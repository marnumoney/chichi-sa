import os
os.environ.setdefault('ADMIN_EMAIL', 'admin@test.co.za')
os.environ.setdefault('ADMIN_PASSWORD_HASH', '')

from auth import hash_password
import pytest


def test_admin_login_success(seeded_client, monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@test.co.za')
    monkeypatch.setenv('ADMIN_PASSWORD_HASH', hash_password('adminpass'))
    res = seeded_client.post('/auth/admin/login', json={
        'email': 'admin@test.co.za', 'password': 'adminpass'
    })
    assert res.status_code == 200
    assert 'token' in res.json()


def test_admin_login_wrong_password(seeded_client, monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@test.co.za')
    monkeypatch.setenv('ADMIN_PASSWORD_HASH', hash_password('adminpass'))
    res = seeded_client.post('/auth/admin/login', json={
        'email': 'admin@test.co.za', 'password': 'wrongpassword'
    })
    assert res.status_code == 401


def test_seller_login_success(seeded_client):
    res = seeded_client.post('/auth/seller/login', json={
        'email': 'seller@test.co.za', 'password': 'seller123'
    })
    assert res.status_code == 200
    data = res.json()
    assert 'token' in data
    assert data['seller']['email'] == 'seller@test.co.za'
    assert 'password_hash' not in data['seller']


def test_seller_login_wrong_password(seeded_client):
    res = seeded_client.post('/auth/seller/login', json={
        'email': 'seller@test.co.za', 'password': 'wrongpassword'
    })
    assert res.status_code == 401


def test_seller_signup_creates_pending_seller(client):
    res = client.post('/auth/seller/signup', json={
        'email': 'new@kennel.co.za',
        'password': 'newpass123',
        'name': 'New Seller',
        'phone': '+27 82 000 0000',
        'province': 'Gauteng',
        'kennel_name': 'New Kennel',
        'registry': 'KUSA',
    })
    assert res.status_code == 201
    assert res.json()['status'] == 'pending_verification'
