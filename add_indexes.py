"""
One-time script to add indexes to an EXISTING tasks.db without
losing data. Run this once after pulling the indexed models.py.
Safe to re-run — uses IF NOT EXISTS everywhere.

Usage:
    python add_indexes.py
"""
from app import app
from models import db
from sqlalchemy import text

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_users_username ON users (username)",
    "CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)",

    "CREATE INDEX IF NOT EXISTS ix_categories_user_id ON categories (user_id)",

    "CREATE INDEX IF NOT EXISTS ix_tasks_user_id ON tasks (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_tasks_status ON tasks (status)",
    "CREATE INDEX IF NOT EXISTS ix_tasks_category_id ON tasks (category_id)",

    "CREATE INDEX IF NOT EXISTS ix_task_members_task_id ON task_members (task_id)",
    "CREATE INDEX IF NOT EXISTS ix_task_members_user_id ON task_members (user_id)",

    "CREATE INDEX IF NOT EXISTS ix_invitations_task_id ON invitations (task_id)",
    "CREATE INDEX IF NOT EXISTS ix_invitations_inviter_id ON invitations (inviter_id)",
    "CREATE INDEX IF NOT EXISTS ix_invitations_invitee_id ON invitations (invitee_id)",
    "CREATE INDEX IF NOT EXISTS ix_invitations_status ON invitations (status)",

    "CREATE INDEX IF NOT EXISTS ix_comments_task_id ON comments (task_id)",
    "CREATE INDEX IF NOT EXISTS ix_comments_user_id ON comments (user_id)",

    "CREATE INDEX IF NOT EXISTS ix_task_templates_user_id ON task_templates (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_task_template_items_template_id ON task_template_items (template_id)",
    "CREATE INDEX IF NOT EXISTS ix_task_checklist_items_task_id ON task_checklist_items (task_id)",

    "CREATE INDEX IF NOT EXISTS ix_saved_filters_user_id ON saved_filters (user_id)",

    "CREATE INDEX IF NOT EXISTS ix_activity_logs_user_id ON activity_logs (user_id)",
]

with app.app_context():
    for stmt in INDEX_STATEMENTS:
        db.session.execute(text(stmt))
    db.session.commit()
    print(f"✓ Applied {len(INDEX_STATEMENTS)} indexes to {db.engine.url}")