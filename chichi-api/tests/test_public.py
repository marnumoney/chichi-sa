def test_list_kennels_returns_approved_only(seeded_client):
    res = seeded_client.get('/kennels')
    assert res.status_code == 200
    kennels = res.json()
    assert len(kennels) == 1
    assert kennels[0]['slug'] == 'test-kennel'
    assert kennels[0]['status'] == 'approved'


def test_get_kennel_by_slug(seeded_client):
    res = seeded_client.get('/kennels/test-kennel')
    assert res.status_code == 200
    data = res.json()
    assert data['kennel']['name'] == 'Test Kennel'
    assert len(data['puppies']) == 1
    assert data['puppies'][0]['name'] == 'Duchess'


def test_get_kennel_not_found(seeded_client):
    res = seeded_client.get('/kennels/does-not-exist')
    assert res.status_code == 404


def test_list_puppies(seeded_client):
    res = seeded_client.get('/puppies')
    assert res.status_code == 200
    puppies = res.json()
    assert len(puppies) == 1
    assert puppies[0]['name'] == 'Duchess'
    assert isinstance(puppies[0]['images'], list)
    assert isinstance(puppies[0]['pedigree'], dict)
    assert isinstance(puppies[0]['health'], list)


def test_list_puppies_filter_sold(seeded_client, test_db):
    test_db.execute("UPDATE puppies SET sold = 1 WHERE id = 'p1'")
    test_db.commit()
    res = seeded_client.get('/puppies?sold=false')
    assert res.status_code == 200
    assert len(res.json()) == 0


def test_get_puppy_by_id(seeded_client):
    res = seeded_client.get('/puppies/p1')
    assert res.status_code == 200
    assert res.json()['name'] == 'Duchess'


def test_get_puppy_not_found(seeded_client):
    res = seeded_client.get('/puppies/does-not-exist')
    assert res.status_code == 404


def test_list_testimonials(seeded_client, test_db):
    test_db.execute(
        "INSERT INTO testimonials (id, kennel_id, buyer_name, stars, text, date)"
        " VALUES ('t1', 'k1', 'Jane', 5, 'Great!', '2026-01-01')"
    )
    test_db.commit()
    res = seeded_client.get('/testimonials')
    assert res.status_code == 200
    assert len(res.json()) == 1
