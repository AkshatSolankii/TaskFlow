from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime

from models import (
    db, Task, TaskTemplate, TaskTemplateItem,
    TaskChecklistItem, ActivityLog, can_access_task
)

templates_bp = Blueprint("templates", __name__)


# ═══════════════════════════════════════════════
# HELPER
# ═══════════════════════════════════════════════
def _get_template_or_404_403(template_id):
    template = TaskTemplate.query.get(template_id)
    if not template:
        return None, (jsonify({"error": "Template not found"}), 404)
    if template.user_id != current_user.id:
        return None, (jsonify({"error": "Forbidden"}), 403)
    return template, None


# ═══════════════════════════════════════════════
# TEMPLATE CRUD
# ═══════════════════════════════════════════════

# POST /api/task-templates
@templates_bp.route("/task-templates", methods=["POST"])
@login_required
def create_template():
    data  = request.get_json() or {}
    name  = (data.get("name") or "").strip()
    items = data.get("items") or []

    if not name:
        return jsonify({"error": "Template name is required"}), 400
    if not isinstance(items, list) or not items:
        return jsonify({"error": "At least one checklist item is required"}), 400

    clean_items = [str(i).strip() for i in items if str(i).strip()]
    if not clean_items:
        return jsonify({"error": "At least one non-empty checklist item is required"}), 400

    template = TaskTemplate(name=name, user_id=current_user.id)
    db.session.add(template)
    db.session.flush()  # get template.id before adding items

    for pos, text in enumerate(clean_items):
        db.session.add(TaskTemplateItem(template_id=template.id, text=text, position=pos))

    log = ActivityLog(action="Created", entity_type="Template",
                      entity_name=name, user_id=current_user.id)
    db.session.add(log)
    db.session.commit()

    return jsonify(template.to_dict()), 201


# GET /api/task-templates  — list current user's templates
@templates_bp.route("/task-templates", methods=["GET"])
@login_required
def list_templates():
    templates = (
        TaskTemplate.query
        .filter_by(user_id=current_user.id)
        .order_by(TaskTemplate.created_at.desc())
        .all()
    )
    return jsonify([t.to_dict() for t in templates]), 200


# GET /api/task-templates/<id>
@templates_bp.route("/task-templates/<int:template_id>", methods=["GET"])
@login_required
def get_template(template_id):
    template, err = _get_template_or_404_403(template_id)
    if err:
        return err
    return jsonify(template.to_dict()), 200


# PATCH /api/task-templates/<id>  — replace name + items wholesale
@templates_bp.route("/task-templates/<int:template_id>", methods=["PATCH"])
@login_required
def update_template(template_id):
    template, err = _get_template_or_404_403(template_id)
    if err:
        return err

    data = request.get_json() or {}

    if "name" in data:
        new_name = (data.get("name") or "").strip()
        if not new_name:
            return jsonify({"error": "Template name cannot be empty"}), 400
        template.name = new_name

    if "items" in data:
        items = data.get("items") or []
        clean_items = [str(i).strip() for i in items if str(i).strip()]
        if not clean_items:
            return jsonify({"error": "At least one non-empty checklist item is required"}), 400

        # Replace items wholesale — simplest correct approach for a small list
        TaskTemplateItem.query.filter_by(template_id=template.id).delete()
        for pos, text in enumerate(clean_items):
            db.session.add(TaskTemplateItem(template_id=template.id, text=text, position=pos))

    db.session.commit()
    return jsonify(template.to_dict()), 200


# DELETE /api/task-templates/<id>
@templates_bp.route("/task-templates/<int:template_id>", methods=["DELETE"])
@login_required
def delete_template(template_id):
    template, err = _get_template_or_404_403(template_id)
    if err:
        return err

    name = template.name
    db.session.delete(template)

    log = ActivityLog(action="Deleted", entity_type="Template",
                      entity_name=name, user_id=current_user.id)
    db.session.add(log)
    db.session.commit()

    return jsonify({"message": "Template deleted"}), 200


# ═══════════════════════════════════════════════
# CREATE A TASK FROM A TEMPLATE
# ═══════════════════════════════════════════════

# POST /api/task-templates/<id>/use
@templates_bp.route("/task-templates/<int:template_id>/use", methods=["POST"])
@login_required
def use_template(template_id):
    template, err = _get_template_or_404_403(template_id)
    if err:
        return err

    data = request.get_json() or {}

    task = Task(
        title       = (data.get("title") or template.name).strip(),
        description = data.get("description", ""),
        deadline    = data.get("deadline"),
        priority    = data.get("priority", "Medium"),
        status      = "pending",
        user_id     = current_user.id,
        category_id = data.get("category_id")
    )
    db.session.add(task)
    db.session.flush()  # get task.id

    for item in template.items:
        db.session.add(TaskChecklistItem(
            task_id  = task.id,
            text     = item.text,
            position = item.position
        ))

    log = ActivityLog(
        action      = f"Created from template '{template.name}'",
        entity_type = "Task",
        entity_name = task.title,
        user_id     = current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "message": "Task created from template",
        "task":    task.to_dict()
    }), 201


# ═══════════════════════════════════════════════
# CHECKLIST ITEMS ON A TASK
# ═══════════════════════════════════════════════

# GET /api/tasks/<id>/checklist
@templates_bp.route("/tasks/<int:task_id>/checklist", methods=["GET"])
@login_required
def get_checklist(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    allowed, _ = can_access_task(current_user, task)
    if not allowed:
        return jsonify({"error": "Forbidden"}), 403

    items = (
        TaskChecklistItem.query
        .filter_by(task_id=task_id)
        .order_by(TaskChecklistItem.position.asc())
        .all()
    )
    return jsonify([i.to_dict() for i in items]), 200


# PATCH /api/tasks/<id>/checklist/<item_id>  — toggle done, owner/editor only
@templates_bp.route("/tasks/<int:task_id>/checklist/<int:item_id>", methods=["PATCH"])
@login_required
def toggle_checklist_item(task_id, item_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    allowed, role = can_access_task(current_user, task)
    if not allowed:
        return jsonify({"error": "Forbidden"}), 403
    if role == "Viewer":
        return jsonify({"error": "Viewers cannot modify the checklist"}), 403

    item = TaskChecklistItem.query.filter_by(id=item_id, task_id=task_id).first()
    if not item:
        return jsonify({"error": "Checklist item not found"}), 404

    data = request.get_json() or {}
    if "is_done" in data:
        item.is_done = bool(data["is_done"])

    db.session.commit()
    return jsonify(item.to_dict()), 200