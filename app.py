from flask import Flask, render_template, request, jsonify, redirect, url_for
from models import db, Task
import os

app = Flask(__name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "tasks.db")

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()


@app.route("/")
def dashboard():
    """Main dashboard – JS will load tasks and render cards."""
    return render_template("dashboard.html")

@app.route("/table")
def table_page():
    """Table view page."""
    return render_template("all_tasks_table.html")

@app.route("/task-manager")
def task_manager():
    """Task manager list view."""
    return render_template("task_manager.html")

@app.route("/tasks")
def tasks_page():
    """
    Simple server-side 'My Tasks' page (uses my_tasks.html).
    Sidebar link 'My Tasks' will go here.
    """
    tasks = Task.query.order_by(Task.deadline.asc().nulls_last()).all()
    return render_template("my_tasks.html", tasks=tasks)

@app.route("/add")
def add_page():
    """Add task form."""
    return render_template("add_task.html")

@app.route("/edit/<int:task_id>")
def edit_page(task_id):
    """Edit task form."""
    task = Task.query.get_or_404(task_id)
    return render_template("edit_task.html", task=task)


@app.route("/api/tasks", methods=["GET"])
def api_get_tasks():
    """Return all tasks as JSON for dashboard/table/manager."""
    tasks = Task.query.order_by(Task.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks]), 200

@app.route("/api/tasks", methods=["POST"])
def api_create_task():
    """Create a new task."""
    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    deadline = (data.get("deadline") or "").strip()
    description = (data.get("description") or "").strip()
    priority = data.get("priority") or "Medium"

    if not title or not deadline:
        return jsonify({"error": "Title and Deadline are required."}), 400

    new_task = Task(
        title=title,
        description=description,
        deadline=deadline,
        priority=priority,
        status="pending"
    )
    db.session.add(new_task)
    db.session.commit()

    return jsonify(new_task.to_dict()), 201

@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def api_update_task(task_id):
    """Update an existing task (edit page)."""
    task = Task.query.get_or_404(task_id)
    data = request.get_json() or {}

    title = data.get("title")
    deadline = data.get("deadline")

    if title is not None:
        task.title = title.strip()
    if deadline is not None:
        task.deadline = deadline.strip()

    if "description" in data:
        task.description = (data.get("description") or "").strip()
    if "priority" in data:
        task.priority = data.get("priority") or task.priority
    if "status" in data:
        task.status = data.get("status") or task.status

    
    if not task.title or not task.deadline:
        return jsonify({"error": "Title and Deadline cannot be empty."}), 400

    db.session.commit()
    return jsonify(task.to_dict()), 200

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def api_delete_task(task_id):
    """Delete a task."""
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "deleted"}), 200

if __name__ == "__main__":
    app.run(debug=True)
