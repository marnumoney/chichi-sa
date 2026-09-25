from tests.conftest import auth


def test_register_login_me(client):
    res = client.post('/api/auth/register', json={'email': 'A@B.com', 'password': 'password1', 'name': '  Ann  '})
    assert res.status_code == 201
    body = res.json()
    assert body['user']['email'] == 'a@b.com'
    assert body['user']['name'] == 'Ann'
    assert 'password_hash' not in body['user']
    assert body['user']['role'] == 'freelancer'

    res = client.post('/api/auth/login', json={'email': 'a@b.com', 'password': 'password1'})
    assert res.status_code == 200
    me = client.get('/api/auth/me', headers=auth(res.json()['token'])).json()
    assert me['email'] == 'a@b.com'


def test_duplicate_email_rejected_case_insensitive(client, freelancer):
    res = client.post('/api/auth/register', json={'email': 'jo@test.com', 'password': 'secret123', 'name': 'X'})
    assert res.status_code == 409


def test_register_validation(client):
    assert client.post('/api/auth/register', json={'email': 'bad', 'password': 'secret123', 'name': 'X'}).status_code == 422
    assert client.post('/api/auth/register', json={'email': 'a@b.com', 'password': 'short', 'name': 'X'}).status_code == 422
    assert client.post('/api/auth/register', json={'email': 'a@b.com', 'password': 'secret123', 'name': '   '}).status_code == 422


def test_wrong_password(client, freelancer):
    assert client.post('/api/auth/login', json={'email': 'jo@test.com', 'password': 'nope12345'}).status_code == 401


def test_missing_and_bad_token(client):
    assert client.get('/api/auth/me').status_code == 401
    assert client.get('/api/auth/me', headers=auth('garbage')).status_code == 401


def test_profile_update_and_skills_cleanup(client, freelancer):
    res = client.put('/api/auth/me', headers=freelancer, json={
        'headline': 'Support pro', 'skills': ['Zendesk', ' zendesk ', 'Data, entry', ''],
        'hourly_rate': 11.5, 'availability': 'limited', 'country': 'Kenya', 'bio': 'Hi',
    })
    assert res.status_code == 200
    u = res.json()
    assert u['skills'] == ['Zendesk', 'Data  entry']
    assert u['availability'] == 'limited'
    assert client.put('/api/auth/me', headers=freelancer, json={'availability': 'bogus'}).status_code == 422
    assert client.put('/api/auth/me', headers=freelancer, json={'hourly_rate': -1}).status_code == 422


def test_change_password(client, freelancer):
    assert client.put('/api/auth/password', headers=freelancer,
                      json={'current_password': 'wrong', 'new_password': 'newpass123'}).status_code == 400
    assert client.put('/api/auth/password', headers=freelancer,
                      json={'current_password': 'secret123', 'new_password': 'newpass123'}).status_code == 200
    assert client.post('/api/auth/login', json={'email': 'jo@test.com', 'password': 'newpass123'}).status_code == 200


def test_role_guards(client, freelancer, admin):
    assert client.get('/api/admin/stats', headers=freelancer).status_code == 403
    assert client.get('/api/dashboard', headers=admin).status_code == 403
    assert client.post('/api/jobs/1/apply', headers=admin, json={}).status_code == 403


def test_frontend_served(client):
    assert client.get('/').status_code == 200
    assert client.get('/static/app.js').status_code == 200
    assert client.get('/api/health').json() == {'status': 'ok'}
