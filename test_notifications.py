from app import app, db
from models import User, Task, Notification, Comment, TaskMember
from datetime import datetime, timedelta

with app.app_context():
    # Setup test users
    u1 = User.query.filter_by(username="test_u1").first()
    if not u1:
        u1 = User(username="test_u1", email="u1@test.com", password="pwd")
        db.session.add(u1)
    
    u2 = User.query.filter_by(username="test_u2").first()
    if not u2:
        u2 = User(username="test_u2", email="u2@test.com", password="pwd")
        db.session.add(u2)
    
    db.session.commit()

    # Create an overdue task
    past_date = (datetime.utcnow() - timedelta(days=2)).isoformat()
    task = Task(title="Overdue Task", description="Testing overdue", deadline=past_date, user_id=u1.id, status="pending")
    db.session.add(task)
    db.session.commit()

    # Create a task for status change & comment
    task2 = Task(title="Normal Task", description="Testing normal", deadline=(datetime.utcnow() + timedelta(days=2)).isoformat(), user_id=u1.id, status="pending")
    db.session.add(task2)
    db.session.commit()

    # Add u2 as member to task2
    member = TaskMember(task_id=task2.id, user_id=u2.id, role="Editor")
    db.session.add(member)
    db.session.commit()

    # Now manually test generating overdue notifications for u1
    from comments import generate_overdue_notifications
    generate_overdue_notifications(u1)
    
    print("Overdue notifications for u1:")
    notifs = Notification.query.filter_by(user_id=u1.id, type="overdue").all()
    for n in notifs:
        print(f" - {n.message}")

    # Test comment (simulate post_comment logic)
    print("\nSimulating post_comment by u1 on task2...")
    comment = Comment(task_id=task2.id, user_id=u1.id, content="Hello")
    db.session.add(comment)
    
    members = TaskMember.query.filter_by(task_id=task2.id).all()
    notify_user_ids = set([m.user_id for m in members])
    notify_user_ids.add(task2.user_id)
    notify_user_ids.discard(u1.id)
    for uid in notify_user_ids:
        db.session.add(Notification(
            user_id=uid,
            message=f"{u1.username} commented on '{task2.title}'",
            type="comment",
            task_id=task2.id
        ))
    db.session.commit()

    print("Comment notifications for u2:")
    c_notifs = Notification.query.filter_by(user_id=u2.id, type="comment").all()
    for n in c_notifs:
        print(f" - {n.message}")

    # Cleanup test data
    db.session.delete(task)
    db.session.delete(comment)
    db.session.delete(member)
    db.session.delete(task2)
    for n in Notification.query.filter(Notification.user_id.in_([u1.id, u2.id])).all():
        db.session.delete(n)
    db.session.delete(u1)
    db.session.delete(u2)
    db.session.commit()
    print("\nCleanup complete.")
