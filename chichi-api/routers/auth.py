import json
import os
import secrets
import sqlite3
import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional

from auth import create_token, hash_password, verify_password
from database import get_db, parse_seller
from models import LoginRequest, SignupRequest

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')


class BuyerSignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = ''

router = APIRouter()


@router.post('/admin/login')
def admin_login(body: LoginRequest):
    admin_email = os.getenv('ADMIN_EMAIL', 'chihuahuasouthafrica@gmail.com')
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
    kennel = None
    if seller.get('kennel_id'):
        k = db.execute('SELECT * FROM kennels WHERE id = ?', (seller['kennel_id'],)).fetchone()
        if k:
            kennel = dict(k)
    return {'token': token, 'seller': {**parse_seller(row), 'kennel': kennel}}


@router.post('/seller/signup', status_code=201)
def seller_signup(body: SignupRequest, db: sqlite3.Connection = Depends(get_db)):
    existing = db.execute('SELECT id FROM sellers WHERE email = ?', (body.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail='Email already registered')
    import uuid
    seller_id = f's{uuid.uuid4().hex[:8]}'
    today = date.today().isoformat()
    db.execute("""
        INSERT INTO sellers (id, email, password_hash, name, kennel_id, status, joined_date,
                             kennel_name, registry, phone, province, documents)
        VALUES (?, ?, ?, ?, NULL, 'pending_verification', ?, ?, ?, ?, ?, ?)
    """, (seller_id, body.email, hash_password(body.password), body.name, today,
          body.kennel_name or '', body.registry or 'KUSA',
          body.phone or '', body.province or '',
          json.dumps(body.documents or {})))
    db.commit()
    row = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    return parse_seller(row)


@router.post('/buyer/signup', status_code=201)
def buyer_signup(body: BuyerSignupRequest, db: sqlite3.Connection = Depends(get_db)):
    existing = db.execute('SELECT id FROM buyers WHERE email = ?', (body.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail='Email already registered')
    buyer_id = f'b{uuid.uuid4().hex[:8]}'
    db.execute("""
        INSERT INTO buyers (id, email, password_hash, name, phone, joined_date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (buyer_id, body.email, hash_password(body.password), body.name,
          body.phone or '', date.today().isoformat()))
    db.commit()
    row = db.execute('SELECT * FROM buyers WHERE id = ?', (buyer_id,)).fetchone()
    buyer = dict(row)
    buyer.pop('password_hash', None)
    token = create_token({'buyer_id': buyer_id})
    return {'token': token, 'buyer': buyer}


@router.post('/buyer/login')
def buyer_login(body: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT * FROM buyers WHERE email = ?', (body.email,)).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    buyer = dict(row)
    if not verify_password(body.password, buyer['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    buyer.pop('password_hash', None)
    token = create_token({'buyer_id': buyer['id']})
    return {'token': token, 'buyer': buyer}


def _send_reset_email(email: str, reset_link: str, name: str):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_user = os.getenv('SMTP_USER', 'chihuahuasouthafrica@gmail.com')
    smtp_pass = os.getenv('SMTP_PASSWORD', '')
    if not smtp_pass:
        print(f'[email] SMTP_PASSWORD not set — reset link: {reset_link}')
        return

    body = (
        f'Hi {name},\n\n'
        f'We received a request to reset your Chihuahua SA password.\n\n'
        f'Click the link below to set a new password (valid for 1 hour):\n\n'
        f'{reset_link}\n\n'
        f'If you did not request this, you can safely ignore this email.\n\n'
        f'— Chihuahua South Africa'
    )
    msg = MIMEMultipart()
    msg['From'] = f'Chihuahua South Africa <{smtp_user}>'
    msg['To'] = email
    msg['Subject'] = 'Reset your Chihuahua SA password'
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f'[email] Reset email sent to {email}')
    except Exception as e:
        print(f'[email] Failed to send to {email}: {e}')


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post('/buyer/forgot-password')
async def buyer_forgot_password(body: ForgotPasswordRequest, db: sqlite3.Connection = Depends(get_db)):
    email = body.email
    row = db.execute('SELECT * FROM buyers WHERE email = ?', (email,)).fetchone()
    # Always return 200 so we don't reveal whether the email exists
    if not row:
        return {'ok': True}
    buyer = dict(row)
    token = secrets.token_urlsafe(32)
    expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    db.execute('UPDATE buyers SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
               (token, expiry, buyer['id']))
    db.commit()
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}&type=buyer"
    _send_reset_email(buyer['email'], reset_link, buyer['name'])
    return {'ok': True}


@router.post('/buyer/reset-password')
def buyer_reset_password(body: dict, db: sqlite3.Connection = Depends(get_db)):
    token = body.get('token', '')
    new_password = body.get('password', '')
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters')
    row = db.execute('SELECT * FROM buyers WHERE reset_token = ?', (token,)).fetchone()
    if not row:
        raise HTTPException(status_code=400, detail='Invalid or expired reset link')
    buyer = dict(row)
    expiry = buyer.get('reset_token_expiry', '')
    if not expiry or datetime.fromisoformat(expiry) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail='Reset link has expired')
    db.execute("UPDATE buyers SET password_hash = ?, reset_token = '', reset_token_expiry = '' WHERE id = ?",
               (hash_password(new_password), buyer['id']))
    db.commit()
    return {'ok': True}


@router.post('/seller/forgot-password')
async def seller_forgot_password(body: ForgotPasswordRequest, db: sqlite3.Connection = Depends(get_db)):
    email = body.email
    row = db.execute('SELECT * FROM sellers WHERE email = ?', (email,)).fetchone()
    if not row:
        return {'ok': True}
    seller = dict(row)
    token = secrets.token_urlsafe(32)
    expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    db.execute('UPDATE sellers SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
               (token, expiry, seller['id']))
    db.commit()
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}&type=seller"
    _send_reset_email(seller['email'], reset_link, seller['name'] or 'Breeder')
    return {'ok': True}


@router.post('/seller/reset-password')
def seller_reset_password(body: dict, db: sqlite3.Connection = Depends(get_db)):
    token = body.get('token', '')
    new_password = body.get('password', '')
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters')
    row = db.execute('SELECT * FROM sellers WHERE reset_token = ?', (token,)).fetchone()
    if not row:
        raise HTTPException(status_code=400, detail='Invalid or expired reset link')
    seller = dict(row)
    expiry = seller.get('reset_token_expiry', '')
    if not expiry or datetime.fromisoformat(expiry) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail='Reset link has expired')
    db.execute("UPDATE sellers SET password_hash = ?, reset_token = '', reset_token_expiry = '' WHERE id = ?",
               (hash_password(new_password), seller['id']))
    db.commit()
    return {'ok': True}
