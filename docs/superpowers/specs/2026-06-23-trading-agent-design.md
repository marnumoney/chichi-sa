# Trading Agent — Design Spec
**Date:** 2026-06-23
**Status:** Approved

---

## Overview

An autonomous Claude-powered paper trading agent that runs on a daily schedule during US market hours. It researches a hybrid watchlist (fixed symbols + news-discovered tickers), makes trading decisions using a structured decision framework, executes limit orders via Robinhood (`robin_stocks`), and sends a nightly email digest. A React + FastAPI dashboard provides visibility into portfolio state, journal history, and watchlist configuration. Risk is enforced at three layers: CLAUDE.md rules, script-level validation, and an optional Critic agent.

---

## Project Structure

```
trading-agent/
├── CLAUDE.md                      # Layer 1: hard trading rules
├── watchlist.json                 # Symbols + per-symbol allocation limits + cash reserve
├── scripts/
│   ├── research.py                # Alpaca: 60-day bars, news, 20/50-day MA calculation
│   ├── trade.py                   # Robinhood: portfolio state, validate_order, execution
│   └── notify.py                  # SendGrid: email today's journal as digest
├── journal/
│   ├── YYYY-MM-DD.md              # Daily full journal (agent writes)
│   └── summary.md                 # Rolling 7-day context summary (agent maintains)
├── dashboard/
│   ├── backend/
│   │   └── main.py                # FastAPI: portfolio, journal, watchlist endpoints
│   └── frontend/
│       └── src/                   # React: Portfolio view, Journal browser, Watchlist manager
└── .env                           # All API keys (never committed)
```

---

## Scheduled Routines

Three Claude Code routines run on weekdays (Mon–Fri) in the `America/New_York` timezone.

### 1. Morning Research — 9:45 AM ET

```json
{
  "name": "Morning Research",
  "schedule": "45 9 * * 1-5",
  "timezone": "America/New_York",
  "allowed_tools": ["bash", "read", "write"]
}
```

**What Claude does:**
1. Calls `python scripts/trade.py status` — if market is closed, stops immediately
2. Reads `summary.md` for prior-week context (not raw past journals)
3. Reads `watchlist.json` to get fixed symbols
4. For each symbol: calls `python scripts/research.py bars SYMBOL` (60-day bars) and `python scripts/research.py news SYMBOL`
5. Calculates 20-day and 50-day moving averages from bar data
6. Reads recent market news headlines and discovers 3–5 additional tickers worth researching
7. Researches discovered tickers the same way
8. Writes the Research section to `journal/YYYY-MM-DD.md`

### 2. Trading Session — 10:00 AM ET

```json
{
  "name": "Trading Session",
  "schedule": "0 10 * * 1-5",
  "timezone": "America/New_York",
  "allowed_tools": ["bash", "read", "write"]
}
```

**What Claude does:**
1. Reads today's journal (Research section)
2. Calls `python scripts/trade.py portfolio` — gets cash balance and open positions from Robinhood
3. For each open position: checks if it has dropped ≥ 8% from entry — if so, places a sell order immediately (stop loss)
4. For each researched symbol, answers the 5 decision questions from CLAUDE.md
5. For any buy/sell decision: calls `python scripts/trade.py order SYMBOL QTY SIDE LIMIT_PRICE`
   - `validate_order()` runs inside trade.py before any Robinhood call — rejects non-compliant orders
6. Logs all decisions, orders placed, and rejections to the journal

### 3. End of Day Journal — 4:15 PM ET

```json
{
  "name": "End of Day Journal",
  "schedule": "15 16 * * 1-5",
  "timezone": "America/New_York",
  "allowed_tools": ["bash", "read", "write"]
}
```

**What Claude does:**
1. Calls `python scripts/trade.py portfolio` — gets final positions and account value
2. Reads full day's journal entries
3. Writes the End-of-Day Reflection section (what worked, what didn't, what to watch tomorrow)
4. Rewrites `summary.md` to include today's key takeaways (rolling 7-day window)
5. Calls `python scripts/notify.py journal/YYYY-MM-DD.md` — sends email digest via SendGrid

---

## Data Sources

| Data type | Source | Script |
|---|---|---|
| Historical bars (60-day) | Alpaca data API | `research.py` |
| News headlines | Alpaca news API | `research.py` |
| 20-day / 50-day MA | Calculated from bars | `research.py` |
| Market status (open/closed) | Alpaca clock API | `trade.py` |
| Cash balance | Robinhood via `robin_stocks` | `trade.py` |
| Open positions | Robinhood via `robin_stocks` | `trade.py` |
| Order execution | Robinhood via `robin_stocks` | `trade.py` |
| Email digest | SendGrid | `notify.py` |

---

## Watchlist

`watchlist.json` defines the fixed symbol universe and per-symbol allocation ceilings. Claude supplements this with news-discovered tickers (subject to the default 5% allocation cap from CLAUDE.md).

```json
{
  "watchlist": [
    { "symbol": "SPY",  "description": "S&P 500 ETF",         "max_allocation_pct": 15 },
    { "symbol": "QQQ",  "description": "Nasdaq ETF",           "max_allocation_pct": 10 },
    { "symbol": "NVDA", "description": "GPU/AI infrastructure","max_allocation_pct": 8  },
    { "symbol": "AAPL", "description": "Large cap tech",       "max_allocation_pct": 8  },
    { "symbol": "MSFT", "description": "Cloud/enterprise",     "max_allocation_pct": 8  }
  ],
  "cash_reserve_pct": 20
}
```

News-discovered tickers not in the watchlist are subject to the default 5% cap from CLAUDE.md.

---

## Risk Controls

### Layer 1 — CLAUDE.md (Agent Instructions)

Hard rules in plain language, read by Claude at the start of every session:
- Never invest more than 5% of total portfolio in a single position (watchlist symbols may have higher caps defined in `watchlist.json`)
- Never place a market order — always use limit orders within 0.2% of ask
- If a position drops 8% from entry price, close it without waiting
- Always write a journal entry, even on days with no trades
- Never place trades when market status is "closed"
- Before any trade, answer all 5 decision framework questions

**Decision framework (required before every trade):**
1. What is the current portfolio cash balance?
2. What positions are already open?
3. What does recent news say about this ticker?
4. What do the 20-day and 50-day MAs indicate?
5. What is the risk if this trade goes wrong?

### Layer 2 — Script Validation (`trade.py`)

`validate_order()` runs inside `trade.py` before any Robinhood API call:

```python
def validate_order(symbol, qty, side, current_price, account_value, current_positions, watchlist):
    order_value = qty * current_price
    allocation_pct = (order_value / account_value) * 100

    # Per-symbol cap: use watchlist override or default 5%
    symbol_max = next(
        (w["max_allocation_pct"] for w in watchlist if w["symbol"] == symbol), 5
    )
    if allocation_pct > symbol_max:
        return False, f"Order exceeds {symbol_max}% allocation limit: {allocation_pct:.1f}%"

    # Cash reserve: total invested + this order must leave ≥ 20% cash
    total_invested = sum(p["market_value"] for p in current_positions)
    if (total_invested + order_value) / account_value > 0.80:
        return False, "Order would violate 20% cash reserve requirement"

    return True, "Order validated"
```

Orders rejected by `validate_order()` are logged to the journal with the rejection reason. Claude does not retry rejected orders in the same session.

### Layer 3 — Critic Agent (Optional)

A fourth routine at 10:15 AM reads the journal's proposed trades and independently evaluates each one. If the Critic disagrees, it sets `review_required: true` on that trade in the journal. The Trading Session routine skips any order flagged `review_required` until a human clears it. This is a multi-agent debate pattern — Agent A proposes, Agent B reviews, humans break ties.

**Start with the single-agent setup. Add the Critic once the base agent's behavior is verified on paper.**

---

## Journal Format

```markdown
# Trade Journal — YYYY-MM-DD

## Portfolio Status
- Cash: $X
- Positions: SYMBOL (N shares @ $X.XX), ...
- Total Value: $X

## Market Research
### SYMBOL
- 20-day MA: $X | 50-day MA: $X — [trend assessment]
- News: [headline summary]
- Decision: [action or "No action — reason"]

## Trades Executed
| Time | Symbol | Action | Qty | Price | Reasoning |
|------|--------|--------|-----|-------|-----------|

## Positions Closed
[None today / list of closed positions]

## End-of-Day Reflection
[What worked, what didn't, what to watch tomorrow]
```

---

## Token Efficiency

| Practice | Implementation |
|---|---|
| Truncated history | `research.py` fetches 60 bars, not 500 |
| Context summarization | Agent reads `summary.md` (7-day rolling), not raw past journals |
| Tool call budget | Each routine has a capped tool call limit to prevent runaway loops |

---

## Dashboard (React + FastAPI)

### Backend (`dashboard/backend/main.py`)

FastAPI app with three route groups:

- `GET /portfolio` — calls `trade.py` functions to return cash, positions, P&L, total value from Robinhood
- `GET /journal` — lists all `.md` files in `journal/` sorted by date descending
- `GET /journal/{date}` — returns the raw markdown content of a specific journal entry
- `GET /watchlist` — reads and returns `watchlist.json`
- `PUT /watchlist` — validates that total `max_allocation_pct` across all symbols ≤ 80, then writes `watchlist.json`

### Frontend (`dashboard/frontend/src/`)

Three views in a single-page React app:

**Portfolio View** — displays cash balance, each open position with entry price / current price / P&L, and total account value. Refreshes on load.

**Journal Browser** — left panel lists journal entries by date. Clicking an entry renders the full markdown on the right. No pagination needed at this scale.

**Watchlist Manager** — editable table of symbols and their `max_allocation_pct` values. Inline validation shows an error if total allocation exceeds 80%. Save button calls `PUT /watchlist`.

---

## Environment Variables (`.env`)

```
# Alpaca
APCA_API_KEY_ID=
APCA_API_SECRET_KEY=
APCA_BASE_URL=https://api.alpaca.markets

# Robinhood
ROBINHOOD_USERNAME=
ROBINHOOD_PASSWORD=

# SendGrid
SENDGRID_API_KEY=
NOTIFY_EMAIL=

# Anthropic
ANTHROPIC_API_KEY=
```

---

## Deployment

- Trading agent scripts run as Claude Code scheduled routines
- FastAPI backend run under PM2: `pm2 start dashboard/backend/main.py --interpreter python3`
- React frontend built and served statically or run in dev mode locally
- All credentials in `.env`, never committed to git
- `journal/` directory committed to git nightly (via End of Day routine)

---

## Out of Scope

- Real-money execution (paper trading only until verified)
- Backtesting engine (validate strategy manually from journal history first)
- Options or crypto trading
- Multi-user access to the dashboard
- Critic agent (implement after single-agent setup is stable)
