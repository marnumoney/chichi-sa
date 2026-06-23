# Trading Agent Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core trading agent — Alpaca data scripts, Robinhood execution, risk validation, journal writing, and three Claude Code scheduled routines.

**Architecture:** Three Python scripts (research.py, trade.py, notify.py) act as the agent's tools, called via bash. CLAUDE.md defines hard trading rules the agent reads at session start. Three Claude Code routines (9:45 AM, 10:00 AM, 4:15 PM ET) orchestrate the daily cycle. All state is persisted as markdown files in journal/.

**Tech Stack:** Python 3.11+, robin-stocks (Robinhood), requests (Alpaca API), sendgrid (email digest), python-dotenv, pytest

---

## File Map

| File | Purpose |
|------|---------|
| `trading-agent/CLAUDE.md` | Hard trading rules — agent reads at every session start |
| `trading-agent/watchlist.json` | Fixed symbols + per-symbol allocation caps |
| `trading-agent/scripts/research.py` | Alpaca: 60-day bars, news, 20/50-day MA |
| `trading-agent/scripts/trade.py` | Robinhood: portfolio state, validate_order, order execution |
| `trading-agent/scripts/notify.py` | SendGrid: email today's journal as digest |
| `trading-agent/journal/summary.md` | Rolling 7-day context (agent rewrites daily) |
| `trading-agent/journal/YYYY-MM-DD.md` | Daily trade journals (agent writes) |
| `trading-agent/tests/test_research.py` | Tests for calculate_ma and data fetching |
| `trading-agent/tests/test_trade.py` | Tests for validate_order and Robinhood calls |
| `trading-agent/tests/test_notify.py` | Tests for email digest sending |
| `trading-agent/requirements.txt` | Python dependencies |
| `trading-agent/.env` | API credentials (never committed) |

---

### Task 1: Scaffold the project

**Files:**
- Create: `trading-agent/` (directory tree)
- Create: `trading-agent/requirements.txt`
- Create: `trading-agent/.env.example`
- Create: `trading-agent/.gitignore`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p trading-agent/scripts trading-agent/journal trading-agent/tests
touch trading-agent/tests/__init__.py trading-agent/journal/.gitkeep
```

- [ ] **Step 2: Create requirements.txt**

Create `trading-agent/requirements.txt`:
```
requests==2.31.0
robin-stocks==3.0.4
sendgrid==6.11.0
python-dotenv==1.0.0
pytest==7.4.0
pytest-mock==3.12.0
```

- [ ] **Step 3: Create .env.example**

Create `trading-agent/.env.example`:
```
# Alpaca (data only)
APCA_API_KEY_ID=
APCA_API_SECRET_KEY=
APCA_BASE_URL=https://api.alpaca.markets

# Robinhood (execution)
ROBINHOOD_USERNAME=
ROBINHOOD_PASSWORD=

# SendGrid (email digest)
SENDGRID_API_KEY=
NOTIFY_EMAIL=
```

- [ ] **Step 4: Create .gitignore**

Create `trading-agent/.gitignore`:
```
.env
__pycache__/
*.pyc
*.pickle
.pytest_cache/
```

Note: `*.pickle` excludes the credential cache file that `robin_stocks` creates automatically after first login. Never commit this file.

- [ ] **Step 5: Install dependencies**

```bash
cd trading-agent && pip install -r requirements.txt
```

Expected: All packages install without errors.

- [ ] **Step 6: Copy .env and fill in credentials**

```bash
cp trading-agent/.env.example trading-agent/.env
```

Open `trading-agent/.env` and fill in your Alpaca keys, Robinhood username/password, SendGrid key, and notification email.

- [ ] **Step 7: Commit**

```bash
cd trading-agent
git add requirements.txt .env.example .gitignore tests/__init__.py journal/.gitkeep
git commit -m "feat: scaffold trading-agent project structure"
```

---

### Task 2: CLAUDE.md — agent trading rules

**Files:**
- Create: `trading-agent/CLAUDE.md`

- [ ] **Step 1: Create CLAUDE.md**

Create `trading-agent/CLAUDE.md`:

```markdown
# Trading Agent Instructions

You are an autonomous trading agent managing a paper portfolio.

## Core Responsibilities
- Every market day at 9:45 AM ET: Run the morning research routine
- Every market day at 10:00 AM ET: Run the trading session
- Every market day at 4:15 PM ET: Write the end-of-day journal entry

## Hard Rules (Never Break These)
- Never invest more than 5% of total portfolio value in a single position. Exception: watchlist symbols use their `max_allocation_pct` from watchlist.json instead.
- Never place a market order — always use limit orders within 0.2% of ask price.
- If a position drops 8% from your average entry price, close it immediately with a sell limit order. Do not wait.
- Always write a journal entry, even on days with no trades.
- Never place trades when market status is "closed". Check first with `python scripts/trade.py status`.
- Before any trade, explicitly answer all 5 decision questions below in the journal.

## Decision Framework
Before placing any trade, write your answers to these questions in the journal:
1. What is the current portfolio cash balance?
2. What positions are already open?
3. What does recent news say about this ticker?
4. What do the 20-day and 50-day moving averages indicate?
5. What is the risk if this trade goes wrong?

## Script Reference

Check market status:
```bash
python scripts/trade.py status
```

Get portfolio (cash + open positions):
```bash
python scripts/trade.py portfolio
```

Get price bars + moving averages for a symbol:
```bash
python scripts/research.py bars SYMBOL
```

Get recent news for a symbol:
```bash
python scripts/research.py news SYMBOL
```

Place a limit order (validate_order runs automatically before execution):
```bash
python scripts/trade.py order SYMBOL QTY buy LIMIT_PRICE
python scripts/trade.py order SYMBOL QTY sell LIMIT_PRICE
```

Send email digest:
```bash
python scripts/notify.py journal/YYYY-MM-DD.md
```

## Journal Format

Write daily journals to: `journal/YYYY-MM-DD.md`
Read prior context from: `journal/summary.md`

Always follow this exact structure:

```
# Trade Journal — YYYY-MM-DD

## Portfolio Status
- Cash: $X,XXX.XX
- Positions: SYMBOL (N shares @ $X.XX), ...
- Total Value: $XX,XXX.XX

## Market Research
### SYMBOL
- 20-day MA: $X.XX | 50-day MA: $X.XX — [bullish/bearish/neutral]
- News: [1-2 sentence summary]
- Decision: [action taken, or "No action — reason"]

## Trades Executed
| Time | Symbol | Action | Qty | Price | Reasoning |
|------|--------|--------|-----|-------|-----------|

## Positions Closed
None today.

## End-of-Day Reflection
[What worked, what didn't, what to watch tomorrow]
```
```

- [ ] **Step 2: Commit**

```bash
cd trading-agent && git add CLAUDE.md && git commit -m "feat: add CLAUDE.md with hard trading rules"
```

---

### Task 3: watchlist.json

**Files:**
- Create: `trading-agent/watchlist.json`

- [ ] **Step 1: Create watchlist.json**

Create `trading-agent/watchlist.json`:

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
  ],
  "cash_reserve_pct": 20
}
```

- [ ] **Step 2: Commit**

```bash
cd trading-agent && git add watchlist.json && git commit -m "feat: add watchlist with 5 symbols and allocation limits"
```

---

### Task 4: research.py — Alpaca data + MA calculation

**Files:**
- Create: `trading-agent/scripts/research.py`
- Create: `trading-agent/tests/test_research.py`

- [ ] **Step 1: Write failing tests**

Create `trading-agent/tests/test_research.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from unittest.mock import patch, MagicMock
import pytest
from research import calculate_ma, get_bars, get_news


def test_calculate_ma_20_day():
    # Last 20 of 60 values (41-60), average = (41+60)/2 = 50.5
    bars = {"bars": [{"c": float(i)} for i in range(1, 61)]}
    assert calculate_ma(bars, 20) == 50.5


def test_calculate_ma_50_day():
    # Last 50 of 60 values (11-60), average = (11+60)/2 = 35.5
    bars = {"bars": [{"c": float(i)} for i in range(1, 61)]}
    assert calculate_ma(bars, 50) == 35.5


def test_calculate_ma_insufficient_data():
    bars = {"bars": [{"c": 100.0} for _ in range(10)]}
    assert calculate_ma(bars, 20) is None


def test_calculate_ma_exact_period():
    bars = {"bars": [{"c": 10.0} for _ in range(20)]}
    assert calculate_ma(bars, 20) == 10.0


def test_get_bars_returns_data():
    mock_response = MagicMock()
    mock_response.json.return_value = {"bars": [{"c": 100.0, "o": 99.0}]}
    with patch("requests.get", return_value=mock_response):
        result = get_bars("AAPL")
    assert "bars" in result


def test_get_news_returns_data():
    mock_response = MagicMock()
    mock_response.json.return_value = {"news": [{"headline": "Test headline"}]}
    with patch("requests.get", return_value=mock_response):
        result = get_news("AAPL")
    assert "news" in result
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd trading-agent && python -m pytest tests/test_research.py -v
```

Expected: `ModuleNotFoundError: No module named 'research'`

- [ ] **Step 3: Write research.py**

Create `trading-agent/scripts/research.py`:

```python
import os
import requests
import json
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

ALPACA_KEY = os.getenv("APCA_API_KEY_ID")
ALPACA_SECRET = os.getenv("APCA_API_SECRET_KEY")
DATA_URL = "https://data.alpaca.markets"


def _headers():
    return {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
    }


def get_bars(symbol, timeframe="1Day", limit=60):
    url = f"{DATA_URL}/v2/stocks/{symbol}/bars"
    params = {"timeframe": timeframe, "limit": limit, "adjustment": "raw"}
    response = requests.get(url, headers=_headers(), params=params)
    return response.json()


def get_news(symbol):
    url = f"{DATA_URL}/v1beta1/news"
    params = {"symbols": symbol, "limit": 5, "sort": "desc"}
    response = requests.get(url, headers=_headers(), params=params)
    return response.json()


def calculate_ma(bars, period):
    closes = [bar["c"] for bar in bars.get("bars", [])]
    if len(closes) < period:
        return None
    return sum(closes[-period:]) / period


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "bars"
    symbol = sys.argv[2] if len(sys.argv) > 2 else "SPY"

    if action == "bars":
        bars = get_bars(symbol)
        print(json.dumps({
            "symbol": symbol,
            "bars": bars,
            "ma20": calculate_ma(bars, 20),
            "ma50": calculate_ma(bars, 50),
        }))
    elif action == "news":
        print(json.dumps(get_news(symbol)))
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd trading-agent && python -m pytest tests/test_research.py -v
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/research.py tests/test_research.py
git commit -m "feat: research.py with Alpaca bars, news, and MA calculation"
```

---

### Task 5: trade.py — validate_order

**Files:**
- Create: `trading-agent/scripts/trade.py`
- Create: `trading-agent/tests/test_trade.py`

- [ ] **Step 1: Write failing tests for validate_order**

Create `trading-agent/tests/test_trade.py`:

```python
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
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd trading-agent && python -m pytest tests/test_trade.py -v
```

Expected: `ModuleNotFoundError: No module named 'trade'`

- [ ] **Step 3: Write trade.py**

Create `trading-agent/scripts/trade.py`:

```python
import os
import json
import sys
import requests
import robin_stocks.robinhood as r
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

ALPACA_KEY = os.getenv("APCA_API_KEY_ID")
ALPACA_SECRET = os.getenv("APCA_API_SECRET_KEY")
ALPACA_BASE_URL = os.getenv("APCA_BASE_URL", "https://api.alpaca.markets")


def _rh_login():
    r.login(os.getenv("ROBINHOOD_USERNAME"), os.getenv("ROBINHOOD_PASSWORD"))


def validate_order(symbol, qty, side, current_price, account_value, current_positions, watchlist):
    if side == "sell":
        return True, "Order validated"

    order_value = qty * current_price
    allocation_pct = (order_value / account_value) * 100

    symbol_max = next(
        (w["max_allocation_pct"] for w in watchlist if w["symbol"] == symbol), 5
    )
    if allocation_pct > symbol_max:
        return False, f"Order exceeds {symbol_max}% allocation limit: {allocation_pct:.1f}%"

    total_invested = sum(float(p.get("market_value", 0)) for p in current_positions)
    if (total_invested + order_value) / account_value > 0.80:
        return False, "Order would violate 20% cash reserve requirement"

    return True, "Order validated"


def get_market_status():
    headers = {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
    }
    response = requests.get(f"{ALPACA_BASE_URL}/v2/clock", headers=headers)
    return response.json()


def get_portfolio():
    _rh_login()
    profile = r.profiles.load_portfolio_profile()
    positions = r.account.get_open_stock_positions()
    return {
        "cash": float(profile["withdrawable_amount"]),
        "positions": positions,
        "total_value": float(profile["equity"]),
    }


def place_order(symbol, qty, side, limit_price):
    _rh_login()
    if side == "buy":
        return r.orders.order_buy_limit(symbol, qty, limit_price, timeInForce="gfd")
    return r.orders.order_sell_limit(symbol, qty, limit_price, timeInForce="gfd")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "status"

    if action == "status":
        print(json.dumps(get_market_status()))

    elif action == "portfolio":
        print(json.dumps(get_portfolio()))

    elif action == "order":
        symbol = sys.argv[2]
        qty = int(sys.argv[3])
        side = sys.argv[4]
        limit_price = float(sys.argv[5])

        wl_path = os.path.join(os.path.dirname(__file__), '..', 'watchlist.json')
        with open(wl_path) as f:
            wl = json.load(f)

        portfolio = get_portfolio()
        valid, msg = validate_order(
            symbol, qty, side, limit_price,
            portfolio["total_value"],
            portfolio["positions"],
            wl["watchlist"],
        )
        if not valid:
            print(json.dumps({"error": msg, "order_placed": False}))
            sys.exit(0)

        result = place_order(symbol, qty, side, limit_price)
        print(json.dumps({**result, "order_placed": True}))
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd trading-agent && python -m pytest tests/test_trade.py -v
```

Expected: All 6 validate_order tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/trade.py tests/test_trade.py
git commit -m "feat: trade.py with validate_order, Robinhood execution, and market status"
```

---

### Task 6: trade.py — Robinhood integration tests

**Files:**
- Modify: `trading-agent/tests/test_trade.py`

- [ ] **Step 1: Append Robinhood integration tests**

Append to the bottom of `trading-agent/tests/test_trade.py`:

```python
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
```

- [ ] **Step 2: Run all trade tests**

```bash
cd trading-agent && python -m pytest tests/test_trade.py -v
```

Expected: All 9 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/test_trade.py
git commit -m "test: add Robinhood portfolio and order execution tests"
```

---

### Task 7: notify.py — SendGrid email digest

**Files:**
- Create: `trading-agent/scripts/notify.py`
- Create: `trading-agent/tests/test_notify.py`

- [ ] **Step 1: Write failing tests**

Create `trading-agent/tests/test_notify.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from unittest.mock import patch, MagicMock
import pytest
from notify import send_digest


def test_send_digest_calls_sendgrid(tmp_path):
    journal = tmp_path / "2026-06-23.md"
    journal.write_text("# Trade Journal — 2026-06-23\nTest content")

    with patch("notify.sendgrid.SendGridAPIClient") as mock_sg_class:
        mock_client = MagicMock()
        mock_sg_class.return_value = mock_client
        send_digest(str(journal))

    mock_client.send.assert_called_once()


def test_send_digest_raises_on_missing_file():
    with pytest.raises(FileNotFoundError):
        send_digest("/nonexistent/path/journal.md")
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd trading-agent && python -m pytest tests/test_notify.py -v
```

Expected: `ModuleNotFoundError: No module named 'notify'`

- [ ] **Step 3: Write notify.py**

Create `trading-agent/scripts/notify.py`:

```python
import os
import sys
import sendgrid
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


def send_digest(journal_path):
    with open(journal_path, 'r') as f:
        content = f.read()

    date_str = os.path.basename(journal_path).replace('.md', '')
    sg = sendgrid.SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
    message = Mail(
        from_email="agent@yourdomain.com",
        to_emails=os.getenv("NOTIFY_EMAIL"),
        subject=f"Trading Agent Report — {date_str}",
        plain_text_content=content,
    )
    sg.send(message)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python notify.py journal/YYYY-MM-DD.md")
        sys.exit(1)
    send_digest(sys.argv[1])
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd trading-agent && python -m pytest tests/test_notify.py -v
```

Expected: Both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/notify.py tests/test_notify.py
git commit -m "feat: notify.py sends daily journal digest via SendGrid"
```

---

### Task 8: journal/summary.md — initial context file

**Files:**
- Create: `trading-agent/journal/summary.md`

- [ ] **Step 1: Create initial summary.md**

Create `trading-agent/journal/summary.md`:

```markdown
# Trading Agent — Weekly Summary

*Maintained by the agent. Rewritten at end of each trading day to reflect the last 7 sessions.*

## Current Week
No entries yet. Agent writes here after the first trading session.

## Positions to Watch
None yet.

## Running Notes
- Agent initialized 2026-06-23
- Paper trading mode via Robinhood
- Watchlist: SPY, QQQ, NVDA, AAPL, MSFT
```

- [ ] **Step 2: Commit**

```bash
cd trading-agent && git add journal/summary.md && git commit -m "feat: initialize journal summary file"
```

---

### Task 9: Robinhood first login (manual, one-time)

`robin_stocks` requires interactive MFA on the first login. After that it caches a device token locally and future logins proceed silently. This must be done once before the routines can run.

- [ ] **Step 1: Run interactive login**

```bash
cd trading-agent && python -c "
import robin_stocks.robinhood as r
import os
from dotenv import load_dotenv
load_dotenv()
r.login(os.getenv('ROBINHOOD_USERNAME'), os.getenv('ROBINHOOD_PASSWORD'))
print('Login successful — credential cache stored')
"
```

Enter your Robinhood MFA code when prompted.

- [ ] **Step 2: Verify portfolio access**

```bash
cd trading-agent && python scripts/trade.py portfolio
```

Expected: JSON with `cash`, `positions`, and `total_value` fields populated from your Robinhood account.

- [ ] **Step 3: Confirm credential cache is gitignored**

```bash
git status
```

Expected: The `robin_stocks` credential cache file does NOT appear in untracked files (covered by `*.pickle` in .gitignore).

---

### Task 10: Register Claude Code routines

Use `/schedule` in Claude Code to register the three routines. Run from `trading-agent/` as working directory so relative paths resolve correctly.

- [ ] **Step 1: Register Morning Research**

```json
{
  "name": "Morning Research",
  "schedule": "45 9 * * 1-5",
  "timezone": "America/New_York",
  "prompt": "Run the morning research routine. First check market status: `python scripts/trade.py status` — if `is_open` is false, stop and write a one-line note to today's journal. Read journal/summary.md for prior context. Read watchlist.json for symbols. For each symbol, run `python scripts/research.py bars SYMBOL` and `python scripts/research.py news SYMBOL`. Extract ma20 and ma50 from the response and summarize the news. Also identify 3-5 additional tickers from news headlines worth researching and run the same commands for those. Write the Research section to journal/YYYY-MM-DD.md following the format in CLAUDE.md.",
  "allowed_tools": ["bash", "read", "write"]
}
```

- [ ] **Step 2: Register Trading Session**

```json
{
  "name": "Trading Session",
  "schedule": "0 10 * * 1-5",
  "timezone": "America/New_York",
  "prompt": "Run the trading session. Read today's journal for research. Run `python scripts/trade.py portfolio` to get cash balance and open positions. For each open position: if current price is more than 8% below average_buy_price, place a sell limit order at current bid minus 0.2% using `python scripts/trade.py order SYMBOL QTY sell LIMIT_PRICE`. Then for each researched symbol, answer the 5 decision framework questions from CLAUDE.md. For any buy or sell decision, run `python scripts/trade.py order SYMBOL QTY buy|sell LIMIT_PRICE`. If the script returns `order_placed: false`, log the rejection reason in the journal. Log all decisions under Trades Executed. Never place orders if market is closed.",
  "allowed_tools": ["bash", "read", "write"]
}
```

- [ ] **Step 3: Register End of Day Journal**

```json
{
  "name": "End of Day Journal",
  "schedule": "15 16 * * 1-5",
  "timezone": "America/New_York",
  "prompt": "Run the end-of-day routine. Run `python scripts/trade.py portfolio` to get final positions and account value. Read today's full journal. Write the End-of-Day Reflection section: what worked, what didn't, what to watch tomorrow. Rewrite journal/summary.md to include today's key takeaways — keep only the last 7 trading days of context. Then run `python scripts/notify.py journal/YYYY-MM-DD.md` to send the email digest.",
  "allowed_tools": ["bash", "read", "write"]
}
```

- [ ] **Step 4: Run full test suite**

```bash
cd trading-agent && python -m pytest tests/ -v
```

Expected: All 13 tests PASS.

- [ ] **Step 5: Final commit**

```bash
cd trading-agent && git add -A && git commit -m "feat: trading agent core complete — scripts, config, tests, routines registered"
```

---

## Self-Review

- [x] **CLAUDE.md hard rules** — Task 2 ✓
- [x] **watchlist.json with 5 symbols** — Task 3 ✓
- [x] **research.py: bars, news, MA (20/50-day)** — Task 4 ✓
- [x] **trade.py: validate_order (allocation cap + cash reserve)** — Task 5 ✓
- [x] **trade.py: Robinhood get_portfolio, place_order** — Tasks 5/6 ✓
- [x] **trade.py: market status via Alpaca clock** — Task 5 ✓
- [x] **trade.py: CLI order flow with validate_order gate** — Task 5 ✓
- [x] **notify.py: SendGrid email digest** — Task 7 ✓
- [x] **journal/summary.md initialized** — Task 8 ✓
- [x] **Robinhood first login documented** — Task 9 ✓
- [x] **Three routines registered** — Task 10 ✓
- [x] **8% stop-loss** — Trading Session routine prompt (Task 10) ✓
- [x] **Sell orders skip allocation check** — validate_order returns True for side=="sell" ✓
- [x] **60-bar limit on history** — get_bars defaults to limit=60 ✓
- [x] **summary.md context (not raw journals)** — routines reference summary.md ✓

---

*Dashboard (React + FastAPI) is a separate plan: `2026-06-23-trading-agent-dashboard.md`*
