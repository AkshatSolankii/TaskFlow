from app import app
from models import db, Task, Notification, User
from datetime import datetime

with app.app_context():
    print(f"Current Server Time: {datetime.now()}")
    print("--- TASKS ---")
    tasks = Task.query.all()
    for t in tasks:
        print(f"[{t.id}] '{t.title}' | owner: {t.user_id} | deadline: '{t.deadline}' | status: {t.status}")
        if t.deadline:
            try:
                dt = datetime.fromisoformat(t.deadline)
                print(f"  Parsed deadline: {dt} -> Overdue? {dt < datetime.now()}")
            except Exception as e:
                print(f"  Error parsing: {e}")
                
    print("\n--- NOTIFICATIONS ---")
    notifs = Notification.query.all()
    for n in notifs:
        print(f"[{n.id}] user: {n.user_id} | type: {n.type} | task: {n.task_id} | read: {n.is_read} | message: {n.message}")
