# Trading Robot — Design Spec
**Date:** 2026-04-18
**Status:** Approved

---

## Overview

A fully automated Forex scalping bot that connects to MetaTrader 5 via the Python `MetaTrader5` library. It trades EUR/USD, GBP/USD, and USD/JPY during the New York session (13:00–17:00 GMT) using a price action + 20 EMA crossover strategy on the 1-minute chart. Risk is managed with 1% per-trade sizing and a 3% daily hard stop. All trades are logged to a local SQLite journal.

---

## Architecture

### Directory Structure

```
trading-robot/
├── bot.py              # Main entry point + trading loop
├── strategy.py         # Signal logic (price action + 20 EMA)
├── risk.py             # Position sizing, daily loss limit enforcement
├── broker.py           # MT5 connection + order execution wrapper
├── session.py          # NY session time gate (13:00–17:00 GMT)
├── db.py               # SQLite trade journal
├── config.py           # All parameters (pairs, risk %, lot limits, etc.)
└── .env                # MT5 credentials (login, password, server)
```

### Execution Flow

1. `bot.py` starts a loop that ticks every 5 seconds
2. `session.py` gates execution — loop skips logic outside NY session hours
3. For each pair, `strategy.py` fetches the last 2 closed 1m candles and evaluates the signal
4. If signal fires, `risk.py` calculates lot size and checks daily loss limit
5. If risk checks pass, `broker.py` places the market order with SL and TP
6. Trade is logged to SQLite via `db.py`
7. At 17:00 GMT, a session summary is printed to stdout

---

## Strategy Logic

### Entry Signal (1m chart, price action + 20 EMA)

**Long entry — all 3 conditions must be true:**
- Last closed candle closes above the 20 EMA
- Candle body ≥ 60% of total candle range (strong momentum, filters indecision)
- Previous candle closed below the 20 EMA (fresh crossover)

**Short entry — mirror:**
- Last closed candle closes below the 20 EMA
- Candle body ≥ 60% of total candle range
- Previous candle closed above the 20 EMA

### Exit Rules

| Trigger | Action |
|---|---|
| Take Profit | 1.5× risk distance (1:1.5 R:R) |
| Stop Loss | 1.5× entry candle range, beyond wick |
| Time exit | Close at market after 15 minutes if no profit |
| Daily halt | Close all positions immediately |

### Pair Constraints

- Max 1 open trade per pair at any time
- Pairs traded: EUR/USD, GBP/USD, USD/JPY

---

## Risk Management

### Per-Trade Sizing (1% rule)

```
lot_size = (account_balance × 0.01) / (sl_pips × pip_value)
```

- Hard cap: 0.10 lots maximum per trade
- SL distance derived from entry candle range at signal time

### Daily Loss Limit (3% hard stop)

- `starting_balance` recorded at session open
- After every trade close: check `(starting_balance - current_balance) / starting_balance`
- If ≥ 3%: set `daily_halt = True`, close all open trades, block new entries
- `daily_halt` resets at midnight UTC

### Additional Guardrails

| Rule | Value |
|---|---|
| Max concurrent open trades | 3 (across all pairs) |
| Late session cutoff | No new entries after 16:50 GMT |
| Spread filter | Skip entry if spread > 2.0 pips |

---

## Trade Journal

### SQLite Schema (`trades` table)

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| pair | TEXT | e.g., EURUSD |
| direction | TEXT | `long` or `short` |
| entry_price | REAL | |
| sl | REAL | Stop loss price |
| tp | REAL | Take profit price |
| lot_size | REAL | |
| entry_time | TEXT | ISO 8601 UTC |
| exit_time | TEXT | ISO 8601 UTC |
| exit_price | REAL | |
| pnl_usd | REAL | Realized PnL in USD |
| exit_reason | TEXT | `tp_hit`, `sl_hit`, `time_exit`, `daily_halt`, `manual` |
| spread_at_entry | REAL | Pips at time of entry |
| candle_body_ratio | REAL | Body / range ratio at signal |
| daily_pnl_snapshot | REAL | Running daily PnL at exit time |

### Session Summary (stdout at 17:00 GMT)

```
=== NY Session Summary 2026-04-18 ===
Trades: 7 | Win: 5 | Loss: 2 | Win rate: 71%
Total PnL: +$43.20 | Starting balance: $1,000
Daily drawdown: -0.8% (limit: 3%)
Pairs: EURUSD(3) GBPUSD(2) USDJPY(2)
```

---

## Configuration (`config.py`)

```python
PAIRS = ["EURUSD", "GBPUSD", "USDJPY"]
TIMEFRAME = "M1"
EMA_PERIOD = 20
BODY_RATIO_MIN = 0.60
RISK_PER_TRADE = 0.01       # 1%
DAILY_LOSS_LIMIT = 0.03     # 3%
MAX_LOT_SIZE = 0.10
MAX_CONCURRENT_TRADES = 3
SPREAD_LIMIT_PIPS = 2.0
RR_RATIO = 1.5
SL_MULTIPLIER = 1.5
TIME_EXIT_MINUTES = 15
SESSION_START_UTC = "13:00"
SESSION_END_UTC = "17:00"
LATE_SESSION_CUTOFF_UTC = "16:50"
LOOP_INTERVAL_SECONDS = 5
```

---

## Deployment

- Runs as a standalone Python process on the same Linux machine as Agency OS
- Start/stop via systemd service or manual `python bot.py`
- MT5 must be running (Windows VM or Wine) with AutoTrading enabled
- Credentials stored in `.env`, never committed to git
- Logs captured by systemd journal or redirected to a log file

---

## Out of Scope

- Web UI or dashboard
- Backtesting engine (use MT5's built-in Strategy Tester for backtesting)
- Agency OS integration (can be added later as a reporting department)
- Multiple timeframe confirmation
- News filter (spread filter provides indirect protection)
