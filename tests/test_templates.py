import json
import pytest
from app import app
from models import db, User, Task, TaskTemplate, TaskTemplateItem, TaskMember
from extensions import bcrypt


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


def _register_and_login(client, username="alice", email="alice@test.com", password="pass1234"):
    client.post("/api/register", json={
        "username": username, "email": email, "password": password
    })
    res = client.post("/api/login", json={"email": email, "password": password})
    return res


def test_create_template(client):
    _register_and_login(client)
    res = client.post("/api/task-templates", json={
        "name": "Daily Standup",
        "items": ["Attend standup", "Update Jira", "Review PRs"]
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["name"] == "Daily Standup"
    assert data["item_count"] == 3


def test_create_template_requires_name(client):
    _register_and_login(client)
    res = client.post("/api/task-templates", json={"name": "", "items": ["x"]})
    assert res.status_code == 400


def test_create_template_requires_items(client):
    _register_and_login(client)
    res = client.post("/api/task-templates", json={"name": "Empty", "items": []})
    assert res.status_code == 400


def test_list_templates_only_own(client):
    _register_and_login(client, "alice", "alice@test.com")
    client.post("/api/task-templates", json={"name": "Alice Tpl", "items": ["a"]})
    client.get("/api/logout")

    _register_and_login(client, "bob", "bob@test.com")
    res = client.get("/api/task-templates")
    assert res.status_code == 200
    assert res.get_json() == []   # bob sees none of alice's templates


def test_update_template(client):
    _register_and_login(client)
    create = client.post("/api/task-templates", json={
        "name": "Old Name", "items": ["one"]
    })
    tid = create.get_json()["id"]

    res = client.patch(f"/api/task-templates/{tid}", json={
        "name": "New Name", "items": ["one", "two"]
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["name"] == "New Name"
    assert data["item_count"] == 2


def test_delete_template(client):
    _register_and_login(client)
    create = client.post("/api/task-templates", json={"name": "Temp", "items": ["a"]})
    tid = create.get_json()["id"]

    res = client.delete(f"/api/task-templates/{tid}")
    assert res.status_code == 200

    res2 = client.get(f"/api/task-templates/{tid}")
    assert res2.status_code == 404


def test_cannot_access_others_template(client):
    _register_and_login(client, "alice", "alice@test.com")
    create = client.post("/api/task-templates", json={"name": "Alice Tpl", "items": ["a"]})
    tid = create.get_json()["id"]
    client.get("/api/logout")

    _register_and_login(client, "bob", "bob@test.com")
    res = client.get(f"/api/task-templates/{tid}")
    assert res.status_code == 403


def test_use_template_creates_task_with_checklist(client):
    _register_and_login(client)
    create = client.post("/api/task-templates", json={
        "name": "Daily Standup",
        "items": ["Attend standup", "Update Jira", "Review PRs"]
    })
    tid = create.get_json()["id"]

    res = client.post(f"/api/task-templates/{tid}/use", json={
        "title": "Standup - Monday", "priority": "Low"
    })
    assert res.status_code == 201
    task_id = res.get_json()["task"]["id"]

    checklist_res = client.get(f"/api/tasks/{task_id}/checklist")
    assert checklist_res.status_code == 200
    items = checklist_res.get_json()
    assert len(items) == 3
    assert all(i["is_done"] is False for i in items)


def test_toggle_checklist_item_as_owner(client):
    _register_and_login(client)
    create = client.post("/api/task-templates", json={"name": "T", "items": ["Step 1"]})
    tid = create.get_json()["id"]
    use  = client.post(f"/api/task-templates/{tid}/use", json={"title": "Task X"})
    task_id = use.get_json()["task"]["id"]

    checklist = client.get(f"/api/tasks/{task_id}/checklist").get_json()
    item_id = checklist[0]["id"]

    res = client.patch(f"/api/tasks/{task_id}/checklist/{item_id}", json={"is_done": True})
    assert res.status_code == 200
    assert res.get_json()["is_done"] is True


def test_viewer_cannot_toggle_checklist_item(client):
    # Owner creates task + template
    _register_and_login(client, "owner", "owner@test.com")
    create = client.post("/api/task-templates", json={"name": "T", "items": ["Step 1"]})
    tid = create.get_json()["id"]
    use  = client.post(f"/api/task-templates/{tid}/use", json={"title": "Task X"})
    task_id = use.get_json()["task"]["id"]
    checklist = client.get(f"/api/tasks/{task_id}/checklist").get_json()
    item_id = checklist[0]["id"]

    client.post(f"/api/tasks/{task_id}/invite", json={"username": "viewer1", "role": "Viewer"})
    client.get("/api/logout")

    # Viewer registers, logs in, accepts invite
    _register_and_login(client, "viewer1", "viewer1@test.com")
    invites = client.get("/api/invitations").get_json()
    inv_id = invites[0]["id"]
    client.post(f"/api/invitations/{inv_id}/accept")

    # Viewer tries to toggle — should be forbidden
    res = client.patch(f"/api/tasks/{task_id}/checklist/{item_id}", json={"is_done": True})
    assert res.status_code == 403