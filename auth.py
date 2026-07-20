from flask import Blueprint, request, jsonify
from flask_login import (
    login_user,
    logout_user,
    login_required,
    current_user
)

from extensions import bcrypt
from models import db, User, ActivityLog


auth_bp = Blueprint("auth", __name__)


# ================= REGISTER =================
@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "No data provided"
        }), 400

    username = data.get("username", "").strip()
    email    = data.get("email",    "").strip()
    password = data.get("password", "").strip()

    if not username or not email or not password:
        return jsonify({
            "error": "All fields are required"
        }), 400

    if User.query.filter_by(username=username).first():
        return jsonify({
            "error": "Username already exists"
        }), 400

    if User.query.filter_by(email=email).first():
        return jsonify({
            "error": "Email already exists"
        }), 400

    hashed_password = bcrypt.generate_password_hash(
        password
    ).decode("utf-8")

    new_user = User(
        username=username,
        email=email,
        password=hashed_password
    )

    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        "message": "Registration successful"
    }), 201


# ================= LOGIN =================
@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "No data provided"
        }), 400

    email    = data.get("email",    "").strip()
    password = data.get("password", "").strip()

    user = User.query.filter_by(email=email).first()

    if not user or not bcrypt.check_password_hash(user.password, password):
        # AUDIT: only log the failed attempt if we found a real account —
        # we can't attach an ActivityLog row to a user_id that doesn't exist,
        # and there's no value in recording attempts against unknown emails.
        if user:
            db.session.add(ActivityLog(
                action      = f"Failed login attempt (IP: {request.remote_addr})",
                entity_type = "Auth",
                entity_name = user.username,
                user_id     = user.id
            ))
            db.session.commit()

        return jsonify({
            "error": "Invalid email or password"
        }), 401

    login_user(user)

    # AUDIT: successful login
    db.session.add(ActivityLog(
        action      = f"Logged in (IP: {request.remote_addr})",
        entity_type = "Auth",
        entity_name = user.username,
        user_id     = user.id
    ))
    db.session.commit()

    # ── Respect the 'next' param so the user lands back on the
    #    page they were trying to visit (e.g. /tasks/5)
    next_page = data.get("next", "").strip()

    # Safety check — only allow local paths, never external URLs
    if not next_page or not next_page.startswith("/"):
        next_page = "/"

    return jsonify({
        "message":  "Login successful",
        "redirect": next_page
    }), 200


# ================= LOGOUT =================
@auth_bp.route("/logout", methods=["GET"])
@login_required
def logout():

    # AUDIT: log logout before the session is cleared, since
    # current_user is only valid until logout_user() runs.
    db.session.add(ActivityLog(
        action      = "Logged out",
        entity_type = "Auth",
        entity_name = current_user.username,
        user_id     = current_user.id
    ))
    db.session.commit()

    logout_user()

    return jsonify({
        "message":  "Logout successful",
        "redirect": "/login"
    }), 200