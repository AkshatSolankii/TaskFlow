from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from extensions import login_manager

db = SQLAlchemy()

VALID_ROLES = ("Admin", "Manager", "User")


# ================= USER =================
class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    email    = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password = db.Column(db.String(200), nullable=False)
    role     = db.Column(db.String(20), nullable=False, default="User", index=True)  # ← NEW: Admin | Manager | User

    tasks      = db.relationship("Task",     backref="user", lazy=True)
    categories = db.relationship("Category", backref="user", lazy=True)

    def is_admin(self):
        return self.role == "Admin"

    def is_manager(self):
        return self.role == "Manager"

    def can_manage_all_tasks(self):
        """Admin and Manager can act on any task/category, not just their own."""
        return self.role in ("Admin", "Manager")

    def to_dict(self):
        return {
            "id":       self.id,
            "username": self.username,
            "email":    self.email,
            "role":     self.role
        }

    def __repr__(self):
        return f"<User {self.username} role={self.role}>"


# ================= CATEGORY =================
class Category(db.Model):
    __tablename__ = "categories"

    id      = db.Column(db.Integer, primary_key=True)
    name    = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    def __repr__(self):
        return f"<Category {self.name}>"


# ================= TASK =================
class Task(db.Model):
    __tablename__ = "tasks"

    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    deadline    = db.Column(db.String(50), nullable=True)
    priority    = db.Column(db.String(20), default="Medium")
    status      = db.Column(db.String(20), default="pending", index=True)
    created_at  = db.Column(db.DateTime,  default=datetime.utcnow)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True, index=True)

    category    = db.relationship("Category", backref="tasks")
    members     = db.relationship("TaskMember",  backref="task", lazy=True,
                                  cascade="all, delete-orphan")
    comments    = db.relationship("Comment",     backref="task", lazy=True,
                                  cascade="all, delete-orphan",
                                  order_by="Comment.created_at.asc()")
    invitations = db.relationship("Invitation",  backref="task", lazy=True,
                                  cascade="all, delete-orphan")
    checklist_items = db.relationship("TaskChecklistItem", backref="task", lazy=True,
                                  cascade="all, delete-orphan",
                                  order_by="TaskChecklistItem.position.asc()")

    def to_dict(self):
        return {
            "id":          self.id,
            "title":       self.title,
            "description": self.description or "",
            "deadline":    self.deadline    or "",
            "priority":    self.priority    or "Medium",
            "status":      self.status,
            "created_at":  self.created_at.isoformat(),
            "category_id": self.category_id,
            "category":    self.category.name if self.category else None,
            "owner_username": self.user.username if self.user else None
        }

    def __repr__(self):
        return f"<Task {self.title}>"


# ================= TASK MEMBER =================
class TaskMember(db.Model):
    """Users who have accepted an invitation. Roles: Editor | Viewer"""
    __tablename__ = "task_members"

    id         = db.Column(db.Integer, primary_key=True)
    task_id    = db.Column(db.Integer, db.ForeignKey("tasks.id"),  nullable=False, index=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"),  nullable=False, index=True)
    role       = db.Column(db.String(20), nullable=False, default="Viewer")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="task_memberships")

    def to_dict(self):
        return {
            "id":         self.id,
            "task_id":    self.task_id,
            "user_id":    self.user_id,
            "username":   self.user.username,
            "role":       self.role,
            "created_at": self.created_at.isoformat()
        }

    def __repr__(self):
        return f"<TaskMember task={self.task_id} user={self.user_id} role={self.role}>"


# ================= INVITATION =================
class Invitation(db.Model):
    """
    Pending/accepted/rejected invitations.
    status: pending | accepted | rejected
    """
    __tablename__ = "invitations"

    id           = db.Column(db.Integer, primary_key=True)
    task_id      = db.Column(db.Integer, db.ForeignKey("tasks.id"),  nullable=False, index=True)
    inviter_id   = db.Column(db.Integer, db.ForeignKey("users.id"),  nullable=False, index=True)
    invitee_id   = db.Column(db.Integer, db.ForeignKey("users.id"),  nullable=True, index=True)
    invitee_username = db.Column(db.String(100), nullable=False, index=True)
    role         = db.Column(db.String(20), nullable=False, default="Viewer")
    status       = db.Column(db.String(20), nullable=False, default="pending", index=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    responded_at = db.Column(db.DateTime, nullable=True)

    inviter = db.relationship("User", foreign_keys=[inviter_id],
                              backref="sent_invitations")
    invitee = db.relationship("User", foreign_keys=[invitee_id],
                              backref="received_invitations")

    def to_dict(self):
        return {
            "id":               self.id,
            "task_id":          self.task_id,
            "task_title":       self.task.title if self.task else "",
            "inviter_id":       self.inviter_id,
            "inviter_username": self.inviter.username if self.inviter else "",
            "invitee_id":       self.invitee_id,
            "invitee_username": self.invitee.username if self.invitee else self.invitee_username,
            "role":             self.role,
            "status":           self.status,
            "created_at":       self.created_at.strftime("%d %b %Y, %I:%M %p"),
            "responded_at":     (self.responded_at.strftime("%d %b %Y, %I:%M %p")
                                 if self.responded_at else None)
        }

    def __repr__(self):
        return f"<Invitation task={self.task_id} to={self.invitee_id} status={self.status}>"


# ================= COMMENT =================
class Comment(db.Model):
    __tablename__ = "comments"

    id         = db.Column(db.Integer, primary_key=True)
    task_id    = db.Column(db.Integer, db.ForeignKey("tasks.id"),  nullable=False, index=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"),  nullable=False, index=True)
    content    = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    author = db.relationship("User", backref="comments")

    def to_dict(self):
        return {
            "id":         self.id,
            "task_id":    self.task_id,
            "user_id":    self.user_id,
            "username":   self.author.username,
            "avatar":     self.author.username[0].upper(),
            "content":    self.content,
            "created_at": self.created_at.strftime("%d %b %Y, %I:%M %p")
        }

    def __repr__(self):
        return f"<Comment task={self.task_id} by={self.user_id}>"


# ================= TASK TEMPLATE =================
class TaskTemplate(db.Model):
    """A reusable checklist template, owned by one user."""
    __tablename__ = "task_templates"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(150), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    owner = db.relationship("User", backref="task_templates")
    items = db.relationship("TaskTemplateItem", backref="template", lazy=True,
                            cascade="all, delete-orphan",
                            order_by="TaskTemplateItem.position.asc()")

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "created_at": self.created_at.strftime("%d %b %Y, %I:%M %p"),
            "items":      [i.to_dict() for i in self.items],
            "item_count": len(self.items)
        }

    def __repr__(self):
        return f"<TaskTemplate {self.name}>"


class TaskTemplateItem(db.Model):
    """A single checklist line inside a template (e.g. 'Attend standup')."""
    __tablename__ = "task_template_items"

    id          = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey("task_templates.id"), nullable=False, index=True)
    text        = db.Column(db.String(255), nullable=False)
    position    = db.Column(db.Integer, nullable=False, default=0)

    def to_dict(self):
        return {"id": self.id, "text": self.text, "position": self.position}

    def __repr__(self):
        return f"<TaskTemplateItem {self.text}>"


# ================= TASK CHECKLIST ITEM =================
class TaskChecklistItem(db.Model):
    """
    Checklist items that live on a real Task. Normally created in bulk
    when a task is created from a TaskTemplate, but the model itself
    doesn't care where they came from.
    """
    __tablename__ = "task_checklist_items"

    id         = db.Column(db.Integer, primary_key=True)
    task_id    = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False, index=True)
    text       = db.Column(db.String(255), nullable=False)
    is_done    = db.Column(db.Boolean, default=False)
    position   = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":       self.id,
            "task_id":  self.task_id,
            "text":     self.text,
            "is_done":  self.is_done,
            "position": self.position
        }

    def __repr__(self):
        return f"<TaskChecklistItem {self.text} done={self.is_done}>"


# ================= SAVED FILTER =================
class SavedFilter(db.Model):
    """
    A user's saved combination of table filters, e.g. "My Overdue Tasks".
    `filters` is stored as JSON text: {status, priority, category, search}.
    """
    __tablename__ = "saved_filters"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name       = db.Column(db.String(100), nullable=False)
    filters    = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    owner = db.relationship("User", backref="saved_filters")

    def to_dict(self):
        import json
        try:
            parsed = json.loads(self.filters)
        except (ValueError, TypeError):
            parsed = {}
        return {
            "id":         self.id,
            "name":       self.name,
            "filters":    parsed,
            "created_at": self.created_at.strftime("%d %b %Y, %I:%M %p")
        }

    def __repr__(self):
        return f"<SavedFilter {self.name}>"


# ================= ACTIVITY LOG =================
class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id          = db.Column(db.Integer, primary_key=True)
    action      = db.Column(db.String(50),  nullable=False)
    entity_type = db.Column(db.String(50),  nullable=False)
    entity_name = db.Column(db.String(200), nullable=False)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    timestamp   = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="activity_logs")

    def __repr__(self):
        return f"<ActivityLog {self.action} {self.entity_type}>"


# ================= ACCESS CONTROL HELPER (per-task collaborators) =================
def can_access_task(user, task):
    """
    Task-level access via TaskMember (Owner/Editor/Viewer on THIS task).
    This is separate from RBAC — Admin/Manager access is checked
    separately via user.can_manage_all_tasks() at the route level.

    Returns (allowed: bool, role: str | None)
    """
    if task.user_id == user.id:
        return True, "Owner"

    member = TaskMember.query.filter_by(
        task_id=task.id,
        user_id=user.id
    ).first()

    if member:
        return True, member.role

    return False, None


# ================= LOGIN MANAGER =================
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))