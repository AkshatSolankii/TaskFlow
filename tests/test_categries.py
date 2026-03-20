import time

def test_create_category(client):
    response = client.post("/api/categories", json={
        "name": f"Work_{int(time.time())}"
    })

    assert response.status_code == 201