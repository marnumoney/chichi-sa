"""Initialise the database schema on deploy. Safe to re-run — idempotent."""
from database import create_tables, get_connection


def seed():
    conn = get_connection()
    create_tables(conn)
    conn.close()
    print('Database initialised.')


if __name__ == '__main__':
    seed()
