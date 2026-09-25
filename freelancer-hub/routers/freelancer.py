import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth import get_current_user, require_freelancer
from database import balance, get_db

router = APIRouter(prefix='/api', tags=['freelancer'])

MIN_PAYOUT = 10.0


class ApplyIn(BaseModel):
    cover_letter: str = Field(default='', max_length=3000)


class TimeEntryIn(BaseModel):
    application_id: int
    work_date: date
    hours: float = Field(gt=0, le=24)
    note: str = Field(default='', max_length=500)


class PayoutIn(BaseModel):
    amount: float = Field(gt=0)
    method: str = Field(min_length=1, max_length=60)


# ── Jobs ──────────────────────────────────────────────────────────────────────

@router.get('/jobs')
def list_jobs(q: str = '', category: str = '', user: dict = Depends(get_current_user),
              db: sqlite3.Connection = Depends(get_db)):
    sql = """SELECT j.*,
                (SELECT status FROM applications a WHERE a.job_id = j.id AND a.freelancer_id = ?) AS my_status,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants
             FROM jobs j WHERE j.status = 'open'"""
    params: list = [user['id']]
    if q.strip():
        sql += ' AND (j.title LIKE ? OR j.description LIKE ? OR j.client LIKE ?)'
        like = f'%{q.strip()}%'
        params += [like, like, like]
    if category:
        sql += ' AND j.category = ?'
        params.append(category)
    sql += ' ORDER BY j.created_at DESC, j.id DESC'
    return [dict(r) for r in db.execute(sql, params).fetchall()]


@router.get('/jobs/categories')
def categories(user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute("SELECT DISTINCT category FROM jobs WHERE status = 'open' ORDER BY category")
    return [r['category'] for r in rows.fetchall()]


@router.post('/jobs/{job_id}/apply', status_code=201)
def apply(job_id: int, body: ApplyIn, user: dict = Depends(require_freelancer),
          db: sqlite3.Connection = Depends(get_db)):
    job = db.execute('SELECT * FROM jobs WHERE id = ?', (job_id,)).fetchone()
    if job is None:
        raise HTTPException(status_code=404, detail='Job not found')
    if job['status'] != 'open':
        raise HTTPException(status_code=400, detail='This job is no longer accepting applications')
    existing = db.execute('SELECT * FROM applications WHERE job_id = ? AND freelancer_id = ?',
                          (job_id, user['id'])).fetchone()
    if existing and existing['status'] != 'withdrawn':
        raise HTTPException(status_code=409, detail='You have already applied to this job')
    if existing:
        db.execute("UPDATE applications SET status = 'pending', cover_letter = ?, created_at = datetime('now') WHERE id = ?",
                   (body.cover_letter.strip(), existing['id']))
        app_id = existing['id']
    else:
        app_id = db.execute(
            'INSERT INTO applications (job_id, freelancer_id, cover_letter) VALUES (?, ?, ?)',
            (job_id, user['id'], body.cover_letter.strip()),
        ).lastrowid
    db.commit()
    return dict(db.execute('SELECT * FROM applications WHERE id = ?', (app_id,)).fetchone())


@router.get('/applications')
def my_applications(user: dict = Depends(require_freelancer), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        """SELECT a.*, j.title, j.client, j.category, j.rate, j.status AS job_status
           FROM applications a JOIN jobs j ON j.id = a.job_id
           WHERE a.freelancer_id = ? ORDER BY a.created_at DESC, a.id DESC""",
        (user['id'],),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post('/applications/{app_id}/withdraw')
def withdraw(app_id: int, user: dict = Depends(require_freelancer), db: sqlite3.Connection = Depends(get_db)):
    app = db.execute('SELECT * FROM applications WHERE id = ? AND freelancer_id = ?',
                     (app_id, user['id'])).fetchone()
    if app is None:
        raise HTTPException(status_code=404, detail='Application not found')
    if app['status'] != 'pending':
        raise HTTPException(status_code=400, detail='Only pending applications can be withdrawn')
    db.execute("UPDATE applications SET status = 'withdrawn' WHERE id = ?", (app_id,))
    db.commit()
    return {'ok': True}


# ── Time tracking ─────────────────────────────────────────────────────────────

@router.get('/time')
def my_time(user: dict = Depends(require_freelancer), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        """SELECT t.*, j.title, j.client, ROUND(t.hours * t.rate, 2) AS amount
           FROM time_entries t JOIN applications a ON a.id = t.application_id
           JOIN jobs j ON j.id = a.job_id
           WHERE a.freelancer_id = ? ORDER BY t.work_date DESC, t.id DESC""",
        (user['id'],),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post('/time', status_code=201)
def log_time(body: TimeEntryIn, user: dict = Depends(require_freelancer),
             db: sqlite3.Connection = Depends(get_db)):
    app = db.execute(
        """SELECT a.*, j.rate FROM applications a JOIN jobs j ON j.id = a.job_id
           WHERE a.id = ? AND a.freelancer_id = ?""",
        (body.application_id, user['id']),
    ).fetchone()
    if app is None or app['status'] != 'accepted':
        raise HTTPException(status_code=400, detail='You can only log time on jobs you have been hired for')
    if body.work_date > date.today():
        raise HTTPException(status_code=400, detail='Work date cannot be in the future')
    logged = db.execute(
        """SELECT COALESCE(SUM(t.hours), 0) FROM time_entries t JOIN applications a ON a.id = t.application_id
           WHERE a.freelancer_id = ? AND t.work_date = ? AND t.status != 'rejected'""",
        (user['id'], body.work_date.isoformat()),
    ).fetchone()[0]
    if logged + body.hours > 24:
        raise HTTPException(status_code=400, detail=f'You already logged {logged:g}h on this day (max 24h)')
    entry_id = db.execute(
        'INSERT INTO time_entries (application_id, work_date, hours, note, rate) VALUES (?, ?, ?, ?, ?)',
        (app['id'], body.work_date.isoformat(), round(body.hours, 2), body.note.strip(), app['rate']),
    ).lastrowid
    db.commit()
    return dict(db.execute('SELECT * FROM time_entries WHERE id = ?', (entry_id,)).fetchone())


@router.delete('/time/{entry_id}')
def delete_time(entry_id: int, user: dict = Depends(require_freelancer), db: sqlite3.Connection = Depends(get_db)):
    entry = db.execute(
        """SELECT t.* FROM time_entries t JOIN applications a ON a.id = t.application_id
           WHERE t.id = ? AND a.freelancer_id = ?""",
        (entry_id, user['id']),
    ).fetchone()
    if entry is None:
        raise HTTPException(status_code=404, detail='Time entry not found')
    if entry['status'] != 'submitted':
        raise HTTPException(status_code=400, detail='Reviewed entries cannot be deleted')
    db.execute('DELETE FROM time_entries WHERE id = ?', (entry_id,))
    db.commit()
    return {'ok': True}


# ── Earnings & payouts ────────────────────────────────────────────────────────

@router.get('/earnings')
def earnings(user: dict = Depends(require_freelancer), db: sqlite3.Connection = Depends(get_db)):
    payouts = db.execute('SELECT * FROM payouts WHERE freelancer_id = ? ORDER BY created_at DESC, id DESC',
                         (user['id'],)).fetchall()
    return {**balance(db, user['id']), 'min_payout': MIN_PAYOUT, 'payouts': [dict(p) for p in payouts]}


@router.post('/payouts', status_code=201)
def request_payout(body: PayoutIn, user: dict = Depends(require_freelancer),
                   db: sqlite3.Connection = Depends(get_db)):
    amount = round(body.amount, 2)
    if amount < MIN_PAYOUT:
        raise HTTPException(status_code=400, detail=f'Minimum payout is ${MIN_PAYOUT:.2f}')
    available = balance(db, user['id'])['available']
    if amount > available + 1e-9:
        raise HTTPException(status_code=400, detail=f'Amount exceeds your available balance (${available:.2f})')
    pid = db.execute('INSERT INTO payouts (freelancer_id, amount, method) VALUES (?, ?, ?)',
                     (user['id'], amount, body.method.strip())).lastrowid
    db.commit()
    return dict(db.execute('SELECT * FROM payouts WHERE id = ?', (pid,)).fetchone())


# ── Training ──────────────────────────────────────────────────────────────────

@router.get('/courses')
def list_courses(user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        """SELECT c.*, cc.completed_at FROM courses c
           LEFT JOIN course_completions cc ON cc.course_id = c.id AND cc.freelancer_id = ?
           ORDER BY c.id""",
        (user['id'],),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post('/courses/{course_id}/complete')
def complete_course(course_id: int, user: dict = Depends(require_freelancer),
                    db: sqlite3.Connection = Depends(get_db)):
    if db.execute('SELECT 1 FROM courses WHERE id = ?', (course_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail='Course not found')
    db.execute('INSERT OR IGNORE INTO course_completions (course_id, freelancer_id) VALUES (?, ?)',
               (course_id, user['id']))
    db.commit()
    return {'ok': True}


# ── Dashboard & notifications ─────────────────────────────────────────────────

@router.get('/dashboard')
def dashboard(user: dict = Depends(require_freelancer), db: sqlite3.Connection = Depends(get_db)):
    uid = user['id']
    counts = {
        r['status']: r['n'] for r in db.execute(
            'SELECT status, COUNT(*) AS n FROM applications WHERE freelancer_id = ? GROUP BY status', (uid,))
    }
    week_hours = db.execute(
        """SELECT COALESCE(SUM(t.hours), 0) FROM time_entries t JOIN applications a ON a.id = t.application_id
           WHERE a.freelancer_id = ? AND t.status != 'rejected' AND t.work_date >= date('now', '-6 days')""",
        (uid,),
    ).fetchone()[0]
    total_courses = db.execute('SELECT COUNT(*) FROM courses').fetchone()[0]
    done_courses = db.execute('SELECT COUNT(*) FROM course_completions WHERE freelancer_id = ?', (uid,)).fetchone()[0]
    profile_fields = [user['headline'], user['bio'], user['skills'], user['country'], user['hourly_rate']]
    return {
        'balance': balance(db, uid),
        'applications': {
            'pending': counts.get('pending', 0),
            'active': counts.get('accepted', 0),
            'rejected': counts.get('rejected', 0),
        },
        'hours_last_7_days': round(week_hours, 2),
        'training': {'completed': done_courses, 'total': total_courses},
        'profile_completion': round(100 * sum(1 for f in profile_fields if f) / len(profile_fields)),
    }


@router.get('/notifications')
def notifications(user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db),
                  limit: int = Query(default=30, ge=1, le=100)):
    rows = db.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?',
                      (user['id'], limit)).fetchall()
    unread = db.execute('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0',
                        (user['id'],)).fetchone()[0]
    return {'unread': unread, 'items': [dict(r) for r in rows]}


@router.post('/notifications/read')
def mark_read(user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', (user['id'],))
    db.commit()
    return {'ok': True}
