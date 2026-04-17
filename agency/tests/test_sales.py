import sys, os
from unittest.mock import MagicMock, patch
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.db import init_db, insert_lead
from shared.base_agent import Directive
from departments.sales.agent import SalesAgent


def make_config():
    return {
        "anthropic": {"model": "claude-opus-4-6", "api_key": "test"},
        "google_places": {"api_key": "gkey", "min_rating": 4.0, "min_reviews": 10,
                          "request_delay_seconds": 0.1, "industries": ["restaurant"],
                          "cities": ["Cape Town"]},
        "gmail": {"sender_email": "test@test.com", "app_password": "x"},
        "agency": {"name": "Test Agency", "website": "https://test.com",
                   "tone": "professional", "services": "websites", "cta": "Reply"},
    }


def test_sales_agent_skips_when_priority_skip():
    conn = init_db(":memory:", key="testkey")
    agent = SalesAgent("sales", make_config(), conn, {}, "topic")
    agent.output_dir = "/tmp"
    report = agent.run(Directive(priority="skip", instruction=""))
    assert report.status == "skipped"
    conn.close()


def test_sales_agent_returns_report_on_success():
    conn = init_db(":memory:", key="testkey")
    agent = SalesAgent("sales", make_config(), conn, {"sender": "t@t.com", "password": "x"}, "topic")
    agent.output_dir = "/tmp"
    with patch.object(agent, "_execute", return_value=[{"action": "sent_email", "lead": "Cafe"}]):
        report = agent.run(Directive(priority="high", instruction="focus on restaurants"))
    assert report.dept == "sales"
    assert report.status in ("success", "partial", "failed")
    conn.close()
