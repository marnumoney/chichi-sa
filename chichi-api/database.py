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

def _add_column(conn, is_pg, table, col, defn):
    """Add a column safely on every deploy — never crashes even if column exists."""
    # PostgreSQL supports IF NOT EXISTS natively — no exception raised if column exists.
    # SQLite doesn't, so we fall back to try/except with rollback.
    if is_pg:
        try:
            conn.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {defn}')
            conn.commit()
        except Exception:
            conn.rollback()
    else:
        try:
            conn.execute(f'ALTER TABLE {table} ADD COLUMN {col} {defn}')
            conn.commit()
        except Exception:
            conn.rollback()


def create_tables(conn):
    is_pg = isinstance(conn, _PgConnection)
    insert_ignore = 'INSERT INTO' if is_pg else 'INSERT OR IGNORE INTO'
    on_conflict = 'ON CONFLICT DO NOTHING' if is_pg else ''
    blob_type = 'BYTEA' if is_pg else 'BLOB'

    # Each statement in its own try/except so one failure never blocks the rest
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
            breeding_rights_price REAL DEFAULT 0,
            images TEXT DEFAULT '[]',
            pedigree TEXT DEFAULT '{}',
            health TEXT DEFAULT '[]',
            description TEXT,
            registration_no TEXT,
            sire_image TEXT,
            dam_image TEXT
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
        """CREATE TABLE IF NOT EXISTS buyers (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            joined_date TEXT
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
        """CREATE TABLE IF NOT EXISTS buyer_protection (
            id INTEGER PRIMARY KEY DEFAULT 1,
            content TEXT DEFAULT ''
        )""",
        """CREATE TABLE IF NOT EXISTS terms_content (
            id INTEGER PRIMARY KEY DEFAULT 1,
            content TEXT DEFAULT ''
        )""",
        f"""CREATE TABLE IF NOT EXISTS certs (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            content_type TEXT NOT NULL,
            data {blob_type} NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        f"""CREATE TABLE IF NOT EXISTS images (
            id TEXT PRIMARY KEY,
            content_type TEXT NOT NULL,
            data {blob_type} NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS membership_logs (
            id TEXT PRIMARY KEY,
            kennel_id TEXT NOT NULL,
            note TEXT NOT NULL,
            logged_at TEXT NOT NULL,
            logged_by TEXT DEFAULT ''
        )""",
        """CREATE TABLE IF NOT EXISTS broadcasts (
            id TEXT PRIMARY KEY,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            sent_at TEXT NOT NULL,
            recipient_ids TEXT DEFAULT '[]'
        )""",
f"{insert_ignore} admin_settings (id) VALUES (1) {on_conflict}",
        f"{insert_ignore} legal_text (id) VALUES (1) {on_conflict}",
        f"{insert_ignore} buyer_protection (id) VALUES (1) {on_conflict}",
        f"{insert_ignore} terms_content (id) VALUES (1) {on_conflict}",
    ]

    for stmt in statements:
        try:
            conn.execute(stmt)
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f'[db] warning: {e}')

    # Additive column migrations — safe to re-run on every deploy
    for col, defn in [
        ('bank_name', "TEXT DEFAULT ''"),
        ('account_holder', "TEXT DEFAULT ''"),
        ('account_number', "TEXT DEFAULT ''"),
        ('branch_code', "TEXT DEFAULT ''"),
        ('account_type', "TEXT DEFAULT ''"),
    ]:
        _add_column(conn, is_pg, 'kennels', col, defn)

    _add_column(conn, is_pg, 'transactions', 'buyer_id', "TEXT DEFAULT ''")
    _add_column(conn, is_pg, 'kennels', 'logo', "TEXT DEFAULT ''")

    for col, defn in [
        ('reset_token', "TEXT DEFAULT ''"),
        ('reset_token_expiry', "TEXT DEFAULT ''"),
    ]:
        _add_column(conn, is_pg, 'buyers', col, defn)
        _add_column(conn, is_pg, 'sellers', col, defn)

    for col, defn in [
        ('kennel_name', "TEXT DEFAULT ''"),
        ('registry', "TEXT DEFAULT 'KUSA'"),
        ('phone', "TEXT DEFAULT ''"),
        ('city', "TEXT DEFAULT ''"),
        ('province', "TEXT DEFAULT ''"),
        ('documents', "TEXT DEFAULT '{}'"),
    ]:
        _add_column(conn, is_pg, 'sellers', col, defn)

    for col, defn in [
        ('sire_image', "TEXT DEFAULT ''"),
        ('dam_image', "TEXT DEFAULT ''"),
        ('breeding_rights_price', 'REAL DEFAULT 0'),
    ]:
        _add_column(conn, is_pg, 'puppies', col, defn)

    _add_column(conn, is_pg, 'testimonials', 'buyer_email', "TEXT DEFAULT ''")

    for col, defn in [
        ('admin_bank_name', "TEXT DEFAULT ''"),
        ('admin_account_holder', "TEXT DEFAULT 'Chihuahua South Africa'"),
        ('admin_account_number', "TEXT DEFAULT ''"),
        ('admin_branch_code', "TEXT DEFAULT ''"),
        ('admin_account_type', "TEXT DEFAULT 'Cheque / Current'"),
    ]:
        _add_column(conn, is_pg, 'admin_settings', col, defn)

    # Backfill referral codes for any kennel that doesn't have one yet
    import random, string
    rows = conn.execute("SELECT id FROM kennels WHERE referral_code IS NULL OR referral_code = ''").fetchall()
    for row in rows:
        kennel_id = dict(row)['id']
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if not conn.execute('SELECT id FROM kennels WHERE referral_code = ?', (code,)).fetchone():
                break
        conn.execute('UPDATE kennels SET referral_code = ? WHERE id = ?', (code, kennel_id))
    if rows:
        conn.commit()
        print(f'[db] backfilled referral codes for {len(rows)} kennel(s)')


# ── Row parsers ───────────────────────────────────────────────────────────────

def parse_puppy(row) -> dict:
    d = dict(row)
    d['images'] = json.loads(d.get('images') or '[]')
    d['pedigree'] = json.loads(d.get('pedigree') or '{}')
    d['health'] = json.loads(d.get('health') or '[]')
    d['sold'] = bool(d.get('sold', 0))
    d['breeding_rights'] = bool(d.get('breeding_rights', 0))
    d['breeding_rights_price'] = d.get('breeding_rights_price') or 0
    d['sire_image'] = d.get('sire_image') or ''
    d['dam_image'] = d.get('dam_image') or ''
    return d


def parse_transaction(row) -> dict:
    d = dict(row)
    d['seller_paid'] = bool(d.get('seller_paid', 0))
    d['commission_paid'] = bool(d.get('commission_paid', 0))
    return d


def parse_seller(row) -> dict:
    d = dict(row)
    d.pop('password_hash', None)
    try:
        d['documents'] = json.loads(d.get('documents') or '{}')
    except Exception:
        d['documents'] = {}
    return d
