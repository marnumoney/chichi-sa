import sqlite3
import pytest
from datetime import date
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from db import init_db, lead_exists, insert_lead, get_uncontacted_leads, insert_email, get_daily_sent_count


@pytest.fixture
def conn():
    c = init_db(":memory:")
    yield c
    c.close()


def test_init_db_creates_tables(conn):
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    names = {t[0] for t in tables}
    assert "leads" in names
    assert "emails" in names


def test_lead_exists_false_when_empty(conn):
    assert lead_exists(conn, "some_place_id") is False


def test_insert_and_find_lead(conn):
    lead = {
        "place_id": "abc123",
        "business_name": "Joe's Plumbing",
        "industry": "plumber",
        "city": "Durban",
        "phone": "0311234567",
        "email": "joe@example.com",
        "rating": 4.5,
        "review_count": 42,
        "found_date": str(date.today()),
    }
    insert_lead(conn, lead)
    assert lead_exists(conn, "abc123") is True


def test_insert_lead_duplicate_ignored(conn):
    lead = {
        "place_id": "abc123", "business_name": "Joe's Plumbing",
        "industry": "plumber", "city": "Durban", "phone": None,
        "email": None, "rating": 4.5, "review_count": 42,
        "found_date": str(date.today()),
    }
    insert_lead(conn, lead)
    insert_lead(conn, lead)  # second insert should not raise
    count = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    assert count == 1


def test_get_uncontacted_leads_returns_leads_with_email(conn):
    for i in range(5):
        lead = {
            "place_id": f"place_{i}", "business_name": f"Biz {i}",
            "industry": "gym", "city": "Joburg", "phone": None,
            "email": f"biz{i}@example.com", "rating": 4.2,
            "review_count": 20, "found_date": str(date.today()),
        }
        insert_lead(conn, lead)
    leads = get_uncontacted_leads(conn, limit=3)
    assert len(leads) == 3
    assert all(l["email"] for l in leads)


def test_get_uncontacted_leads_skips_no_email(conn):
    lead_no_email = {
        "place_id": "no_email", "business_name": "No Email Biz",
        "industry": "gym", "city": "Joburg", "phone": None,
        "email": None, "rating": 4.2, "review_count": 20,
        "found_date": str(date.today()),
    }
    insert_lead(conn, lead_no_email)
    leads = get_uncontacted_leads(conn, limit=10)
    assert len(leads) == 0


def test_get_uncontacted_leads_skips_already_emailed(conn):
    lead = {
        "place_id": "emailed_one", "business_name": "Already Emailed",
        "industry": "bakery", "city": "Cape Town", "phone": None,
        "email": "done@example.com", "rating": 4.8, "review_count": 30,
        "found_date": str(date.today()),
    }
    lead_id = insert_lead(conn, lead)
    insert_email(conn, {
        "lead_id": lead_id, "sent_at": "2026-04-09 08:00:00",
        "status": "sent", "subject": "Hi", "body": "Hello",
        "outlook_message_id": "msg_001",
    })
    leads = get_uncontacted_leads(conn, limit=10)
    assert len(leads) == 0


def test_get_daily_sent_count(conn):
    lead = {
        "place_id": "p1", "business_name": "Biz", "industry": "gym",
        "city": "Durban", "phone": None, "email": "x@x.com",
        "rating": 4.0, "review_count": 11, "found_date": str(date.today()),
    }
    lead_id = insert_lead(conn, lead)
    insert_email(conn, {
        "lead_id": lead_id, "sent_at": "2026-04-09 08:01:00",
        "status": "sent", "subject": "Hi", "body": "Body",
        "outlook_message_id": "msg_002",
    })
    assert get_daily_sent_count(conn) == 1
