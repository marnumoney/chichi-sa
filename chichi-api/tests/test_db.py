import sqlite3
import pytest
from database import create_tables


@pytest.fixture
def test_db():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    create_tables(conn)
    yield conn
    conn.close()


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


def test_puppy_status_columns_exist(test_db):
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, price, sold, status, booked_by, booked_at)
        VALUES ('px1', 'k1', 'Rex', 10000.0, 0, 'booked', 'b1', '2026-07-12T10:00:00')
    """)
    test_db.commit()
    from database import parse_puppy
    row = test_db.execute("SELECT * FROM puppies WHERE id = 'px1'").fetchone()
    p = parse_puppy(row)
    assert p['status'] == 'booked'
    assert p['booked_by'] == 'b1'


def test_status_backfilled_from_sold_flag(test_db):
    # Legacy row: sold=1 but status left at default — create_tables() must backfill
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, price, sold)
        VALUES ('px2', 'k1', 'Old', 9000.0, 1)
    """)
    test_db.execute("UPDATE puppies SET status = 'available' WHERE id = 'px2'")
    test_db.commit()
    from database import create_tables
    create_tables(test_db)  # re-run migrations — must be idempotent
    row = test_db.execute("SELECT status FROM puppies WHERE id = 'px2'").fetchone()
    assert dict(row)['status'] == 'sold'


def test_parse_puppy_derives_status_when_missing(test_db):
    from database import parse_puppy
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, price, sold)
        VALUES ('px3', 'k1', 'NoStatus', 8000.0, 0)
    """)
    test_db.execute("UPDATE puppies SET status = NULL WHERE id = 'px3'")
    test_db.commit()
    row = test_db.execute("SELECT * FROM puppies WHERE id = 'px3'").fetchone()
    assert parse_puppy(row)['status'] == 'available'


def test_parse_transaction_type_defaults_to_full(test_db):
    from database import parse_transaction
    test_db.execute("""
        INSERT INTO transactions (id, puppy_id, amount) VALUES ('t1', 'p1', 100.0)
    """)
    test_db.execute("UPDATE transactions SET type = NULL WHERE id = 't1'")
    test_db.commit()
    row = test_db.execute("SELECT * FROM transactions WHERE id = 't1'").fetchone()
    assert parse_transaction(row)['type'] == 'full'
