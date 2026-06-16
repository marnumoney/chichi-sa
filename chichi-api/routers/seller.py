import json
import sqlite3
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_seller
from database import get_db, parse_puppy
from models import KennelUpdate, PuppyCreate

router = APIRouter()


@router.get('/me')
def get_me(seller: dict = Depends(get_current_seller), db: sqlite3.Connection = Depends(get_db)):
    kennel = None
    if seller.get('kennel_id'):
        row = db.execute('SELECT * FROM kennels WHERE id = ?', (seller['kennel_id'],)).fetchone()
        if row:
            kennel = dict(row)
    return {'seller': seller, 'kennel': kennel}


@router.put('/profile')
def update_profile(
    body: KennelUpdate,
    seller: dict = Depends(get_current_seller),
    db: sqlite3.Connection = Depends(get_db),
):
    if not seller.get('kennel_id'):
        raise HTTPException(status_code=400, detail='No kennel associated with this account')
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    cols = ', '.join(f'{k} = ?' for k in updates)
    db.execute(
        f'UPDATE kennels SET {cols} WHERE id = ?',
        [*updates.values(), seller['kennel_id']]
    )
    db.commit()
    row = db.execute('SELECT * FROM kennels WHERE id = ?', (seller['kennel_id'],)).fetchone()
    return dict(row)


@router.put('/documents')
def update_documents(
    body: dict,
    seller: dict = Depends(get_current_seller),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute(
        'UPDATE sellers SET documents = ? WHERE id = ?',
        (json.dumps(body), seller['id'])
    )
    db.commit()
    return body


@router.get('/puppies')
def list_seller_puppies(
    seller: dict = Depends(get_current_seller),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute(
        'SELECT * FROM puppies WHERE kennel_id = ?', (seller['kennel_id'],)
    ).fetchall()
    return [parse_puppy(r) for r in rows]


@router.post('/puppies', status_code=201)
def add_puppy(
    body: PuppyCreate,
    seller: dict = Depends(get_current_seller),
    db: sqlite3.Connection = Depends(get_db),
):
    if not seller.get('kennel_id'):
        raise HTTPException(status_code=400, detail='No kennel associated with this account')
    puppy_id = f'p{uuid.uuid4().hex[:8]}'
    db.execute("""
        INSERT INTO puppies
        (id, kennel_id, name, coat_type, gender, color, dob, price, sold,
         breeding_rights, images, pedigree, health, description, registration_no)
        VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)
    """, (
        puppy_id, seller['kennel_id'], body.name, body.coat_type, body.gender,
        body.color, body.dob, body.price, int(body.breeding_rights),
        json.dumps(body.images), json.dumps(body.pedigree), json.dumps(body.health),
        body.description, body.registration_no,
    ))
    db.commit()
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    return parse_puppy(row)


@router.delete('/puppies/{puppy_id}')
def delist_puppy(
    puppy_id: str,
    seller: dict = Depends(get_current_seller),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Puppy not found')
    if dict(row)['kennel_id'] != seller['kennel_id']:
        raise HTTPException(status_code=403, detail='Not your puppy')
    db.execute('DELETE FROM puppies WHERE id = ?', (puppy_id,))
    db.commit()
    return {'ok': True}
