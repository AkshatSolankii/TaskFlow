from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import case
from datetime import datetime
import os

app = Flask(__name__)

# ------------------ CONFIG ------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "tasks.db")

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ------------------ MODELS ------------------
class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    deadline = db.Column(db.String(20))
    priority = db.Column(db.String(20), default="Medium")
    status = db.Column(db.String(20), default="pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    category = db.relationship("Category", backref="tasks")


with app.app_context():
    db.create_all()

# ------------------ PAGES ------------------
@app.route("/")
def dashboard():
    return render_template("dashboard.html")


@app.route("/add")
def add_page():
    return render_template("add_task.html")


@app.route("/edit/<int:task_id>")
def edit_page(task_id):
    task = Task.query.get_or_404(task_id)
    return render_template("edit_task.html", task=task)


@app.route("/task-manager")
def task_manager():
    return render_template("task_manager.html")


@app.route("/table")
def table_page():
    return render_template("all_tasks_table.html")


@app.route("/tasks")
def my_tasks():
    return render_template("my_tasks.html")

# ------------------ CATEGORY API ------------------
@app.route("/api/categories", methods=["POST"])
def create_category():
    data = request.get_json()
    name = data.get("name", "").strip()

    if not name:
        return jsonify({"error": "Category name is required"}), 400

    if Category.query.filter_by(name=name).first():
        return jsonify({"error": "Category already exists"}), 400

    category = Category(name=name)
    db.session.add(category)
    db.session.commit()

    return jsonify({"id": category.id, "name": category.name}), 201


@app.route("/api/categories", methods=["GET"])
def get_categories():
    categories = Category.query.order_by(Category.name.asc()).all()

    return jsonify([
        {"id": c.id, "name": c.name}
        for c in categories
    ])

# ------------------ TASK API ------------------
@app.route("/api/tasks", methods=["GET"])
def get_tasks():

    # -------- QUERY PARAMS --------
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    sort = request.args.get("sort", "created")

    # -------- BASE QUERY --------
    query = Task.query

    # -------- SORTING --------
    if sort == "deadline":
        query = query.order_by(Task.deadline.asc())

    elif sort == "priority":
        priority_order = case(
            (Task.priority == "High", 1),
            (Task.priority == "Medium", 2),
            (Task.priority == "Low", 3),
        )
        query = query.order_by(priority_order)

    else:
        query = query.order_by(Task.created_at.desc())

    # -------- PAGINATION --------
    pagination = query.paginate(page=page, per_page=limit, error_out=False)

    tasks = pagination.items

    return jsonify({
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "deadline": t.deadline,
                "priority": t.priority,
                "status": t.status,
                "category_id": t.category_id,
                "category": t.category.name if t.category else None
            }
            for t in tasks
        ],
        "page": page,
        "total_pages": pagination.pages
    })


@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json()

    title = data.get("title", "").strip()
    description = data.get("description", "")
    deadline = data.get("deadline")
    priority = data.get("priority", "Medium")
    category_id = data.get("category_id")

    if not title or not deadline:
        return jsonify({"error": "Title and Deadline are required"}), 400

    task = Task(
        title=title,
        description=description,
        deadline=deadline,
        priority=priority,
        category_id=category_id
    )

    db.session.add(task)
    db.session.commit()

    return jsonify({"message": "Task created"}), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json()

    task.title = data.get("title", task.title)
    task.description = data.get("description", task.description)
    task.deadline = data.get("deadline", task.deadline)
    task.priority = data.get("priority", task.priority)
    task.status = data.get("status", task.status)
    task.category_id = data.get("category_id")

    if not task.title or not task.deadline:
        return jsonify({"error": "Title and Deadline are required"}), 400

    db.session.commit()
    return jsonify({"message": "Task updated"}), 200


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"}), 200


# ------------------ RUN ------------------
if __name__ == "__main__":
    app.run(debug=True)