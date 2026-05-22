# Chichi Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a FastAPI + SQLite backend to the Chichi Chihuahua marketplace so all data persists across page refreshes.

**Architecture:** A new `chichi-api/` folder contains a FastAPI server with SQLite. The React frontend's `AppContext.jsx` is refactored to call the API instead of reading from `mockData.js`. UI components are untouched.

**Tech Stack:** Python 3.11+, FastAPI 0.115, SQLite (stdlib sqlite3), PyJWT 2.9, passlib[bcrypt] 1.7.4, pytest, httpx

---

## File Map

**New files — `chichi-api/`**
- `requirements.txt` — Python dependencies
- `.env.example` — template for secrets
- `main.py` — FastAPI app, CORS, lifespan, router wiring
- `database.py` — `get_db()` dependency, `create_tables()`, `parse_puppy()`, `parse_transaction()`
- `auth.py` — `hash_password`, `verify_password`, `create_token`, `decode_token`, `get_current_admin`, `get_current_seller`
- `models.py` — Pydantic request schemas (input validation)
- `seed.py` — one-time script: inserts all mock data into `chichi.db`
- `routers/__init__.py` — empty
- `routers/public.py` — GET /kennels, /kennels/{slug}, /puppies, /puppies/{id}, /testimonials
- `routers/auth.py` — POST /auth/admin/login, /auth/seller/login, /auth/seller/signup
- `routers/seller.py` — GET/PUT /seller/me, /seller/profile, GET/POST/DELETE /seller/puppies/{id}
- `routers/admin.py` — all /admin/* routes
- `routers/transactions.py` — POST /transactions, POST /admin/transactions/{id}/release
- `tests/__init__.py` — empty
- `tests/conftest.py` — in-memory DB fixture, TestClient fixture, seeded data fixture
- `tests/test_public.py`
- `tests/test_auth.py`
- `tests/test_seller.py`
- `tests/test_admin.py`
- `tests/test_transactions.py`

**Modified — `chichi/src/`**
- `context/AppContext.jsx` — replace mock data + state mutations with fetch() calls
- `pages/admin/AdminLogin.jsx` — add `await` to `loginAdmin()` call
- `pages/seller/SellerLogin.jsx` — add `await` to `loginSeller()` call
- `pages/seller/SellerSignup.jsx` — add `await` to `signupSeller()` call
- `pages/PuppyDetailPage.jsx` — add `await` to `purchasePuppy()` call

---

## Task 1: Project scaffold, DB schema, and test infrastructure

**Files:**
- Create: `chichi-api/requirements.txt`
- Create: `chichi-api/.env.example`
- Create: `chichi-api/database.py`
- Create: `chichi-api/main.py`
- Create: `chichi-api/routers/__init__.py`
- Create: `chichi-api/tests/__init__.py`
- Create: `chichi-api/tests/conftest.py`
- Test: `chichi-api/tests/test_db.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p chichi-api/routers chichi-api/tests
touch chichi-api/routers/__init__.py chichi-api/tests/__init__.py
```

- [ ] **Step 2: Write `chichi-api/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
PyJWT==2.9.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.1
pytest==8.3.3
httpx==0.27.2
```

- [ ] **Step 3: Create virtualenv and install**

```bash
cd chichi-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: all packages install without errors.

- [ ] **Step 4: Write failing test for DB table creation**

Create `chichi-api/tests/test_db.py`:

```python
import sqlite3
from database import create_tables

def test_all_tables_created():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    create_tables(conn)
    tables = {r['name'] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    assert 'kennels' in tables
    assert 'puppies' in tables
    assert 'sellers' in tables
    assert 'transactions' in tables
    assert 'testimonials' in tables
    assert 'admin_settings' in tables
    assert 'legal_text' in tables
    conn.close()
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd chichi-api && source .venv/bin/activate
pytest tests/test_db.py -v
```

Expected: `ModuleNotFoundError: No module named 'database'`

- [ ] **Step 6: Write `chichi-api/database.py`**

```python
import sqlite3
import json
import os

DB_PATH = os.getenv('DB_PATH', 'chichi.db')


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    return conn


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def create_tables(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS kennels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            registry TEXT,
            initials TEXT,
            color TEXT,
            description TEXT,
            location TEXT,
            contact TEXT,
            phone TEXT,
            membership_status TEXT DEFAULT 'pending_payment',
            membership_expiry TEXT,
            commission REAL DEFAULT 8.0,
            status TEXT DEFAULT 'pending',
            referred_by TEXT,
            referral_code TEXT
        );

        CREATE TABLE IF NOT EXISTS puppies (
            id TEXT PRIMARY KEY,
            kennel_id TEXT NOT NULL,
            name TEXT NOT NULL,
            coat_type TEXT,
            gender TEXT,
            color TEXT,
            dob TEXT,
            price REAL,
            sold INTEGER DEFAULT 0,
            breeding_rights INTEGER DEFAULT 0,
            images TEXT DEFAULT '[]',
            pedigree TEXT DEFAULT '{}',
            health TEXT DEFAULT '[]',
            description TEXT,
            registration_no TEXT
        );

        CREATE TABLE IF NOT EXISTS sellers (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            kennel_id TEXT,
            status TEXT DEFAULT 'pending_verification',
            joined_date TEXT,
            warning_date TEXT
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            puppy_id TEXT,
            puppy_name TEXT,
            kennel_id TEXT,
            kennel_name TEXT,
            buyer_name TEXT,
            buyer_email TEXT,
            amount REAL,
            commission REAL,
            seller_payout REAL,
            seller_paid INTEGER DEFAULT 0,
            commission_paid INTEGER DEFAULT 0,
            date TEXT,
            seller_paid_date TEXT,
            commission_paid_date TEXT
        );

        CREATE TABLE IF NOT EXISTS testimonials (
            id TEXT PRIMARY KEY,
            kennel_id TEXT,
            buyer_name TEXT,
            stars INTEGER,
            text TEXT,
            date TEXT
        );

        CREATE TABLE IF NOT EXISTS admin_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            default_commission REAL DEFAULT 8.0,
            membership_fee_annual REAL DEFAULT 1200.0,
            referral_discount REAL DEFAULT 1.5,
            site_name TEXT DEFAULT 'Chihuahua South Africa',
            tagline TEXT DEFAULT 'South Africa''s Premier Chihuahua Marketplace',
            admin_bank_name TEXT DEFAULT '',
            admin_account_holder TEXT DEFAULT 'Chihuahua South Africa',
            admin_account_number TEXT DEFAULT '',
            admin_branch_code TEXT DEFAULT '',
            admin_account_type TEXT DEFAULT 'Cheque / Current'
        );

        INSERT OR IGNORE INTO admin_settings (id) VALUES (1);

        CREATE TABLE IF NOT EXISTS legal_text (
            id INTEGER PRIMARY KEY DEFAULT 1,
            content TEXT DEFAULT ''
        );

        INSERT OR IGNORE INTO legal_text (id) VALUES (1);
    """)
    conn.commit()


def parse_puppy(row) -> dict:
    d = dict(row)
    d['images'] = json.loads(d.get('images') or '[]')
    d['pedigree'] = json.loads(d.get('pedigree') or '{}')
    d['health'] = json.loads(d.get('health') or '[]')
    d['sold'] = bool(d.get('sold', 0))
    d['breeding_rights'] = bool(d.get('breeding_rights', 0))
    return d


def parse_transaction(row) -> dict:
    d = dict(row)
    d['seller_paid'] = bool(d.get('seller_paid', 0))
    d['commission_paid'] = bool(d.get('commission_paid', 0))
    return d
```

- [ ] **Step 7: Write `chichi-api/main.py`** (minimal, routers added in later tasks)

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_connection, create_tables

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = get_connection()
    create_tables(conn)
    conn.close()
    yield


app = FastAPI(title='Chichi API', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)
```

- [ ] **Step 8: Write `chichi-api/.env.example`**

```
SECRET_KEY=change-me-to-a-long-random-string
ADMIN_EMAIL=admin@chihuahuasa.co.za
ADMIN_PASSWORD_HASH=
DB_PATH=chichi.db
```

- [ ] **Step 9: Write `chichi-api/tests/conftest.py`**

```python
import sqlite3
import pytest
from fastapi.testclient import TestClient
from main import app
from database import get_db, create_tables
from auth import hash_password


@pytest.fixture
def test_db():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    create_tables(conn)
    yield conn
    conn.close()


@pytest.fixture
def client(test_db):
    app.dependency_overrides[get_db] = lambda: test_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_client(test_db):
    """Client with one kennel, one puppy, and one approved seller seeded."""
    test_db.execute("""
        INSERT INTO kennels (id, name, slug, registry, initials, color,
            description, location, contact, phone,
            membership_status, membership_expiry, commission, status)
        VALUES ('k1', 'Test Kennel', 'test-kennel', 'KUSA', 'TK', '#B5651D',
            'A test kennel', 'Johannesburg', 'test@kennel.co.za', '+27 82 000 0000',
            'active', '2027-01-01', 8.0, 'approved')
    """)
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, coat_type, gender, color,
            dob, price, sold, breeding_rights, images, pedigree, health,
            description, registration_no)
        VALUES ('p1', 'k1', 'Duchess', 'Long Coat', 'Female', 'Cream',
            '2025-12-10', 15500.0, 0, 1,
            '["https://example.com/img.jpg"]',
            '{"sire": "Test Sire"}',
            '["Inoculation Up to Date"]',
            'A lovely puppy', 'KUSA-2025-CHI-0001')
    """)
    test_db.execute("""
        INSERT INTO sellers (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES ('s1', 'seller@test.co.za', ?, 'Test Seller', 'k1', 'approved', '2024-01-01')
    """, (hash_password('seller123'),))
    test_db.commit()

    app.dependency_overrides[get_db] = lambda: test_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 10: Run DB test to verify it now passes**

```bash
cd chichi-api && source .venv/bin/activate
pytest tests/test_db.py -v
```

Expected: `PASSED`

- [ ] **Step 11: Verify the app starts**

```bash
cd chichi-api && source .venv/bin/activate
uvicorn main:app --reload
```

Expected: `Application startup complete.` Visit http://localhost:8000/docs — should show empty API docs page.

- [ ] **Step 12: Commit**

```bash
cd chichi-api
git add requirements.txt .env.example main.py database.py routers/__init__.py tests/__init__.py tests/conftest.py tests/test_db.py
git commit -m "feat: chichi-api scaffold — DB schema and test infrastructure"
```

---

## Task 2: Auth utilities

**Files:**
- Create: `chichi-api/auth.py`
- Create: `chichi-api/models.py`
- Test: `chichi-api/tests/test_auth_utils.py`

- [ ] **Step 1: Write failing tests for auth utilities**

Create `chichi-api/tests/test_auth_utils.py`:

```python
from auth import hash_password, verify_password, create_token, decode_token


def test_hash_and_verify_password():
    hashed = hash_password('mysecret')
    assert hashed != 'mysecret'
    assert verify_password('mysecret', hashed)
    assert not verify_password('wrongpassword', hashed)


def test_create_and_decode_token():
    payload = {'role': 'admin', 'email': 'admin@test.co.za'}
    token = create_token(payload)
    decoded = decode_token(token)
    assert decoded['role'] == 'admin'
    assert decoded['email'] == 'admin@test.co.za'


def test_decode_token_invalid_raises():
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as exc:
        decode_token('not.a.valid.token')
    assert exc.value.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd chichi-api && source .venv/bin/activate
pytest tests/test_auth_utils.py -v
```

Expected: `ModuleNotFoundError: No module named 'auth'`

- [ ] **Step 3: Write `chichi-api/auth.py`**

```python
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
```

- [ ] **Step 4: Write `chichi-api/models.py`**

```python
from pydantic import BaseModel
from typing import Optional, List


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    province: str
    kennel_name: str
    registry: str


class PuppyCreate(BaseModel):
    name: str
    coat_type: str
    gender: str
    color: str
    dob: str
    price: float
    breeding_rights: bool = False
    images: List[str] = []
    pedigree: dict = {}
    health: List[str] = []
    description: str = ''
    registration_no: str = ''


class KennelCreate(BaseModel):
    name: str
    slug: str
    registry: str
    description: str = ''
    location: str = ''
    contact: str = ''
    phone: str = ''
    commission: float = 8.0
    initials: str = ''
    color: str = '#B5651D'
    referral_code: Optional[str] = None


class KennelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    contact: Optional[str] = None
    phone: Optional[str] = None
    commission: Optional[float] = None
    initials: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    membership_status: Optional[str] = None
    membership_expiry: Optional[str] = None
    referral_code: Optional[str] = None
    slug: Optional[str] = None


class SellerCreate(BaseModel):
    email: str
    password: str
    name: str
    kennel_id: Optional[str] = None
    status: str = 'pending_verification'


class SellerUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    kennel_id: Optional[str] = None
    status: Optional[str] = None
    warning_date: Optional[str] = None


class TestimonialCreate(BaseModel):
    kennel_id: str
    buyer_name: str
    stars: int
    text: str


class PurchaseRequest(BaseModel):
    puppy_id: str
    buyer_name: str
    buyer_email: str


class SettingsUpdate(BaseModel):
    default_commission: Optional[float] = None
    membership_fee_annual: Optional[float] = None
    referral_discount: Optional[float] = None
    site_name: Optional[str] = None
    tagline: Optional[str] = None
    admin_bank_name: Optional[str] = None
    admin_account_holder: Optional[str] = None
    admin_account_number: Optional[str] = None
    admin_branch_code: Optional[str] = None
    admin_account_type: Optional[str] = None


class LegalUpdate(BaseModel):
    content: str
```

- [ ] **Step 5: Run auth utility tests to verify they pass**

```bash
cd chichi-api && source .venv/bin/activate
pytest tests/test_auth_utils.py -v
```

Expected: 3 tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add auth.py models.py tests/test_auth_utils.py
git commit -m "feat: auth utilities — JWT, bcrypt, and Pydantic request schemas"
```

---

## Task 3: Seed script

**Files:**
- Create: `chichi-api/seed.py`

- [ ] **Step 1: Write `chichi-api/seed.py`**

```python
"""Run once to populate chichi.db with mock data. Usage: python seed.py"""
import json
import sqlite3
from datetime import date

from auth import hash_password
from database import create_tables, DB_PATH

KENNELS = [
    ('k1', 'Little Royals Chihuahuas', 'little-royals-chihuahuas', 'KUSA', 'LR', '#B5651D',
     'Dedicated KUSA-registered Chihuahua breeders on the Highveld since 2008.', 'Johannesburg, Gauteng',
     'info@littleroyalschis.co.za', '+27 82 555 1234', 'active', '2027-01-15', 8.0, 'approved', None, 'LRC2024'),
    ('k2', 'Cape Miniatura', 'cape-miniatura', 'KUSA', 'CM', '#4A7C59',
     "Cape Town's finest Chihuahua kennel.", 'Cape Town, Western Cape',
     'breed@capeminiatura.co.za', '+27 72 444 5678', 'active', '2026-11-30', 8.0, 'approved', 'k1', 'CMN2024'),
    ('k3', 'Pretoria Chi Palace', 'pretoria-chi-palace', 'KUSA', 'PCP', '#C49A1D',
     'Show-quality Chihuahuas bred for conformation, temperament and longevity.', 'Pretoria, Gauteng',
     'chis@pretorichis.co.za', '+27 83 111 9876', 'active', '2026-08-20', 8.0, 'approved', None, 'PCP2024'),
    ('k4', 'Suncoast Tiny Paws', 'suncoast-tiny-paws', 'Canine SA', 'STP', '#7C5C4A',
     'Family-raised Chihuahuas on the KwaZulu-Natal coast.', 'Durban, KwaZulu-Natal',
     'tinypaws@suncoastchis.co.za', '+27 71 333 2222', 'active', '2027-03-10', 8.0, 'approved', None, 'STP2024'),
    ('k5', 'Joburg Miniature Palace', 'joburg-miniature-palace', 'Canine SA', 'JMP', '#2A1F14',
     'Premium Chihuahua breeders in Sandton specialising in rare colours.', 'Sandton, Gauteng',
     'chis@joburgminiature.co.za', '+27 82 777 4444', 'active', '2026-12-01', 10.0, 'approved', 'k4', 'JMP2024'),
    ('k6', 'Bluebell Chihuahuas', 'bluebell-chihuahuas', 'Canine SA', 'BCH', '#6B4A7C',
     'Exquisite long coat Chihuahuas raised in our home in Stellenbosch.', 'Stellenbosch, Western Cape',
     'hello@bluebellchis.co.za', '+27 73 888 3333', 'pending_payment', None, 8.0, 'pending', None, None),
    ('k_dormant', 'Sundown Chi Breeders', 'sundown-chi-breeders', 'Canine SA', 'SCB', '#8B7355',
     'Inactive kennel — no listings.', 'Bloemfontein, Free State',
     'dormant@sundownchis.co.za', '+27 51 000 0000', 'active', '2026-04-10', 8.0, 'approved', None, None),
]

PUPPIES = [
    ('p1', 'k1', 'Duchess', 'Long Coat', 'Female', 'Cream & White', '2025-12-10', 15500.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'CH Little Royals Prince Enzo', 'dam': 'Little Royals Lady Bella',
                 'sireSire': 'INT CH Mariposa El Magnifico', 'sireDam': 'Little Royals Diamante',
                 'damSire': 'SA CH Royal Tiny Prince', 'damDam': 'Little Royals Starlet'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Exquisite cream and white long coat female from champion bloodlines.', 'KUSA-2025-CHI-8821'),
    ('p2', 'k1', 'Romeo', 'Smooth Coat', 'Male', 'Fawn with White Markings', '2025-12-10', 12000.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'CH Little Royals Prince Enzo', 'dam': 'Little Royals Lady Bella'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Classic apple head smooth coat male, deep fawn colouring.', 'KUSA-2025-CHI-8822'),
    ('p3', 'k1', 'Perla', 'Long Coat', 'Female', 'Chocolate & Tan', '2025-11-05', 18000.0, 1, 0,
     json.dumps(['https://images.unsplash.com/photo-1612195583950-b44b0f558e80?w=800&q=80']),
     json.dumps({'sire': 'SA CH Royal Tiny Prince', 'dam': 'Little Royals Lola'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Stunning chocolate & tan long coat female. Now in her forever home.', 'KUSA-2025-CHI-7710'),
    ('p4', 'k2', 'Aurora', 'Long Coat', 'Female', 'Blue Merle', '2025-11-20', 22000.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'INT CH Cape Merle Maestro', 'dam': 'Cape Miniatura Serafina'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Rare blue merle long coat female from champion European import sire.', 'KUSA-2025-CHI-5502'),
    ('p5', 'k2', 'Marco', 'Smooth Coat', 'Male', 'Black & Tan', '2025-11-20', 11500.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'INT CH Cape Merle Maestro', 'dam': 'Cape Miniatura Serafina'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Classic black & tan smooth coat male.', 'KUSA-2025-CHI-5503'),
    ('p6', 'k3', 'Valentina', 'Long Coat', 'Female', 'Tricolor — Black, White & Tan', '2026-01-05', 17500.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'SA CH Pretoria Chi King', 'dam': 'Palace Princess Sofia'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Striking tricolor long coat female with show potential.', 'KUSA-2026-CHI-0191'),
    ('p7', 'k3', 'Zeus', 'Smooth Coat', 'Male', 'Blue Fawn', '2026-01-05', 19000.0, 1, 0,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'SA CH Pretoria Chi King', 'dam': 'Palace Princess Sofia'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Rare blue fawn smooth coat male — now in his forever home.', 'KUSA-2026-CHI-0192'),
    ('p8', 'k4', 'Coco', 'Long Coat', 'Female', 'Chocolate', '2025-12-15', 9500.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'Suncoast Tiny Titan', 'dam': 'Suncoast Lady Rosella'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Gorgeous deep chocolate long coat female, beautifully socialised with children.', 'CSA-2025-CHI-3319'),
    ('p9', 'k4', 'Bruno', 'Smooth Coat', 'Male', 'White', '2025-12-15', 8500.0, 1, 0,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'Suncoast Tiny Titan', 'dam': 'Suncoast Lady Rosella'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Pure white smooth coat male — already in his new home.', 'CSA-2025-CHI-3320'),
    ('p10', 'k4', 'Pixie', 'Long Coat', 'Female', 'Cream', '2026-01-20', 9800.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'Suncoast Tiny Prince', 'dam': 'Suncoast Cream Dream'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Pale cream long coat female with the sweetest temperament.', 'CSA-2026-CHI-0112'),
    ('p11', 'k5', 'Bleu', 'Smooth Coat', 'Male', 'Blue', '2026-01-10', 28000.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'EUR CH Bleu de Paris', 'dam': 'Joburg Palace Diamond'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Exceptional rare blue smooth coat male from champion European import sire.', 'CSA-2026-CHI-0534'),
    ('p12', 'k5', 'Lilac Rose', 'Long Coat', 'Female', 'Lilac & Tan', '2026-01-10', 32000.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'EUR CH Bleu de Paris', 'dam': 'Joburg Palace Diamond'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Exceptionally rare lilac & tan long coat female.', 'CSA-2026-CHI-0535'),
]

SELLERS = [
    ('s1', 'info@littleroyalschis.co.za', 'seller123', 'Johan van der Berg', 'k1', 'approved', '2024-01-15'),
    ('s2', 'breed@capeminiatura.co.za', 'seller123', 'Sandra Mitchell', 'k2', 'approved', '2024-03-22'),
    ('s3', 'chis@pretorichis.co.za', 'seller123', 'Pieter Grobler', 'k3', 'approved', '2024-06-10'),
    ('s4', 'incoming@newkennel.co.za', 'seller123', 'Thabo Nkosi', None, 'pending_verification', '2026-04-28'),
    ('s5', 'dormant@sundownchis.co.za', 'seller123', 'Riaan Botha', 'k_dormant', 'approved', '2025-04-10'),
]

TRANSACTIONS = [
    ('txn1', 'p3', 'Perla', 'k1', 'Little Royals Chihuahuas', 'Sarah Johnson', 'sarah.j@gmail.com',
     18000.0, 1440.0, 16560.0, 1, 1, '2026-04-06', '2026-04-09', '2026-04-09'),
    ('txn2', 'p7', 'Zeus', 'k3', 'Pretoria Chi Palace', 'Mike van der Berg', 'mike.vdb@gmail.com',
     19000.0, 1520.0, 17480.0, 1, 1, '2026-04-12', '2026-04-15', '2026-04-15'),
    ('txn3', 'p9', 'Bruno', 'k4', 'Suncoast Tiny Paws', 'Linda Nkosi', 'linda.n@gmail.com',
     8500.0, 680.0, 7820.0, 0, 0, '2026-04-19', None, None),
]

TESTIMONIALS = [
    ('t1', 'k1', 'Sarah Johnson', 5,
     'Absolutely wonderful experience! Duchess arrived healthy, well-socialised and exactly as described.', '2026-04-10'),
    ('t2', 'k3', 'Mike van der Berg', 5,
     'Zeus is perfect! Pieter kept us updated every step of the way. Highly recommended kennel.', '2026-04-16'),
    ('t3', 'k4', 'Linda Nkosi', 4,
     'Great puppy, very healthy. Communication was good. Would buy again.', '2026-04-22'),
]

LEGAL_CONTENT = """# Chihuahua South Africa Marketplace — Terms & Conditions

Chihuahua South Africa is an online marketplace exclusively for Chihuahua breeders,
connecting KUSA and Canine SA registered kennels with prospective buyers across South Africa.

All breeders listed on Chihuahua South Africa are verified by registry membership before
listing approval is granted.
"""


def seed():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    create_tables(conn)

    conn.executemany("""
        INSERT OR IGNORE INTO kennels
        (id, name, slug, registry, initials, color, description, location, contact, phone,
         membership_status, membership_expiry, commission, status, referred_by, referral_code)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, KENNELS)

    conn.executemany("""
        INSERT OR IGNORE INTO puppies
        (id, kennel_id, name, coat_type, gender, color, dob, price, sold, breeding_rights,
         images, pedigree, health, description, registration_no)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, PUPPIES)

    conn.executemany("""
        INSERT OR IGNORE INTO sellers
        (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES (?,?,?,?,?,?,?)
    """, [(s[0], s[1], hash_password(s[2]), s[3], s[4], s[5], s[6]) for s in SELLERS])

    conn.executemany("""
        INSERT OR IGNORE INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date,
         seller_paid_date, commission_paid_date)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, TRANSACTIONS)

    conn.executemany("""
        INSERT OR IGNORE INTO testimonials (id, kennel_id, buyer_name, stars, text, date)
        VALUES (?,?,?,?,?,?)
    """, TESTIMONIALS)

    conn.execute("UPDATE legal_text SET content = ? WHERE id = 1", (LEGAL_CONTENT,))

    conn.commit()
    conn.close()
    print('Seed complete.')


if __name__ == '__main__':
    seed()
```

- [ ] **Step 2: Run the seed script**

```bash
cd chichi-api && source .venv/bin/activate
python seed.py
```

Expected: `Seed complete.`

- [ ] **Step 3: Verify data is in the DB**

```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('chichi.db')
print('Kennels:', conn.execute('SELECT COUNT(*) FROM kennels').fetchone()[0])
print('Puppies:', conn.execute('SELECT COUNT(*) FROM puppies').fetchone()[0])
print('Sellers:', conn.execute('SELECT COUNT(*) FROM sellers').fetchone()[0])
"
```

Expected:
```
Kennels: 7
Puppies: 12
Sellers: 5
```

- [ ] **Step 4: Commit**

```bash
git add seed.py
git commit -m "feat: seed script — imports all mock data into SQLite with hashed passwords"
```

---

## Task 4: Auth endpoints

**Files:**
- Create: `chichi-api/routers/auth.py`
- Modify: `chichi-api/main.py`
- Test: `chichi-api/tests/test_auth.py`

- [ ] **Step 1: Write failing tests**

Create `chichi-api/tests/test_auth.py`:

```python
import os
os.environ['ADMIN_EMAIL'] = 'admin@test.co.za'
os.environ['ADMIN_PASSWORD_HASH'] = ''  # set per test

from auth import hash_password
import pytest


def test_admin_login_success(seeded_client, monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@test.co.za')
    monkeypatch.setenv('ADMIN_PASSWORD_HASH', hash_password('adminpass'))
    res = seeded_client.post('/auth/admin/login', json={
        'email': 'admin@test.co.za', 'password': 'adminpass'
    })
    assert res.status_code == 200
    assert 'token' in res.json()


def test_admin_login_wrong_password(seeded_client, monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@test.co.za')
    monkeypatch.setenv('ADMIN_PASSWORD_HASH', hash_password('adminpass'))
    res = seeded_client.post('/auth/admin/login', json={
        'email': 'admin@test.co.za', 'password': 'wrongpassword'
    })
    assert res.status_code == 401


def test_seller_login_success(seeded_client):
    res = seeded_client.post('/auth/seller/login', json={
        'email': 'seller@test.co.za', 'password': 'seller123'
    })
    assert res.status_code == 200
    data = res.json()
    assert 'token' in data
    assert data['seller']['email'] == 'seller@test.co.za'
    assert 'password_hash' not in data['seller']


def test_seller_login_wrong_password(seeded_client):
    res = seeded_client.post('/auth/seller/login', json={
        'email': 'seller@test.co.za', 'password': 'wrongpassword'
    })
    assert res.status_code == 401


def test_seller_signup_creates_pending_seller(client):
    res = client.post('/auth/seller/signup', json={
        'email': 'new@kennel.co.za',
        'password': 'newpass123',
        'name': 'New Seller',
        'phone': '+27 82 000 0000',
        'province': 'Gauteng',
        'kennel_name': 'New Kennel',
        'registry': 'KUSA',
    })
    assert res.status_code == 201
    assert res.json()['status'] == 'pending_verification'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd chichi-api && source .venv/bin/activate
pytest tests/test_auth.py -v
```

Expected: `404 Not Found` or `ModuleNotFoundError` — routes don't exist yet.

- [ ] **Step 3: Write `chichi-api/routers/auth.py`**

```python
import os
import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext

from auth import create_token, hash_password, verify_password
from database import get_db
from models import LoginRequest, SignupRequest

router = APIRouter()
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


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
```

- [ ] **Step 4: Wire auth router into `chichi-api/main.py`**

Add these lines to `main.py` (below the middleware block):

```python
from routers import auth as auth_router

app.include_router(auth_router.router, prefix='/auth', tags=['auth'])
```

- [ ] **Step 5: Generate the admin password hash and create `.env`**

```bash
cd chichi-api && source .venv/bin/activate
python3 -c "from auth import hash_password; print(hash_password('admin123'))"
```

Copy the output hash. Create `chichi-api/.env`:

```
SECRET_KEY=dev-secret-key-change-before-going-live
ADMIN_EMAIL=admin@chihuahuasa.co.za
ADMIN_PASSWORD_HASH=<paste the hash here>
DB_PATH=chichi.db
```

Add `.env` to `.gitignore`:

```bash
echo ".env" >> .gitignore
echo "chichi.db" >> .gitignore
echo ".venv/" >> .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore
```

- [ ] **Step 6: Run auth tests**

```bash
pytest tests/test_auth.py -v
```

Expected: 5 tests PASSED.

- [ ] **Step 7: Commit**

```bash
git add routers/auth.py main.py .gitignore
git commit -m "feat: auth endpoints — admin login, seller login, seller signup"
```

---

## Task 5: Public endpoints

**Files:**
- Create: `chichi-api/routers/public.py`
- Modify: `chichi-api/main.py`
- Test: `chichi-api/tests/test_public.py`

- [ ] **Step 1: Write failing tests**

Create `chichi-api/tests/test_public.py`:

```python
def test_list_kennels_returns_approved_only(seeded_client):
    res = seeded_client.get('/kennels')
    assert res.status_code == 200
    kennels = res.json()
    assert len(kennels) == 1
    assert kennels[0]['slug'] == 'test-kennel'
    assert kennels[0]['status'] == 'approved'


def test_get_kennel_by_slug(seeded_client):
    res = seeded_client.get('/kennels/test-kennel')
    assert res.status_code == 200
    data = res.json()
    assert data['kennel']['name'] == 'Test Kennel'
    assert len(data['puppies']) == 1
    assert data['puppies'][0]['name'] == 'Duchess'


def test_get_kennel_not_found(seeded_client):
    res = seeded_client.get('/kennels/does-not-exist')
    assert res.status_code == 404


def test_list_puppies(seeded_client):
    res = seeded_client.get('/puppies')
    assert res.status_code == 200
    puppies = res.json()
    assert len(puppies) == 1
    assert puppies[0]['name'] == 'Duchess'
    assert isinstance(puppies[0]['images'], list)
    assert isinstance(puppies[0]['pedigree'], dict)
    assert isinstance(puppies[0]['health'], list)


def test_list_puppies_filter_sold(seeded_client, test_db):
    test_db.execute("UPDATE puppies SET sold = 1 WHERE id = 'p1'")
    test_db.commit()
    res = seeded_client.get('/puppies?sold=false')
    assert res.status_code == 200
    assert len(res.json()) == 0


def test_get_puppy_by_id(seeded_client):
    res = seeded_client.get('/puppies/p1')
    assert res.status_code == 200
    assert res.json()['name'] == 'Duchess'


def test_get_puppy_not_found(seeded_client):
    res = seeded_client.get('/puppies/does-not-exist')
    assert res.status_code == 404


def test_list_testimonials(seeded_client, test_db):
    test_db.execute(
        "INSERT INTO testimonials (id, kennel_id, buyer_name, stars, text, date)"
        " VALUES ('t1', 'k1', 'Jane', 5, 'Great!', '2026-01-01')"
    )
    test_db.commit()
    res = seeded_client.get('/testimonials')
    assert res.status_code == 200
    assert len(res.json()) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_public.py -v
```

Expected: `404 Not Found` for all — routes don't exist.

- [ ] **Step 3: Write `chichi-api/routers/public.py`**

```python
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, parse_puppy

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
```

- [ ] **Step 4: Wire public router into `chichi-api/main.py`**

Add to `main.py` (below the auth router import):

```python
from routers import public as public_router

app.include_router(public_router.router, tags=['public'])
```

- [ ] **Step 5: Run public tests**

```bash
pytest tests/test_public.py -v
```

Expected: 8 tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add routers/public.py main.py tests/test_public.py
git commit -m "feat: public endpoints — kennels, puppies, testimonials"
```

---

## Task 6: Seller endpoints

**Files:**
- Create: `chichi-api/routers/seller.py`
- Modify: `chichi-api/main.py`
- Test: `chichi-api/tests/test_seller.py`

- [ ] **Step 1: Write failing tests**

Create `chichi-api/tests/test_seller.py`:

```python
def seller_token(seeded_client):
    res = seeded_client.post('/auth/seller/login', json={
        'email': 'seller@test.co.za', 'password': 'seller123'
    })
    return res.json()['token']


def test_get_seller_me(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.get('/seller/me', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    data = res.json()
    assert data['seller']['email'] == 'seller@test.co.za'
    assert data['kennel']['name'] == 'Test Kennel'


def test_get_seller_me_no_token(seeded_client):
    res = seeded_client.get('/seller/me')
    assert res.status_code == 403


def test_seller_list_puppies(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.get('/seller/puppies', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]['name'] == 'Duchess'


def test_seller_add_puppy(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.post('/seller/puppies', headers={'Authorization': f'Bearer {token}'}, json={
        'name': 'Tiny',
        'coat_type': 'Smooth Coat',
        'gender': 'Male',
        'color': 'Fawn',
        'dob': '2026-03-01',
        'price': 10000.0,
        'breeding_rights': False,
        'images': ['https://example.com/tiny.jpg'],
        'pedigree': {'sire': 'Test Sire'},
        'health': ['Vaccinated'],
        'description': 'A lovely pup',
        'registration_no': 'KUSA-2026-001',
    })
    assert res.status_code == 201
    assert res.json()['name'] == 'Tiny'
    assert res.json()['kennel_id'] == 'k1'


def test_seller_delist_puppy(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.delete('/seller/puppies/p1', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200

    res2 = seeded_client.get('/seller/puppies', headers={'Authorization': f'Bearer {token}'})
    assert len(res2.json()) == 0


def test_seller_update_profile(seeded_client):
    token = seller_token(seeded_client)
    res = seeded_client.put('/seller/profile', headers={'Authorization': f'Bearer {token}'}, json={
        'description': 'Updated description',
        'phone': '+27 82 999 9999',
    })
    assert res.status_code == 200
    assert res.json()['description'] == 'Updated description'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_seller.py -v
```

Expected: `404` or `403` errors — routes don't exist.

- [ ] **Step 3: Write `chichi-api/routers/seller.py`**

```python
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
    s = {k: v for k, v in seller.items() if k != 'password_hash'}
    kennel = None
    if seller.get('kennel_id'):
        row = db.execute('SELECT * FROM kennels WHERE id = ?', (seller['kennel_id'],)).fetchone()
        if row:
            kennel = dict(row)
    return {'seller': s, 'kennel': kennel}


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
```

- [ ] **Step 4: Wire seller router into `chichi-api/main.py`**

```python
from routers import seller as seller_router

app.include_router(seller_router.router, prefix='/seller', tags=['seller'])
```

- [ ] **Step 5: Run seller tests**

```bash
pytest tests/test_seller.py -v
```

Expected: 7 tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add routers/seller.py main.py tests/test_seller.py
git commit -m "feat: seller endpoints — profile, puppy listings CRUD"
```

---

## Task 7: Admin endpoints — kennels & sellers

**Files:**
- Create: `chichi-api/routers/admin.py` (partial — kennels + sellers sections)
- Modify: `chichi-api/main.py`
- Test: `chichi-api/tests/test_admin.py` (partial)

- [ ] **Step 1: Write a helper to get an admin token in tests**

Add this to `chichi-api/tests/conftest.py` (append below existing fixtures):

```python
@pytest.fixture
def admin_token(seeded_client, monkeypatch):
    from auth import hash_password as hp
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@test.co.za')
    monkeypatch.setenv('ADMIN_PASSWORD_HASH', hp('adminpass'))
    res = seeded_client.post('/auth/admin/login', json={
        'email': 'admin@test.co.za', 'password': 'adminpass'
    })
    return res.json()['token']
```

- [ ] **Step 2: Write failing tests**

Create `chichi-api/tests/test_admin.py`:

```python
def auth(token):
    return {'Authorization': f'Bearer {token}'}


def test_admin_list_kennels(seeded_client, admin_token):
    res = seeded_client.get('/admin/kennels', headers=auth(admin_token))
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_admin_add_kennel(seeded_client, admin_token):
    res = seeded_client.post('/admin/kennels', headers=auth(admin_token), json={
        'name': 'New Kennel',
        'slug': 'new-kennel',
        'registry': 'KUSA',
        'commission': 8.0,
    })
    assert res.status_code == 201
    assert res.json()['name'] == 'New Kennel'


def test_admin_edit_kennel(seeded_client, admin_token):
    res = seeded_client.put('/admin/kennels/k1', headers=auth(admin_token), json={
        'commission': 10.0
    })
    assert res.status_code == 200
    assert res.json()['commission'] == 10.0


def test_admin_delete_kennel_cascades(seeded_client, admin_token, test_db):
    res = seeded_client.delete('/admin/kennels/k1', headers=auth(admin_token))
    assert res.status_code == 200
    puppies = test_db.execute("SELECT * FROM puppies WHERE kennel_id = 'k1'").fetchall()
    assert len(puppies) == 0
    seller = test_db.execute("SELECT * FROM sellers WHERE id = 's1'").fetchone()
    assert dict(seller)['kennel_id'] is None


def test_admin_list_sellers(seeded_client, admin_token):
    res = seeded_client.get('/admin/sellers', headers=auth(admin_token))
    assert res.status_code == 200
    sellers = res.json()
    assert len(sellers) >= 1
    assert all('password_hash' not in s for s in sellers)


def test_admin_approve_seller(seeded_client, admin_token, test_db):
    test_db.execute("""
        INSERT INTO sellers (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES ('s_new', 'new@breeder.co.za', 'hash', 'New Breeder', NULL,
                'pending_verification', '2026-05-01')
    """)
    test_db.commit()
    res = seeded_client.patch('/admin/sellers/s_new/approve', headers=auth(admin_token))
    assert res.status_code == 200
    seller = test_db.execute("SELECT * FROM sellers WHERE id = 's_new'").fetchone()
    assert dict(seller)['status'] == 'pending_payment'
    assert dict(seller)['kennel_id'] is not None


def test_admin_pay_membership(seeded_client, admin_token, test_db):
    test_db.execute("""
        UPDATE sellers SET status = 'pending_payment' WHERE id = 's1'
    """)
    test_db.commit()
    res = seeded_client.patch('/admin/sellers/s1/pay-membership', headers=auth(admin_token))
    assert res.status_code == 200
    seller = test_db.execute("SELECT * FROM sellers WHERE id = 's1'").fetchone()
    assert dict(seller)['status'] == 'approved'
    kennel = test_db.execute("SELECT * FROM kennels WHERE id = 'k1'").fetchone()
    assert dict(kennel)['membership_status'] == 'active'
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/test_admin.py -v
```

Expected: `404` — routes don't exist.

- [ ] **Step 4: Write `chichi-api/routers/admin.py`** (kennels + sellers section)

```python
import sqlite3
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_admin, hash_password
from database import get_db, parse_puppy, parse_transaction
from models import (KennelCreate, KennelUpdate, LegalUpdate, SellerCreate,
                    SellerUpdate, SettingsUpdate, TestimonialCreate)

router = APIRouter()


# ── Kennels ──────────────────────────────────────────────────────────────────

@router.get('/kennels')
def admin_list_kennels(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM kennels ORDER BY name').fetchall()
    return [dict(r) for r in rows]


@router.post('/kennels', status_code=201)
def admin_add_kennel(
    body: KennelCreate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    kennel_id = f'k{uuid.uuid4().hex[:8]}'
    expiry = (date.today() + timedelta(days=365)).isoformat()
    db.execute("""
        INSERT INTO kennels
        (id, name, slug, registry, initials, color, description, location,
         contact, phone, membership_status, membership_expiry, commission,
         status, referral_code)
        VALUES (?,?,?,?,?,?,?,?,?,?,'active',?,?,'approved',?)
    """, (
        kennel_id, body.name, body.slug, body.registry,
        body.initials or body.name[:3].upper(), body.color,
        body.description, body.location, body.contact, body.phone,
        expiry, body.commission, body.referral_code,
    ))
    db.commit()
    return dict(db.execute('SELECT * FROM kennels WHERE id = ?', (kennel_id,)).fetchone())


@router.put('/kennels/{kennel_id}')
def admin_edit_kennel(
    kennel_id: str,
    body: KennelUpdate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT id FROM kennels WHERE id = ?', (kennel_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Kennel not found')
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    cols = ', '.join(f'{k} = ?' for k in updates)
    db.execute(f'UPDATE kennels SET {cols} WHERE id = ?', [*updates.values(), kennel_id])
    db.commit()
    return dict(db.execute('SELECT * FROM kennels WHERE id = ?', (kennel_id,)).fetchone())


@router.delete('/kennels/{kennel_id}')
def admin_delete_kennel(
    kennel_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM puppies WHERE kennel_id = ?', (kennel_id,))
    db.execute('UPDATE sellers SET kennel_id = NULL, status = ? WHERE kennel_id = ?',
               ('pending_verification', kennel_id))
    db.execute('DELETE FROM kennels WHERE id = ?', (kennel_id,))
    db.commit()
    return {'ok': True}


# ── Sellers ───────────────────────────────────────────────────────────────────

@router.get('/sellers')
def admin_list_sellers(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM sellers ORDER BY joined_date DESC').fetchall()
    return [{k: v for k, v in dict(r).items() if k != 'password_hash'} for r in rows]


@router.post('/sellers', status_code=201)
def admin_add_seller(
    body: SellerCreate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    seller_id = f's{uuid.uuid4().hex[:8]}'
    today = date.today().isoformat()
    db.execute("""
        INSERT INTO sellers (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES (?,?,?,?,?,?,?)
    """, (seller_id, body.email, hash_password(body.password),
          body.name, body.kennel_id, body.status, today))
    db.commit()
    row = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    row.pop('password_hash')
    return row


@router.put('/sellers/{seller_id}')
def admin_edit_seller(
    seller_id: str,
    body: SellerUpdate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT id FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Seller not found')
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    cols = ', '.join(f'{k} = ?' for k in updates)
    db.execute(f'UPDATE sellers SET {cols} WHERE id = ?', [*updates.values(), seller_id])
    db.commit()
    result = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    result.pop('password_hash')
    return result


@router.delete('/sellers/{seller_id}')
def admin_delete_seller(
    seller_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM sellers WHERE id = ?', (seller_id,))
    db.commit()
    return {'ok': True}


@router.patch('/sellers/{seller_id}/approve')
def admin_approve_seller(
    seller_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)
    kennel_id = f'k{uuid.uuid4().hex[:8]}'
    palette = ['#B5651D', '#4A7C59', '#C49A1D', '#7C5C4A', '#2A1F14', '#6B4A7C']
    import random
    color = random.choice(palette)
    db.execute("""
        INSERT INTO kennels
        (id, name, slug, registry, initials, color, membership_status, commission, status)
        VALUES (?,?,?,?,'??',?,'pending_payment',8.0,'pending')
    """, (
        kennel_id,
        f"{seller['name']}'s Kennel",
        f"kennel-{kennel_id}",
        'KUSA',
        color,
    ))
    db.execute(
        "UPDATE sellers SET status = 'pending_payment', kennel_id = ? WHERE id = ?",
        (kennel_id, seller_id)
    )
    db.commit()
    result = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    result.pop('password_hash')
    return result


@router.patch('/sellers/{seller_id}/pay-membership')
def admin_pay_membership(
    seller_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)
    expiry = (date.today() + timedelta(days=365)).isoformat()
    db.execute("UPDATE sellers SET status = 'approved' WHERE id = ?", (seller_id,))
    if seller.get('kennel_id'):
        db.execute("""
            UPDATE kennels SET status = 'approved', membership_status = 'active',
            membership_expiry = ? WHERE id = ?
        """, (expiry, seller['kennel_id']))
    db.commit()
    result = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    result.pop('password_hash')
    return result
```

- [ ] **Step 5: Wire admin router into `chichi-api/main.py`**

```python
from routers import admin as admin_router

app.include_router(admin_router.router, prefix='/admin', tags=['admin'])
```

- [ ] **Step 6: Run admin kennel + seller tests**

```bash
pytest tests/test_admin.py -v
```

Expected: 8 tests PASSED.

- [ ] **Step 7: Commit**

```bash
git add routers/admin.py main.py tests/test_admin.py tests/conftest.py
git commit -m "feat: admin endpoints — kennels and sellers CRUD + approve + membership"
```

---

## Task 8: Admin endpoints — puppies, testimonials, settings, legal, transactions

**Files:**
- Modify: `chichi-api/routers/admin.py` (append remaining sections)
- Test: `chichi-api/tests/test_admin.py` (append tests)

- [ ] **Step 1: Write failing tests** (append to `tests/test_admin.py`)

```python
def test_admin_list_puppies(seeded_client, admin_token):
    res = seeded_client.get('/admin/puppies', headers=auth(admin_token))
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_admin_delete_puppy(seeded_client, admin_token, test_db):
    res = seeded_client.delete('/admin/puppies/p1', headers=auth(admin_token))
    assert res.status_code == 200
    row = test_db.execute("SELECT * FROM puppies WHERE id = 'p1'").fetchone()
    assert row is None


def test_admin_list_testimonials(seeded_client, admin_token, test_db):
    test_db.execute(
        "INSERT INTO testimonials (id, kennel_id, buyer_name, stars, text, date)"
        " VALUES ('t1', 'k1', 'Jane', 5, 'Loved it!', '2026-01-01')"
    )
    test_db.commit()
    res = seeded_client.get('/admin/testimonials', headers=auth(admin_token))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_admin_add_and_delete_testimonial(seeded_client, admin_token):
    res = seeded_client.post('/admin/testimonials', headers=auth(admin_token), json={
        'kennel_id': 'k1', 'buyer_name': 'Bob', 'stars': 4, 'text': 'Very good.'
    })
    assert res.status_code == 201
    tid = res.json()['id']

    res2 = seeded_client.delete(f'/admin/testimonials/{tid}', headers=auth(admin_token))
    assert res2.status_code == 200


def test_admin_get_and_update_settings(seeded_client, admin_token):
    res = seeded_client.get('/admin/settings', headers=auth(admin_token))
    assert res.status_code == 200
    assert 'default_commission' in res.json()

    res2 = seeded_client.put('/admin/settings', headers=auth(admin_token), json={
        'default_commission': 9.0
    })
    assert res2.status_code == 200
    assert res2.json()['default_commission'] == 9.0


def test_admin_get_and_update_legal(seeded_client, admin_token):
    res = seeded_client.get('/admin/legal', headers=auth(admin_token))
    assert res.status_code == 200
    assert 'content' in res.json()

    res2 = seeded_client.put('/admin/legal', headers=auth(admin_token), json={
        'content': '# New Terms\n\nUpdated content.'
    })
    assert res2.status_code == 200
    assert res2.json()['content'] == '# New Terms\n\nUpdated content.'


def test_admin_list_transactions(seeded_client, admin_token, test_db):
    test_db.execute("""
        INSERT INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date)
        VALUES ('txn1','p1','Duchess','k1','Test Kennel','Jane','j@g.com',
                15500,1240,14260,0,0,'2026-05-01')
    """)
    test_db.commit()
    res = seeded_client.get('/admin/transactions', headers=auth(admin_token))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_admin_release_transaction(seeded_client, admin_token, test_db):
    test_db.execute("""
        INSERT INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date)
        VALUES ('txn1','p1','Duchess','k1','Test Kennel','Jane','j@g.com',
                15500,1240,14260,0,0,'2026-05-01')
    """)
    test_db.commit()
    res = seeded_client.post('/admin/transactions/txn1/release', headers=auth(admin_token))
    assert res.status_code == 200
    txn = test_db.execute("SELECT * FROM transactions WHERE id = 'txn1'").fetchone()
    assert dict(txn)['seller_paid'] == 1
    assert dict(txn)['commission_paid'] == 1
```

- [ ] **Step 2: Run to verify these tests fail**

```bash
pytest tests/test_admin.py -v -k "puppy or testimonial or settings or legal or transaction"
```

Expected: `404` — new routes don't exist yet.

- [ ] **Step 3: Append remaining routes to `chichi-api/routers/admin.py`**

Add below the sellers section:

```python
# ── Puppies ───────────────────────────────────────────────────────────────────

@router.get('/puppies')
def admin_list_puppies(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM puppies ORDER BY name').fetchall()
    return [parse_puppy(r) for r in rows]


@router.delete('/puppies/{puppy_id}')
def admin_delete_puppy(
    puppy_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM puppies WHERE id = ?', (puppy_id,))
    db.commit()
    return {'ok': True}


# ── Testimonials ──────────────────────────────────────────────────────────────

@router.get('/testimonials')
def admin_list_testimonials(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM testimonials ORDER BY date DESC').fetchall()
    return [dict(r) for r in rows]


@router.post('/testimonials', status_code=201)
def admin_add_testimonial(
    body: TestimonialCreate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    tid = f't{uuid.uuid4().hex[:8]}'
    today = date.today().isoformat()
    db.execute(
        'INSERT INTO testimonials (id, kennel_id, buyer_name, stars, text, date) VALUES (?,?,?,?,?,?)',
        (tid, body.kennel_id, body.buyer_name, body.stars, body.text, today)
    )
    db.commit()
    return dict(db.execute('SELECT * FROM testimonials WHERE id = ?', (tid,)).fetchone())


@router.delete('/testimonials/{testimonial_id}')
def admin_delete_testimonial(
    testimonial_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM testimonials WHERE id = ?', (testimonial_id,))
    db.commit()
    return {'ok': True}


# ── Settings ──────────────────────────────────────────────────────────────────

@router.get('/settings')
def admin_get_settings(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT * FROM admin_settings WHERE id = 1').fetchone()
    return dict(row)


@router.put('/settings')
def admin_update_settings(
    body: SettingsUpdate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    cols = ', '.join(f'{k} = ?' for k in updates)
    db.execute(f'UPDATE admin_settings SET {cols} WHERE id = 1', list(updates.values()))
    db.commit()
    return dict(db.execute('SELECT * FROM admin_settings WHERE id = 1').fetchone())


# ── Legal ─────────────────────────────────────────────────────────────────────

@router.get('/legal')
def admin_get_legal(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT * FROM legal_text WHERE id = 1').fetchone()
    return dict(row)


@router.put('/legal')
def admin_update_legal(
    body: LegalUpdate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('UPDATE legal_text SET content = ? WHERE id = 1', (body.content,))
    db.commit()
    return dict(db.execute('SELECT * FROM legal_text WHERE id = 1').fetchone())


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get('/transactions')
def admin_list_transactions(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM transactions ORDER BY date DESC').fetchall()
    return [parse_transaction(r) for r in rows]


@router.post('/transactions/{txn_id}/release')
def admin_release_transaction(
    txn_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    today = date.today().isoformat()
    db.execute("""
        UPDATE transactions
        SET seller_paid = 1, commission_paid = 1,
            seller_paid_date = ?, commission_paid_date = ?
        WHERE id = ?
    """, (today, today, txn_id))
    db.commit()
    row = db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Transaction not found')
    return parse_transaction(row)
```

- [ ] **Step 4: Run all admin tests**

```bash
pytest tests/test_admin.py -v
```

Expected: all tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add routers/admin.py tests/test_admin.py
git commit -m "feat: admin endpoints — puppies, testimonials, settings, legal, transactions"
```

---

## Task 9: Transaction endpoint (purchase)

**Files:**
- Create: `chichi-api/routers/transactions.py`
- Modify: `chichi-api/main.py`
- Test: `chichi-api/tests/test_transactions.py`

- [ ] **Step 1: Write failing tests**

Create `chichi-api/tests/test_transactions.py`:

```python
def test_purchase_puppy(seeded_client):
    res = seeded_client.post('/transactions', json={
        'puppy_id': 'p1',
        'buyer_name': 'Alice Dlamini',
        'buyer_email': 'alice@gmail.com',
    })
    assert res.status_code == 201
    data = res.json()
    assert data['puppy_name'] == 'Duchess'
    assert data['amount'] == 15500.0
    assert data['commission'] == 1240.0  # 8% of 15500
    assert data['seller_payout'] == 14260.0
    assert data['seller_paid'] is False
    assert data['commission_paid'] is False


def test_purchase_marks_puppy_sold(seeded_client, test_db):
    seeded_client.post('/transactions', json={
        'puppy_id': 'p1',
        'buyer_name': 'Alice Dlamini',
        'buyer_email': 'alice@gmail.com',
    })
    puppy = test_db.execute("SELECT sold FROM puppies WHERE id = 'p1'").fetchone()
    assert dict(puppy)['sold'] == 1


def test_purchase_puppy_not_found(seeded_client):
    res = seeded_client.post('/transactions', json={
        'puppy_id': 'does-not-exist',
        'buyer_name': 'Alice',
        'buyer_email': 'a@g.com',
    })
    assert res.status_code == 404


def test_purchase_already_sold_puppy(seeded_client, test_db):
    test_db.execute("UPDATE puppies SET sold = 1 WHERE id = 'p1'")
    test_db.commit()
    res = seeded_client.post('/transactions', json={
        'puppy_id': 'p1',
        'buyer_name': 'Alice',
        'buyer_email': 'a@g.com',
    })
    assert res.status_code == 409
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_transactions.py -v
```

Expected: `404` — route doesn't exist.

- [ ] **Step 3: Write `chichi-api/routers/transactions.py`**

```python
import sqlite3
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from database import get_db, parse_transaction
from models import PurchaseRequest

router = APIRouter()


@router.post('/transactions', status_code=201)
def purchase_puppy(body: PurchaseRequest, db: sqlite3.Connection = Depends(get_db)):
    puppy = db.execute('SELECT * FROM puppies WHERE id = ?', (body.puppy_id,)).fetchone()
    if not puppy:
        raise HTTPException(status_code=404, detail='Puppy not found')
    puppy = dict(puppy)
    if puppy['sold']:
        raise HTTPException(status_code=409, detail='Puppy already sold')

    kennel = db.execute('SELECT * FROM kennels WHERE id = ?', (puppy['kennel_id'],)).fetchone()
    rate = dict(kennel)['commission'] if kennel else 8.0
    commission = round(puppy['price'] * rate / 100, 2)
    seller_payout = round(puppy['price'] - commission, 2)

    txn_id = f'txn{uuid.uuid4().hex[:8]}'
    today = date.today().isoformat()
    db.execute("""
        INSERT INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date)
        VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?)
    """, (
        txn_id, puppy['id'], puppy['name'],
        puppy['kennel_id'], dict(kennel)['name'] if kennel else '',
        body.buyer_name, body.buyer_email,
        puppy['price'], commission, seller_payout, today,
    ))
    db.execute('UPDATE puppies SET sold = 1 WHERE id = ?', (body.puppy_id,))
    db.commit()

    row = db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone()
    return parse_transaction(row)
```

- [ ] **Step 4: Wire transactions router into `chichi-api/main.py`**

```python
from routers import transactions as transactions_router

app.include_router(transactions_router.router, tags=['transactions'])
```

- [ ] **Step 5: Run transaction tests**

```bash
pytest tests/test_transactions.py -v
```

Expected: 4 tests PASSED.

- [ ] **Step 6: Run full test suite to confirm nothing is broken**

```bash
pytest -v
```

Expected: all tests PASSED with 0 failures.

- [ ] **Step 7: Commit**

```bash
git add routers/transactions.py main.py tests/test_transactions.py
git commit -m "feat: transactions endpoint — purchase puppy with commission calculation"
```

---

## Task 10: Frontend AppContext refactor

**Files:**
- Modify: `chichi/src/context/AppContext.jsx`
- Modify: `chichi/src/pages/admin/AdminLogin.jsx` (add `await`)
- Modify: `chichi/src/pages/seller/SellerLogin.jsx` (add `await`)
- Modify: `chichi/src/pages/seller/SellerSignup.jsx` (add `await`)
- Modify: `chichi/src/pages/PuppyDetailPage.jsx` (add `await`)

`★ Insight ─────────────────────────────────────`
The `AppContext.jsx` acts as a service layer. By keeping the same function signatures but making them async, all UI components work without changes — they just need `await` added at 4 call sites where they check the return value.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Define the API base URL constant at the top of `AppContext.jsx`**

Open `chichi/src/context/AppContext.jsx`. Replace the entire file with the following. Read the existing file first to confirm all functions are accounted for, then write the new version.

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const API = 'http://localhost:8000'
const AppContext = createContext(null)

function getToken() {
  return localStorage.getItem('token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options,
  })
  return res
}

export function AppProvider({ children }) {
  const [kennels, setKennels] = useState([])
  const [puppies, setPuppies] = useState([])
  const [sellers, setSellers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [testimonials, setTestimonials] = useState([])
  const [adminSettings, setAdminSettings] = useState({})
  const [legalContent, setLegalContent] = useState('')
  const [adminUser, setAdminUser] = useState(null)
  const [sellerUser, setSellerUser] = useState(null)

  // ── Bootstrap: restore seller session from localStorage ──────────────────
  useEffect(() => {
    const token = getToken()
    const role = localStorage.getItem('role')
    if (token && role === 'admin') {
      setAdminUser({ email: localStorage.getItem('adminEmail') || '', name: 'Admin' })
    }
    if (token && role === 'seller') {
      apiFetch('/seller/me').then(async res => {
        if (res.ok) {
          const data = await res.json()
          setSellerUser({ ...data.seller, kennel: data.kennel })
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('role')
        }
      })
    }
  }, [])

  // ── Public data loaders ───────────────────────────────────────────────────
  const loadKennels = useCallback(async () => {
    const res = await apiFetch('/kennels')
    if (res.ok) setKennels(await res.json())
  }, [])

  const loadPuppies = useCallback(async () => {
    const res = await apiFetch('/puppies')
    if (res.ok) setPuppies(await res.json())
  }, [])

  const loadTestimonials = useCallback(async () => {
    const res = await apiFetch('/testimonials')
    if (res.ok) setTestimonials(await res.json())
  }, [])

  useEffect(() => {
    loadKennels()
    loadPuppies()
    loadTestimonials()
  }, [loadKennels, loadPuppies, loadTestimonials])

  // ── Admin data loaders ────────────────────────────────────────────────────
  const loadAdminData = useCallback(async () => {
    const [kRes, sRes, tRes, txRes, setRes, legRes] = await Promise.all([
      apiFetch('/admin/kennels'),
      apiFetch('/admin/sellers'),
      apiFetch('/admin/testimonials'),
      apiFetch('/admin/transactions'),
      apiFetch('/admin/settings'),
      apiFetch('/admin/legal'),
    ])
    if (kRes.ok) setKennels(await kRes.json())
    if (sRes.ok) setSellers(await sRes.json())
    if (tRes.ok) setTestimonials(await tRes.json())
    if (txRes.ok) setTransactions(await txRes.json())
    if (setRes.ok) setAdminSettings(await setRes.json())
    if (legRes.ok) { const d = await legRes.json(); setLegalContent(d.content) }
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loginAdmin = async (email, password) => {
    const res = await apiFetch('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) return false
    const { token } = await res.json()
    localStorage.setItem('token', token)
    localStorage.setItem('role', 'admin')
    localStorage.setItem('adminEmail', email)
    setAdminUser({ email, name: 'Admin' })
    await loadAdminData()
    return true
  }

  const loginSeller = async (email, password) => {
    const res = await apiFetch('/auth/seller/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      return { success: false, error: err.detail || 'Invalid credentials.' }
    }
    const { token, seller, kennel } = await res.json()
    localStorage.setItem('token', token)
    localStorage.setItem('role', 'seller')
    setSellerUser({ ...seller, kennel })
    return { success: true }
  }

  const logoutAdmin = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('adminEmail')
    setAdminUser(null)
  }

  const logoutSeller = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setSellerUser(null)
  }

  const signupSeller = async (formData) => {
    const res = await apiFetch('/auth/seller/signup', {
      method: 'POST',
      body: JSON.stringify(formData),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Signup failed')
    return data
  }

  // ── Public purchase ───────────────────────────────────────────────────────
  const purchasePuppy = async (puppyId, buyerDetails) => {
    const res = await apiFetch('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        puppy_id: puppyId,
        buyer_name: buyerDetails?.name ?? 'Anonymous',
        buyer_email: buyerDetails?.email ?? '',
      }),
    })
    if (!res.ok) return null
    const txn = await res.json()
    await loadPuppies()
    return txn
  }

  // ── Seller actions ────────────────────────────────────────────────────────
  const addPuppy = async (puppyData) => {
    await apiFetch('/seller/puppies', {
      method: 'POST',
      body: JSON.stringify(puppyData),
    })
    await loadPuppies()
  }

  const delistPuppy = async (puppyId) => {
    await apiFetch(`/seller/puppies/${puppyId}`, { method: 'DELETE' })
    await loadPuppies()
  }

  const updateSellerProfile = async (updates) => {
    const res = await apiFetch('/seller/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const kennel = await res.json()
      setSellerUser(prev => ({ ...prev, kennel }))
      await loadKennels()
    }
  }

  // ── Admin — kennels ───────────────────────────────────────────────────────
  const adminAddKennel = async (data) => {
    const res = await apiFetch('/admin/kennels', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    const kennel = await res.json()
    await loadAdminData()
    return kennel
  }

  const adminEditKennel = async (kennelId, updates) => {
    await apiFetch(`/admin/kennels/${kennelId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    await loadAdminData()
  }

  const adminRemoveKennel = async (kennelId) => {
    await apiFetch(`/admin/kennels/${kennelId}`, { method: 'DELETE' })
    await loadAdminData()
  }

  const approveKennel = async (kennelId) => {
    await adminEditKennel(kennelId, { status: 'approved' })
  }

  const rejectKennel = async (kennelId) => {
    await adminEditKennel(kennelId, { status: 'rejected' })
  }

  const updateKennelCommission = async (kennelId, commission) => {
    await adminEditKennel(kennelId, { commission: Number(commission) })
  }

  // ── Admin — sellers ───────────────────────────────────────────────────────
  const adminAddSeller = async (data) => {
    const res = await apiFetch('/admin/sellers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    const seller = await res.json()
    await loadAdminData()
    return seller
  }

  const adminEditSeller = async (sellerId, updates) => {
    await apiFetch(`/admin/sellers/${sellerId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    await loadAdminData()
  }

  const adminRemoveSeller = async (sellerId) => {
    await apiFetch(`/admin/sellers/${sellerId}`, { method: 'DELETE' })
    await loadAdminData()
  }

  const approveSeller = async (sellerId) => {
    await apiFetch(`/admin/sellers/${sellerId}/approve`, { method: 'PATCH' })
    await loadAdminData()
  }

  const payMembership = async (sellerId) => {
    await apiFetch(`/admin/sellers/${sellerId}/pay-membership`, { method: 'PATCH' })
    await loadAdminData()
  }

  // ── Admin — puppies ───────────────────────────────────────────────────────
  const adminRemovePuppy = async (puppyId) => {
    await apiFetch(`/admin/puppies/${puppyId}`, { method: 'DELETE' })
    await loadAdminData()
    await loadPuppies()
  }

  // ── Admin — testimonials ──────────────────────────────────────────────────
  const addTestimonial = async (data) => {
    await apiFetch('/admin/testimonials', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await loadTestimonials()
  }

  const removeTestimonial = async (id) => {
    await apiFetch(`/admin/testimonials/${id}`, { method: 'DELETE' })
    await loadTestimonials()
  }

  // ── Admin — transactions ──────────────────────────────────────────────────
  const releasePayment = async (txnId) => {
    await apiFetch(`/admin/transactions/${txnId}/release`, { method: 'POST' })
    await loadAdminData()
  }

  const markSellerPaid = async (txnId) => {
    await releasePayment(txnId)
  }

  const markCommissionPaid = async (txnId) => {
    await releasePayment(txnId)
  }

  // ── Admin — settings & legal ──────────────────────────────────────────────
  const updateAdminSettings = async (settings) => {
    const res = await apiFetch('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
    if (res.ok) setAdminSettings(await res.json())
  }

  const updateLegal = async (content) => {
    const res = await apiFetch('/admin/legal', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
    if (res.ok) { const d = await res.json(); setLegalContent(d.content) }
  }

  return (
    <AppContext.Provider value={{
      kennels, puppies, sellers, adminSettings, legalContent, transactions, testimonials,
      addTestimonial, removeTestimonial,
      adminUser, sellerUser,
      loginAdmin, loginSeller, logoutAdmin, logoutSeller,
      purchasePuppy, releasePayment, markSellerPaid, markCommissionPaid,
      approveSeller, approveKennel, rejectKennel,
      updateKennelCommission, addPuppy, delistPuppy,
      updateLegal, updateAdminSettings, signupSeller, updateSellerProfile,
      payMembership,
      adminRemovePuppy, adminAddKennel, adminEditKennel, adminRemoveKennel,
      adminAddSeller, adminEditSeller, adminRemoveSeller,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
```

- [ ] **Step 2: Add `await` to `AdminLogin.jsx`**

Find the call to `loginAdmin` in `chichi/src/pages/admin/AdminLogin.jsx`. It will look like:

```js
const ok = loginAdmin(email, password)
```

Change it to:

```js
const ok = await loginAdmin(email, password)
```

Make the surrounding handler function `async` if it isn't already (e.g., `const handleSubmit = async (e) => {`).

- [ ] **Step 3: Add `await` to `SellerLogin.jsx`**

Find the call to `loginSeller` in `chichi/src/pages/seller/SellerLogin.jsx`. Change:

```js
const result = loginSeller(email, password)
```

To:

```js
const result = await loginSeller(email, password)
```

Make the surrounding handler `async`.

- [ ] **Step 4: Add `await` to `SellerSignup.jsx`**

Find the call to `signupSeller` in `chichi/src/pages/seller/SellerSignup.jsx`. Change:

```js
const seller = signupSeller(formData)
```

To:

```js
const seller = await signupSeller(formData)
```

Make the surrounding handler `async`.

- [ ] **Step 5: Add `await` to `PuppyDetailPage.jsx`**

Find the call to `purchasePuppy` in `chichi/src/pages/PuppyDetailPage.jsx`. Change:

```js
const txn = purchasePuppy(puppy.id, buyerDetails)
```

To:

```js
const txn = await purchasePuppy(puppy.id, buyerDetails)
```

Make the surrounding handler `async`.

- [ ] **Step 6: Start both servers and test manually**

Terminal 1 — backend:
```bash
cd chichi-api && source .venv/bin/activate
uvicorn main:app --reload
```

Terminal 2 — frontend:
```bash
cd chichi && npm run dev
```

Open http://localhost:5173 and verify:
- Home page loads kennels from the API (not mock data)
- Kennels page shows real kennel cards
- Puppy detail page shows a puppy
- Admin login at /admin/login works with `admin@chihuahuasa.co.za` / `admin123`
- Admin dashboard shows real transactions and settings
- Seller login at /seller/login works with `info@littleroyalschis.co.za` / `seller123`
- Seller dashboard shows their puppies

- [ ] **Step 7: Commit**

```bash
cd chichi
git add src/context/AppContext.jsx \
        src/pages/admin/AdminLogin.jsx \
        src/pages/seller/SellerLogin.jsx \
        src/pages/seller/SellerSignup.jsx \
        src/pages/PuppyDetailPage.jsx
git commit -m "feat: refactor AppContext to call FastAPI backend — remove all mock data"

cd ../chichi-api
git add .
git commit -m "chore: final backend wiring"
```

---

## Self-review checklist

**Spec coverage:**
- [x] All 7 DB tables defined and created (Task 1)
- [x] JWT auth for admin and seller (Tasks 2, 4)
- [x] Seed script with all mock data + bcrypt hashes (Task 3)
- [x] All public endpoints (Task 5)
- [x] All seller endpoints (Task 6)
- [x] All admin endpoints — kennels, sellers, puppies, testimonials, settings, legal, transactions (Tasks 7–8)
- [x] Transaction purchase with commission calculation (Task 9)
- [x] AppContext refactor + component await fixes (Task 10)
- [x] `.env` / `.gitignore` setup (Task 4)

**Out of scope (intentionally omitted):**
- Real payment processing
- Email sending (functions exist but send to console)
- File upload for images
- Production deployment

**Placeholder scan:** No TBDs, TODOs, or "similar to" references found.

**Type consistency:** `parse_puppy()` and `parse_transaction()` defined in Task 1 and used consistently in Tasks 5–9. `get_current_admin` and `get_current_seller` defined in Task 2, used in Tasks 6–9. All Pydantic models defined in Task 2 and referenced by name in Tasks 4–9.
