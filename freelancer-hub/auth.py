import os
import sqlite3
import warnings
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import get_db

_secret = os.getenv('SECRET_KEY')
if not _secret:
    warnings.warn('SECRET_KEY not set — using insecure default. Set it before going live.')
    _secret = 'dev-secret-change-in-production'
SECRET_KEY = _secret

ALGORITHM = 'HS256'
TOKEN_EXPIRY_DAYS = 7

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user_id: int, role: str) -> str:
    payload = {
        'sub': str(user_id),
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload['sub'])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Session expired, please log in again')
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail='Invalid token')
    row = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail='Account no longer exists')
    return dict(row)


def require_freelancer(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] != 'freelancer':
        raise HTTPException(status_code=403, detail='Freelancer access required')
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    return user


def public_user(row) -> dict:
    user = dict(row)
    user.pop('password_hash', None)
    user['skills'] = [s for s in (user.get('skills') or '').split(',') if s]
    return user
