from app import app
from models import db, User, Task, Notification
from flask_login import login_user

with app.app_context():
    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess['_user_id'] = '2'
            sess['_fresh'] = True
            
        res = client.get('/api/notifications/count')
        print(f"Status: {res.status_code}")
        
        notifs = Notification.query.filter_by(task_id=6).all()
        print(f"Task 6 Notifs: {notifs}")
