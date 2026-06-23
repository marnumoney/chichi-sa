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
    # 7500 already invested + 1000 new = 8500/10000 = 85% > 80%
    valid, msg = validate_order("AAPL", 5, "buy", 200.0, 10000.0, positions, WATCHLIST)
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
    # Sells reduce exposure — skip allocation check
    positions = [{"market_value": "7500.0"}]
    valid, msg = validate_order("NVDA", 5, "sell", 900.0, 10000.0, positions, WATCHLIST)
    assert valid


def test_get_portfolio_returns_cash_and_positions():
    mock_profile = {"withdrawable_amount": "12450.00", "equity": "23891.80"}
    mock_positions = [{"symbol": "NVDA", "quantity": "42", "average_buy_price": "845.20", "market_value": "35498.40"}]

    with patch("robin_stocks.robinhood.login"), \
         patch("robin_stocks.robinhood.profiles.load_portfolio_profile", return_value=mock_profile), \
         patch("robin_stocks.robinhood.account.get_open_stock_positions", return_value=mock_positions):
        from trade import get_portfolio
        result = get_portfolio()

    assert result["cash"] == 12450.00
    assert result["total_value"] == 23891.80
    assert len(result["positions"]) == 1


def test_place_buy_limit_order():
    mock_order = {"id": "abc123", "symbol": "NVDA", "qty": "2", "limit_price": "847.50"}

    with patch("robin_stocks.robinhood.login"), \
         patch("robin_stocks.robinhood.orders.order_buy_limit", return_value=mock_order) as mock_buy:
        from trade import place_order
        result = place_order("NVDA", 2, "buy", 847.50)

    mock_buy.assert_called_once_with("NVDA", 2, 847.50, timeInForce="gfd")
    assert result["id"] == "abc123"


def test_place_sell_limit_order():
    mock_order = {"id": "def456", "symbol": "NVDA", "qty": "2", "limit_price": "846.00"}

    with patch("robin_stocks.robinhood.login"), \
         patch("robin_stocks.robinhood.orders.order_sell_limit", return_value=mock_order) as mock_sell:
        from trade import place_order
        result = place_order("NVDA", 2, "sell", 846.00)

    mock_sell.assert_called_once_with("NVDA", 2, 846.00, timeInForce="gfd")
    assert result["id"] == "def456"
