import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

import json
import pytest
from trade import load_config, validate_order

WATCHLIST = [
    {"symbol": "SPY",  "max_allocation_pct": 15},
    {"symbol": "NVDA", "max_allocation_pct": 8},
]


def test_load_config_returns_all_keys(tmp_path):
    config_data = {
        "stop_loss_pct": 8,
        "limit_order_slippage_pct": 0.2,
        "ma_short_period": 20,
        "ma_long_period": 50,
        "cash_reserve_pct": 20,
        "max_default_allocation_pct": 5,
    }
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps(config_data))
    result = load_config(str(config_file))
    assert result == config_data


def test_load_config_reads_default_path():
    # config.json must exist at trading-agent/config.json
    result = load_config()
    assert "stop_loss_pct" in result
    assert "cash_reserve_pct" in result


def test_validate_order_uses_config_max_default_allocation():
    # With max_default_allocation_pct=3, 5*200=1000=10% of 10000 should fail
    valid, msg = validate_order(
        "TSLA", 5, "buy", 200.0, 10000.0, [], WATCHLIST,
        max_default_allocation_pct=3
    )
    assert not valid
    assert "3%" in msg


def test_validate_order_max_default_allocation_boundary():
    # 5*100=500=5% of 10000 — exactly at the 5% default cap, should pass
    valid, _ = validate_order("TSLA", 5, "buy", 100.0, 10000.0, [], WATCHLIST)
    assert valid
    # 6*100=600=6% of 10000 — just over 5% default cap, should fail
    valid, msg = validate_order("TSLA", 6, "buy", 100.0, 10000.0, [], WATCHLIST)
    assert not valid
    assert "5%" in msg
