from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timezone
from sqlalchemy import or_

from models import (
    db, Task, Comment, TaskMember,
    Invitation, ActivityLog, User, Notification, can_access_task
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

    members = TaskMember.query.filter_by(task_id=task_id).all()
    notify_user_ids = set([m.user_id for m in members])
    notify_user_ids.add(task.user_id)
    notify_user_ids.discard(current_user.id)

    for uid in notify_user_ids:
        db.session.add(Notification(
            user_id=uid,
            message=f"{current_user.username} commented on '{task.title}'",
            type="comment",
            task_id=task_id
        ))

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
    if target and target.id == current_user.id:
        return jsonify({"error": "You cannot invite yourself"}), 400

    # Already an active member?
    if target and TaskMember.query.filter_by(task_id=task_id, user_id=target.id).first():
        return jsonify({"error": f"'{username}' is already a member"}), 400

    # Already a pending invitation?
    existing = Invitation.query.filter(
        Invitation.task_id == task_id,
        Invitation.status == "pending",
        or_(
            Invitation.invitee_id == (target.id if target else None),
            Invitation.invitee_username == username,
        )
    ).first()
    if existing:
        return jsonify({"error": f"'{username}' already has a pending invitation"}), 400

    invitation = Invitation(
        task_id    = task_id,
        inviter_id = current_user.id,
        invitee_id = target.id if target else None,
        invitee_username = username,
        role       = role,
        status     = "pending"
    )
    db.session.add(invitation)

    if target:
        db.session.add(Notification(
            user_id=target.id,
            message=f"You have been assigned to task '{task.title}' by {current_user.username}",
            type="assigned",
            task_id=task_id
        ))

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
        .filter(
            Invitation.status == "pending",
            or_(
                Invitation.invitee_id == current_user.id,
                Invitation.invitee_username == current_user.username,
            )
        )
        .order_by(Invitation.created_at.desc())
        .all()
    )
    return jsonify([inv.to_dict() for inv in invitations]), 200


def generate_overdue_notifications(user):
    now = datetime.now(timezone.utc)
    # Find incomplete tasks that belong to user or where they are a member
    base_filter = [Task.status != "completed", Task.deadline.isnot(None)]
    
    owner_tasks = Task.query.filter(*base_filter, Task.user_id == user.id).all()
    
    member_task_ids = [m.task_id for m in TaskMember.query.filter_by(user_id=user.id).all()]
    if member_task_ids:
        member_tasks = Task.query.filter(*base_filter, Task.id.in_(member_task_ids)).all()
    else:
        member_tasks = []
        
    # Deduplicate by task.id to avoid SQLAlchemy hashing issues
    tasks_to_check = {}
    for t in owner_tasks + member_tasks:
        if t.deadline and t.deadline.strip():
            tasks_to_check[t.id] = t
            
    for task_id, task in tasks_to_check.items():
        try:
            # Replace Z with +00:00 for fromisoformat compatibility
            deadline_str = task.deadline.replace("Z", "+00:00")
            deadline_dt = datetime.fromisoformat(deadline_str)
            if deadline_dt.tzinfo is None:
                deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
            if deadline_dt < now:
                existing = Notification.query.filter_by(
                    user_id=user.id,
                    type="overdue",
                    task_id=task.id
                ).first()
                if not existing:
                    db.session.add(Notification(
                        user_id=user.id,
                        message=f"Task '{task.title}' is overdue!",
                        type="overdue",
                        task_id=task.id
                    ))
        except Exception:
            pass
            
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

# GET /api/notifications/count  — badge count for sidebar
@comments_bp.route("/notifications/count", methods=["GET"])
@login_required
def get_notification_count():
    generate_overdue_notifications(current_user)

    invites_count = Invitation.query.filter(
        Invitation.status == "pending",
        or_(
            Invitation.invitee_id == current_user.id,
            Invitation.invitee_username == current_user.username,
        )
    ).count()

    notifs_count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).count()

    return jsonify({"count": invites_count + notifs_count}), 200


# POST /api/invitations/<id>/accept
@comments_bp.route("/invitations/<int:inv_id>/accept", methods=["POST"])
@login_required
def accept_invitation(inv_id):
    invitation = Invitation.query.filter_by(
        id=inv_id,
        status="pending"
    ).filter(
        or_(
            Invitation.invitee_id == current_user.id,
            Invitation.invitee_username == current_user.username,
        )
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
        status="pending"
    ).filter(
        or_(
            Invitation.invitee_id == current_user.id,
            Invitation.invitee_username == current_user.username,
        )
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


# ═══════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════

@comments_bp.route("/notifications", methods=["GET"])
@login_required
def get_notifications():
    generate_overdue_notifications(current_user)
    
    notifications = (
        Notification.query
        .filter_by(user_id=current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    resp = jsonify([n.to_dict() for n in notifications])
    resp.headers['Cache-Control'] = 'no-store'
    return resp, 200


@comments_bp.route("/notifications/<int:notif_id>/read", methods=["POST"])
@login_required
def read_notification(notif_id):
    notif = Notification.query.filter_by(id=notif_id, user_id=current_user.id).first()
    if not notif:
        return jsonify({"error": "Notification not found"}), 404
        
    notif.is_read = True
    db.session.commit()
    return jsonify({"message": "Marked as read"}), 200


@comments_bp.route("/notifications/read-all", methods=["POST"])
@login_required
def read_all_notifications():
    notifications = Notification.query.filter_by(user_id=current_user.id, is_read=False).all()
    for n in notifications:
        n.is_read = True
    db.session.commit()
    return jsonify({"message": f"Marked {len(notifications)} notifications as read"}), 200