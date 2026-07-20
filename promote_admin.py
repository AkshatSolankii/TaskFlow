"""
One-time CLI script to promote a user to Admin.

Use this to bootstrap your very first Admin account (since every
user registers as "User" by default, and only an Admin can promote
others via the /api/admin/users/<id>/role endpoint).

Usage:
    python promote_admin.py <username_or_email>

Example:
    python promote_admin.py akshat
    python promote_admin.py akshat@example.com
"""

import sys

from app import app
from models import db, User, VALID_ROLES


def promote_to_admin(identifier: str) -> None:
    with app.app_context():
        user = (
            User.query.filter_by(username=identifier).first()
            or User.query.filter_by(email=identifier).first()
        )

        if not user:
            print(f"No user found matching '{identifier}'.")
            sys.exit(1)

        if user.role == "Admin":
            print(f"'{user.username}' is already an Admin. Nothing to do.")
            return

        old_role = user.role
        user.role = "Admin"
        db.session.commit()

        print(f"Success: '{user.username}' promoted from {old_role} -> Admin.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python promote_admin.py <username_or_email>")
        sys.exit(1)

    promote_to_admin(sys.argv[1].strip())