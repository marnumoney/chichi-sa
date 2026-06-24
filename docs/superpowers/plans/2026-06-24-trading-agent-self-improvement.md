# Trading Agent Self-Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-improvement loop to the trading agent: daily lessons, weekly proposals, and a human-gated apply script — the agent learns from its own decisions but never self-modifies without approval.

**Architecture:** A `config.json` centralises all numeric parameters (loaded by `trade.py` and `research.py`). After each EOD journal, a daily reflection Claude session evaluates decision quality and appends structured entries to `journal/lessons.md`. Every Friday, a weekly review Claude session reads the full lessons history and writes machine-parseable proposals to `journal/proposals.md`. `scripts/apply_proposals.py` mechanically applies approved proposals and commits.

**Tech Stack:** Python 3.12, bash, PM2 cron, Claude CLI (`--dangerously-skip-permissions --print`), Alpaca paper API, pytest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `config.json` | CREATE | Single source for all numeric trading parameters |
| `scripts/trade.py` | MODIFY | Add `load_config(path=None)`, use config for `cash_reserve_pct` + `max_default_allocation_pct` |
| `scripts/research.py` | MODIFY | Add `load_config(path=None)`, use config MA periods in `__main__` |
| `watchlist.json` | MODIFY | Remove `cash_reserve_pct` (moved to `config.json`) |
| `CLAUDE.md` | MODIFY | Add `lessons.md` reading step; reference `config.json` for numeric params |
| `journal/lessons.md` | CREATE | Structured living strategic memory — appended daily |
| `scripts/run-daily-reflection.sh` | CREATE | PM2 cron at 4:30 PM ET — Claude session that appends to lessons.md |
| `scripts/run-weekly-review.sh` | CREATE | PM2 cron at 4:45 PM ET Fridays — Claude session that writes proposals.md |
| `scripts/apply_proposals.py` | CREATE | Parses proposals.md, validates, applies to config/watchlist/CLAUDE.md, commits |
| `scripts/apply-proposals.sh` | CREATE | Thin shell wrapper: `cd $AGENT_DIR && python scripts/apply_proposals.py "$@"` |
| `ecosystem.config.js` | MODIFY | Add two new PM2 cron entries |
| `tests/test_config.py` | CREATE | Tests for `load_config`, config-driven `validate_order`, `apply_proposals.py` |

---

## Task 1: Create `config.json`

**Files:**
- Create: `trading-agent/config.json`

- [ ] **Step 1: Create config.json**

```json
{
  "stop_loss_pct": 8,
  "limit_order_slippage_pct": 0.2,
  "ma_short_period": 20,
  "ma_long_period": 50,
  "cash_reserve_pct": 20,
  "max_default_allocation_pct": 5
}
```

Save to `/home/marnu/trading-agent/config.json`.

- [ ] **Step 2: Commit**

```bash
cd /home/marnu/trading-agent
git add config.json
git commit -m "feat: add config.json for numeric trading parameters"
```

---

## Task 2: Add `load_config()` to `trade.py` and wire parameters

**Files:**
- Modify: `trading-agent/scripts/trade.py`
- Create: `trading-agent/tests/test_config.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_config.py`:

```python
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
    assert result["stop_loss_pct"] == 8
    assert result["ma_short_period"] == 20
    assert result["cash_reserve_pct"] == 20
    assert result["max_default_allocation_pct"] == 5


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


def test_validate_order_default_max_allocation_is_5():
    # Default max_default_allocation_pct=5; 3*200=600=6% > 5% — should fail
    valid, msg = validate_order(
        "TSLA", 3, "buy", 200.0, 10000.0, [], WATCHLIST
    )
    assert not valid
    assert "5%" in msg
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/marnu/trading-agent
python3 -m pytest tests/test_config.py -v
```

Expected: `test_load_config_returns_all_keys` FAIL (`load_config` not defined), others FAIL similarly.

- [ ] **Step 3: Add `load_config()` to `trade.py` and update `validate_order` signature**

In `scripts/trade.py`, add after the `load_dotenv(...)` line:

```python
def load_config(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    with open(path) as f:
        return json.load(f)
```

Change the `validate_order` signature from:

```python
def validate_order(symbol, qty, side, current_price, account_value, current_positions, watchlist, cash_reserve_pct=0.80):
```

to:

```python
def validate_order(symbol, qty, side, current_price, account_value, current_positions, watchlist, cash_reserve_pct=0.80, max_default_allocation_pct=5):
```

Change the hardcoded `5` inside `validate_order`:

```python
    symbol_max = next(
        (w["max_allocation_pct"] for w in watchlist if w["symbol"] == symbol), max_default_allocation_pct
    )
```

In `__main__`, replace the block that reads `cash_reserve_pct` from watchlist:

```python
        elif action == "order":
            symbol = sys.argv[2]
            qty = int(sys.argv[3])
            side = sys.argv[4]
            limit_price = float(sys.argv[5])

            wl_path = os.path.join(os.path.dirname(__file__), '..', 'watchlist.json')
            with open(wl_path) as f:
                wl = json.load(f)

            config = load_config()
            portfolio = get_portfolio()
            cash_reserve_pct = config["cash_reserve_pct"] / 100
            max_default_allocation_pct = config["max_default_allocation_pct"]
            valid, msg = validate_order(
                symbol, qty, side, limit_price,
                portfolio["total_value"],
                portfolio["positions"],
                wl["watchlist"],
                cash_reserve_pct=cash_reserve_pct,
                max_default_allocation_pct=max_default_allocation_pct,
            )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/marnu/trading-agent
python3 -m pytest tests/test_config.py tests/test_trade.py -v
```

Expected: all 4 new tests PASS, all 10 existing `test_trade.py` tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/trade.py tests/test_config.py
git commit -m "feat: load_config() in trade.py — cash_reserve and max_allocation from config.json"
```

---

## Task 3: Update `research.py` to use config MA periods

**Files:**
- Modify: `trading-agent/scripts/research.py`
- Modify: `trading-agent/tests/test_config.py`

- [ ] **Step 1: Write failing tests — append to `tests/test_config.py`**

```python
from research import load_config as research_load_config, calculate_ma


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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/marnu/trading-agent
python3 -m pytest tests/test_config.py::test_research_load_config_returns_ma_periods -v
```

Expected: FAIL — `load_config` not importable from `research`.

- [ ] **Step 3: Add `load_config()` to `research.py` and use it in `__main__`**

In `scripts/research.py`, add after the `load_dotenv(...)` line:

```python
def load_config(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    with open(path) as f:
        return json.load(f)
```

In `__main__`, replace the bars block:

```python
        if action == "bars":
            config = load_config()
            ma_short = config["ma_short_period"]
            ma_long = config["ma_long_period"]
            bars = get_bars(symbol)
            print(json.dumps({
                "symbol": symbol,
                "bars": bars,
                f"ma{ma_short}": calculate_ma(bars, ma_short),
                f"ma{ma_long}": calculate_ma(bars, ma_long),
            }))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/marnu/trading-agent
python3 -m pytest tests/test_config.py tests/test_research.py -v
```

Expected: all tests PASS. Note: `test_get_bars_returns_data` checks `params["limit"] == 60` — this is unaffected.

- [ ] **Step 5: Commit**

```bash
git add scripts/research.py tests/test_config.py
git commit -m "feat: load_config() in research.py — MA periods from config.json"
```

---

## Task 4: Remove `cash_reserve_pct` from `watchlist.json`

**Files:**
- Modify: `trading-agent/watchlist.json`

- [ ] **Step 1: Remove `cash_reserve_pct` from `watchlist.json`**

Update `watchlist.json` to:

```json
{
  "watchlist": [
    {
      "symbol": "SPY",
      "description": "S&P 500 ETF — baseline market exposure",
      "max_allocation_pct": 15
    },
    {
      "symbol": "QQQ",
      "description": "Nasdaq ETF — tech sector exposure",
      "max_allocation_pct": 10
    },
    {
      "symbol": "NVDA",
      "description": "GPU/AI infrastructure — high conviction holding",
      "max_allocation_pct": 8
    },
    {
      "symbol": "AAPL",
      "description": "Large cap tech — stability anchor",
      "max_allocation_pct": 8
    },
    {
      "symbol": "MSFT",
      "description": "Cloud/enterprise — AI infrastructure play",
      "max_allocation_pct": 8
    }
  ]
}
```

- [ ] **Step 2: Verify full test suite still passes**

```bash
cd /home/marnu/trading-agent
python3 -m pytest tests/ -v
```

Expected: all 25 tests PASS. (The trade.py `__main__` no longer reads `cash_reserve_pct` from watchlist.json, so no test breaks.)

- [ ] **Step 3: Commit**

```bash
git add watchlist.json
git commit -m "refactor: move cash_reserve_pct from watchlist.json to config.json"
```

---

## Task 5: Update `CLAUDE.md` and create `journal/lessons.md`

**Files:**
- Modify: `trading-agent/CLAUDE.md`
- Create: `trading-agent/journal/lessons.md`

- [ ] **Step 1: Update `CLAUDE.md`**

Add a new section after `## Core Responsibilities`:

```markdown
## Session Startup (Every Session)
Before doing anything else:
1. Read `journal/summary.md` for rolling 7-day context.
2. Read `journal/lessons.md` for accumulated strategic lessons — patterns and decisions validated over time.
3. Read `config.json` for current numeric parameters — these override any values mentioned in prose below.
```

Replace every hardcoded numeric reference in `CLAUDE.md` with config references:

- `"Never invest more than 5% of total portfolio value"` → `"Never invest more than the value of config.json → max_default_allocation_pct in a single position."`
- `"within 0.2% of ask price"` → `"within config.json → limit_order_slippage_pct% of ask price"`
- `"a position drops 8% from your average entry price"` → `"a position drops config.json → stop_loss_pct% from your average entry price"`

Full updated Hard Rules section:

```markdown
## Hard Rules (Never Break These)
- Never invest more than `config.json → max_default_allocation_pct`% of total portfolio value in a single position. Exception: watchlist symbols use their `max_allocation_pct` from watchlist.json instead.
- Never place a market order — always use limit orders within `config.json → limit_order_slippage_pct`% of ask price.
- If a position drops `config.json → stop_loss_pct`% from your average entry price, close it immediately with a sell limit order. Do not wait.
- Always write a journal entry, even on days with no trades.
- Never place trades when market status is "closed". Check first with `python scripts/trade.py status`.
- Before any trade, explicitly answer all 5 decision questions below in the journal.
```

- [ ] **Step 2: Create `journal/lessons.md`**

```markdown
# Trading Agent — Strategic Lessons

*Maintained by the daily reflection agent. Appended after each EOD journal. Never manually edited.*
*Format: DECISION / OUTCOME / QUALITY per trading decision.*
*QUALITY values: Good | Poor | Pending | Resolved | Stale*

---
```

Save to `/home/marnu/trading-agent/journal/lessons.md`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md journal/lessons.md
git commit -m "feat: CLAUDE.md reads lessons.md and config.json; create lessons.md"
```

---

## Task 6: Create `scripts/run-daily-reflection.sh`

**Files:**
- Create: `trading-agent/scripts/run-daily-reflection.sh`

- [ ] **Step 1: Create the script**

```bash
#!/bin/bash
# Daily Reflection — runs at 4:30 PM ET (20:30 UTC) on weekdays
# Evaluates today's decisions by reasoning quality and appends to lessons.md
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_BIN="/home/marnu/.local/bin/claude"
LOG_DIR="$AGENT_DIR/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOGFILE="$LOG_DIR/daily-reflection-$DATE.log"

cd "$AGENT_DIR"
source "$AGENT_DIR/.env" 2>/dev/null || true

exec "$CLAUDE_BIN" --dangerously-skip-permissions --print "Run the daily reflection routine.

Date: $DATE

Steps:
1. Read journal/$DATE.md — today's full journal entry.
2. Read journal/lessons.md — existing lessons, paying attention to any entries marked QUALITY: Pending.
3. For each QUALITY: Pending entry in lessons.md from prior days: run \`python scripts/research.py bars SYMBOL\` to get today's closing price and resolve the entry. Update from 'Pending' to 'Resolved' (if outcome validates the reasoning) or 'Poor' (if it contradicts it), adding a one-line note with the actual price.
4. For each decision made today (trade placed, trade skipped, stop-loss triggered, no-trade day): evaluate reasoning quality — was the logic internally consistent? Did the stated rationale hold up?
5. Append new structured entries to journal/lessons.md following this EXACT format:

## $DATE

- DECISION: [what was decided — e.g. 'No entry on MU before earnings']
  OUTCOME: [what actually happened or 'Pending — check YYYY-MM-DD']
  QUALITY: [Good | Poor | Pending]
  NOTE: [one sentence explaining why the quality rating was assigned]

Rules:
- Append only — never rewrite existing entries.
- Every decision from today's journal gets an entry (including no-trade decisions).
- If outcome is not yet known (open position, or price move not yet visible), set QUALITY: Pending and OUTCOME: Pending — check YYYY-MM-DD (tomorrow's date).
- Be specific: name the symbol, the price level, and the reasoning that was used." \
  2>&1 | tee "$LOGFILE"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /home/marnu/trading-agent/scripts/run-daily-reflection.sh
```

- [ ] **Step 3: Verify syntax**

```bash
bash -n /home/marnu/trading-agent/scripts/run-daily-reflection.sh && echo "Syntax OK"
```

Expected: `Syntax OK`

- [ ] **Step 4: Commit**

```bash
git add scripts/run-daily-reflection.sh
git commit -m "feat: run-daily-reflection.sh — daily lessons append at 4:30 PM ET"
```

---

## Task 7: Create `scripts/run-weekly-review.sh`

**Files:**
- Create: `trading-agent/scripts/run-weekly-review.sh`

- [ ] **Step 1: Create the script**

```bash
#!/bin/bash
# Weekly Review — runs at 4:45 PM ET (20:45 UTC) every Friday
# Deep review of the week's decisions; writes machine-parseable proposals.md
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_BIN="/home/marnu/.local/bin/claude"
LOG_DIR="$AGENT_DIR/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOGFILE="$LOG_DIR/weekly-review-$DATE.log"

cd "$AGENT_DIR"
source "$AGENT_DIR/.env" 2>/dev/null || true

exec "$CLAUDE_BIN" --dangerously-skip-permissions --print "Run the weekly self-improvement review.

Week ending: $DATE

Steps:
1. Check if journal/proposals.md already exists with unapplied proposals. If so, note this at the top of the new proposals.md.
2. Read all journal/YYYY-MM-DD.md files from this week (Monday to today).
3. Read the full journal/lessons.md.
4. Read the current CLAUDE.md (to know what rules exist before proposing changes).
5. Read the current config.json (to know current parameter values).
6. Read the current watchlist.json (to know current symbols and allocation caps).
7. Stale resolution: for any QUALITY: Pending entry in lessons.md older than 5 trading days, run `python scripts/research.py bars SYMBOL` to get the latest price, mark the entry QUALITY: Stale, and add a one-line note with what the price actually did.
8. Analyse: what patterns emerged this week? Which decision rules helped? Which hurt? Which parameters appear miscalibrated? Which symbols no longer belong on the watchlist? Are any new symbols consistently appearing in research with strong setups?
8. Write journal/proposals.md with this EXACT structure (include all three sections even if empty):

---
# Proposals — Week of $DATE
[If prior proposals.md existed: > Note: Prior proposals from YYYY-MM-DD were not applied before this review.]

## Parameters
[For each parameter proposal, use this machine-parseable format:]
- [P1] key=PARAM_NAME from=OLD_VALUE to=NEW_VALUE
  Proposed: [human description]
  Reasoning: [pattern observed]
  Evidence: [specific dates/symbols]

[Valid PARAM_NAME values: stop_loss_pct, limit_order_slippage_pct, ma_short_period, ma_long_period, cash_reserve_pct, max_default_allocation_pct]
[If no changes: write 'No changes proposed.']

## Watchlist
[For each watchlist proposal, use this machine-parseable format:]
- [W1] action=add symbol=SYMBOL max_allocation_pct=N description=\"DESCRIPTION\"
- [W2] action=remove symbol=SYMBOL
- [W3] action=update symbol=SYMBOL max_allocation_pct=N

  Proposed: [human description]
  Reasoning: [pattern observed]
  Evidence: [specific dates/symbols]

[If no changes: write 'No changes proposed.']

## Hard Rules
[For hard rule changes that require manual CLAUDE.md editing:]
- [H1] action=manual
  Proposed: [exact proposed change in plain English]
  Reasoning: [why this rule change is warranted]
  Evidence: [specific decisions that support this]
  Instructions: [which section/line of CLAUDE.md to edit and how]

[If no changes: write 'No changes proposed.']
---

Rules for proposal writing:
- Only propose changes with clear evidence from this week's data.
- Parameter proposals must use the exact key names from config.json.
- Do not propose more than 3 total proposals in the first 4 weeks — the portfolio is new and patterns need time to emerge.
- Proposals should be specific and actionable, not vague." \
  2>&1 | tee "$LOGFILE"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /home/marnu/trading-agent/scripts/run-weekly-review.sh
```

- [ ] **Step 3: Verify syntax**

```bash
bash -n /home/marnu/trading-agent/scripts/run-weekly-review.sh && echo "Syntax OK"
```

Expected: `Syntax OK`

- [ ] **Step 4: Commit**

```bash
git add scripts/run-weekly-review.sh
git commit -m "feat: run-weekly-review.sh — weekly proposals at 4:45 PM ET Fridays"
```

---

## Task 8: Create `apply_proposals.py` and `apply-proposals.sh`

**Files:**
- Create: `trading-agent/scripts/apply_proposals.py`
- Create: `trading-agent/scripts/apply-proposals.sh`
- Modify: `trading-agent/tests/test_config.py`

- [ ] **Step 1: Write failing tests — append to `tests/test_config.py`**

```python
import subprocess
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/marnu/trading-agent
python3 -m pytest tests/test_config.py -v -k "apply or parse"
```

Expected: FAIL — `apply_proposals` module not found.

- [ ] **Step 3: Create `scripts/apply_proposals.py`**

```python
#!/usr/bin/env python3
"""
Apply approved proposals from journal/proposals.md.
Usage: python scripts/apply_proposals.py P1 [W1] [H1] ...
"""
import sys
import os
import json
import re
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
PROPOSALS_PATH = BASE_DIR / "journal" / "proposals.md"
CONFIG_PATH = BASE_DIR / "config.json"
WATCHLIST_PATH = BASE_DIR / "watchlist.json"

CONFIG_BOUNDS = {
    "stop_loss_pct":             (1,    20),
    "limit_order_slippage_pct":  (0.05, 2.0),
    "ma_short_period":           (5,    50),
    "ma_long_period":            (20,   200),
    "cash_reserve_pct":          (5,    50),
    "max_default_allocation_pct":(1,    20),
}


def parse_proposals(text):
    """Return dict of {proposal_id: {line, raw, section}}."""
    proposals = {}
    current_section = None
    last_pid = None

    for line in text.split('\n'):
        if line.startswith('## Parameters'):
            current_section = 'P'
        elif line.startswith('## Watchlist'):
            current_section = 'W'
        elif line.startswith('## Hard Rules'):
            current_section = 'H'

        m = re.match(r'\s*-\s*\[([PWH]\d+)\]\s*(.*)', line)
        if m:
            pid = m.group(1)
            last_pid = pid
            proposals[pid] = {
                'section': current_section,
                'line': m.group(2).strip(),
                'raw': [line],
            }
        elif last_pid and line.startswith('  '):
            proposals[last_pid]['raw'].append(line)

    return proposals


def apply_parameter(proposal, config_path=None):
    """Apply a P-type proposal: update config.json."""
    path = Path(config_path) if config_path else CONFIG_PATH
    line = proposal['line']

    key_m = re.search(r'key=(\w+)', line)
    to_m  = re.search(r'to=([\d.]+)', line)

    if not key_m or not to_m:
        print(f"ERROR: Cannot parse parameter proposal line: {line}")
        print("Expected format: key=PARAM_NAME from=OLD to=NEW")
        sys.exit(1)

    key   = key_m.group(1)
    value = float(to_m.group(1))

    if key not in CONFIG_BOUNDS:
        print(f"ERROR: Unknown config key '{key}'. Valid: {list(CONFIG_BOUNDS)}")
        sys.exit(1)

    lo, hi = CONFIG_BOUNDS[key]
    if not (lo <= value <= hi):
        print(f"ERROR: {key}={value} out of bounds [{lo}, {hi}]")
        sys.exit(1)

    config = json.loads(path.read_text())
    old    = config.get(key)
    config[key] = int(value) if value == int(value) else value
    path.write_text(json.dumps(config, indent=2) + '\n')
    print(f"  config.json: {key} {old} -> {config[key]}")
    return path


def apply_watchlist(proposal, watchlist_path=None):
    """Apply a W-type proposal: update watchlist.json."""
    path = Path(watchlist_path) if watchlist_path else WATCHLIST_PATH
    line = proposal['line']

    action_m = re.search(r'action=(\w+)', line)
    symbol_m = re.search(r'symbol=(\w+)', line)

    if not action_m or not symbol_m:
        print(f"ERROR: Cannot parse watchlist proposal line: {line}")
        print("Expected: action=add|remove|update symbol=SYM [max_allocation_pct=N] [description=\"...\"]")
        sys.exit(1)

    action = action_m.group(1)
    symbol = symbol_m.group(1).upper()
    wl     = json.loads(path.read_text())
    items  = wl.get("watchlist", [])

    if action == "remove":
        before = len(items)
        items  = [w for w in items if w["symbol"] != symbol]
        if len(items) == before:
            print(f"  WARNING: {symbol} not found in watchlist — nothing removed")
        else:
            print(f"  watchlist.json: removed {symbol}")

    elif action in ("add", "update"):
        alloc_m = re.search(r'max_allocation_pct=([\d.]+)', line)
        desc_m  = re.search(r'description="([^"]+)"', line)

        if not alloc_m:
            print(f"ERROR: max_allocation_pct required for action={action}")
            sys.exit(1)

        max_alloc   = float(alloc_m.group(1))
        description = desc_m.group(1) if desc_m else f"{symbol} — added by self-improvement"
        existing    = [w for w in items if w["symbol"] != symbol]
        total       = sum(w["max_allocation_pct"] for w in existing) + max_alloc

        if total > 80:
            print(f"ERROR: Total allocation {total:.1f}% would exceed 80% limit")
            sys.exit(1)

        entry = {"symbol": symbol, "description": description, "max_allocation_pct": max_alloc}

        if action == "add":
            items.append(entry)
            print(f"  watchlist.json: added {symbol} ({max_alloc}%)")
        else:
            for i, w in enumerate(items):
                if w["symbol"] == symbol:
                    items[i] = {**w, **entry}
            print(f"  watchlist.json: updated {symbol} ({max_alloc}%)")

    else:
        print(f"ERROR: Unknown action '{action}'. Use: add, remove, update")
        sys.exit(1)

    wl["watchlist"] = items
    path.write_text(json.dumps(wl, indent=2) + '\n')
    return path


def apply_hard_rule(proposal, pid):
    """Hard rule proposals require manual CLAUDE.md editing."""
    print(f"\n  [Manual edit required for {pid}]")
    for raw_line in proposal['raw']:
        print(f"    {raw_line}")
    print(f"\n  After editing CLAUDE.md, commit with:")
    print(f"  git add CLAUDE.md && git commit -m 'self-improvement: apply {pid}'")
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/apply_proposals.py P1 [W1] [H1] ...")
        sys.exit(1)

    proposal_ids = [p.upper() for p in sys.argv[1:]]

    if not PROPOSALS_PATH.exists():
        print(f"ERROR: {PROPOSALS_PATH} not found. Run the weekly review first.")
        sys.exit(1)

    proposals = parse_proposals(PROPOSALS_PATH.read_text())

    for pid in proposal_ids:
        if pid not in proposals:
            print(f"ERROR: '{pid}' not found in proposals.md")
            print(f"Available: {sorted(proposals.keys())}")
            sys.exit(1)

    modified = []
    applied  = []

    for pid in proposal_ids:
        proposal = proposals[pid]
        print(f"\nApplying {pid}...")

        if pid.startswith('P'):
            f = apply_parameter(proposal)
            modified.append(str(f))
            applied.append(pid)
        elif pid.startswith('W'):
            f = apply_watchlist(proposal)
            modified.append(str(f))
            applied.append(pid)
        elif pid.startswith('H'):
            apply_hard_rule(proposal, pid)
            # Hard rules: user edits and commits manually

    if not applied:
        print("\nNo auto-apply proposals — see manual instructions above.")
        sys.exit(0)

    # Collect summary lines for commit message
    summaries = []
    for pid in applied:
        for raw_line in proposals[pid]['raw']:
            if 'Proposed:' in raw_line:
                summaries.append(raw_line.strip().replace('Proposed: ', ''))
                break

    ids_str = ' '.join(applied)
    summary = '; '.join(summaries[:2])
    msg     = f"self-improvement: apply {ids_str} — {summary}"

    subprocess.run(['git', 'add'] + list(dict.fromkeys(modified)), check=True, cwd=BASE_DIR)
    subprocess.run(['git', 'commit', '-m', msg], check=True, cwd=BASE_DIR)
    print(f"\nCommitted: {msg}")


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Create `scripts/apply-proposals.sh`**

```bash
#!/bin/bash
# Thin wrapper — applies approved proposals from journal/proposals.md
# Usage: ./scripts/apply-proposals.sh P1 [W1] [H1] ...
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/apply_proposals.py "$@"
```

- [ ] **Step 5: Make both executable**

```bash
chmod +x /home/marnu/trading-agent/scripts/apply_proposals.py
chmod +x /home/marnu/trading-agent/scripts/apply-proposals.sh
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /home/marnu/trading-agent
python3 -m pytest tests/test_config.py -v
```

Expected: all tests PASS including all new apply_proposals tests.

- [ ] **Step 7: Run full test suite**

```bash
python3 -m pytest tests/ -v
```

Expected: all 33 tests PASS (21 existing + 12 new).

- [ ] **Step 8: Commit**

```bash
git add scripts/apply_proposals.py scripts/apply-proposals.sh tests/test_config.py
git commit -m "feat: apply_proposals.py — parse and apply weekly proposals with validation"
```

---

## Task 9: Update `ecosystem.config.js` and restart PM2

**Files:**
- Modify: `trading-agent/ecosystem.config.js`

- [ ] **Step 1: Add two new PM2 entries to `ecosystem.config.js`**

Append after the existing `trading-dashboard-api` app entry (before the closing `]`):

```javascript
    {
      name: "trading-daily-reflection",
      script: "/home/marnu/trading-agent/scripts/run-daily-reflection.sh",
      cron_restart: "30 20 * * 1-5",
      autorestart: false,
      watch: false,
      env: {
        PATH: "/home/marnu/.local/bin:/usr/local/bin:/usr/bin:/bin",
      },
    },
    {
      name: "trading-weekly-review",
      script: "/home/marnu/trading-agent/scripts/run-weekly-review.sh",
      cron_restart: "45 20 * * 5",
      autorestart: false,
      watch: false,
      env: {
        PATH: "/home/marnu/.local/bin:/usr/local/bin:/usr/bin:/bin",
      },
    },
```

The full apps array now has 6 entries: morning-research, trading-session, eod-journal, dashboard-api, daily-reflection, weekly-review.

- [ ] **Step 2: Reload PM2 with updated config**

```bash
cd /home/marnu/trading-agent
/home/marnu/.npm-global/bin/pm2 delete trading-daily-reflection trading-weekly-review 2>/dev/null || true
/home/marnu/.npm-global/bin/pm2 start ecosystem.config.js
/home/marnu/.npm-global/bin/pm2 save
```

- [ ] **Step 3: Verify all 6 processes are registered**

```bash
/home/marnu/.npm-global/bin/pm2 list
```

Expected: 6 entries — `trading-morning-research`, `trading-session`, `trading-eod-journal`, `trading-dashboard-api`, `trading-daily-reflection`, `trading-weekly-review`. The cron-driven ones may show `stopped` — that is correct; they only run on schedule.

- [ ] **Step 4: Run full test suite one final time**

```bash
cd /home/marnu/trading-agent
python3 -m pytest tests/ -v
```

Expected: all 33 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ecosystem.config.js
git commit -m "feat: PM2 cron entries for daily-reflection (4:30 PM ET) and weekly-review (4:45 PM ET Fridays)"
```

---

## Cron Schedule Summary (EDT, UTC-4)

| Process | Cron (UTC) | Fires |
|---------|------------|-------|
| `trading-morning-research` | `45 13 * * 1-5` | 9:45 AM ET weekdays |
| `trading-session` | `0 14 * * 1-5` | 10:00 AM ET weekdays |
| `trading-eod-journal` | `15 20 * * 1-5` | 4:15 PM ET weekdays |
| `trading-daily-reflection` | `30 20 * * 1-5` | 4:30 PM ET weekdays |
| `trading-weekly-review` | `45 20 * * 5` | 4:45 PM ET Fridays |
| `trading-dashboard-api` | always-on | — |

## How to Apply Proposals (Human Workflow)

1. Every Friday after 4:45 PM ET, review `journal/proposals.md`
2. For proposals you approve: `./scripts/apply-proposals.sh P1 W2` (list approved IDs)
3. For H-type (hard rule) proposals: edit `CLAUDE.md` manually as instructed, then `git add CLAUDE.md && git commit -m "self-improvement: apply H1"`
4. Unapplied proposals are noted at the top of next Friday's file
