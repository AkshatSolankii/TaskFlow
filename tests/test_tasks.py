# ================= AUTH HELPER =================

def login_test_user(client):

    # Register test user
    client.post("/api/register", json={
        "username": "testuser",
        "email": "test@test.com",
        "password": "test123"
    })

    # Login test user
    client.post("/api/login", json={
        "email": "test@test.com",
        "password": "test123"
    })


# ================= CREATE TASK TEST =================

def test_create_task(client):

    login_test_user(client)

    response = client.post("/api/tasks", json={

        "title": "Test Task",

        "description": "Testing",

        "deadline": "2026-03-20",

        "priority": "High"
    })

    assert response.status_code == 201


# ================= GET TASKS TEST =================

def test_get_tasks(client):

    login_test_user(client)

    # Create one task first
    client.post("/api/tasks", json={

        "title": "Sample Task",

        "deadline": "2026-03-20"
    })

    response = client.get("/api/tasks")

    assert response.status_code == 200

    data = response.get_json()

    # ✅ NEW STRUCTURE CHECK
    assert "tasks" in data

    assert isinstance(data["tasks"], list)

    assert len(data["tasks"]) > 0


def test_get_calendar_tasks(client):
    login_test_user(client)
    client.post("/api/tasks", json={"title": "Scheduled", "deadline": "2026-03-20"})
    client.post("/api/tasks", json={"title": "Unscheduled"})

    response = client.get("/api/calendar-tasks")

    assert response.status_code == 200
    data = response.get_json()
    assert [task["title"] for task in data["tasks"]] == ["Scheduled"]


def test_upload_list_download_and_delete_attachment(client, tmp_path, monkeypatch):
    from app import app
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path / "uploads"))
    login_test_user(client)
    task = client.post("/api/tasks", json={"title": "With file"}).get_json()["task"]

    import io
    upload = client.post(
        f"/api/tasks/{task['id']}/attachments",
        data={"file": (io.BytesIO(b"%PDF-1.4 example"), "notes.pdf")},
        content_type="multipart/form-data",
    )
    assert upload.status_code == 201
    attachment = upload.get_json()

    listed = client.get(f"/api/tasks/{task['id']}/attachments")
    assert [item["name"] for item in listed.get_json()] == ["notes.pdf"]

    downloaded = client.get(f"/api/tasks/{task['id']}/attachments/{attachment['id']}/download")
    assert downloaded.status_code == 200
    assert downloaded.data == b"%PDF-1.4 example"

    deleted = client.delete(f"/api/tasks/{task['id']}/attachments/{attachment['id']}")
    assert deleted.status_code == 200
    assert client.get(f"/api/tasks/{task['id']}/attachments").get_json() == []


def test_rejects_unsupported_attachment_type(client):
    import io
    login_test_user(client)
    task = client.post("/api/tasks", json={"title": "No executable"}).get_json()["task"]
    response = client.post(
        f"/api/tasks/{task['id']}/attachments",
        data={"file": (io.BytesIO(b"not allowed"), "script.exe")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


# ================= PAGINATION TEST =================

def test_pagination(client):

    login_test_user(client)

    # Create 15 tasks
    for i in range(15):

        client.post("/api/tasks", json={

            "title": f"Task {i}",

            "deadline": "2026-03-20"
        })

    response = client.get(
        "/api/tasks?page=1&limit=10"
    )

    data = response.get_json()

    assert response.status_code == 200

    assert len(data["tasks"]) == 10

    assert data["page"] == 1


# ================= SORTING TEST =================

def test_sort_priority(client):

    login_test_user(client)

    client.post("/api/tasks", json={

        "title": "Low Task",

        "deadline": "2026-03-20",

        "priority": "Low"
    })

    client.post("/api/tasks", json={

        "title": "High Task",

        "deadline": "2026-03-20",

        "priority": "High"
    })

    response = client.get(
        "/api/tasks?sort=priority"
    )

    data = response.get_json()

    assert response.status_code == 200

    assert data["tasks"][0]["priority"] == "High"

# ================= EXCEL EXPORT TEST =================

def test_export_tasks_xlsx(client):

    login_test_user(client)

    client.post("/api/tasks", json={
        "title": "Export me",
        "description": "Excel export test",
        "deadline": "2026-03-20",
        "priority": "High"
    })

    response = client.get("/api/tasks/export/xlsx")

    assert response.status_code == 200
    assert response.mimetype == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.headers["Content-Disposition"].endswith('filename=tasks.xlsx')
    assert response.data.startswith(b"PK")  # XLSX files are ZIP containers
