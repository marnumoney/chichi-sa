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
