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
