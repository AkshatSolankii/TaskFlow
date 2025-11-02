from flask_sqlalchemy import SQLAlchemy
from datetime import datetime


db = SQLAlchemy()

class Task(db.Model):
    __tablename__ = 'tasks'  

    id = db.Column(db.Integer, primary_key=True)              
    title = db.Column(db.String(120), nullable=False)        
    description = db.Column(db.Text, nullable=True)          
    status = db.Column(db.String(20), default="pending")      
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  
    def __repr__(self):
        return f"<Task {self.title}>"

    def to_dict(self):
        """Return task details in dictionary form (useful for JSON response)."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat()
        }
