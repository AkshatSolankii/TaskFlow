import pytest
from app import app
from models import db, User


@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.session.remove()
            db.drop_all()


def _register_and_login(client, username, email, password="pass1234"):
    client.post("/api/register", json={"username": username, "email": email, "password": password})
    return client.post("/api/login", json={"email": email, "password": password})


def _set_role(username, role):
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        user.role = role
        db.session.commit()


def test_default_role_is_user(client):
    _register_and_login(client, "alice", "alice@test.com")
    res = client.get("/api/me")
    assert res.get_json()["role"] == "User"


def test_user_cannot_access_admin_endpoint(client):
    _register_and_login(client, "alice", "alice@test.com")
    res = client.get("/api/admin/users")
    assert res.status_code == 403


def test_admin_can_list_users(client):
    _register_and_login(client, "alice", "alice@test.com")
    _set_role("alice", "Admin")
    res = client.get("/api/admin/users")
    assert res.status_code == 200
    assert len(res.get_json()) == 1


def test_admin_can_change_role(client):
    _register_and_login(client, "alice", "alice@test.com", "pass1234")
    _set_role("alice", "Admin")

    _register_and_login(client, "bob", "bob@test.com", "pass1234")
    client.get("/api/logout")
    client.post("/api/login", json={"email": "alice@test.com", "password": "pass1234"})

    with app.app_context():
        bob = User.query.filter_by(username="bob").first()
        bob_id = bob.id

    res = client.patch(f"/api/admin/users/{bob_id}/role", json={"role": "Manager"})
    assert res.status_code == 200
    assert res.get_json()["user"]["role"] == "Manager"


def test_admin_cannot_self_demote(client):
    _register_and_login(client, "alice", "alice@test.com")
    _set_role("alice", "Admin")

    with app.app_context():
        alice = User.query.filter_by(username="alice").first()
        alice_id = alice.id

    res = client.patch(f"/api/admin/users/{alice_id}/role", json={"role": "User"})
    assert res.status_code == 400


def test_user_can_only_see_own_tasks(client):
    _register_and_login(client, "alice", "alice@test.com", "pass1234")
    client.post("/api/tasks", json={"title": "Alice Task"})
    client.get("/api/logout")

    _register_and_login(client, "bob", "bob@test.com", "pass1234")
    client.post("/api/tasks", json={"title": "Bob Task"})

    res = client.get("/api/tasks?limit=100")
    titles = [t["title"] for t in res.get_json()["tasks"]]
    assert "Bob Task" in titles
    assert "Alice Task" not in titles


def test_manager_sees_all_tasks(client):
    _register_and_login(client, "alice", "alice@test.com", "pass1234")
    client.post("/api/tasks", json={"title": "Alice Task"})
    client.get("/api/logout")

    _register_and_login(client, "bob", "bob@test.com", "pass1234")
    client.post("/api/tasks", json={"title": "Bob Task"})
    _set_role("bob", "Manager")
    client.get("/api/logout")
    client.post("/api/login", json={"email": "bob@test.com", "password": "pass1234"})

    res = client.get("/api/tasks?limit=100")
    titles = [t["title"] for t in res.get_json()["tasks"]]
    assert "Alice Task" in titles
    assert "Bob Task" in titles


def test_manager_can_delete_others_task(client):
    _register_and_login(client, "alice", "alice@test.com", "pass1234")
    create = client.post("/api/tasks", json={"title": "Alice Task"})
    task_id = create.get_json()["task"]["id"]
    client.get("/api/logout")

    _register_and_login(client, "bob", "bob@test.com", "pass1234")
    _set_role("bob", "Manager")
    client.get("/api/logout")
    client.post("/api/login", json={"email": "bob@test.com", "password": "pass1234"})

    res = client.delete(f"/api/tasks/{task_id}")
    assert res.status_code == 200


def test_regular_user_cannot_delete_others_task(client):
    _register_and_login(client, "alice", "alice@test.com", "pass1234")
    create = client.post("/api/tasks", json={"title": "Alice Task"})
    task_id = create.get_json()["task"]["id"]
    client.get("/api/logout")

    _register_and_login(client, "bob", "bob@test.com", "pass1234")
    res = client.delete(f"/api/tasks/{task_id}")
    assert res.status_code == 404