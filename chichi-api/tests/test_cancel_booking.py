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


def test_admin_mark_sold_sets_status(seeded_client, test_db, admin_token):
    # Uses an available (not booked) puppy — mark-sold on a booked puppy is
    # covered by test_admin_mark_sold_blocked_when_booked below.
    res = seeded_client.post('/admin/puppies/p1/mark-sold',
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


def _txn_count(db):
    return dict(db.execute(
        "SELECT COUNT(*) AS c FROM transactions WHERE puppy_id = 'p1'").fetchone())['c']


def test_purchase_blocked_when_booked(booked_setup, test_db):
    assert _txn_count(test_db) == 1
    res = booked_setup.post('/transactions', json={
        'puppy_id': 'p1', 'buyer_name': 'X', 'buyer_email': 'x@y.z'})
    assert res.status_code == 409
    assert _txn_count(test_db) == 1


def test_seller_delist_blocked_when_booked(booked_setup, test_db, seller_token):
    res = booked_setup.delete('/seller/puppies/p1',
                              headers={'Authorization': f'Bearer {seller_token}'})
    assert res.status_code == 409
    row = test_db.execute("SELECT * FROM puppies WHERE id = 'p1'").fetchone()
    assert row is not None


def test_admin_mark_sold_blocked_when_booked(booked_setup, test_db, admin_token):
    res = booked_setup.post('/admin/puppies/p1/mark-sold',
                            headers={'Authorization': f'Bearer {admin_token}'},
                            json={'buyer_name': 'B', 'buyer_email': 'b@t.co'})
    assert res.status_code == 409


def test_admin_delete_puppy_blocked_when_booked(booked_setup, test_db, admin_token):
    res = booked_setup.delete('/admin/puppies/p1',
                              headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 409
    row = test_db.execute("SELECT * FROM puppies WHERE id = 'p1'").fetchone()
    assert row is not None


def test_balance_checkout_blocked_when_no_balance_outstanding(booked_setup, test_db, monkeypatch):
    async def fake_create_checkout(amount_cents, metadata, success_url, cancel_url):
        raise AssertionError('create_checkout should not be called when balance is zero')

    import routers.yoco as yoco_mod
    monkeypatch.setattr(yoco_mod, 'create_checkout', fake_create_checkout)

    # Simulate a zero balance by bumping the deposit transaction's amount to the full price.
    test_db.execute(
        "UPDATE transactions SET amount = 15500.0 WHERE puppy_id = 'p1' AND type = 'deposit'")
    test_db.commit()

    res = booked_setup.post('/yoco/puppy-checkout', json={
        'puppy_id': 'p1', 'buyer_name': 'Buyer One', 'buyer_email': 'buyer@test.co.za',
        'buyer_id': 'b1', 'payment_option': 'balance',
    })
    assert res.status_code == 409
