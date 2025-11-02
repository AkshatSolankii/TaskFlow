from flask import Flask, request, jsonify, render_template
from models import db, Task

app = Flask(__name__)


app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tasks.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


db.init_app(app)



@app.route('/')
def home():
    return render_template('index.html')  # This loads templates/index.html



@app.route('/tasks', methods=['POST'])
def create_task():
    data = request.get_json()

    if not data or 'title' not in data:
        return jsonify({'error': 'Title is required'}), 400

    new_task = Task(
        title=data['title'],
        description=data.get('description', '')
    )

   
    db.session.add(new_task)
    db.session.commit()

    return jsonify({
        'id': new_task.id,
        'title': new_task.title,
        'description': new_task.description,
        'status': new_task.status,
        'created_at': new_task.created_at
    }), 201



@app.route('/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.all()
    result = []
    for task in tasks:
        result.append({
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'created_at': task.created_at
        })
    return jsonify(result), 200




if __name__ == '__main__':
    with app.app_context():
        db.create_all()  
    app.run(debug=True)
