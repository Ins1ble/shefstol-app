import pytest
import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../02-development/backend')))

from app import app as flask_app, init_db

@pytest.fixture
def app():
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    flask_app.config['DATABASE'] = db_path
    flask_app.config['TESTING'] = True
    with flask_app.app_context():
        init_db()
    yield flask_app
    os.close(db_fd)
    if os.path.exists(db_path):
        os.unlink(db_path)

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_header(client):
    phone = '+79990000001'
    code = client.post('/api/auth/request-code', json={'phone': phone}).get_json()['code']
    resp = client.post('/api/auth/verify-code', json={'phone': phone, 'code': code})
    assert resp.status_code == 200
    token = resp.get_json()['tokens']['access_token']
    return {'Authorization': f'Bearer {token}'}