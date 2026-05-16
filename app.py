from flask import Flask, render_template
import os

# MODELS
from models import db

# EXTENSIONS
from extensions import bcrypt, login_manager

# ROUTES
from routes import task_bp

# NEW AUTH IMPORT
from auth import auth_bp

app = Flask(__name__)

# ------------------ CONFIG ------------------

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DB_PATH = os.path.join(BASE_DIR, "tasks.db")

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["SECRET_KEY"] = "super-secret-key"

# ------------------ INIT EXTENSIONS ------------------

db.init_app(app)

bcrypt.init_app(app)

login_manager.init_app(app)

# 🔥 LOGIN PAGE
login_manager.login_view = "login_page"

# ------------------ REGISTER BLUEPRINTS ------------------

app.register_blueprint(task_bp, url_prefix="/api")

# NEW
app.register_blueprint(auth_bp, url_prefix="/api")

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


@app.route("/login")
def login_page():
    return render_template("login.html")


@app.route("/register")
def register_page():
    return render_template("register.html")


# ------------------ RUN ------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)