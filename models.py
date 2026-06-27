from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

# NEW
from extensions import login_manager

db = SQLAlchemy()


# ================= USER =================
class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(
        db.String(100),
        unique=True,
        nullable=False
    )

    # NEW
    email = db.Column(
        db.String(150),
        unique=True,
        nullable=False
    )

    password = db.Column(
        db.String(200),
        nullable=False
    )

    # Relationships
    tasks = db.relationship(
        "Task",
        backref="user",
        lazy=True
    )

    categories = db.relationship(
        "Category",
        backref="user",
        lazy=True
    )

    def __repr__(self):
        return f"<User {self.username}>"


# ================= CATEGORY =================
class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(100),
        nullable=False
    )

    # 🔐 USER LINK
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    def __repr__(self):
        return f"<Category {self.name}>"


# ================= TASK =================
class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(
        db.String(200),
        nullable=False
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    # KEEPING STRING (YOUR EXISTING LOGIC)
    deadline = db.Column(
        db.String(50),
        nullable=True
    )

    priority = db.Column(
        db.String(20),
        default="Medium"
    )

    status = db.Column(
        db.String(20),
        default="pending"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # 🔗 RELATIONS
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id"),
        nullable=True
    )

    category = db.relationship(
        "Category",
        backref="tasks"
    )

    # 🔄 KEEP YOUR EXISTING FUNCTION
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
    
# ================= ACTIVITY LOG =================
class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id = db.Column(db.Integer, primary_key=True)

    action = db.Column(
        db.String(50),
        nullable=False
    )

    entity_type = db.Column(
        db.String(50),
        nullable=False
    )

    entity_name = db.Column(
        db.String(200),
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    timestamp = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    user = db.relationship(
        "User",
        backref="activity_logs"
    )

    def __repr__(self):
        return f"<ActivityLog {self.action} {self.entity_type}>"


# ================= LOGIN MANAGER =================
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))