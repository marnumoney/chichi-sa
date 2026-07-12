def test_purchase_puppy(seeded_client):
    res = seeded_client.post('/transactions', json={
        'puppy_id': 'p1',
        'buyer_name': 'Alice Dlamini',
        'buyer_email': 'alice@gmail.com',
    })
    assert res.status_code == 201
    data = res.json()
    assert data['puppy_name'] == 'Duchess'
    assert data['amount'] == 15500.0
    assert data['commission'] == 1240.0  # 8% of 15500
    assert data['seller_payout'] == 14260.0
    assert data['seller_paid'] is False
    assert data['commission_paid'] is False


def test_purchase_marks_puppy_sold(seeded_client, test_db):
    seeded_client.post('/transactions', json={
        'puppy_id': 'p1',
        'buyer_name': 'Alice Dlamini',
        'buyer_email': 'alice@gmail.com',
    })
    puppy = test_db.execute("SELECT sold FROM puppies WHERE id = 'p1'").fetchone()
    assert dict(puppy)['sold'] == 1


def test_purchase_puppy_not_found(seeded_client):
    res = seeded_client.post('/transactions', json={
        'puppy_id': 'does-not-exist',
        'buyer_name': 'Alice',
        'buyer_email': 'alice@gmail.com',
    })
    assert res.status_code == 404


def test_purchase_already_sold_puppy(seeded_client, test_db):
    test_db.execute("UPDATE puppies SET sold = 1, status = 'sold' WHERE id = 'p1'")
    test_db.commit()
    res = seeded_client.post('/transactions', json={
        'puppy_id': 'p1',
        'buyer_name': 'Alice',
        'buyer_email': 'alice@gmail.com',
    })
    assert res.status_code == 409
