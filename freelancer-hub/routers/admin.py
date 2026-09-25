import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import public_user, require_admin
from database import balance, get_db, notify

router = APIRouter(prefix='/api/admin', tags=['admin'])


class JobIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    client: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=60)
    description: str = Field(default='', max_length=5000)
    rate: float = Field(ge=0, le=1000)
    hours_per_week: int = Field(default=0, ge=0, le=80)


class JobPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    client: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=5000)
    rate: float | None = Field(default=None, ge=0, le=1000)
    hours_per_week: int | None = Field(default=None, ge=0, le=80)
    status: Literal['open', 'closed'] | None = None


class DecisionIn(BaseModel):
    status: Literal['accepted', 'rejected']


class TimeDecisionIn(BaseModel):
    status: Literal['approved', 'rejected']


class PayoutDecisionIn(BaseModel):
    status: Literal['paid', 'rejected']


class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(default='', max_length=300)
    content: str = Field(default='', max_length=20000)
    minutes: int = Field(default=10, ge=1, le=600)


def _job(db, job_id):
    job = db.execute('SELECT * FROM jobs WHERE id = ?', (job_id,)).fetchone()
    if job is None:
        raise HTTPException(status_code=404, detail='Job not found')
    return job


@router.get('/stats')
def stats(admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    one = lambda sql: db.execute(sql).fetchone()[0]
    return {
        'freelancers': one("SELECT COUNT(*) FROM users WHERE role = 'freelancer'"),
        'open_jobs': one("SELECT COUNT(*) FROM jobs WHERE status = 'open'"),
        'pending_applications': one("SELECT COUNT(*) FROM applications WHERE status = 'pending'"),
        'pending_time_entries': one("SELECT COUNT(*) FROM time_entries WHERE status = 'submitted'"),
        'pending_payouts': one("SELECT COUNT(*) FROM payouts WHERE status = 'requested'"),
        'approved_billings': round(one("SELECT COALESCE(SUM(hours * rate), 0) FROM time_entries WHERE status = 'approved'"), 2),
    }


# ── Jobs ──────────────────────────────────────────────────────────────────────

@router.get('/jobs')
def all_jobs(admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        """SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'pending') AS pending,
                  (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'accepted') AS hired
           FROM jobs j ORDER BY j.status = 'closed', j.created_at DESC, j.id DESC"""
    ).fetchall()
    return [dict(r) for r in rows]


@router.post('/jobs', status_code=201)
def create_job(body: JobIn, admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    data = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items()}
    for k in ('title', 'client', 'category'):
        if not data[k]:
            raise HTTPException(status_code=422, detail=f'{k.capitalize()} is required')
    jid = db.execute(
        'INSERT INTO jobs (title, client, category, description, rate, hours_per_week) VALUES (?, ?, ?, ?, ?, ?)',
        (data['title'], data['client'], data['category'], data['description'], data['rate'], data['hours_per_week']),
    ).lastrowid
    db.commit()
    return dict(_job(db, jid))


@router.patch('/jobs/{job_id}')
def update_job(job_id: int, body: JobPatch, admin: dict = Depends(require_admin),
               db: sqlite3.Connection = Depends(get_db)):
    _job(db, job_id)
    fields = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump(exclude_none=True).items()}
    for k in ('title', 'client', 'category'):
        if k in fields and not fields[k]:
            raise HTTPException(status_code=422, detail=f'{k.capitalize()} is required')
    if fields:
        sets = ', '.join(f'{k} = ?' for k in fields)
        db.execute(f'UPDATE jobs SET {sets} WHERE id = ?', (*fields.values(), job_id))
        db.commit()
    return dict(_job(db, job_id))


@router.delete('/jobs/{job_id}')
def delete_job(job_id: int, admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    _job(db, job_id)
    has_time = db.execute(
        'SELECT 1 FROM time_entries t JOIN applications a ON a.id = t.application_id WHERE a.job_id = ? LIMIT 1',
        (job_id,),
    ).fetchone()
    if has_time:
        raise HTTPException(status_code=400, detail='This job has logged time. Close it instead of deleting it.')
    db.execute('DELETE FROM jobs WHERE id = ?', (job_id,))
    db.commit()
    return {'ok': True}


# ── Applications ──────────────────────────────────────────────────────────────

@router.get('/applications')
def applications(status: str = '', admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    sql = """SELECT a.*, j.title, j.client, u.name AS freelancer_name, u.email AS freelancer_email,
                    u.headline, u.skills, u.hourly_rate
             FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.freelancer_id"""
    params = []
    if status:
        sql += ' WHERE a.status = ?'
        params.append(status)
    sql += ' ORDER BY a.status != \'pending\', a.created_at DESC, a.id DESC'
    return [dict(r) for r in db.execute(sql, params).fetchall()]


@router.post('/applications/{app_id}/decision')
def decide_application(app_id: int, body: DecisionIn, admin: dict = Depends(require_admin),
                       db: sqlite3.Connection = Depends(get_db)):
    app = db.execute(
        'SELECT a.*, j.title FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?', (app_id,)
    ).fetchone()
    if app is None:
        raise HTTPException(status_code=404, detail='Application not found')
    if app['status'] != 'pending':
        raise HTTPException(status_code=400, detail=f"Application is already {app['status']}")
    db.execute('UPDATE applications SET status = ? WHERE id = ?', (body.status, app_id))
    msg = (f"You've been hired for \"{app['title']}\". You can now log time on it."
           if body.status == 'accepted' else f"Your application for \"{app['title']}\" was not successful this time.")
    notify(db, app['freelancer_id'], msg)
    db.commit()
    return {'ok': True}


# ── Timesheets ────────────────────────────────────────────────────────────────

@router.get('/time')
def time_entries(status: str = '', admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    sql = """SELECT t.*, ROUND(t.hours * t.rate, 2) AS amount, j.title, j.client,
                    u.name AS freelancer_name, u.id AS freelancer_id
             FROM time_entries t JOIN applications a ON a.id = t.application_id
             JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.freelancer_id"""
    params = []
    if status:
        sql += ' WHERE t.status = ?'
        params.append(status)
    sql += " ORDER BY t.status != 'submitted', t.work_date DESC, t.id DESC"
    return [dict(r) for r in db.execute(sql, params).fetchall()]


@router.post('/time/{entry_id}/decision')
def decide_time(entry_id: int, body: TimeDecisionIn, admin: dict = Depends(require_admin),
                db: sqlite3.Connection = Depends(get_db)):
    entry = db.execute(
        """SELECT t.*, a.freelancer_id, j.title FROM time_entries t JOIN applications a ON a.id = t.application_id
           JOIN jobs j ON j.id = a.job_id WHERE t.id = ?""",
        (entry_id,),
    ).fetchone()
    if entry is None:
        raise HTTPException(status_code=404, detail='Time entry not found')
    if entry['status'] != 'submitted':
        raise HTTPException(status_code=400, detail=f"Entry is already {entry['status']}")
    db.execute('UPDATE time_entries SET status = ? WHERE id = ?', (body.status, entry_id))
    notify(db, entry['freelancer_id'],
           f"{entry['hours']:g}h on \"{entry['title']}\" ({entry['work_date']}) was {body.status}.")
    db.commit()
    return {'ok': True}


# ── Payouts ───────────────────────────────────────────────────────────────────

@router.get('/payouts')
def payouts(admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        """SELECT p.*, u.name AS freelancer_name, u.email AS freelancer_email FROM payouts p
           JOIN users u ON u.id = p.freelancer_id ORDER BY p.status != 'requested', p.created_at DESC, p.id DESC"""
    ).fetchall()
    return [dict(r) for r in rows]


@router.post('/payouts/{payout_id}/decision')
def decide_payout(payout_id: int, body: PayoutDecisionIn, admin: dict = Depends(require_admin),
                  db: sqlite3.Connection = Depends(get_db)):
    p = db.execute('SELECT * FROM payouts WHERE id = ?', (payout_id,)).fetchone()
    if p is None:
        raise HTTPException(status_code=404, detail='Payout not found')
    if p['status'] != 'requested':
        raise HTTPException(status_code=400, detail=f"Payout is already {p['status']}")
    db.execute('UPDATE payouts SET status = ? WHERE id = ?', (body.status, payout_id))
    notify(db, p['freelancer_id'],
           f"Your payout of ${p['amount']:.2f} was {'sent' if body.status == 'paid' else 'declined'}.")
    db.commit()
    return {'ok': True}


# ── Freelancers ───────────────────────────────────────────────────────────────

@router.get('/freelancers')
def freelancers(admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute("SELECT * FROM users WHERE role = 'freelancer' ORDER BY created_at DESC, id DESC").fetchall()
    total_courses = db.execute('SELECT COUNT(*) FROM courses').fetchone()[0]
    out = []
    for r in rows:
        u = public_user(r)
        u['balance'] = balance(db, r['id'])
        u['active_jobs'] = db.execute(
            "SELECT COUNT(*) FROM applications WHERE freelancer_id = ? AND status = 'accepted'", (r['id'],)
        ).fetchone()[0]
        u['training'] = {
            'completed': db.execute('SELECT COUNT(*) FROM course_completions WHERE freelancer_id = ?',
                                    (r['id'],)).fetchone()[0],
            'total': total_courses,
        }
        out.append(u)
    return out


# ── Courses ───────────────────────────────────────────────────────────────────

@router.post('/courses', status_code=201)
def create_course(body: CourseIn, admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail='Title is required')
    cid = db.execute('INSERT INTO courses (title, summary, content, minutes) VALUES (?, ?, ?, ?)',
                     (body.title.strip(), body.summary.strip(), body.content.strip(), body.minutes)).lastrowid
    db.commit()
    return dict(db.execute('SELECT * FROM courses WHERE id = ?', (cid,)).fetchone())


@router.delete('/courses/{course_id}')
def delete_course(course_id: int, admin: dict = Depends(require_admin), db: sqlite3.Connection = Depends(get_db)):
    if db.execute('SELECT 1 FROM courses WHERE id = ?', (course_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail='Course not found')
    db.execute('DELETE FROM courses WHERE id = ?', (course_id,))
    db.commit()
    return {'ok': True}
