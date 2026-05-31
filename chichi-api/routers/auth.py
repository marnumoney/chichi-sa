import os
import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from auth import create_token, hash_password, verify_password
from database import get_db
from models import LoginRequest, SignupRequest

router = APIRouter()


@router.post('/admin/login')
def admin_login(body: LoginRequest):
    admin_email = os.getenv('ADMIN_EMAIL', 'admin@chihuahuasa.co.za')
    admin_hash = os.getenv('ADMIN_PASSWORD_HASH', '')
    if body.email != admin_email:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    if not admin_hash or not verify_password(body.password, admin_hash):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    token = create_token({'role': 'admin', 'email': body.email})
    return {'token': token}


@router.post('/seller/login')
def seller_login(body: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT * FROM sellers WHERE email = ?', (body.email,)).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    seller = dict(row)
    if not verify_password(body.password, seller['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    if seller['status'] == 'pending_verification':
        raise HTTPException(status_code=403, detail='Account pending admin verification')
    if seller['status'] == 'pending_payment':
        raise HTTPException(status_code=403, detail='Membership payment outstanding')
    token = create_token({'seller_id': seller['id']})
    seller.pop('password_hash')
    kennel = None
    if seller.get('kennel_id'):
        k = db.execute('SELECT * FROM kennels WHERE id = ?', (seller['kennel_id'],)).fetchone()
        if k:
            kennel = dict(k)
    return {'token': token, 'seller': {**seller, 'kennel': kennel}}


@router.post('/seller/signup', status_code=201)
def seller_signup(body: SignupRequest, db: sqlite3.Connection = Depends(get_db)):
    existing = db.execute('SELECT id FROM sellers WHERE email = ?', (body.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail='Email already registered')
    import uuid
    seller_id = f's{uuid.uuid4().hex[:8]}'
    today = date.today().isoformat()
    db.execute("""
        INSERT INTO sellers (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES (?, ?, ?, ?, NULL, 'pending_verification', ?)
    """, (seller_id, body.email, hash_password(body.password), body.name, today))
    db.commit()
    row = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    seller = dict(row)
    seller.pop('password_hash')
    return seller
