from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime

from models import (
    db, Task, Comment, TaskMember,
    Invitation, ActivityLog, User, can_access_task
)

comments_bp = Blueprint("comments", __name__)


# ─────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────
def _get_task_or_403(task_id):
    task = Task.query.get(task_id)
    if not task:
        return None, (jsonify({"error": "Task not found"}), 404)
    allowed, _ = can_access_task(current_user, task)
    if not allowed:
        return None, (jsonify({"error": "Forbidden"}), 403)
    return task, None


# ═══════════════════════════════════════════════
# COMMENTS
# ═══════════════════════════════════════════════

@comments_bp.route("/tasks/<int:task_id>/comments", methods=["GET"])
@login_required
def get_comments(task_id):
    task, err = _get_task_or_403(task_id)
    if err:
        return err

    comments = (
        Comment.query
        .filter_by(task_id=task_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return jsonify([c.to_dict() for c in comments]), 200


@comments_bp.route("/tasks/<int:task_id>/comments", methods=["POST"])
@login_required
def post_comment(task_id):
    task, err = _get_task_or_403(task_id)
    if err:
        return err

    data    = request.get_json()
    content = (data.get("content") or "").strip()

    if not content:
        return jsonify({"error": "Comment cannot be empty"}), 400
    if len(content) > 2000:
        return jsonify({"error": "Comment too long (max 2000 chars)"}), 400

    comment = Comment(task_id=task_id, user_id=current_user.id, content=content)
    db.session.add(comment)

    log = ActivityLog(action="Commented", entity_type="Task",
                      entity_name=task.title, user_id=current_user.id)
    db.session.add(log)
    db.session.commit()

    return jsonify(comment.to_dict()), 201


@comments_bp.route("/tasks/<int:task_id>/comments/<int:comment_id>", methods=["DELETE"])
@login_required
def delete_comment(task_id, comment_id):
    task, err = _get_task_or_403(task_id)
    if err:
        return err

    comment = Comment.query.filter_by(id=comment_id, task_id=task_id).first()
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    if comment.user_id != current_user.id and task.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Comment deleted"}), 200


# ═══════════════════════════════════════════════
# MEMBERS
# ═══════════════════════════════════════════════

@comments_bp.route("/tasks/<int:task_id>/members", methods=["GET"])
@login_required
def get_members(task_id):
    task, err = _get_task_or_403(task_id)
    if err:
        return err

    owner   = User.query.get(task.user_id)
    members = TaskMember.query.filter_by(task_id=task_id).all()

    result = [{
        "id": None, "user_id": owner.id,
        "username": owner.username, "role": "Owner", "created_at": None
    }]
    result += [m.to_dict() for m in members]
    return jsonify(result), 200


@comments_bp.route("/tasks/<int:task_id>/members/<int:member_id>", methods=["DELETE"])
@login_required
def remove_member(task_id, member_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if task.user_id != current_user.id:
        return jsonify({"error": "Only the task owner can remove members"}), 403

    member = TaskMember.query.filter_by(id=member_id, task_id=task_id).first()
    if not member:
        return jsonify({"error": "Member not found"}), 404

    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "Member removed"}), 200


# ═══════════════════════════════════════════════
# INVITATIONS
# ═══════════════════════════════════════════════

# POST /api/tasks/<id>/invite
# Owner sends an invitation — creates a pending Invitation record
@comments_bp.route("/tasks/<int:task_id>/invite", methods=["POST"])
@login_required
def send_invitation(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if task.user_id != current_user.id:
        return jsonify({"error": "Only the task owner can invite members"}), 403

    data     = request.get_json()
    username = (data.get("username") or "").strip()
    role     = (data.get("role") or "Viewer").strip()

    if not username:
        return jsonify({"error": "Username is required"}), 400
    if role not in ("Editor", "Viewer"):
        return jsonify({"error": "Role must be Editor or Viewer"}), 400

    target = User.query.filter_by(username=username).first()
    if not target:
        return jsonify({"error": f"User '{username}' not found"}), 404
    if target.id == current_user.id:
        return jsonify({"error": "You cannot invite yourself"}), 400

    # Already an active member?
    if TaskMember.query.filter_by(task_id=task_id, user_id=target.id).first():
        return jsonify({"error": f"'{username}' is already a member"}), 400

    # Already a pending invitation?
    existing = Invitation.query.filter_by(
        task_id=task_id,
        invitee_id=target.id,
        status="pending"
    ).first()
    if existing:
        return jsonify({"error": f"'{username}' already has a pending invitation"}), 400

    invitation = Invitation(
        task_id    = task_id,
        inviter_id = current_user.id,
        invitee_id = target.id,
        role       = role,
        status     = "pending"
    )
    db.session.add(invitation)

    log = ActivityLog(
        action      = f"Invited {username} as {role}",
        entity_type = "Task",
        entity_name = task.title,
        user_id     = current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "message": f"Invitation sent to {username}",
        "invitation": invitation.to_dict()
    }), 201


# GET /api/invitations  — current user's pending invitations
@comments_bp.route("/invitations", methods=["GET"])
@login_required
def get_my_invitations():
    invitations = (
        Invitation.query
        .filter_by(invitee_id=current_user.id, status="pending")
        .order_by(Invitation.created_at.desc())
        .all()
    )
    return jsonify([inv.to_dict() for inv in invitations]), 200


# GET /api/invitations/count  — badge count for sidebar
@comments_bp.route("/invitations/count", methods=["GET"])
@login_required
def get_invitation_count():
    count = Invitation.query.filter_by(
        invitee_id=current_user.id,
        status="pending"
    ).count()
    return jsonify({"count": count}), 200


# POST /api/invitations/<id>/accept
@comments_bp.route("/invitations/<int:inv_id>/accept", methods=["POST"])
@login_required
def accept_invitation(inv_id):
    invitation = Invitation.query.filter_by(
        id=inv_id,
        invitee_id=current_user.id,
        status="pending"
    ).first()

    if not invitation:
        return jsonify({"error": "Invitation not found"}), 404

    # Create the TaskMember record
    member = TaskMember(
        task_id = invitation.task_id,
        user_id = current_user.id,
        role    = invitation.role
    )
    db.session.add(member)

    # Mark invitation accepted
    invitation.status       = "accepted"
    invitation.responded_at = datetime.utcnow()

    log = ActivityLog(
        action      = f"Accepted invitation as {invitation.role}",
        entity_type = "Task",
        entity_name = invitation.task.title,
        user_id     = current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "message":  "Invitation accepted",
        "task_id":  invitation.task_id,
        "task_title": invitation.task.title
    }), 200


# POST /api/invitations/<id>/reject
@comments_bp.route("/invitations/<int:inv_id>/reject", methods=["POST"])
@login_required
def reject_invitation(inv_id):
    invitation = Invitation.query.filter_by(
        id=inv_id,
        invitee_id=current_user.id,
        status="pending"
    ).first()

    if not invitation:
        return jsonify({"error": "Invitation not found"}), 404

    invitation.status       = "rejected"
    invitation.responded_at = datetime.utcnow()

    log = ActivityLog(
        action      = "Rejected invitation",
        entity_type = "Task",
        entity_name = invitation.task.title,
        user_id     = current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({"message": "Invitation rejected"}), 200


# GET /api/tasks/<id>/invitations  — owner sees pending + rejected invites
# NOTE: accepted invitations are intentionally excluded here — once accepted,
# that user already shows up in the Members list, so listing them again in
# "Sent Invitations" would just be clutter/duplication.
@comments_bp.route("/tasks/<int:task_id>/invitations", methods=["GET"])
@login_required
def get_task_invitations(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if task.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    invitations = (
        Invitation.query
        .filter(
            Invitation.task_id == task_id,
            Invitation.status != "accepted"
        )
        .order_by(Invitation.created_at.desc())
        .all()
    )
    return jsonify([inv.to_dict() for inv in invitations]), 200