from functools import wraps
from flask import jsonify
from flask_login import current_user

def role_required(*allowed_roles):
    """
    Restricts a route to specific RBAC roles.
    Usage: @role_required("Admin")
           @role_required("Admin", "Manager")
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({"error": "Unauthorized"}), 401
            if current_user.role not in allowed_roles:
                return jsonify({"error": "Forbidden — insufficient role"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator