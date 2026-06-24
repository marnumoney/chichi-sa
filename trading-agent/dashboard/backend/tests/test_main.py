import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
from unittest.mock import patch
from fastapi.testclient import TestClient


def get_client():
    from main import app
    return TestClient(app)


def test_get_portfolio_returns_cash_and_positions():
    client = get_client()
    mock_output = json.dumps({
        "cash": 100000.0,
        "positions": [
            {"symbol": "SPY", "qty": 2.0, "avg_entry_price": 720.0,
             "current_price": 733.0, "market_value": 1466.0, "unrealized_plpc": 0.018}
        ],
        "total_value": 101466.0,
    })
    with patch("main.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = mock_output
        mock_run.return_value.stderr = ""
        response = client.get("/portfolio")
    assert response.status_code == 200
    data = response.json()
    assert data["cash"] == 100000.0
    assert len(data["positions"]) == 1
    assert data["positions"][0]["symbol"] == "SPY"


def test_get_portfolio_handles_trade_error():
    client = get_client()
    with patch("main.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 1
        mock_run.return_value.stdout = ""
        mock_run.return_value.stderr = "Connection error"
        response = client.get("/portfolio")
    assert response.status_code == 502


def test_get_portfolio_handles_invalid_json():
    client = get_client()
    with patch("main.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "WARNING: something\nnot json"
        mock_run.return_value.stderr = ""
        response = client.get("/portfolio")
    assert response.status_code == 502


import main as main_module


def test_list_journal_returns_dates_descending(tmp_path):
    journal_dir = tmp_path / "journal"
    journal_dir.mkdir()
    (journal_dir / "2026-06-23.md").write_text("day 1")
    (journal_dir / "2026-06-24.md").write_text("day 2")
    (journal_dir / "summary.md").write_text("summary")  # must be excluded
    original = main_module.BASE_DIR
    main_module.BASE_DIR = tmp_path
    try:
        response = get_client().get("/journal")
        assert response.status_code == 200
        assert response.json()["dates"] == ["2026-06-24", "2026-06-23"]
    finally:
        main_module.BASE_DIR = original


def test_get_journal_entry(tmp_path):
    journal_dir = tmp_path / "journal"
    journal_dir.mkdir()
    (journal_dir / "2026-06-23.md").write_text("# Trade Journal\nContent here")
    original = main_module.BASE_DIR
    main_module.BASE_DIR = tmp_path
    try:
        response = get_client().get("/journal/2026-06-23")
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == "2026-06-23"
        assert "Content here" in data["content"]
    finally:
        main_module.BASE_DIR = original


def test_get_journal_entry_not_found():
    response = get_client().get("/journal/1999-01-01")
    assert response.status_code == 404
