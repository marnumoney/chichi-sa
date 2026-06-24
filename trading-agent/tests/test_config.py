import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

import json
import pytest
from trade import load_config, validate_order
from research import load_config as research_load_config, calculate_ma

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


def test_research_load_config_returns_ma_periods(tmp_path):
    config_data = {
        "stop_loss_pct": 8,
        "limit_order_slippage_pct": 0.2,
        "ma_short_period": 10,
        "ma_long_period": 30,
        "cash_reserve_pct": 20,
        "max_default_allocation_pct": 5,
    }
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps(config_data))
    result = research_load_config(str(config_file))
    assert result["ma_short_period"] == 10
    assert result["ma_long_period"] == 30


from apply_proposals import parse_proposals, apply_parameter, apply_watchlist


SAMPLE_PROPOSALS = """
# Proposals — Week of 2026-06-27

## Parameters
- [P1] key=stop_loss_pct from=8 to=6
  Proposed: Lower stop-loss from 8% to 6%
  Reasoning: Positions recovered after triggering stop
  Evidence: NVDA 2026-06-25

## Watchlist
- [W1] action=add symbol=MU max_allocation_pct=8 description="Micron — HBM memory play"
  Proposed: Add MU to watchlist
  Reasoning: Post-earnings bullish confirmation
  Evidence: MU 2026-06-25

- [W2] action=remove symbol=MSFT
  Proposed: Remove MSFT — bearish structure persistent
  Reasoning: Below both MAs for 3 weeks
  Evidence: MSFT lessons 2026-06-23 to 2026-06-27

## Hard Rules
No changes proposed.
"""


def test_parse_proposals_finds_all_ids():
    result = parse_proposals(SAMPLE_PROPOSALS)
    assert "P1" in result
    assert "W1" in result
    assert "W2" in result


def test_parse_proposals_parameter_line():
    result = parse_proposals(SAMPLE_PROPOSALS)
    assert "key=stop_loss_pct" in result["P1"]["line"]
    assert "to=6" in result["P1"]["line"]


def test_apply_parameter_writes_config(tmp_path):
    config_data = {"stop_loss_pct": 8, "limit_order_slippage_pct": 0.2,
                   "ma_short_period": 20, "ma_long_period": 50,
                   "cash_reserve_pct": 20, "max_default_allocation_pct": 5}
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps(config_data))

    proposal = {"line": "key=stop_loss_pct from=8 to=6", "raw": ["- [P1] key=stop_loss_pct from=8 to=6", "  Proposed: Lower stop-loss"]}
    apply_parameter(proposal, config_path=str(config_file))

    result = json.loads(config_file.read_text())
    assert result["stop_loss_pct"] == 6


def test_apply_parameter_rejects_out_of_bounds(tmp_path):
    config_data = {"stop_loss_pct": 8, "limit_order_slippage_pct": 0.2,
                   "ma_short_period": 20, "ma_long_period": 50,
                   "cash_reserve_pct": 20, "max_default_allocation_pct": 5}
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps(config_data))

    proposal = {"line": "key=stop_loss_pct from=8 to=99", "raw": []}
    with pytest.raises(SystemExit):
        apply_parameter(proposal, config_path=str(config_file))


def test_apply_watchlist_add(tmp_path):
    wl_data = {"watchlist": [{"symbol": "SPY", "description": "S&P 500", "max_allocation_pct": 15}]}
    wl_file = tmp_path / "watchlist.json"
    wl_file.write_text(json.dumps(wl_data))

    proposal = {
        "line": 'action=add symbol=MU max_allocation_pct=8 description="Micron — HBM"',
        "raw": []
    }
    apply_watchlist(proposal, watchlist_path=str(wl_file))

    result = json.loads(wl_file.read_text())
    symbols = [w["symbol"] for w in result["watchlist"]]
    assert "MU" in symbols
    mu = next(w for w in result["watchlist"] if w["symbol"] == "MU")
    assert mu["max_allocation_pct"] == 8


def test_apply_watchlist_remove(tmp_path):
    wl_data = {"watchlist": [
        {"symbol": "SPY", "description": "S&P 500", "max_allocation_pct": 15},
        {"symbol": "MSFT", "description": "Microsoft", "max_allocation_pct": 8},
    ]}
    wl_file = tmp_path / "watchlist.json"
    wl_file.write_text(json.dumps(wl_data))

    proposal = {"line": "action=remove symbol=MSFT", "raw": []}
    apply_watchlist(proposal, watchlist_path=str(wl_file))

    result = json.loads(wl_file.read_text())
    symbols = [w["symbol"] for w in result["watchlist"]]
    assert "MSFT" not in symbols


def test_apply_watchlist_rejects_exceeding_80_pct(tmp_path):
    wl_data = {"watchlist": [{"symbol": "SPY", "description": "S&P 500", "max_allocation_pct": 75}]}
    wl_file = tmp_path / "watchlist.json"
    wl_file.write_text(json.dumps(wl_data))

    proposal = {
        "line": 'action=add symbol=MU max_allocation_pct=10 description="Micron"',
        "raw": []
    }
    with pytest.raises(SystemExit):
        apply_watchlist(proposal, watchlist_path=str(wl_file))
