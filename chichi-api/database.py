import os
import json

DATABASE_URL = os.getenv('DATABASE_URL')


# ── PostgreSQL wrapper ────────────────────────────────────────────────────────

class _PgConnection:
    """Adapts psycopg2 to sqlite3's conn.execute() API so routers need no changes."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        cur = self._conn.cursor()
        cur.execute(sql.replace('?', '%s'), params)
        return cur

    def executemany(self, sql, param_list):
        cur = self._conn.cursor()
        cur.executemany(sql.replace('?', '%s'), param_list)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


# ── Connection factory ────────────────────────────────────────────────────────

def get_connection():
    if DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        return _PgConnection(conn)
    import sqlite3
    db_path = os.getenv('DB_PATH', 'chichi.db')
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


# ── Schema ────────────────────────────────────────────────────────────────────

def create_tables(conn):
    is_pg = isinstance(conn, _PgConnection)
    insert_ignore = 'INSERT INTO' if is_pg else 'INSERT OR IGNORE INTO'
    on_conflict = 'ON CONFLICT DO NOTHING' if is_pg else ''

    statements = [
        """CREATE TABLE IF NOT EXISTS kennels (
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
            referral_code TEXT,
            bank_name TEXT DEFAULT '',
            account_holder TEXT DEFAULT '',
            account_number TEXT DEFAULT '',
            branch_code TEXT DEFAULT '',
            account_type TEXT DEFAULT ''
        )""",
        """CREATE TABLE IF NOT EXISTS puppies (
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
        )""",
        """CREATE TABLE IF NOT EXISTS sellers (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            kennel_id TEXT,
            status TEXT DEFAULT 'pending_verification',
            joined_date TEXT,
            warning_date TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS transactions (
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
        )""",
        """CREATE TABLE IF NOT EXISTS testimonials (
            id TEXT PRIMARY KEY,
            kennel_id TEXT,
            buyer_name TEXT,
            stars INTEGER,
            text TEXT,
            date TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS admin_settings (
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
        )""",
        """CREATE TABLE IF NOT EXISTS legal_text (
            id INTEGER PRIMARY KEY DEFAULT 1,
            content TEXT DEFAULT ''
        )""",
        f"{insert_ignore} admin_settings (id) VALUES (1) {on_conflict}",
        f"{insert_ignore} legal_text (id) VALUES (1) {on_conflict}",
    ]

    for stmt in statements:
        conn.execute(stmt)
    conn.commit()

    # Additive migrations for existing tables
    banking_cols = [
        ('bank_name', "TEXT DEFAULT ''"),
        ('account_holder', "TEXT DEFAULT ''"),
        ('account_number', "TEXT DEFAULT ''"),
        ('branch_code', "TEXT DEFAULT ''"),
        ('account_type', "TEXT DEFAULT ''"),
    ]
    for col, defn in banking_cols:
        try:
            conn.execute(f'ALTER TABLE kennels ADD COLUMN {col} {defn}')
            conn.commit()
        except Exception:
            conn.rollback()  # PostgreSQL requires rollback before any further statements


# ── Row parsers ───────────────────────────────────────────────────────────────

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
