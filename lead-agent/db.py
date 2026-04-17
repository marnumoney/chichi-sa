import os
from datetime import date

from sqlcipher3 import dbapi2 as sqlite3


def _load_key(key: str | None = None) -> str:
    if key is not None:
        return key
    path = os.path.expanduser("~/.db_master.key")
    with open(path, "r") as f:
        return f.read().strip()


def _apply_cipher_settings(conn: sqlite3.Connection, key: str) -> None:
    conn.execute(f'PRAGMA key="{key}"')
    conn.execute("PRAGMA cipher_page_size = 4096")
    conn.execute("PRAGMA kdf_iter = 256000")
    conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
    conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")


def init_db(db_path: str, key: str | None = None) -> sqlite3.Connection:
    db_key = _load_key(key)
    conn = sqlite3.connect(db_path)
    _apply_cipher_settings(conn, db_key)
    if db_path != ":memory:":
        os.chmod(db_path, 0o600)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            place_id TEXT UNIQUE NOT NULL,
            business_name TEXT NOT NULL,
            industry TEXT,
            city TEXT,
            phone TEXT,
            email TEXT,
            rating REAL,
            review_count INTEGER,
            found_date DATE
        );
        CREATE TABLE IF NOT EXISTS replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER REFERENCES leads(id),
            received_at DATETIME,
            from_email TEXT,
            subject TEXT,
            body TEXT,
            gmail_uid TEXT UNIQUE,
            notified INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL REFERENCES leads(id),
            sent_at DATETIME,
            status TEXT,
            subject TEXT,
            body TEXT,
            outlook_message_id TEXT,
            follow_up_number INTEGER DEFAULT 0
        );
    """)
    # Migration: add follow_up_number if it doesn't exist yet
    existing_cols = [row[1] for row in conn.execute("PRAGMA table_info(emails)").fetchall()]
    if "follow_up_number" not in existing_cols:
        conn.execute("ALTER TABLE emails ADD COLUMN follow_up_number INTEGER DEFAULT 0")
    conn.commit()
    return conn


def lead_exists(conn: sqlite3.Connection, place_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM leads WHERE place_id = ?", (place_id,)
    ).fetchone()
    return row is not None


def insert_lead(conn: sqlite3.Connection, lead: dict) -> int:
    cur = conn.execute(
        """INSERT OR IGNORE INTO leads
           (place_id, business_name, industry, city, phone, email, rating, review_count, found_date)
           VALUES (:place_id, :business_name, :industry, :city, :phone, :email, :rating, :review_count, :found_date)""",
        lead,
    )
    conn.commit()
    if cur.lastrowid is not None and cur.lastrowid != 0:
        return cur.lastrowid
    return conn.execute(
        "SELECT id FROM leads WHERE place_id = ?", (lead["place_id"],)
    ).fetchone()[0]


def get_uncontacted_leads(conn: sqlite3.Connection, limit: int) -> list[dict]:
    rows = conn.execute(
        """SELECT l.* FROM leads l
           WHERE l.email IS NOT NULL AND l.email != ''
           AND NOT EXISTS (SELECT 1 FROM emails WHERE emails.lead_id = l.id)
           LIMIT ?""",
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def insert_email(conn: sqlite3.Connection, email_record: dict) -> None:
    try:
        conn.execute(
            """INSERT INTO emails (lead_id, sent_at, status, subject, body, outlook_message_id, follow_up_number)
               VALUES (:lead_id, :sent_at, :status, :subject, :body, :outlook_message_id, :follow_up_number)""",
            email_record,
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def update_lead_email(conn: sqlite3.Connection, lead_id: int, email: str) -> None:
    conn.execute("UPDATE leads SET email = ? WHERE id = ?", (email, lead_id))
    conn.commit()


def get_leads_without_email(conn: sqlite3.Connection, limit: int) -> list[dict]:
    rows = conn.execute(
        """SELECT * FROM leads
           WHERE (email IS NULL OR email = '')
           AND NOT EXISTS (SELECT 1 FROM emails WHERE emails.lead_id = leads.id)
           LIMIT ?""",
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_leads_for_followup(conn: sqlite3.Connection, days_since_first: int, follow_up_number: int) -> list[dict]:
    """Return leads whose initial cold email was sent ~days_since_first days ago
    and who have not yet received follow_up_number."""
    rows = conn.execute(
        """SELECT l.*, e.sent_at as first_sent_at
           FROM leads l
           JOIN emails e ON e.lead_id = l.id
           WHERE e.follow_up_number = 0
             AND e.status = 'sent'
             AND DATE(e.sent_at) <= DATE('now', ?)
             AND NOT EXISTS (
                 SELECT 1 FROM emails f
                 WHERE f.lead_id = l.id
                   AND f.follow_up_number = ?
             )""",
        (f"-{days_since_first} days", follow_up_number),
    ).fetchall()
    return [dict(row) for row in rows]


def get_contacted_emails(conn: sqlite3.Connection) -> dict:
    """Return {email: lead_dict} for every lead we've emailed."""
    rows = conn.execute(
        """SELECT DISTINCT l.* FROM leads l
           JOIN emails e ON e.lead_id = l.id
           WHERE e.status = 'sent'"""
    ).fetchall()
    return {row["email"]: dict(row) for row in rows if row["email"]}


def reply_already_seen(conn: sqlite3.Connection, gmail_uid: str) -> bool:
    row = conn.execute("SELECT 1 FROM replies WHERE gmail_uid = ?", (gmail_uid,)).fetchone()
    return row is not None


def insert_reply(conn: sqlite3.Connection, reply: dict) -> None:
    conn.execute(
        """INSERT OR IGNORE INTO replies (lead_id, received_at, from_email, subject, body, gmail_uid, notified)
           VALUES (:lead_id, :received_at, :from_email, :subject, :body, :gmail_uid, :notified)""",
        reply,
    )
    conn.commit()


def get_daily_sent_count(conn: sqlite3.Connection) -> int:
    today = str(date.today())
    row = conn.execute(
        "SELECT COUNT(*) FROM emails WHERE DATE(sent_at) = ? AND status = 'sent'",
        (today,),
    ).fetchone()
    return row[0]
