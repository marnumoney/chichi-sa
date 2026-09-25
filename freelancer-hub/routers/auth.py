import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator

from auth import create_token, get_current_user, hash_password, public_user, verify_password
from database import get_db

router = APIRouter(prefix='/api/auth', tags=['auth'])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)

    @field_validator('name')
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Name is required')
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    headline: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=2000)
    skills: list[str] | None = Field(default=None, max_length=30)
    hourly_rate: float | None = Field(default=None, ge=0, le=1000)
    country: str | None = Field(default=None, max_length=60)
    availability: Literal['available', 'limited', 'unavailable'] | None = None


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post('/register', status_code=201)
def register(body: RegisterIn, db: sqlite3.Connection = Depends(get_db)):
    email = body.email.lower()
    if db.execute('SELECT 1 FROM users WHERE email = ?', (email,)).fetchone():
        raise HTTPException(status_code=409, detail='An account with this email already exists')
    cur = db.execute(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        (email, hash_password(body.password), body.name),
    )
    db.execute(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        (cur.lastrowid, 'Welcome! Complete your profile and finish onboarding training to start applying.'),
    )
    db.commit()
    user = db.execute('SELECT * FROM users WHERE id = ?', (cur.lastrowid,)).fetchone()
    return {'token': create_token(user['id'], user['role']), 'user': public_user(user)}


@router.post('/login')
def login(body: LoginIn, db: sqlite3.Connection = Depends(get_db)):
    user = db.execute('SELECT * FROM users WHERE email = ?', (body.email.lower(),)).fetchone()
    if user is None or not verify_password(body.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Incorrect email or password')
    return {'token': create_token(user['id'], user['role']), 'user': public_user(user)}


@router.get('/me')
def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.put('/me')
def update_profile(body: ProfileIn, user: dict = Depends(get_current_user),
                   db: sqlite3.Connection = Depends(get_db)):
    fields = body.model_dump(exclude_none=True)
    if 'name' in fields:
        fields['name'] = fields['name'].strip()
        if not fields['name']:
            raise HTTPException(status_code=422, detail='Name is required')
    if 'skills' in fields:
        cleaned = []
        for s in fields['skills']:
            s = s.strip().replace(',', ' ')[:40]
            if s and s.lower() not in (c.lower() for c in cleaned):
                cleaned.append(s)
        fields['skills'] = ','.join(cleaned)
    if fields:
        sets = ', '.join(f'{k} = ?' for k in fields)
        db.execute(f'UPDATE users SET {sets} WHERE id = ?', (*fields.values(), user['id']))
        db.commit()
    return public_user(db.execute('SELECT * FROM users WHERE id = ?', (user['id'],)).fetchone())


@router.put('/password')
def change_password(body: PasswordIn, user: dict = Depends(get_current_user),
                    db: sqlite3.Connection = Depends(get_db)):
    if not verify_password(body.current_password, user['password_hash']):
        raise HTTPException(status_code=400, detail='Current password is incorrect')
    db.execute('UPDATE users SET password_hash = ? WHERE id = ?',
               (hash_password(body.new_password), user['id']))
    db.commit()
    return {'ok': True}
