import time

from app import app
from models import db, User



def login_test_user(client):

    
    client.post("/api/register", json={
        "username": "testuser",
        "email": "test@test.com",
        "password": "test123"
    })

    # Creating shared categories is restricted to Admins and Managers.
    # Promote this test account before authenticating it for the request.
    with app.app_context():
        user = User.query.filter_by(username="testuser").first()
        user.role = "Manager"
        db.session.commit()

    
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
