import time




def login_test_user(client):

    
    client.post("/api/register", json={
        "username": "testuser",
        "email": "test@test.com",
        "password": "test123"
    })

    
    client.post("/api/login", json={
        "email": "test@test.com",
        "password": "test123"
    })




def test_create_category(client):

   
    login_test_user(client)

    response = client.post("/api/categories", json={

        "name": f"Work_{int(time.time())}"
    })

    assert response.status_code == 201