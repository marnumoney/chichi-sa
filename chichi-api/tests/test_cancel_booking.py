import pytest


@pytest.fixture
def booked_setup(seeded_client, test_db):
    test_db.execute("""
        INSERT INTO buyers (id, email, password_hash, name)
        VALUES ('b1', 'buyer@test.co.za', 'x', 'Buyer One')
    """)
    test_db.commit()
    from puppy_sales import record_puppy_payment
    record_puppy_payment(test_db, 'p1', 'deposit', 'Buyer One', 'buyer@test.co.za', 'b1')
    return seeded_client


@pytest.fixture
def seller_token(booked_setup):
    res = booked_setup.post('/auth/seller/login', json={
        'email': 'seller@test.co.za', 'password': 'seller123'})
    return res.json()['token']


def _puppy(db):
    return dict(db.execute("SELECT * FROM puppies WHERE id = 'p1'").fetchone())


def test_seller_cancel_booking(booked_setup, test_db, seller_token):
    res = booked_setup.post('/seller/puppies/p1/cancel-booking',
                            headers={'Authorization': f'Bearer {seller_token}'})
    assert res.status_code == 200
    p = _puppy(test_db)
    assert p['status'] == 'available' and p['booked_by'] == '' and p['sold'] == 0


def test_seller_cancel_requires_booked_state(booked_setup, test_db, seller_token):
    test_db.execute("UPDATE puppies SET status = 'available', booked_by = '' WHERE id = 'p1'")
    test_db.commit()
    res = booked_setup.post('/seller/puppies/p1/cancel-booking',
                            headers={'Authorization': f'Bearer {seller_token}'})
    assert res.status_code == 409


def test_seller_cancel_requires_auth(booked_setup):
    res = booked_setup.post('/seller/puppies/p1/cancel-booking')
    assert res.status_code in (401, 403)


def test_admin_cancel_booking(booked_setup, test_db, admin_token):
    res = booked_setup.post('/admin/puppies/p1/cancel-booking',
                            headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 200
    assert _puppy(test_db)['status'] == 'available'


def test_admin_mark_sold_sets_status(booked_setup, test_db, admin_token):
    res = booked_setup.post('/admin/puppies/p1/mark-sold',
                            headers={'Authorization': f'Bearer {admin_token}'},
                            json={'buyer_name': 'B', 'buyer_email': 'b@t.co'})
    assert res.status_code == 200
    p = _puppy(test_db)
    assert p['status'] == 'sold' and p['sold'] == 1


def test_transactions_purchase_sets_status_sold(seeded_client, test_db):
    res = seeded_client.post('/transactions', json={
        'puppy_id': 'p1', 'buyer_name': 'B', 'buyer_email': 'b@t.co'})
    assert res.status_code == 201
    p = _puppy(test_db)
    assert p['status'] == 'sold' and p['sold'] == 1
