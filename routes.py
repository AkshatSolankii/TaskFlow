from flask import Blueprint, request, jsonify
from sqlalchemy import case
from flask_login import (
    login_required,
    current_user
)

from models import db, Task, Category

task_bp = Blueprint('tasks', __name__)


# ================= CREATE TASK =================
@task_bp.route('/tasks', methods=['POST'])
@login_required
def create_task():

    data = request.get_json()

    if not data or 'title' not in data:
        return jsonify({
            "error": "Title is required"
        }), 400

    new_task = Task(
        title=data['title'],
        description=data.get('description', ''),
        deadline=data.get('deadline'),
        priority=data.get('priority', 'Medium'),
        status=data.get('status', 'pending'),

        # USER LINK
        user_id=current_user.id,

        category_id=data.get('category_id')
    )

    db.session.add(new_task)
    db.session.commit()

    return jsonify({
        "message": "Task created successfully",
        "task": new_task.to_dict()
    }), 201


# ================= GET TASKS =================
# ================= GET TASKS =================
# ================= GET TASKS =================
@task_bp.route('/tasks', methods=['GET'])
@login_required
def get_tasks():

    # 🔥 QUERY PARAMS
    page = request.args.get(
        'page',
        1,
        type=int
    )

    limit = request.args.get(
        'limit',
        10,
        type=int
    )

    sort = request.args.get(
        'sort',
        '',
        type=str
    )

    # 🔥 BASE QUERY
    query = Task.query.filter_by(
        user_id=current_user.id
    )

    # ================= SORTING =================

    if sort == "priority":

        priority_order = case(

            (Task.priority == "High", 1),

            (Task.priority == "Medium", 2),

            (Task.priority == "Low", 3),

            else_=4
        )

        query = query.order_by(
            priority_order
        )

    else:

        query = query.order_by(
            Task.created_at.desc()
        )

    # ================= PAGINATION =================

    pagination = query.paginate(

        page=page,

        per_page=limit,

        error_out=False
    )

    # 🔥 TASK LIST
    task_list = [

        task.to_dict()

        for task in pagination.items
    ]

    return jsonify({

        "tasks": task_list,

        "page": pagination.page,

        "total_pages": pagination.pages,

        "total_tasks": pagination.total

    }), 200

# ================= UPDATE TASK =================
@task_bp.route('/tasks/<int:id>', methods=['PATCH'])
@login_required
def update_task(id):

    task = Task.query.filter_by(
        id=id,
        user_id=current_user.id
    ).first()

    if not task:
        return jsonify({
            "error": "Task not found"
        }), 404

    data = request.get_json()

    task.title = data.get(
        "title",
        task.title
    )

    task.description = data.get(
        "description",
        task.description
    )

    task.deadline = data.get(
        "deadline",
        task.deadline
    )

    task.priority = data.get(
        "priority",
        task.priority
    )

    task.status = data.get(
        "status",
        task.status
    )

    task.category_id = data.get(
        "category_id",
        task.category_id
    )

    db.session.commit()

    return jsonify({
        "message": "Task updated successfully",
        "task": task.to_dict()
    }), 200


# ================= DELETE TASK =================
@task_bp.route('/tasks/<int:id>', methods=['DELETE'])
@login_required
def delete_task(id):

    task = Task.query.filter_by(
        id=id,
        user_id=current_user.id
    ).first()

    if not task:
        return jsonify({
            "error": "Task not found"
        }), 404

    db.session.delete(task)
    db.session.commit()

    return jsonify({
        "message": "Task deleted successfully"
    }), 200


# ================= CREATE CATEGORY =================
@task_bp.route('/categories', methods=['POST'])
@login_required
def create_category():

    data = request.get_json()

    name = data.get("name", "").strip()

    if not name:
        return jsonify({
            "error": "Category name required"
        }), 400

    existing = Category.query.filter_by(
        name=name,
        user_id=current_user.id
    ).first()

    if existing:
        return jsonify({
            "error": "Category already exists"
        }), 400

    category = Category(
        name=name,
        user_id=current_user.id
    )

    db.session.add(category)
    db.session.commit()

    return jsonify({
        "id": category.id,
        "name": category.name
    }), 201


# ================= GET CATEGORIES =================
@task_bp.route('/categories', methods=['GET'])
@login_required
def get_categories():

    categories = Category.query.filter_by(
        user_id=current_user.id
    ).all()

    return jsonify([
        {
            "id": c.id,
            "name": c.name
        }
        for c in categories
    ])