from app import app
from models import db, Task, Notification
from datetime import datetime

with app.app_context():
    tasks = Task.query.filter(Task.deadline.isnot(None)).all()
    print("Tasks and their deadlines:")
    for t in tasks:
        print(f"Task ID {t.id} - '{t.title}': {repr(t.deadline)}")
        try:
            deadline_dt = datetime.fromisoformat(t.deadline)
            print(f"  Parsed successfully: {deadline_dt}")
            if deadline_dt < datetime.now():
                print(f"  Status: OVERDUE (now is {datetime.now()})")
            else:
                print(f"  Status: NOT OVERDUE (now is {datetime.now()})")
        except Exception as e:
            print(f"  Failed to parse: {e}")
            
    print("\nNotifications generated:")
    notifs = Notification.query.filter_by(type="overdue").all()
    for n in notifs:
        print(f"User {n.user_id} - Task {n.task_id}: {n.message}")
