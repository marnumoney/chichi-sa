import logging
import os
from datetime import date, timedelta
from typing import Optional

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


logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id TEXT UNIQUE NOT NULL,
    business_name TEXT,
    industry TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    rating REAL,
    review_count INTEGER,
    found_date TEXT,
    contacted INTEGER DEFAULT 0,
    website TEXT
);

CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    sent_at TEXT,
    status TEXT,
    subject TEXT,
    body TEXT,
    outlook_message_id TEXT,
    follow_up_number INTEGER DEFAULT 0,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    from_email TEXT,
    subject TEXT,
    body TEXT,
    received_at TEXT,
    handled INTEGER DEFAULT 0,
    gmail_uid TEXT UNIQUE,
    notified INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    joined_at TEXT,
    revenue_total REAL DEFAULT 0,
    last_contact_at TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    budget REAL,
    deadline TEXT,
    dept TEXT,
    description TEXT,
    created_at TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    dept TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    due_date TEXT,
    created_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    project_id INTEGER,
    amount REAL,
    status TEXT DEFAULT 'unpaid',
    issued_at TEXT,
    due_date TEXT,
    paid_at TEXT,
    notes TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS ceo_directives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    directive_json TEXT,
    outcomes_json TEXT,
    strategy_version INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);
"""


def init_db(path: str, key: str | None = None) -> sqlite3.Connection:
    db_key = _load_key(key)
    conn = sqlite3.connect(path)
    _apply_cipher_settings(conn, db_key)
    if path != ":memory:":
        os.chmod(path, 0o600)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


# --- Leads ---

def lead_exists(conn: sqlite3.Connection, place_id: str) -> bool:
    row = conn.execute("SELECT 1 FROM leads WHERE place_id=?", (place_id,)).fetchone()
    return row is not None


def insert_lead(conn: sqlite3.Connection, lead: dict) -> int:
    try:
        cur = conn.execute(
            """INSERT OR IGNORE INTO leads
               (place_id, business_name, industry, city, phone, email, rating, review_count, found_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (lead["place_id"], lead.get("business_name"), lead.get("industry"),
             lead.get("city"), lead.get("phone"), lead.get("email"),
             lead.get("rating"), lead.get("review_count"), lead.get("found_date")),
        )
        conn.commit()
        if cur.lastrowid:
            return cur.lastrowid
        return conn.execute("SELECT id FROM leads WHERE place_id=?", (lead["place_id"],)).fetchone()[0]
    except Exception as e:
        logger.error("insert_lead failed: %s", e)
        raise


def get_uncontacted_leads(conn: sqlite3.Connection, limit: int = 10) -> list[dict]:
    rows = conn.execute(
        """SELECT l.* FROM leads l
           WHERE l.email IS NOT NULL AND l.email != ''
           AND l.id NOT IN (SELECT DISTINCT lead_id FROM emails WHERE status='sent')
           LIMIT ?""",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_leads_without_email(conn: sqlite3.Connection, limit: int = 100) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM leads WHERE email IS NULL OR email='' LIMIT ?", (limit,)
    ).fetchall()
    return [dict(r) for r in rows]


def get_leads_for_followup(conn: sqlite3.Connection, days_since_first: int,
                            follow_up_number: int) -> list[dict]:
    cutoff = str(date.today() - timedelta(days=days_since_first))
    rows = conn.execute(
        """SELECT l.* FROM leads l
           JOIN emails e ON e.lead_id = l.id AND e.follow_up_number = 0 AND e.status = 'sent'
           WHERE e.sent_at <= ?
           AND l.id NOT IN (
               SELECT lead_id FROM emails WHERE follow_up_number = ? AND status = 'sent'
           )
           AND l.email IS NOT NULL""",
        (cutoff, follow_up_number),
    ).fetchall()
    return [dict(r) for r in rows]


def update_lead_email(conn: sqlite3.Connection, lead_id: int, email: str) -> None:
    conn.execute("UPDATE leads SET email=? WHERE id=?", (email, lead_id))
    conn.commit()


def get_contacted_emails(conn: sqlite3.Connection) -> dict:
    """Return {email: {id, business_name}} for all leads that have been emailed."""
    rows = conn.execute(
        """SELECT l.id, l.business_name, l.email FROM leads l
           JOIN emails e ON e.lead_id = l.id WHERE e.status='sent' AND l.email IS NOT NULL"""
    ).fetchall()
    return {r["email"].lower(): dict(r) for r in rows}


# --- Emails ---

def insert_email(conn: sqlite3.Connection, email: dict) -> int:
    cur = conn.execute(
        """INSERT INTO emails (lead_id, sent_at, status, subject, body, outlook_message_id, follow_up_number)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (email["lead_id"], email.get("sent_at"), email.get("status"),
         email.get("subject"), email.get("body"), email.get("outlook_message_id", ""),
         email.get("follow_up_number", 0)),
    )
    conn.commit()
    return cur.lastrowid


def get_daily_sent_count(conn: sqlite3.Connection) -> int:
    today = str(date.today())
    row = conn.execute(
        "SELECT COUNT(*) FROM emails WHERE status='sent' AND sent_at LIKE ?",
        (f"{today}%",),
    ).fetchone()
    return row[0] if row else 0


# --- Replies ---

def insert_reply(conn: sqlite3.Connection, reply: dict) -> int:
    try:
        cur = conn.execute(
            """INSERT OR IGNORE INTO replies
               (lead_id, from_email, subject, body, received_at, gmail_uid, notified)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (reply.get("lead_id"), reply.get("from_email"), reply.get("subject"),
             reply.get("body"), reply.get("received_at"), reply.get("gmail_uid"), 0),
        )
        conn.commit()
        return cur.lastrowid
    except Exception as e:
        logger.error("insert_reply failed: %s", e)
        raise


def reply_already_seen(conn: sqlite3.Connection, gmail_uid: str) -> bool:
    row = conn.execute("SELECT 1 FROM replies WHERE gmail_uid=?", (gmail_uid,)).fetchone()
    return row is not None


# --- Clients ---

def insert_client(conn: sqlite3.Connection, client: dict) -> int:
    cur = conn.execute(
        """INSERT INTO clients (name, email, phone, status, joined_at, revenue_total, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (client["name"], client.get("email"), client.get("phone"),
         client.get("status", "active"), client.get("joined_at", str(date.today())),
         client.get("revenue_total", 0), client.get("notes", "")),
    )
    conn.commit()
    return cur.lastrowid


def get_all_clients(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM clients WHERE status='active'").fetchall()
    return [dict(r) for r in rows]


# --- Projects ---

def upsert_project(conn: sqlite3.Connection, project: dict) -> int:
    cur = conn.execute(
        """INSERT INTO projects (client_id, name, status, budget, deadline, dept, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (project.get("client_id"), project["name"], project.get("status", "active"),
         project.get("budget"), project.get("deadline"), project.get("dept"),
         project.get("description"), project.get("created_at", str(date.today()))),
    )
    conn.commit()
    return cur.lastrowid


def get_active_projects(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """SELECT p.*, c.name as client_name FROM projects p
           LEFT JOIN clients c ON c.id = p.client_id
           WHERE p.status IN ('active', 'in_progress')"""
    ).fetchall()
    return [dict(r) for r in rows]


# --- Invoices ---

def insert_invoice(conn: sqlite3.Connection, invoice: dict) -> int:
    cur = conn.execute(
        """INSERT INTO invoices (client_id, project_id, amount, status, issued_at, due_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (invoice.get("client_id"), invoice.get("project_id"), invoice.get("amount"),
         invoice.get("status", "unpaid"), invoice.get("issued_at", str(date.today())),
         invoice.get("due_date"), invoice.get("notes", "")),
    )
    conn.commit()
    return cur.lastrowid


def get_unpaid_invoices(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """SELECT inv.*, c.name as client_name FROM invoices inv
           LEFT JOIN clients c ON c.id = inv.client_id
           WHERE inv.status != 'paid'"""
    ).fetchall()
    return [dict(r) for r in rows]


# --- CEO Directives ---

def insert_ceo_directive(conn: sqlite3.Connection, directive: dict) -> int:
    cur = conn.execute(
        """INSERT INTO ceo_directives (date, directive_json, outcomes_json, strategy_version)
           VALUES (?, ?, ?, ?)""",
        (directive["date"], directive.get("directive_json", "{}"),
         directive.get("outcomes_json", "{}"), directive.get("strategy_version", 1)),
    )
    conn.commit()
    return cur.lastrowid


# --- Business Metrics (for CEO Phase 1) ---

def get_business_metrics(conn: sqlite3.Connection) -> dict:
    total_leads = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    total_sent_7d = conn.execute(
        "SELECT COUNT(*) FROM emails WHERE status='sent' AND sent_at >= DATE('now', '-7 days')"
    ).fetchone()[0]
    total_replies_7d = conn.execute(
        "SELECT COUNT(*) FROM replies WHERE received_at >= DATE('now', '-7 days')"
    ).fetchone()[0]
    reply_rate = round((total_replies_7d / total_sent_7d * 100) if total_sent_7d > 0 else 0, 2)
    total_clients = conn.execute("SELECT COUNT(*) FROM clients WHERE status='active'").fetchone()[0]
    revenue_total = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status='paid'"
    ).fetchone()[0]
    revenue_outstanding = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status!='paid'"
    ).fetchone()[0]
    active_projects = conn.execute(
        "SELECT COUNT(*) FROM projects WHERE status IN ('active','in_progress')"
    ).fetchone()[0]
    return {
        "total_leads": total_leads,
        "emails_sent_7d": total_sent_7d,
        "replies_7d": total_replies_7d,
        "reply_rate_pct": reply_rate,
        "total_clients": total_clients,
        "revenue_total": revenue_total,
        "revenue_outstanding": revenue_outstanding,
        "active_projects": active_projects,
    }
