import sqlite3
from datetime import date


def init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
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
        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL REFERENCES leads(id),
            sent_at DATETIME,
            status TEXT,
            subject TEXT,
            body TEXT,
            outlook_message_id TEXT
        );
    """)
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
            """INSERT INTO emails (lead_id, sent_at, status, subject, body, outlook_message_id)
               VALUES (:lead_id, :sent_at, :status, :subject, :body, :outlook_message_id)""",
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


def get_daily_sent_count(conn: sqlite3.Connection) -> int:
    today = str(date.today())
    row = conn.execute(
        "SELECT COUNT(*) FROM emails WHERE DATE(sent_at) = ? AND status = 'sent'",
        (today,),
    ).fetchone()
    return row[0]
