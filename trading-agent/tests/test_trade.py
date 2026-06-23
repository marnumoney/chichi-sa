import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from unittest.mock import patch, MagicMock
import pytest


WATCHLIST = [
    {"symbol": "SPY",  "max_allocation_pct": 15},
    {"symbol": "NVDA", "max_allocation_pct": 8},
    {"symbol": "AAPL", "max_allocation_pct": 8},
]


def test_validate_order_exceeds_watchlist_allocation():
    from trade import validate_order
    positions = []
    # 20 * 900 = 18000 = 180% of 10000 — exceeds 8% NVDA cap
    valid, msg = validate_order("NVDA", 20, "buy", 900.0, 10000.0, positions, WATCHLIST)
    assert not valid
    assert "8%" in msg


def test_validate_order_uses_default_5pct_for_unknown_symbol():
    from trade import validate_order
    positions = []
    # 10 * 200 = 2000 = 20% — exceeds 5% default
    valid, msg = validate_order("TSLA", 10, "buy", 200.0, 10000.0, positions, WATCHLIST)
    assert not valid
    assert "5%" in msg


def test_validate_order_violates_cash_reserve():
    from trade import validate_order
    positions = [{"market_value": "7500.0"}]
    # 3 * 200 = 600 = 6% < 8% AAPL cap (allocation ok); 7500 + 600 = 8100/10000 = 81% > 80%
    valid, msg = validate_order("AAPL", 3, "buy", 200.0, 10000.0, positions, WATCHLIST)
    assert not valid
    assert "cash reserve" in msg


def test_validate_order_passes_valid_buy():
    from trade import validate_order
    positions = [{"market_value": "2000.0"}]
    # 2 * 195 = 390 = 3.9% < 8%; total = 2390/10000 = 23.9% < 80%
    valid, msg = validate_order("AAPL", 2, "buy", 195.0, 10000.0, positions, WATCHLIST)
    assert valid
    assert msg == "Order validated"


def test_validate_order_spy_uses_15pct_cap():
    from trade import validate_order
    positions = []
    # 2 * 520 = 1040 = 10.4% — within SPY's 15% cap
    valid, msg = validate_order("SPY", 2, "buy", 520.0, 10000.0, positions, WATCHLIST)
    assert valid


def test_validate_order_sell_always_passes():
    from trade import validate_order
    positions = [{"market_value": "7500.0"}]
    valid, msg = validate_order("NVDA", 5, "sell", 900.0, 10000.0, positions, WATCHLIST)
    assert valid


def test_validate_order_fresh_portfolio_enforces_allocation_cap():
    from trade import validate_order
    positions = []
    # 30 * 250 = 7500 = 75% of 10000 — under 80% cash reserve but WAY over 5% default cap
    valid, msg = validate_order("TSLA", 30, "buy", 250.0, 10000.0, positions, WATCHLIST)
    assert not valid
    assert "5%" in msg


def test_validate_order_zero_account_value():
    from trade import validate_order
    positions = []
    valid, msg = validate_order("AAPL", 1, "buy", 100.0, 0.0, positions, WATCHLIST)
    assert not valid
    assert "zero" in msg


def _mock_get(url, **kwargs):
    mock = MagicMock()
    mock.raise_for_status = MagicMock()
    if url.endswith("/v2/account"):
        mock.json.return_value = {"cash": "12450.00", "portfolio_value": "23891.80"}
    elif url.endswith("/v2/positions"):
        mock.json.return_value = [{
            "symbol": "NVDA",
            "qty": "42",
            "avg_entry_price": "845.20",
            "current_price": "847.50",
            "market_value": "35498.40",
            "unrealized_plpc": "0.002",
        }]
    return mock


def test_get_portfolio_returns_cash_and_positions():
    with patch("trade.requests.get", side_effect=_mock_get):
        from trade import get_portfolio
        result = get_portfolio()

    assert result["cash"] == 12450.00
    assert result["total_value"] == 23891.80
    assert len(result["positions"]) == 1
    assert result["positions"][0]["symbol"] == "NVDA"


def test_place_buy_limit_order():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"id": "abc123", "symbol": "NVDA", "qty": "2", "limit_price": "847.50"}

    with patch("trade.requests.post", return_value=mock_response) as mock_post:
        from trade import place_order
        result = place_order("NVDA", 2, "buy", 847.50)

    call_kwargs = mock_post.call_args
    payload = call_kwargs.kwargs["json"]
    assert payload["symbol"] == "NVDA"
    assert payload["side"] == "buy"
    assert payload["type"] == "limit"
    assert result["id"] == "abc123"


def test_place_sell_limit_order():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"id": "def456", "symbol": "NVDA", "qty": "2", "limit_price": "846.00"}

    with patch("trade.requests.post", return_value=mock_response) as mock_post:
        from trade import place_order
        result = place_order("NVDA", 2, "sell", 846.00)

    call_kwargs = mock_post.call_args
    payload = call_kwargs.kwargs["json"]
    assert payload["side"] == "sell"
    assert result["id"] == "def456"
