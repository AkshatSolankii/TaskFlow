from app import app
from models import db, Task, Notification, User
from comments import generate_overdue_notifications

with app.app_context():
    task4 = Task.query.get(4)
    print(f"Task 4 owner ID: {task4.user_id}")
    owner = User.query.get(task4.user_id)
    
    print("Calling generate_overdue_notifications...")
    generate_overdue_notifications(owner)
    
    notifs = Notification.query.filter_by(user_id=owner.id, task_id=4).all()
    print("Notifications for Task 4 after generation:")
    for n in notifs:
        print(n.message)
