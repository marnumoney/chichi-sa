import os

os.environ['SKIP_DB_INIT'] = '1'
os.environ.setdefault('SECRET_KEY', 'test-secret')

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from database import connect, create_tables, get_db  # noqa: E402
from main import app  # noqa: E402
from seed import seed  # noqa: E402


@pytest.fixture
def db():
    conn = connect(':memory:')
    create_tables(conn)
    os.environ['ADMIN_EMAIL'] = 'admin@test.com'
    os.environ['ADMIN_PASSWORD'] = 'adminpass123'
    seed(conn)
    yield conn
    conn.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def auth(token):
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def admin(client):
    res = client.post('/api/auth/login', json={'email': 'admin@test.com', 'password': 'adminpass123'})
    assert res.status_code == 200
    return auth(res.json()['token'])


@pytest.fixture
def freelancer(client):
    res = client.post('/api/auth/register', json={'email': 'Jo@Test.com', 'password': 'secret123', 'name': 'Jo Tester'})
    assert res.status_code == 201
    return auth(res.json()['token'])


@pytest.fixture
def hired(client, admin, freelancer):
    """Freelancer hired onto the first seeded job; returns the application id."""
    job = next(j for j in client.get('/api/jobs', headers=freelancer).json() if j['rate'] == 12.0)
    app_id = client.post(f"/api/jobs/{job['id']}/apply", headers=freelancer, json={}).json()['id']
    assert client.post(f'/api/admin/applications/{app_id}/decision', headers=admin,
                       json={'status': 'accepted'}).status_code == 200
    return app_id
