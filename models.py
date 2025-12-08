# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Task(db.Model):
    __tablename__ = "tasks"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    deadline = db.Column(db.String(50), nullable=True)   # store as YYYY-MM-DD string for simplicity
    priority = db.Column(db.String(20), default="Medium")
    status = db.Column(db.String(20), default="pending")  # "pending" or "completed"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description or "",
            "deadline": self.deadline or "",
            "priority": self.priority or "Medium",
            "status": self.status,
            "created_at": self.created_at.isoformat()
        }

    def __repr__(self):
        return f"<Task {self.title}>"