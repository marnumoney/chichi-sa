import pytest


@pytest.fixture
def checkout_client(seeded_client, test_db, monkeypatch):
    """seeded_client + a buyer account + mocked Yoco create_checkout."""
    test_db.execute("""
        INSERT INTO buyers (id, email, password_hash, name)
        VALUES ('b1', 'buyer@test.co.za', 'x', 'Buyer One')
    """)
    test_db.commit()

    captured = {}

    async def fake_create_checkout(amount_cents, metadata, success_url, cancel_url):
        captured['amount_cents'] = amount_cents
        captured['metadata'] = metadata
        captured['success_url'] = success_url
        return {'redirectUrl': 'https://pay.test/r', 'id': 'ch_test1'}

    import routers.yoco as yoco_mod
    monkeypatch.setattr(yoco_mod, 'create_checkout', fake_create_checkout)
    seeded_client.captured = captured
    return seeded_client


def _body(**over):
    base = {'puppy_id': 'p1', 'buyer_name': 'Buyer One',
            'buyer_email': 'buyer@test.co.za', 'buyer_id': 'b1'}
    base.update(over)
    return base


def test_full_checkout_default(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout', json=_body())
    assert res.status_code == 200
    assert checkout_client.captured['amount_cents'] == 1550000  # R15,500 seeded price
    assert checkout_client.captured['metadata']['payment_option'] == 'full'
    assert 'purchased=full' in checkout_client.captured['success_url']


def test_deposit_checkout_half_price(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='deposit'))
    assert res.status_code == 200
    assert checkout_client.captured['amount_cents'] == 775000  # 50% of R15,500
    assert checkout_client.captured['metadata']['payment_option'] == 'deposit'


def test_deposit_requires_buyer_account(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout',
                               json=_body(payment_option='deposit', buyer_id=''))
    assert res.status_code == 403
    res = checkout_client.post('/yoco/puppy-checkout',
                               json=_body(payment_option='deposit', buyer_id='ghost'))
    assert res.status_code == 403


def test_deposit_blocked_when_booked(checkout_client, test_db):
    test_db.execute("UPDATE puppies SET status = 'booked', booked_by = 'b1' WHERE id = 'p1'")
    test_db.commit()
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='deposit'))
    assert res.status_code == 409
    res = checkout_client.post('/yoco/puppy-checkout', json=_body())  # full also blocked
    assert res.status_code == 409


def test_balance_checkout_remaining_amount(checkout_client, test_db):
    from puppy_sales import record_puppy_payment
    record_puppy_payment(test_db, 'p1', 'deposit', 'Buyer One', 'buyer@test.co.za', 'b1')
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='balance'))
    assert res.status_code == 200
    assert checkout_client.captured['amount_cents'] == 775000  # remaining 50%


def test_balance_only_for_booking_buyer(checkout_client, test_db):
    from puppy_sales import record_puppy_payment
    record_puppy_payment(test_db, 'p1', 'deposit', 'Buyer One', 'buyer@test.co.za', 'b1')
    res = checkout_client.post('/yoco/puppy-checkout',
                               json=_body(payment_option='balance', buyer_id='b2'))
    assert res.status_code == 403


def test_balance_blocked_when_not_booked(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='balance'))
    assert res.status_code == 409


def test_invalid_payment_option(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='weird'))
    assert res.status_code == 400
