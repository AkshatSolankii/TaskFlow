from flask import Blueprint, request, jsonify
from models import db, Task


task_bp = Blueprint('tasks', __name__)


@task_bp.route('/tasks', methods=['POST'])
def create_task():
    data = request.get_json()  


    if not data or 'title' not in data:
        return jsonify({"error": "Title is required"}), 400

   
    new_task = Task(
        title=data['title'],
        description=data.get('description', ''),
        status=data.get('status', 'pending')
    )


    db.session.add(new_task)
    db.session.commit()

    return jsonify({
        "message": "Task created successfully",
        "task": new_task.to_dict()
    }), 201



@task_bp.route('/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.all()  # Fetch all task records
    task_list = [task.to_dict() for task in tasks]  # Convert to dictionary format

    return jsonify(task_list), 200
