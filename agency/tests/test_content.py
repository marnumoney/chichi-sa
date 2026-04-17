import sys, os
from unittest.mock import MagicMock, patch
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.db import init_db
from shared.base_agent import Directive
from departments.content.agent import ContentAgent


def test_content_agent_skip():
    conn = init_db(":memory:", key="testkey")
    agent = ContentAgent("content", {
        "anthropic": {"model": "m", "api_key": "k"},
        "agency": {"name": "T", "website": "h", "tone": "p"},
        "notifications": {"ntfy_topic": "t"},
    }, conn, {}, "t")
    agent.output_dir = "/tmp"
    report = agent.run(Directive(priority="skip", instruction=""))
    assert report.status == "skipped"
    conn.close()


def test_content_agent_writes_file(tmp_path):
    conn = init_db(":memory:", key="testkey")
    config = {
        "anthropic": {"model": "m", "api_key": "k"},
        "agency": {"name": "Launchpad", "website": "https://x.com", "tone": "friendly"},
        "notifications": {"ntfy_topic": "t"},
    }
    agent = ContentAgent("content", config, conn, {}, "t")
    agent.output_dir = str(tmp_path)
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="TITLE: Test Post\n\nThis is the body.")])
    agent.client = mock_client
    with patch("departments.content.tools.find_topic", return_value="Test topic"):
        report = agent.run(Directive(priority="medium", instruction="write about websites"))
    assert report.status == "success"
    assert len(report.files_created) == 1
    conn.close()
