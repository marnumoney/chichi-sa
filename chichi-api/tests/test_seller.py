def seller_token(seeded_client):
    res = seeded_client.post('/auth/seller/login', json={
        'email': 'seller@test.co.za', 'password': 'seller123'
    })
    return res.json()['token']


def test_get_seller_me(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.get('/seller/me', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    data = res.json()
    assert data['seller']['email'] == 'seller@test.co.za'
    assert data['kennel']['name'] == 'Test Kennel'


def test_get_seller_me_no_token(seeded_client):
    res = seeded_client.get('/seller/me')
    assert res.status_code == 403


def test_seller_list_puppies(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.get('/seller/puppies', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]['name'] == 'Duchess'


def test_seller_add_puppy(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.post('/seller/puppies', headers={'Authorization': f'Bearer {token}'}, json={
        'name': 'Tiny',
        'coat_type': 'Smooth Coat',
        'gender': 'Male',
        'color': 'Fawn',
        'dob': '2026-03-01',
        'price': 10000.0,
        'breeding_rights': False,
        'images': ['https://example.com/tiny.jpg'],
        'pedigree': {'sire': 'Test Sire'},
        'health': ['Vaccinated'],
        'description': 'A lovely pup',
        'registration_no': 'KUSA-2026-001',
    })
    assert res.status_code == 201
    assert res.json()['name'] == 'Tiny'
    assert res.json()['kennel_id'] == 'k1'


def test_seller_delist_puppy(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.delete('/seller/puppies/p1', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200

    res2 = seeded_client.get('/seller/puppies', headers={'Authorization': f'Bearer {token}'})
    assert len(res2.json()) == 0


def test_seller_update_profile(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.put('/seller/profile', headers={'Authorization': f'Bearer {token}'}, json={
        'description': 'Updated description',
        'phone': '+27 82 999 9999',
    })
    assert res.status_code == 200
    assert res.json()['description'] == 'Updated description'
