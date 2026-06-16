import sqlite3
from fastapi import APIRouter, Depends
from auth import get_current_buyer
from database import get_db

router = APIRouter()


@router.get('/me')
def get_me(buyer: dict = Depends(get_current_buyer), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        'SELECT * FROM transactions WHERE buyer_id = ? ORDER BY date DESC',
        (buyer['id'],)
    ).fetchall()
    purchases = [dict(r) for r in rows]
    return {'buyer': buyer, 'purchases': purchases}


@router.put('/profile')
def update_profile(body: dict, buyer: dict = Depends(get_current_buyer), db: sqlite3.Connection = Depends(get_db)):
    name = body.get('name', '').strip()
    phone = body.get('phone', '').strip()
    if name:
        db.execute('UPDATE buyers SET name = ?, phone = ? WHERE id = ?', (name, phone, buyer['id']))
        db.commit()
    row = db.execute('SELECT * FROM buyers WHERE id = ?', (buyer['id'],)).fetchone()
    result = dict(row)
    result.pop('password_hash', None)
    return result
