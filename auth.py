from flask import Blueprint, request, jsonify
from flask_login import (
    login_user,
    logout_user,
    login_required
)

from extensions import bcrypt
from models import db, User


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
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    # VALIDATION
    if not username or not email or not password:
        return jsonify({
            "error": "All fields are required"
        }), 400

    # CHECK USERNAME
    existing_username = User.query.filter_by(
        username=username
    ).first()

    if existing_username:
        return jsonify({
            "error": "Username already exists"
        }), 400

    # CHECK EMAIL
    existing_email = User.query.filter_by(
        email=email
    ).first()

    if existing_email:
        return jsonify({
            "error": "Email already exists"
        }), 400

    # HASH PASSWORD
    hashed_password = bcrypt.generate_password_hash(
        password
    ).decode("utf-8")

    # CREATE USER
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

    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    # FIND USER
    user = User.query.filter_by(
        email=email
    ).first()

    if not user:
        return jsonify({
            "error": "Invalid email or password"
        }), 401

    # CHECK PASSWORD
    valid_password = bcrypt.check_password_hash(
        user.password,
        password
    )

    if not valid_password:
        return jsonify({
            "error": "Invalid email or password"
        }), 401

    # LOGIN USER
    login_user(user)

    return jsonify({
        "message": "Login successful",
        "redirect": "/"
    }), 200


# ================= LOGOUT =================
@auth_bp.route("/logout", methods=["GET"])
@login_required
def logout():

    logout_user()

    return jsonify({
        "message": "Logout successful",
        "redirect": "/login"
    }), 200