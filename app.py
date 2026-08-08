from flask import Flask, render_template
from flask_login import login_required, current_user
from flasgger import Swagger
import os
from saved_filters import saved_filters_bp
from models import db
from extensions import bcrypt, login_manager
from routes import task_bp
from auth import auth_bp
from comments import comments_bp
from templates import templates_bp
from admin import admin_bp
from health import health_bp

app = Flask(__name__)

# ------------------ CONFIG ------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH  = os.path.join(BASE_DIR, "tasks.db")

app.config["SQLALCHEMY_DATABASE_URI"]        = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"]                     = "super-secret-key"

# ------------------ SWAGGER / OPENAPI ------------------
app.config["SWAGGER"] = {
    "title": "Task Manager API",
    "description": "API documentation for the Task Manager application "
                    "(tasks, categories, comments, templates, admin, "
                    "auth, and monitoring endpoints).",
    "version": "1.0.0",
    "uiversion": 3,
    # Swagger UI will be served at /apidocs
}
swagger = Swagger(app)

# ------------------ INIT EXTENSIONS ------------------
db.init_app(app)
bcrypt.init_app(app)
login_manager.init_app(app)

@login_manager.unauthorized_handler
def unauthorized():
    from flask import request as freq, redirect, url_for
    if freq.path.startswith("/api/"):
        return {"error": "Unauthorized"}, 401
    return redirect(url_for("login_page", next=freq.path))

# ------------------ REGISTER BLUEPRINTS ------------------
app.register_blueprint(task_bp,      url_prefix="/api")
app.register_blueprint(auth_bp,      url_prefix="/api")
app.register_blueprint(comments_bp,  url_prefix="/api")
app.register_blueprint(templates_bp, url_prefix="/api")
app.register_blueprint(saved_filters_bp, url_prefix="/api")
app.register_blueprint(admin_bp, url_prefix="/api")

# Health/version are registered at the root (no /api prefix) since
# load balancers, uptime monitors, and container orchestrators
# conventionally expect them at the top level, e.g. GET /health.
app.register_blueprint(health_bp)

# ------------------ CREATE DATABASE ------------------
with app.app_context():
    db.create_all()

# ------------------ PAGES ------------------

@app.route("/")
def dashboard():
    return render_template("dashboard.html")

@app.route("/add")
def add_page():
    return render_template("add_task.html")

@app.route("/task-manager")
def task_manager():
    return render_template("task_manager.html")

@app.route("/table")
def table_page():
    return render_template("all_tasks_table.html")

@app.route("/tasks")
def my_tasks():
    return render_template("my_tasks.html")

@app.route("/activity-log")
def activity_log_page():
    return render_template("activity_log.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/register")
def register_page():
    return render_template("register.html")

# ── Task detail (comments + members + invite) ──
@app.route("/tasks/<int:task_id>")
@login_required
def task_detail(task_id):
    return render_template(
        "task_detail.html",
        task_id          = task_id,
        current_user_id  = current_user.id,
        current_username = current_user.username
    )

# ── Notifications / invitations inbox ──
@app.route("/notifications")
@login_required
def notifications_page():
    return render_template(
        "notifications.html",
        current_user_id  = current_user.id,
        current_username = current_user.username
    )

# ── Task Templates ──
@app.route("/templates")
@login_required
def templates_page():
    return render_template("templates.html")

@app.route("/audit-log")
@login_required
def audit_log_page():
    if current_user.role != "Admin":
        return render_template("403.html"), 403
    return render_template("audit_log.html")

   
@login_required
@app.route("/user-management")
def user_management_page():
    if current_user.role != "Admin":
        return render_template("403.html"), 403
    return render_template("user_management.html")

# ------------------ RUN ------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)