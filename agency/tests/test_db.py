import sqlite3
import pytest
from datetime import date
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.db import (init_db, lead_exists, insert_lead, get_uncontacted_leads,
                       insert_email, get_daily_sent_count, get_leads_without_email,
                       get_leads_for_followup, update_lead_email, get_contacted_emails,
                       insert_reply, reply_already_seen, insert_client, get_all_clients,
                       upsert_project, get_active_projects, get_unpaid_invoices,
                       insert_invoice, insert_ceo_directive, get_business_metrics)


@pytest.fixture
def conn():
    c = init_db(":memory:")
    yield c
    c.close()


def test_init_db_creates_all_tables(conn):
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    names = {t[0] for t in tables}
    for t in ["leads","emails","replies","clients","projects","tasks","invoices","ceo_directives"]:
        assert t in names, f"Missing table: {t}"


def test_lead_exists_false_when_empty(conn):
    assert lead_exists(conn, "some_place_id") is False


def test_insert_and_find_lead(conn):
    lead = {"place_id": "abc123", "business_name": "Joe's Plumbing",
            "industry": "plumber", "city": "Durban", "phone": "0311234567",
            "email": "joe@example.com", "rating": 4.5, "review_count": 42,
            "found_date": str(date.today())}
    insert_lead(conn, lead)
    assert lead_exists(conn, "abc123") is True


def test_insert_lead_duplicate_ignored(conn):
    lead = {"place_id": "abc123", "business_name": "Joe's Plumbing",
            "industry": "plumber", "city": "Durban", "phone": None,
            "email": None, "rating": 4.5, "review_count": 42,
            "found_date": str(date.today())}
    insert_lead(conn, lead)
    insert_lead(conn, lead)
    count = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    assert count == 1


def test_get_uncontacted_leads_returns_leads_with_email(conn):
    for i in range(5):
        lead = {"place_id": f"place_{i}", "business_name": f"Biz {i}",
                "industry": "gym", "city": "Joburg", "phone": None,
                "email": f"biz{i}@example.com", "rating": 4.2,
                "review_count": 20, "found_date": str(date.today())}
        insert_lead(conn, lead)
    leads = get_uncontacted_leads(conn, limit=3)
    assert len(leads) == 3
    assert all(l["email"] for l in leads)


def test_get_uncontacted_leads_skips_already_emailed(conn):
    lead = {"place_id": "emailed_one", "business_name": "Already Emailed",
            "industry": "bakery", "city": "Cape Town", "phone": None,
            "email": "done@example.com", "rating": 4.8, "review_count": 30,
            "found_date": str(date.today())}
    lead_id = insert_lead(conn, lead)
    insert_email(conn, {"lead_id": lead_id, "sent_at": str(date.today()) + " 08:00:00",
                        "status": "sent", "subject": "Hi", "body": "Hello",
                        "outlook_message_id": "msg_001", "follow_up_number": 0})
    leads = get_uncontacted_leads(conn, limit=10)
    assert len(leads) == 0


def test_get_daily_sent_count(conn):
    lead = {"place_id": "p1", "business_name": "Biz", "industry": "gym",
            "city": "Durban", "phone": None, "email": "x@x.com",
            "rating": 4.0, "review_count": 11, "found_date": str(date.today())}
    lead_id = insert_lead(conn, lead)
    insert_email(conn, {"lead_id": lead_id, "sent_at": str(date.today()) + " 08:01:00",
                        "status": "sent", "subject": "Hi", "body": "Body",
                        "outlook_message_id": "msg_002", "follow_up_number": 0})
    assert get_daily_sent_count(conn) == 1


def test_get_leads_without_email(conn):
    lead = {"place_id": "noemail", "business_name": "No Email Biz",
            "industry": "gym", "city": "Joburg", "phone": None,
            "email": None, "rating": 4.2, "review_count": 20,
            "found_date": str(date.today())}
    insert_lead(conn, lead)
    leads = get_leads_without_email(conn, limit=10)
    assert len(leads) == 1
    assert leads[0]["business_name"] == "No Email Biz"


def test_update_lead_email(conn):
    lead = {"place_id": "upd1", "business_name": "Update Biz",
            "industry": "gym", "city": "Joburg", "phone": None,
            "email": None, "rating": 4.2, "review_count": 20,
            "found_date": str(date.today())}
    lead_id = insert_lead(conn, lead)
    update_lead_email(conn, lead_id, "new@example.com")
    row = conn.execute("SELECT email FROM leads WHERE id=?", (lead_id,)).fetchone()
    assert row[0] == "new@example.com"


def test_insert_client_and_get_all(conn):
    insert_client(conn, {"name": "Acme", "email": "acme@example.com", "phone": "011111",
                          "status": "active", "revenue_total": 1000, "notes": "Good client"})
    clients = get_all_clients(conn)
    assert len(clients) == 1
    assert clients[0]["name"] == "Acme"


def test_upsert_project_and_get_active(conn):
    cid = insert_client(conn, {"name": "Client1", "email": "c@c.com", "phone": "",
                                "status": "active", "revenue_total": 0, "notes": ""})
    upsert_project(conn, {"client_id": cid, "name": "Website", "status": "active",
                          "budget": 500, "deadline": "2026-12-31", "dept": "development",
                          "description": "Build a website"})
    projects = get_active_projects(conn)
    assert len(projects) == 1
    assert projects[0]["name"] == "Website"


def test_insert_ceo_directive(conn):
    insert_ceo_directive(conn, {"date": str(date.today()), "directive_json": "{}",
                                 "outcomes_json": "{}", "strategy_version": 1})
    count = conn.execute("SELECT COUNT(*) FROM ceo_directives").fetchone()[0]
    assert count == 1


def test_get_business_metrics(conn):
    metrics = get_business_metrics(conn)
    assert "total_leads" in metrics
    assert "reply_rate_pct" in metrics
    assert "revenue_total" in metrics
