import sqlite3
import pytest
from fastapi.testclient import TestClient
from main import app
from database import get_db, create_tables

try:
    from auth import hash_password
except ImportError:
    # auth.py is created in Task 2; stub until then
    def hash_password(password: str) -> str:
        raise NotImplementedError("auth.py not yet available")


@pytest.fixture
def test_db():
    conn = sqlite3.connect(':memory:', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    create_tables(conn)
    yield conn
    conn.close()


@pytest.fixture
def client(test_db):
    app.dependency_overrides[get_db] = lambda: test_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def seeded_client(test_db):
    """Client with one kennel, one puppy, and one approved seller seeded."""
    test_db.execute("""
        INSERT INTO kennels (id, name, slug, registry, initials, color,
            description, location, contact, phone,
            membership_status, membership_expiry, commission, status)
        VALUES ('k1', 'Test Kennel', 'test-kennel', 'KUSA', 'TK', '#B5651D',
            'A test kennel', 'Johannesburg', 'test@kennel.co.za', '+27 82 000 0000',
            'active', '2027-01-01', 8.0, 'approved')
    """)
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, coat_type, gender, color,
            dob, price, sold, breeding_rights, images, pedigree, health,
            description, registration_no)
        VALUES ('p1', 'k1', 'Duchess', 'Long Coat', 'Female', 'Cream',
            '2025-12-10', 15500.0, 0, 1,
            '["https://example.com/img.jpg"]',
            '{"sire": "Test Sire"}',
            '["Inoculation Up to Date"]',
            'A lovely puppy', 'KUSA-2025-CHI-0001')
    """)
    test_db.execute("""
        INSERT INTO sellers (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES ('s1', 'seller@test.co.za', ?, 'Test Seller', 'k1', 'approved', '2024-01-01')
    """, (hash_password('seller123'),))
    test_db.commit()

    app.dependency_overrides[get_db] = lambda: test_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def admin_token(seeded_client, monkeypatch):
    from auth import hash_password as hp
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@test.co.za')
    monkeypatch.setenv('ADMIN_PASSWORD_HASH', hp('adminpass'))
    res = seeded_client.post('/auth/admin/login', json={
        'email': 'admin@test.co.za', 'password': 'adminpass'
    })
    return res.json()['token']
