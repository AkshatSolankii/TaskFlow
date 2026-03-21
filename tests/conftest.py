import os
import sys
import pytest

# Ensure tests can import modules from the project root in local and CI runs.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

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