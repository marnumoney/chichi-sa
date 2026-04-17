import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.db import init_db, insert_client, upsert_project
from shared.base_agent import Directive, DepartmentReport


def test_load_config_injects_env(tmp_path):
    from ceo import load_config
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("anthropic:\n  model: claude-opus-4-6\n")
    env_file = tmp_path / ".env"
    env_file.write_text("ANTHROPIC_API_KEY=test-key-123\n")
    cfg = load_config(str(cfg_file))
    assert cfg["anthropic"]["api_key"] == "test-key-123"


def test_read_business_context_returns_metrics(tmp_path):
    from ceo import read_business_context
    conn = init_db(":memory:", key="testkey")
    insert_client(conn, {"name": "C1", "email": "c1@x.com", "phone": "",
                         "status": "active", "revenue_total": 500, "notes": ""})
    ctx = read_business_context(conn, str(tmp_path / "strategy.md"), str(tmp_path / "journal"))
    assert "total_leads" in ctx["metrics"]
    assert ctx["strategy"] == ""   # no strategy file yet
    conn.close()


def test_decide_returns_directive_for_all_depts(tmp_path):
    from unittest.mock import MagicMock
    from ceo import decide
    import json

    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text=json.dumps({
            "date": "2026-01-01",
            "business_context": "Early stage agency",
            "departments": {
                "sales": {"priority": "high", "instruction": "Focus on restaurants"},
                "account_mgmt": {"priority": "low", "instruction": "No clients yet"},
                "project_mgmt": {"priority": "skip", "instruction": ""},
                "design": {"priority": "skip", "instruction": ""},
                "development": {"priority": "skip", "instruction": ""},
                "content": {"priority": "medium", "instruction": "Write blog post"},
                "marketing": {"priority": "low", "instruction": "Draft LinkedIn post"},
                "strategy": {"priority": "low", "instruction": "Competitor scan"},
                "finance": {"priority": "skip", "instruction": ""},
                "hr": {"priority": "skip", "instruction": ""},
                "qa": {"priority": "skip", "instruction": ""},
            }
        }))]
    )
    ctx = {"strategy": "", "journal_entries": [], "metrics": {"total_leads": 0}}
    directives = decide(mock_client, ctx, "claude-opus-4-6")
    assert "sales" in directives
    assert directives["sales"].priority == "high"
    assert directives["content"].priority == "medium"


def test_reflect_and_learn_writes_journal_and_strategy(tmp_path):
    from unittest.mock import MagicMock
    from ceo import reflect_and_learn
    import json

    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text=json.dumps({
            "journal_entry": "Today sales sent 5 emails. Reply rate still low.",
            "updated_strategy": "Focus on restaurants. Subject lines need testing."
        }))]
    )
    journal_dir = tmp_path / "journal"
    journal_dir.mkdir()
    strategy_path = str(tmp_path / "strategy.md")
    directives = {"sales": Directive("high", "do outreach")}
    reports = [DepartmentReport("sales", "success", emails_sent=5, metrics={"sent": 5})]
    metrics_before = {"total_sent": 100, "reply_rate_pct": 1.2}

    reflect_and_learn(mock_client, "claude-opus-4-6", directives, reports,
                      metrics_before, strategy_path, str(journal_dir))

    assert (tmp_path / "strategy.md").exists()
    files = list(journal_dir.glob("*.md"))
    assert len(files) == 1
