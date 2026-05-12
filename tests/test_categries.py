import time


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


# ================= CREATE CATEGORY TEST =================

def test_create_category(client):

    # 🔥 Login first
    login_test_user(client)

    response = client.post("/api/categories", json={

        "name": f"Work_{int(time.time())}"
    })

    assert response.status_code == 201