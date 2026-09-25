import os
import sqlite3

DB_PATH = os.getenv('DB_PATH', os.path.join(os.path.dirname(__file__), 'freelancer_hub.db'))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'freelancer' CHECK (role IN ('freelancer', 'admin')),
    headline      TEXT NOT NULL DEFAULT '',
    bio           TEXT NOT NULL DEFAULT '',
    skills        TEXT NOT NULL DEFAULT '',
    hourly_rate   REAL NOT NULL DEFAULT 0,
    country       TEXT NOT NULL DEFAULT '',
    availability  TEXT NOT NULL DEFAULT 'available'
                  CHECK (availability IN ('available', 'limited', 'unavailable')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    client      TEXT NOT NULL,
    category    TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rate        REAL NOT NULL CHECK (rate >= 0),
    hours_per_week INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id        INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cover_letter  TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (job_id, freelancer_id)
);

CREATE TABLE IF NOT EXISTS time_entries (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    work_date      TEXT NOT NULL,
    hours          REAL NOT NULL CHECK (hours > 0 AND hours <= 24),
    note           TEXT NOT NULL DEFAULT '',
    rate           REAL NOT NULL,
    status         TEXT NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('submitted', 'approved', 'rejected')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payouts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount        REAL NOT NULL CHECK (amount > 0),
    method        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested', 'paid', 'rejected')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    summary     TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    minutes     INTEGER NOT NULL DEFAULT 10,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_completions (
    course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (course_id, freelancer_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message    TEXT NOT NULL,
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def connect(path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def create_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def get_db():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def notify(conn: sqlite3.Connection, user_id: int, message: str) -> None:
    conn.execute('INSERT INTO notifications (user_id, message) VALUES (?, ?)', (user_id, message))


def balance(conn: sqlite3.Connection, freelancer_id: int) -> dict:
    """Approved earnings minus payouts that are requested or paid."""
    earned = conn.execute(
        """SELECT COALESCE(SUM(t.hours * t.rate), 0) FROM time_entries t
           JOIN applications a ON a.id = t.application_id
           WHERE a.freelancer_id = ? AND t.status = 'approved'""",
        (freelancer_id,),
    ).fetchone()[0]
    pending = conn.execute(
        """SELECT COALESCE(SUM(t.hours * t.rate), 0) FROM time_entries t
           JOIN applications a ON a.id = t.application_id
           WHERE a.freelancer_id = ? AND t.status = 'submitted'""",
        (freelancer_id,),
    ).fetchone()[0]
    paid = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM payouts WHERE freelancer_id = ? AND status = 'paid'",
        (freelancer_id,),
    ).fetchone()[0]
    requested = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM payouts WHERE freelancer_id = ? AND status = 'requested'",
        (freelancer_id,),
    ).fetchone()[0]
    return {
        'earned': round(earned, 2),
        'pending_approval': round(pending, 2),
        'paid_out': round(paid, 2),
        'payout_requested': round(requested, 2),
        'available': round(earned - paid - requested, 2),
    }
