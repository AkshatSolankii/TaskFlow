"""
One-time migration: add the `role` column to an EXISTING users table
without losing data. Safe to re-run.

Usage:
    python add_role_column.py
"""
from app import app
from models import db
from sqlalchemy import text, inspect

with app.app_context():
    inspector = inspect(db.engine)
    columns = [c["name"] for c in inspector.get_columns("users")]

    if "role" in columns:
        print("✓ 'role' column already exists — nothing to do.")
    else:
        db.session.execute(text(
            "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'User'"
        ))
        db.session.commit()
        print("✓ Added 'role' column to users table (all existing users default to 'User').")