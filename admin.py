from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import db, User, ActivityLog, VALID_ROLES
from rbac import role_required

admin_bp = Blueprint("admin", __name__)


# GET /api/admin/users — Admin only: list every user + their role
@admin_bp.route("/admin/users", methods=["GET"])
@login_required
@role_required("Admin")
def list_users():
    users = User.query.order_by(User.username.asc()).all()
    return jsonify([u.to_dict() for u in users]), 200


# PATCH /api/admin/users/<id>/role — Admin only: change a user's role
@admin_bp.route("/admin/users/<int:user_id>/role", methods=["PATCH"])
@login_required
@role_required("Admin")
def update_user_role(user_id):
    target = User.query.get(user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    data     = request.get_json() or {}
    new_role = (data.get("role") or "").strip()

    if new_role not in VALID_ROLES:
        return jsonify({"error": f"Role must be one of {', '.join(VALID_ROLES)}"}), 400

    if target.id == current_user.id and new_role != "Admin":
        return jsonify({"error": "You cannot demote yourself"}), 400

    old_role     = target.role
    target.role  = new_role

    log = ActivityLog(
        action      = f"Changed role of '{target.username}' from {old_role} to {new_role}",
        entity_type = "User",
        entity_name = target.username,
        user_id     = current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({"message": "Role updated", "user": target.to_dict()}), 200


# ================= AUDIT LOG =================

# Maps a friendly category name to the actual (entity_type, action-prefix) rule
# used to filter ActivityLog rows. Kept in one place so the endpoint and any
# future export/report feature can reuse the exact same definitions.
AUDIT_CATEGORIES = {
    "login":      lambda q: q.filter(ActivityLog.entity_type == "Auth"),
    "task_created": lambda q: q.filter(
        ActivityLog.entity_type == "Task",
        ActivityLog.action == "Created"
    ),
    "task_deleted": lambda q: q.filter(
        ActivityLog.entity_type == "Task",
        ActivityLog.action.like("%Deleted%")   # covers "Deleted" + "Bulk deleted N task(s)"
    ),
    "permission": lambda q: q.filter(ActivityLog.entity_type == "User"),
}


# GET /api/admin/audit-log — Admin only: full audit trail, filterable
@admin_bp.route("/admin/audit-log", methods=["GET"])
@login_required
@role_required("Admin")
def get_audit_log():
    page     = request.args.get("page",     1,  type=int)
    limit    = request.args.get("limit",    50, type=int)
    category = request.args.get("category", "", type=str).strip()
    username = request.args.get("username", "", type=str).strip()

    query = ActivityLog.query.order_by(ActivityLog.timestamp.desc())

    if category and category in AUDIT_CATEGORIES:
        query = AUDIT_CATEGORIES[category](query)

    if username:
        query = query.join(User, ActivityLog.user_id == User.id).filter(
            User.username.ilike(f"%{username}%")
        )

    pagination = query.paginate(page=page, per_page=limit, error_out=False)

    return jsonify({
        "logs": [{
            "id":          log.id,
            "action":      log.action,
            "entity_type": log.entity_type,
            "entity_name": log.entity_name,
            "username":    log.user.username if log.user else "Unknown",
            "timestamp":   log.timestamp.strftime("%d %b %Y, %I:%M %p")
        } for log in pagination.items],
        "page":        pagination.page,
        "total_pages": pagination.pages,
        "total_logs":  pagination.total,
        "categories":  list(AUDIT_CATEGORIES.keys())
    }), 200