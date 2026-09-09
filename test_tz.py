from app import app
from models import db, User, Task, Notification
from flask_login import login_user

with app.app_context():
    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess['_user_id'] = '2'
            sess['_fresh'] = True
            
        print("Creating Task...")
        # Simulating client sending a UTC string for 2 minutes from now
        from datetime import datetime, timezone, timedelta
        utc_now = datetime.now(timezone.utc)
        deadline = (utc_now + timedelta(minutes=2)).toISOString() if hasattr(utc_now, 'toISOString') else (utc_now + timedelta(minutes=2)).isoformat().replace("+00:00", "Z")
        print(f"Sending deadline: {deadline}")
        
        res = client.post('/api/tasks', json={
            "title": "Global TZ Task",
            "description": "testing",
            "deadline": deadline,
            "priority": "High"
        })
        print(f"Task creation status: {res.status_code}")
        data = res.get_json()
        print(f"Response: {data}")
        
        task_id = data.get('task', {}).get('id')
        if task_id:
            # Check DB
            t = Task.query.get(task_id)
            print(f"DB stored deadline: {t.deadline}")
