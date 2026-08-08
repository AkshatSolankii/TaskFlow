import json
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import db, SavedFilter, ActivityLog

saved_filters_bp = Blueprint("saved_filters", __name__)

ALLOWED_KEYS = {"status", "priority", "category", "search"}


def _clean_filters(raw):
    """Keep only known keys, drop empty values, coerce everything to str."""
    if not isinstance(raw, dict):
        return {}
    cleaned = {}
    for key in ALLOWED_KEYS:
        val = raw.get(key)
        if val:
            cleaned[key] = str(val).strip()
    return cleaned


# POST /api/saved-filters
@saved_filters_bp.route("/saved-filters", methods=["POST"])
@login_required
def create_saved_filter():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    raw_filters = data.get("filters") or {}

    if not name:
        return jsonify({"error": "Filter name is required"}), 400

    cleaned = _clean_filters(raw_filters)
    if not cleaned:
        return jsonify({"error": "At least one filter criterion is required"}), 400

    existing = SavedFilter.query.filter_by(user_id=current_user.id, name=name).first()
    if existing:
        return jsonify({"error": f"A saved filter named '{name}' already exists"}), 400

    saved = SavedFilter(
        user_id = current_user.id,
        name    = name,
        filters = json.dumps(cleaned)
    )
    db.session.add(saved)

    log = ActivityLog(action="Created", entity_type="SavedFilter",
                      entity_name=name, user_id=current_user.id)
    db.session.add(log)
    db.session.commit()

    return jsonify(saved.to_dict()), 201


# GET /api/saved-filters
@saved_filters_bp.route("/saved-filters", methods=["GET"])
@login_required
def list_saved_filters():
    filters = (
        SavedFilter.query
        .filter_by(user_id=current_user.id)
        .order_by(SavedFilter.created_at.asc())
        .all()
    )
    return jsonify([f.to_dict() for f in filters]), 200


# DELETE /api/saved-filters/<id>
@saved_filters_bp.route("/saved-filters/<int:filter_id>", methods=["DELETE"])
@login_required
def delete_saved_filter(filter_id):
    saved = SavedFilter.query.filter_by(id=filter_id, user_id=current_user.id).first()
    if not saved:
        return jsonify({"error": "Saved filter not found"}), 404

    name = saved.name
    db.session.delete(saved)

    log = ActivityLog(action="Deleted", entity_type="SavedFilter",
                      entity_name=name, user_id=current_user.id)
    db.session.add(log)
    db.session.commit()

    return jsonify({"message": "Saved filter deleted"}), 200