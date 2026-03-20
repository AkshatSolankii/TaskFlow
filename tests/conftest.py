import pytest
from app import app, db


@pytest.fixture
def client():
    app.config["TESTING"] = True

    with app.test_client() as client:
        with app.app_context():
            db.create_all()   # ✅ create tables before test

        yield client

        with app.app_context():
            db.drop_all()     # ✅ clean DB after test