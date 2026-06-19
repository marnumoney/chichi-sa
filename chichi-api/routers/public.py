import sqlite3
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, parse_puppy
from models import TestimonialCreate

router = APIRouter()


@router.get('/kennels')
def list_kennels(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM kennels WHERE status = 'approved' ORDER BY name"
    ).fetchall()
    return [dict(r) for r in rows]


@router.get('/kennels/{slug}')
def get_kennel(slug: str, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT * FROM kennels WHERE slug = ?', (slug,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Kennel not found')
    kennel = dict(row)
    puppy_rows = db.execute(
        "SELECT * FROM puppies WHERE kennel_id = ? AND sold = 0", (kennel['id'],)
    ).fetchall()
    return {'kennel': kennel, 'puppies': [parse_puppy(p) for p in puppy_rows]}


@router.get('/puppies')
def list_puppies(
    coat: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    sold: Optional[str] = Query(None),
    db: sqlite3.Connection = Depends(get_db),
):
    query = 'SELECT * FROM puppies WHERE 1=1'
    params: list = []
    if coat:
        query += ' AND coat_type = ?'
        params.append(coat)
    if gender:
        query += ' AND gender = ?'
        params.append(gender)
    if sold is not None:
        query += ' AND sold = ?'
        params.append(1 if sold.lower() == 'true' else 0)
    rows = db.execute(query, params).fetchall()
    return [parse_puppy(r) for r in rows]


@router.get('/puppies/{puppy_id}')
def get_puppy(puppy_id: str, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Puppy not found')
    return parse_puppy(row)


@router.get('/testimonials')
def list_testimonials(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute('SELECT * FROM testimonials ORDER BY date DESC').fetchall()
    return [dict(r) for r in rows]


@router.post('/testimonials', status_code=201)
def submit_testimonial(body: TestimonialCreate, db: sqlite3.Connection = Depends(get_db)):
    tid = f't{uuid.uuid4().hex[:8]}'
    db.execute(
        'INSERT INTO testimonials (id, kennel_id, buyer_name, stars, text, date) VALUES (?,?,?,?,?,?)',
        (tid, body.kennel_id, body.buyer_name, body.stars, body.text, date.today().isoformat())
    )
    db.commit()
    return dict(db.execute('SELECT * FROM testimonials WHERE id = ?', (tid,)).fetchone())


@router.get('/legal')
def get_legal(db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT content FROM legal_text WHERE id = 1').fetchone()
    return {'content': row['content'] if row else ''}


@router.get('/sellers/{seller_id}/payment-info')
def get_seller_payment_info(seller_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Returns minimal public info needed to render the membership payment page."""
    seller = db.execute(
        'SELECT id, name, kennel_id, status FROM sellers WHERE id = ?', (seller_id,)
    ).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)
    kennel = None
    if seller.get('kennel_id'):
        row = db.execute('SELECT * FROM kennels WHERE id = ?', (seller['kennel_id'],)).fetchone()
        if row:
            kennel = dict(row)
    return {'seller': seller, 'kennel': kennel}
