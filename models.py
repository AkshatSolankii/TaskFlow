# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)

    # Store as YYYY-MM-DD (string) → works with sorting
    deadline = db.Column(db.String(50), nullable=True)

    priority = db.Column(db.String(20), default="Medium")  # High / Medium / Low
    status = db.Column(db.String(20), default="pending")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    category = db.relationship("Category", backref="tasks")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description or "",
            "deadline": self.deadline or "",
            "priority": self.priority or "Medium",
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "category_id": self.category_id,
            "category": self.category.name if self.category else None
        }

    def __repr__(self):
        return f"<Task {self.title}>"