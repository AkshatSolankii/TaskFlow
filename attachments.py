import os
import uuid

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename

from models import ActivityLog, Task, TaskAttachment, TaskMember, db, can_access_task


attachments_bp = Blueprint("attachments", __name__)

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "docx"}
CONTENT_TYPES = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _get_task_or_403(task_id):
    task = Task.query.get(task_id)
    if not task:
        return None, (jsonify({"error": "Task not found"}), 404)
    if current_user.can_manage_all_tasks():
        return task, None
    allowed, _ = can_access_task(current_user, task)
    if not allowed:
        return None, (jsonify({"error": "Forbidden"}), 403)
    return task, None


def _may_upload(task):
    if current_user.can_manage_all_tasks() or task.user_id == current_user.id:
        return True
    membership = TaskMember.query.filter_by(
        task_id=task.id, user_id=current_user.id
    ).first()
    return membership is not None and membership.role == "Editor"


def _upload_folder():
    folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(folder, exist_ok=True)
    return folder


@attachments_bp.route("/tasks/<int:task_id>/attachments", methods=["GET"])
@login_required
def list_attachments(task_id):
    task, error = _get_task_or_403(task_id)
    if error:
        return error
    attachments = TaskAttachment.query.filter_by(task_id=task.id).order_by(
        TaskAttachment.created_at.desc()
    ).all()
    return jsonify([attachment.to_dict() for attachment in attachments]), 200


@attachments_bp.route("/tasks/<int:task_id>/attachments", methods=["POST"])
@login_required
def upload_attachment(task_id):
    task, error = _get_task_or_403(task_id)
    if error:
        return error
    if not _may_upload(task):
        return jsonify({"error": "Only task owners and editors can upload attachments"}), 403

    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Select a file to upload"}), 400

    original_name = secure_filename(uploaded.filename)
    if not original_name or "." not in original_name:
        return jsonify({"error": "Unsupported file type"}), 400
    extension = original_name.rsplit(".", 1)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Supported file types are PDF, PNG, JPG, and DOCX"}), 400

    stored_name = f"{uuid.uuid4().hex}.{extension}"
    destination = os.path.join(_upload_folder(), stored_name)
    uploaded.save(destination)
    size = os.path.getsize(destination)

    attachment = TaskAttachment(
        task_id=task.id,
        user_id=current_user.id,
        original_name=original_name,
        stored_name=stored_name,
        content_type=CONTENT_TYPES[extension],
        size=size,
    )
    db.session.add(attachment)
    db.session.add(ActivityLog(
        action="Uploaded attachment",
        entity_type="Task",
        entity_name=task.title,
        user_id=current_user.id,
    ))
    db.session.commit()
    return jsonify(attachment.to_dict()), 201


@attachments_bp.route("/tasks/<int:task_id>/attachments/<int:attachment_id>/download", methods=["GET"])
@login_required
def download_attachment(task_id, attachment_id):
    task, error = _get_task_or_403(task_id)
    if error:
        return error
    attachment = TaskAttachment.query.filter_by(id=attachment_id, task_id=task.id).first()
    if not attachment:
        return jsonify({"error": "Attachment not found"}), 404
    path = os.path.join(_upload_folder(), attachment.stored_name)
    if not os.path.isfile(path):
        return jsonify({"error": "Attachment file is unavailable"}), 404
    return send_from_directory(
        _upload_folder(), attachment.stored_name,
        as_attachment=True, download_name=attachment.original_name,
        mimetype=attachment.content_type,
    )


@attachments_bp.route("/tasks/<int:task_id>/attachments/<int:attachment_id>", methods=["DELETE"])
@login_required
def delete_attachment(task_id, attachment_id):
    task, error = _get_task_or_403(task_id)
    if error:
        return error
    attachment = TaskAttachment.query.filter_by(id=attachment_id, task_id=task.id).first()
    if not attachment:
        return jsonify({"error": "Attachment not found"}), 404
    if not (
        current_user.can_manage_all_tasks()
        or task.user_id == current_user.id
        or attachment.user_id == current_user.id
    ):
        return jsonify({"error": "Only the uploader or task owner can delete this attachment"}), 403

    path = os.path.join(_upload_folder(), attachment.stored_name)
    db.session.delete(attachment)
    db.session.add(ActivityLog(
        action="Deleted attachment",
        entity_type="Task",
        entity_name=task.title,
        user_id=current_user.id,
    ))
    db.session.commit()
    if os.path.isfile(path):
        os.remove(path)
    return jsonify({"message": "Attachment deleted"}), 200
