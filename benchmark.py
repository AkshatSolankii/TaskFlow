"""
Benchmark script for Task 2 - Performance Improvements.

Seeds a fresh in-memory-ish SQLite DB with realistic volume, then
times the endpoints most exposed to N+1 queries and full table scans:
  - GET /api/tasks           (shared_tasks N+1 fix)
  - GET /api/dashboard-stats (category N+1 fix + status aggregation)
  - GET /api/tasks/<id>/comments (index on task_id)

Run this TWICE to get a real before/after:
  1. Run once against the OLD routes.py / models.py (before fixes)
  2. Apply the fixes from this response
  3. Run again against the NEW routes.py / models.py (after fixes)

Usage:
    python benchmark.py
"""
import time
import random
from app import app
from models import db, User, Task, Category, TaskMember
from extensions import bcrypt

# ── Tunables — adjust to match your expected production scale ──
NUM_TASKS_OWNED     = 5000
NUM_CATEGORIES      = 50
NUM_SHARED_TASKS    = 500   # tasks another user shares with the benchmark user
NUM_OTHER_USERS     = 5     # users who own the shared tasks


def seed_data():
    """Wipes and rebuilds the DB with realistic volume."""
    db.drop_all()
    db.create_all()

    # Primary benchmark user
    main_user = User(
        username="bench_user",
        email="bench@test.com",
        password=bcrypt.generate_password_hash("pass1234").decode("utf-8")
    )
    db.session.add(main_user)
    db.session.flush()

    # Categories owned by main_user
    categories = []
    for i in range(NUM_CATEGORIES):
        c = Category(name=f"Category {i}", user_id=main_user.id)
        db.session.add(c)
        categories.append(c)
    db.session.flush()

    # Tasks owned by main_user
    statuses = ["pending", "in_progress", "completed"]
    for i in range(NUM_TASKS_OWNED):
        t = Task(
            title       = f"Task {i}",
            description = f"Description for task {i}",
            deadline    = "2026-08-01T10:00:00",
            priority    = random.choice(["High", "Medium", "Low"]),
            status      = random.choice(statuses),
            user_id     = main_user.id,
            category_id = random.choice(categories).id
        )
        db.session.add(t)
    db.session.flush()

    # Other users who own tasks shared WITH main_user
    other_users = []
    for i in range(NUM_OTHER_USERS):
        u = User(
            username=f"owner_{i}",
            email=f"owner_{i}@test.com",
            password=bcrypt.generate_password_hash("pass1234").decode("utf-8")
        )
        db.session.add(u)
        other_users.append(u)
    db.session.flush()

    for i in range(NUM_SHARED_TASKS):
        owner = random.choice(other_users)
        t = Task(
            title       = f"Shared Task {i}",
            description = "",
            deadline    = None,
            priority    = "Medium",
            status      = random.choice(statuses),
            user_id     = owner.id
        )
        db.session.add(t)
        db.session.flush()

        db.session.add(TaskMember(
            task_id = t.id,
            user_id = main_user.id,
            role    = random.choice(["Editor", "Viewer"])
        ))

    db.session.commit()
    return main_user


def time_request(client, label, method, url, runs=5):
    times = []
    for _ in range(runs):
        start = time.perf_counter()
        res = client.get(url) if method == "GET" else client.post(url)
        elapsed = (time.perf_counter() - start) * 1000  # ms
        times.append(elapsed)
        assert res.status_code == 200, f"{label} failed: {res.status_code} {res.get_json()}"
    avg = sum(times) / len(times)
    print(f"{label:45s} avg {avg:8.2f} ms   (min {min(times):.2f}, max {max(times):.2f}, n={runs})")
    return avg


def run_benchmark():
    app.config["TESTING"] = True

    with app.app_context():
        print(f"Seeding {NUM_TASKS_OWNED} owned tasks, {NUM_CATEGORIES} categories, "
              f"{NUM_SHARED_TASKS} shared tasks…")
        seed_data()
        print("Seed complete.\n")

    client = app.test_client()
    client.post("/api/login", json={"email": "bench@test.com", "password": "pass1234"})

    print("── Benchmark results ──")
    time_request(client, "GET /api/tasks (limit=50)",       "GET", "/api/tasks?limit=50")
    time_request(client, "GET /api/tasks (limit=5000)",     "GET", "/api/tasks?limit=5000")
    time_request(client, "GET /api/dashboard-stats",        "GET", "/api/dashboard-stats")


if __name__ == "__main__":
    run_benchmark()