import os
import warnings
from datetime import datetime, timedelta, timezone
import sqlite3

import bcrypt as _bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_db, parse_seller

_secret = os.getenv('SECRET_KEY')
if not _secret:
    warnings.warn('SECRET_KEY not set — using insecure default. Set it before going live.')
    _secret = 'dev-secret-change-in-production'
SECRET_KEY = _secret

ALGORITHM = 'HS256'
TOKEN_EXPIRY_DAYS = 7

bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(payload: dict) -> str:
    data = payload.copy()
    data['exp'] = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS)
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    payload = decode_token(credentials.credentials)
    if payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    return payload


def get_current_seller(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    payload = decode_token(credentials.credentials)
    seller_id = payload.get('seller_id')
    if not seller_id:
        raise HTTPException(status_code=403, detail='Seller access required')
    row = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Seller not found')
    return parse_seller(row)


def get_current_buyer(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    payload = decode_token(credentials.credentials)
    buyer_id = payload.get('buyer_id')
    if not buyer_id:
        raise HTTPException(status_code=403, detail='Buyer access required')
    row = db.execute('SELECT * FROM buyers WHERE id = ?', (buyer_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Buyer not found')
    buyer = dict(row)
    buyer.pop('password_hash', None)
    return buyer
