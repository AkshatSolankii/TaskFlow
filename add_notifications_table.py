from app import app, db
from models import Notification

with app.app_context():
    # This will create any missing tables, like the new notifications table
    db.create_all()
    print("Notifications table created (if it didn't exist).")
