import os
from datetime import datetime, timedelta, timezone
import sqlite3

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext

from database import get_db

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')
ALGORITHM = 'HS256'
TOKEN_EXPIRY_DAYS = 7

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


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
    return dict(row)
