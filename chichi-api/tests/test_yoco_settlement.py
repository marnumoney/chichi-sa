import json
import pytest


@pytest.fixture
def hook_client(seeded_client, test_db, monkeypatch):
    test_db.execute("""
        INSERT INTO buyers (id, email, password_hash, name)
        VALUES ('b1', 'buyer@test.co.za', 'x', 'Buyer One')
    """)
    test_db.commit()
    import routers.yoco as yoco_mod
    monkeypatch.setattr(yoco_mod, 'verify_webhook', lambda body, sig: True)
    return seeded_client


def _event(payment_option, buyer_id='b1'):
    return {
        'type': 'payment.succeeded',
        'payload': {'metadata': {
            'type': 'puppy', 'payment_option': payment_option, 'puppy_id': 'p1',
            'buyer_name': 'Buyer One', 'buyer_email': 'buyer@test.co.za',
            'buyer_id': buyer_id,
        }},
    }


def _puppy(db):
    return dict(db.execute("SELECT * FROM puppies WHERE id = 'p1'").fetchone())


def test_webhook_deposit_books_puppy(hook_client, test_db):
    res = hook_client.post('/yoco/webhook', json=_event('deposit'))
    assert res.status_code == 200
    p = _puppy(test_db)
    assert p['status'] == 'booked' and p['sold'] == 0 and p['booked_by'] == 'b1'


def test_webhook_balance_sells_puppy(hook_client, test_db):
    hook_client.post('/yoco/webhook', json=_event('deposit'))
    res = hook_client.post('/yoco/webhook', json=_event('balance'))
    assert res.status_code == 200
    p = _puppy(test_db)
    assert p['status'] == 'sold' and p['sold'] == 1
    txns = test_db.execute("SELECT type, amount FROM transactions WHERE puppy_id = 'p1'").fetchall()
    assert sum(dict(t)['amount'] for t in txns) == 15500.0


def test_webhook_duplicate_delivery_noop(hook_client, test_db):
    hook_client.post('/yoco/webhook', json=_event('deposit'))
    hook_client.post('/yoco/webhook', json=_event('deposit'))
    count = test_db.execute("SELECT COUNT(*) AS c FROM transactions WHERE puppy_id = 'p1'").fetchone()
    assert dict(count)['c'] == 1


def test_webhook_legacy_event_without_option_sells(hook_client, test_db):
    ev = _event('full')
    del ev['payload']['metadata']['payment_option']
    hook_client.post('/yoco/webhook', json=ev)
    assert _puppy(test_db)['status'] == 'sold'


class _FakeResponse:
    is_success = True
    def __init__(self, payload):
        self._payload = payload
    def json(self):
        return self._payload


class _FakeAsyncClient:
    payload = {}
    def __init__(self, *a, **kw):
        pass
    async def __aenter__(self):
        return self
    async def __aexit__(self, *a):
        return False
    async def get(self, url, **kw):
        return _FakeResponse(_FakeAsyncClient.payload)


def test_verify_puppy_deposit(hook_client, test_db, monkeypatch):
    import routers.yoco as yoco_mod
    _FakeAsyncClient.payload = {
        'status': 'succeeded',
        'metadata': {'payment_option': 'deposit', 'puppy_id': 'p1',
                     'buyer_name': 'Buyer One', 'buyer_email': 'buyer@test.co.za',
                     'buyer_id': 'b1'},
    }
    monkeypatch.setattr(yoco_mod.httpx, 'AsyncClient', _FakeAsyncClient)
    res = hook_client.post('/yoco/verify-puppy', json={
        'checkout_id': 'ch_x', 'puppy_id': 'p1', 'buyer_id': 'b1',
        'buyer_name': 'Buyer One', 'buyer_email': 'buyer@test.co.za',
    })
    assert res.status_code == 200
    assert _puppy(test_db)['status'] == 'booked'
