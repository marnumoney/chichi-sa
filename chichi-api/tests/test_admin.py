def auth(token):
    return {'Authorization': f'Bearer {token}'}


def test_admin_list_kennels(seeded_client, admin_token):
    res = seeded_client.get('/admin/kennels', headers=auth(admin_token))
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_admin_add_kennel(seeded_client, admin_token):
    res = seeded_client.post('/admin/kennels', headers=auth(admin_token), json={
        'name': 'New Kennel',
        'slug': 'new-kennel',
        'registry': 'KUSA',
        'commission': 8.0,
    })
    assert res.status_code == 201
    assert res.json()['name'] == 'New Kennel'


def test_admin_edit_kennel(seeded_client, admin_token):
    res = seeded_client.put('/admin/kennels/k1', headers=auth(admin_token), json={
        'commission': 10.0
    })
    assert res.status_code == 200
    assert res.json()['commission'] == 10.0


def test_admin_delete_kennel_cascades(seeded_client, admin_token, test_db):
    res = seeded_client.delete('/admin/kennels/k1', headers=auth(admin_token))
    assert res.status_code == 200
    puppies = test_db.execute("SELECT * FROM puppies WHERE kennel_id = 'k1'").fetchall()
    assert len(puppies) == 0
    seller = test_db.execute("SELECT * FROM sellers WHERE id = 's1'").fetchone()
    assert dict(seller)['kennel_id'] is None


def test_admin_list_sellers(seeded_client, admin_token):
    res = seeded_client.get('/admin/sellers', headers=auth(admin_token))
    assert res.status_code == 200
    sellers = res.json()
    assert len(sellers) >= 1
    assert all('password_hash' not in s for s in sellers)


def test_admin_approve_seller(seeded_client, admin_token, test_db):
    test_db.execute("""
        INSERT INTO sellers (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES ('s_new', 'new@breeder.co.za', 'hash', 'New Breeder', NULL,
                'pending_verification', '2026-05-01')
    """)
    test_db.commit()
    res = seeded_client.patch('/admin/sellers/s_new/approve', headers=auth(admin_token))
    assert res.status_code == 200
    seller = test_db.execute("SELECT * FROM sellers WHERE id = 's_new'").fetchone()
    assert dict(seller)['status'] == 'pending_payment'
    assert dict(seller)['kennel_id'] is not None


def test_admin_pay_membership(seeded_client, admin_token, test_db):
    test_db.execute("""
        UPDATE sellers SET status = 'pending_payment' WHERE id = 's1'
    """)
    test_db.commit()
    res = seeded_client.patch('/admin/sellers/s1/pay-membership', headers=auth(admin_token))
    assert res.status_code == 200
    seller = test_db.execute("SELECT * FROM sellers WHERE id = 's1'").fetchone()
    assert dict(seller)['status'] == 'approved'
    kennel = test_db.execute("SELECT * FROM kennels WHERE id = 'k1'").fetchone()
    assert dict(kennel)['membership_status'] == 'active'


def test_admin_list_puppies(seeded_client, admin_token):
    res = seeded_client.get('/admin/puppies', headers=auth(admin_token))
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_admin_delete_puppy(seeded_client, admin_token, test_db):
    res = seeded_client.delete('/admin/puppies/p1', headers=auth(admin_token))
    assert res.status_code == 200
    row = test_db.execute("SELECT * FROM puppies WHERE id = 'p1'").fetchone()
    assert row is None


def test_admin_list_testimonials(seeded_client, admin_token, test_db):
    test_db.execute(
        "INSERT INTO testimonials (id, kennel_id, buyer_name, stars, text, date)"
        " VALUES ('t1', 'k1', 'Jane', 5, 'Loved it!', '2026-01-01')"
    )
    test_db.commit()
    res = seeded_client.get('/admin/testimonials', headers=auth(admin_token))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_admin_add_and_delete_testimonial(seeded_client, admin_token):
    res = seeded_client.post('/admin/testimonials', headers=auth(admin_token), json={
        'kennel_id': 'k1', 'buyer_name': 'Bob', 'stars': 4, 'text': 'Very good.'
    })
    assert res.status_code == 201
    tid = res.json()['id']

    res2 = seeded_client.delete(f'/admin/testimonials/{tid}', headers=auth(admin_token))
    assert res2.status_code == 200


def test_admin_get_and_update_settings(seeded_client, admin_token):
    res = seeded_client.get('/admin/settings', headers=auth(admin_token))
    assert res.status_code == 200
    assert 'default_commission' in res.json()

    res2 = seeded_client.put('/admin/settings', headers=auth(admin_token), json={
        'default_commission': 9.0
    })
    assert res2.status_code == 200
    assert res2.json()['default_commission'] == 9.0


def test_admin_get_and_update_legal(seeded_client, admin_token):
    res = seeded_client.get('/admin/legal', headers=auth(admin_token))
    assert res.status_code == 200
    assert 'content' in res.json()

    res2 = seeded_client.put('/admin/legal', headers=auth(admin_token), json={
        'content': '# New Terms\n\nUpdated content.'
    })
    assert res2.status_code == 200
    assert res2.json()['content'] == '# New Terms\n\nUpdated content.'


def test_admin_list_transactions(seeded_client, admin_token, test_db):
    test_db.execute("""
        INSERT INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date)
        VALUES ('txn1','p1','Duchess','k1','Test Kennel','Jane','jane@gmail.com',
                15500,1240,14260,0,0,'2026-05-01')
    """)
    test_db.commit()
    res = seeded_client.get('/admin/transactions', headers=auth(admin_token))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_admin_release_transaction(seeded_client, admin_token, test_db):
    test_db.execute("""
        INSERT INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date)
        VALUES ('txn1','p1','Duchess','k1','Test Kennel','Jane','jane@gmail.com',
                15500,1240,14260,0,0,'2026-05-01')
    """)
    test_db.commit()
    res = seeded_client.post('/admin/transactions/txn1/release', headers=auth(admin_token))
    assert res.status_code == 200
    txn = test_db.execute("SELECT * FROM transactions WHERE id = 'txn1'").fetchone()
    assert dict(txn)['seller_paid'] == 1
    assert dict(txn)['commission_paid'] == 1
