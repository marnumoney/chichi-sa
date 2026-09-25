from datetime import date, timedelta


def test_job_board_search_and_categories(client, freelancer):
    jobs = client.get('/api/jobs', headers=freelancer).json()
    assert len(jobs) == 4
    assert all(j['my_status'] is None for j in jobs)
    assert len(client.get('/api/jobs?q=dental', headers=freelancer).json()) == 1
    cats = client.get('/api/jobs/categories', headers=freelancer).json()
    assert 'Data Entry' in cats
    assert len(client.get('/api/jobs?category=Data%20Entry', headers=freelancer).json()) == 1


def test_apply_duplicate_withdraw_reapply(client, freelancer):
    job_id = client.get('/api/jobs', headers=freelancer).json()[0]['id']
    res = client.post(f'/api/jobs/{job_id}/apply', headers=freelancer, json={'cover_letter': 'Pick me'})
    assert res.status_code == 201
    app_id = res.json()['id']
    assert client.post(f'/api/jobs/{job_id}/apply', headers=freelancer, json={}).status_code == 409
    assert client.post(f'/api/applications/{app_id}/withdraw', headers=freelancer).status_code == 200
    assert client.post(f'/api/applications/{app_id}/withdraw', headers=freelancer).status_code == 400
    res = client.post(f'/api/jobs/{job_id}/apply', headers=freelancer, json={})
    assert res.status_code == 201 and res.json()['status'] == 'pending'
    assert client.post('/api/jobs/9999/apply', headers=freelancer, json={}).status_code == 404


def test_cannot_apply_to_closed_job(client, admin, freelancer):
    job_id = client.get('/api/jobs', headers=freelancer).json()[0]['id']
    client.patch(f'/api/admin/jobs/{job_id}', headers=admin, json={'status': 'closed'})
    assert client.post(f'/api/jobs/{job_id}/apply', headers=freelancer, json={}).status_code == 400
    assert len(client.get('/api/jobs', headers=freelancer).json()) == 3


def test_hire_notifies_and_decision_is_final(client, admin, freelancer, hired):
    n = client.get('/api/notifications', headers=freelancer).json()
    assert n['unread'] == 2  # welcome + hired
    assert 'hired' in n['items'][0]['message']
    assert client.post(f'/api/admin/applications/{hired}/decision', headers=admin,
                       json={'status': 'rejected'}).status_code == 400
    client.post('/api/notifications/read', headers=freelancer)
    assert client.get('/api/notifications', headers=freelancer).json()['unread'] == 0


def test_time_logging_rules(client, freelancer, hired):
    today = date.today().isoformat()
    ok = client.post('/api/time', headers=freelancer, json={'application_id': hired, 'work_date': today, 'hours': 8})
    assert ok.status_code == 201
    assert ok.json()['rate'] == 12.0
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    assert client.post('/api/time', headers=freelancer,
                       json={'application_id': hired, 'work_date': tomorrow, 'hours': 1}).status_code == 400
    assert client.post('/api/time', headers=freelancer,
                       json={'application_id': hired, 'work_date': today, 'hours': 17}).status_code == 400
    assert client.post('/api/time', headers=freelancer,
                       json={'application_id': hired, 'work_date': today, 'hours': 0}).status_code == 422
    assert client.post('/api/time', headers=freelancer,
                       json={'application_id': hired, 'work_date': today, 'hours': 25}).status_code == 422


def test_cannot_log_time_without_hire(client, freelancer):
    job_id = client.get('/api/jobs', headers=freelancer).json()[0]['id']
    app_id = client.post(f'/api/jobs/{job_id}/apply', headers=freelancer, json={}).json()['id']
    res = client.post('/api/time', headers=freelancer,
                      json={'application_id': app_id, 'work_date': date.today().isoformat(), 'hours': 2})
    assert res.status_code == 400


def test_other_freelancer_cannot_touch_entries(client, freelancer, hired):
    entry = client.post('/api/time', headers=freelancer,
                        json={'application_id': hired, 'work_date': date.today().isoformat(), 'hours': 2}).json()
    tok = client.post('/api/auth/register', json={'email': 'x@y.com', 'password': 'secret123', 'name': 'X'}).json()['token']
    other = {'Authorization': f'Bearer {tok}'}
    assert client.delete(f"/api/time/{entry['id']}", headers=other).status_code == 404
    assert client.post('/api/time', headers=other,
                       json={'application_id': hired, 'work_date': date.today().isoformat(), 'hours': 1}).status_code == 400
    assert client.post(f'/api/applications/{hired}/withdraw', headers=other).status_code == 404


def test_full_earnings_and_payout_flow(client, admin, freelancer, hired):
    d = date.today()
    ids = []
    for i, hours in enumerate([5, 3, 2]):
        r = client.post('/api/time', headers=freelancer, json={
            'application_id': hired, 'work_date': (d - timedelta(days=i)).isoformat(), 'hours': hours, 'note': 'tickets'})
        ids.append(r.json()['id'])

    e = client.get('/api/earnings', headers=freelancer).json()
    assert e['pending_approval'] == 120.0 and e['available'] == 0

    # approve 5h + 3h, reject 2h
    client.post(f'/api/admin/time/{ids[0]}/decision', headers=admin, json={'status': 'approved'})
    client.post(f'/api/admin/time/{ids[1]}/decision', headers=admin, json={'status': 'approved'})
    client.post(f'/api/admin/time/{ids[2]}/decision', headers=admin, json={'status': 'rejected'})
    assert client.post(f'/api/admin/time/{ids[0]}/decision', headers=admin, json={'status': 'rejected'}).status_code == 400
    assert client.delete(f'/api/time/{ids[0]}', headers=freelancer).status_code == 400

    e = client.get('/api/earnings', headers=freelancer).json()
    assert e['earned'] == 96.0 and e['available'] == 96.0 and e['pending_approval'] == 0

    assert client.post('/api/payouts', headers=freelancer, json={'amount': 5, 'method': 'PayPal'}).status_code == 400
    assert client.post('/api/payouts', headers=freelancer, json={'amount': 96.01, 'method': 'PayPal'}).status_code == 400
    p1 = client.post('/api/payouts', headers=freelancer, json={'amount': 60, 'method': 'PayPal'})
    assert p1.status_code == 201
    # requested funds are reserved — can't double-spend
    assert client.post('/api/payouts', headers=freelancer, json={'amount': 40, 'method': 'PayPal'}).status_code == 400
    assert client.get('/api/earnings', headers=freelancer).json()['available'] == 36.0

    # declined payout releases funds; paid payout reduces balance
    client.post(f"/api/admin/payouts/{p1.json()['id']}/decision", headers=admin, json={'status': 'rejected'})
    assert client.get('/api/earnings', headers=freelancer).json()['available'] == 96.0
    p2 = client.post('/api/payouts', headers=freelancer, json={'amount': 96, 'method': 'Wise'}).json()
    client.post(f"/api/admin/payouts/{p2['id']}/decision", headers=admin, json={'status': 'paid'})
    assert client.post(f"/api/admin/payouts/{p2['id']}/decision", headers=admin, json={'status': 'paid'}).status_code == 400
    e = client.get('/api/earnings', headers=freelancer).json()
    assert e['available'] == 0 and e['paid_out'] == 96.0 and len(e['payouts']) == 2

    dash = client.get('/api/dashboard', headers=freelancer).json()
    assert dash['applications']['active'] == 1
    assert dash['hours_last_7_days'] == 8
    stats = client.get('/api/admin/stats', headers=admin).json()
    assert stats['approved_billings'] == 96.0 and stats['pending_payouts'] == 0


def test_rate_change_does_not_rewrite_logged_time(client, admin, freelancer, hired):
    job_id = client.get('/api/applications', headers=freelancer).json()[0]['job_id']
    entry = client.post('/api/time', headers=freelancer,
                        json={'application_id': hired, 'work_date': date.today().isoformat(), 'hours': 1}).json()
    client.patch(f'/api/admin/jobs/{job_id}', headers=admin, json={'rate': 50})
    client.post(f"/api/admin/time/{entry['id']}/decision", headers=admin, json={'status': 'approved'})
    assert client.get('/api/earnings', headers=freelancer).json()['earned'] == 12.0


def test_admin_job_crud(client, admin):
    body = {'title': 'Chat agent', 'client': 'Acme', 'category': 'Customer Support', 'rate': 10, 'hours_per_week': 20}
    job = client.post('/api/admin/jobs', headers=admin, json=body)
    assert job.status_code == 201
    jid = job.json()['id']
    assert client.patch(f'/api/admin/jobs/{jid}', headers=admin, json={'title': '  '}).status_code == 422
    assert client.patch(f'/api/admin/jobs/{jid}', headers=admin, json={'rate': 11}).json()['rate'] == 11
    assert client.post('/api/admin/jobs', headers=admin, json={**body, 'rate': -1}).status_code == 422
    assert client.delete(f'/api/admin/jobs/{jid}', headers=admin).status_code == 200
    assert client.delete(f'/api/admin/jobs/{jid}', headers=admin).status_code == 404


def test_cannot_delete_job_with_logged_time(client, admin, freelancer, hired):
    job_id = client.get('/api/applications', headers=freelancer).json()[0]['job_id']
    client.post('/api/time', headers=freelancer,
                json={'application_id': hired, 'work_date': date.today().isoformat(), 'hours': 1})
    assert client.delete(f'/api/admin/jobs/{job_id}', headers=admin).status_code == 400


def test_training(client, admin, freelancer):
    courses = client.get('/api/courses', headers=freelancer).json()
    assert len(courses) == 4
    cid = courses[0]['id']
    assert client.post(f'/api/courses/{cid}/complete', headers=freelancer).status_code == 200
    assert client.post(f'/api/courses/{cid}/complete', headers=freelancer).status_code == 200  # idempotent
    assert client.get('/api/dashboard', headers=freelancer).json()['training'] == {'completed': 1, 'total': 4}
    assert client.post('/api/courses/999/complete', headers=freelancer).status_code == 404
    new = client.post('/api/admin/courses', headers=admin, json={'title': 'QA', 'minutes': 5}).json()
    assert client.delete(f"/api/admin/courses/{new['id']}", headers=admin).status_code == 200
    freelancers = client.get('/api/admin/freelancers', headers=admin).json()
    assert freelancers[0]['training'] == {'completed': 1, 'total': 4}


def test_seed_is_idempotent(db):
    from seed import seed
    seed(db)
    assert db.execute('SELECT COUNT(*) FROM jobs').fetchone()[0] == 4
    assert db.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'").fetchone()[0] == 1
