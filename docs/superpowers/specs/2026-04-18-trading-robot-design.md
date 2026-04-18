# Trading Robot — Design Spec
**Date:** 2026-04-18
**Status:** Approved

---

## Overview

A fully automated, self-improving Forex scalping bot that connects to MetaTrader 5 via the Python `MetaTrader5` library. It trades EUR/USD, GBP/USD, and USD/JPY during the New York session (13:00–17:00 GMT) using a price action + 20 EMA crossover strategy on the 1-minute chart. Risk is managed with 1% per-trade sizing and a 3% daily hard stop. The bot learns from every trade through a three-layer self-improvement loop, and filters entries using live economic calendar events, news sentiment, and weekly COT institutional positioning data.

---

## Architecture

### Directory Structure

```
trading-robot/
├── bot.py                  # Main entry point + trading loop
├── strategy.py             # Signal logic (price action + 20 EMA)
├── risk.py                 # Position sizing, daily loss limit enforcement
├── broker.py               # MT5 connection + order execution wrapper
├── session.py              # NY session time gate (13:00–17:00 GMT)
├── db.py                   # SQLite trade journal + helpers
├── config.py               # Base parameters (pairs, risk %, lot limits, etc.)
├── learned_config.json     # Claude-rewritten overrides (takes precedence over config.py)
├── learned_params.json     # Auto-tuned thresholds from statistical analysis
├── blacklist.json          # Losing pattern blacklist (pair + hour + day)
├── strategy_notes.md       # Claude's nightly reflection (read at session start)
├── learner.py              # Post-session parameter tuner + blacklist builder
├── reflector.py            # Claude nightly reflection runner
├── news.py                 # Economic calendar + sentiment feed
├── cot.py                  # COT data downloader + parser
└── .env                    # MT5 credentials + API keys (never committed)
```

### Execution Flow

1. `bot.py` starts, loads `config.py` then merges `learned_config.json` overrides
2. Reads `strategy_notes.md` and logs key notes to stdout
3. `news.py` fetches today's high-impact calendar events and initial sentiment scores
4. `cot.py` loads latest COT positioning snapshot from SQLite
5. `session.py` gates execution — loop ticks every 5 seconds during NY session only
6. Per tick, for each pair: `strategy.py` evaluates signal → `news.py` checks macro filters → `risk.py` checks sizing + daily limit → `broker.py` places order
7. Trade logged to SQLite via `db.py`
8. Every 15 minutes: `news.py` refreshes sentiment scores
9. At 17:00 GMT: session summary printed, `learner.py` runs parameter tuning + blacklist update
10. At midnight UTC: `reflector.py` runs Claude reflection, rewrites `strategy_notes.md` + `learned_config.json`, commits to git

---

## Strategy Logic

### Entry Signal (1m chart, price action + 20 EMA)

**Long entry — all 3 conditions must be true:**
- Last closed candle closes above the 20 EMA
- Candle body ≥ body_ratio_min (default 0.60, auto-tuned) of total candle range
- Previous candle closed below the 20 EMA (fresh crossover)

**Short entry — mirror:**
- Last closed candle closes below the 20 EMA
- Candle body ≥ body_ratio_min of total candle range
- Previous candle closed above the 20 EMA

### Exit Rules

| Trigger | Action |
|---|---|
| Take Profit | RR ratio × risk distance (default 1:1.5) |
| Stop Loss | SL multiplier × entry candle range, beyond wick (default 1.5×) |
| Time exit | Close at market after time_exit_minutes if no profit (default 15 min) |
| Daily halt | Close all positions immediately |

### Pair Constraints

- Max 1 open trade per pair at any time
- Active pairs defined in `learned_config.json` (default: EUR/USD, GBP/USD, USD/JPY)

---

## Risk Management

### Per-Trade Sizing (1% rule)

```
lot_size = (account_balance × risk_per_trade) / (sl_pips × pip_value)
```

- Hard cap: max_lot_size per trade (default 0.10)
- SL distance derived from entry candle range at signal time

### Daily Loss Limit (3% hard stop)

- `starting_balance` recorded at session open
- After every trade close: check `(starting_balance - current_balance) / starting_balance`
- If ≥ daily_loss_limit: set `daily_halt = True`, close all open trades, block new entries
- `daily_halt` resets at midnight UTC

### Additional Guardrails

| Rule | Default |
|---|---|
| Max concurrent open trades | 3 (across all pairs) |
| Late session cutoff | No new entries after 16:50 GMT |
| Spread filter | Skip entry if spread > spread_limit_pips (default 2.0) |

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
| sentiment_bias | TEXT | JSON: `{"EUR": 1, "USD": -1}` at entry time |
| cot_bias | TEXT | JSON: `{"EUR": "long", "USD": "short"}` at entry time |
| news_blocked | INTEGER | 1 if a macro filter blocked an earlier signal this tick |

### Session Summary (stdout at 17:00 GMT)

```
=== NY Session Summary 2026-04-18 ===
Trades: 7 | Win: 5 | Loss: 2 | Win rate: 71%
Total PnL: +$43.20 | Starting balance: $1,000
Daily drawdown: -0.8% (limit: 3%)
Pairs: EURUSD(3) GBPUSD(2) USDJPY(2)
News blocks: 4 | Blacklist blocks: 2
```

---

## Self-Learning Loop

Three layers operate at different timescales:

### Layer 1 — Parameter Tuner (`learner.py`, runs post-session)

Queries the last 30 trades. Groups by win/loss. Calculates average `candle_body_ratio`, `spread_at_entry`, session hour, pair, and day-of-week per group. Updates `learned_params.json` with refined thresholds. Safety bounds prevent dangerous values:

| Parameter | Min | Max |
|---|---|---|
| body_ratio_min | 0.50 | 0.80 |
| spread_limit_pips | 1.0 | 3.0 |
| time_exit_minutes | 10 | 30 |

Requires minimum 10 trades per group before adjusting a parameter (avoids noise from small samples).

### Layer 2 — Signal Filter / Blacklist (`learner.py`, runs post-session)

Tracks losing patterns: pair + hour-of-day + day-of-week combinations. Any combination with win rate < 40% over 20+ samples is written to `blacklist.json`. Bot skips entries matching any blacklisted condition. Each blacklist entry has a 60-day TTL — auto-expires to adapt to changing market regimes.

### Layer 3 — Claude Reflection (`reflector.py`, runs nightly at midnight UTC)

Reads:
- Full trade journal (last 7 days)
- Current effective config (merged `config.py` + `learned_config.json`)
- `strategy_notes.md` from prior night
- Latest `learned_params.json` and `blacklist.json`

Claude analyses performance, identifies patterns, and rewrites both `strategy_notes.md` (human-readable observations) and `learned_config.json` (machine-readable parameter overrides). Full autonomy: Claude may change any parameter including pairs traded, risk %, RR ratio, session hours, or EMA period. Each reflection run is committed to git with a timestamped log entry so changes are traceable and reversible.

---

## Macro Awareness Layer

### Feed 1 — Economic Calendar (`news.py`)

- Source: ForexFactory calendar (scraped once at session start)
- Filters for high-impact (red) events affecting USD, EUR, GBP, JPY
- Stores event times in memory for the session
- Before every entry: if a high-impact event is within ±10 minutes, skip that pair
- Affected pairs: USD events block all 3 pairs; EUR events block EURUSD; GBP blocks GBPUSD; JPY blocks USDJPY

### Feed 2 — Live News Sentiment (`news.py`)

- Source: NewsAPI (free tier, requires API key in `.env`)
- Fetched every 15 minutes during the session
- Headlines scored per currency via Claude: `bullish (+1)`, `neutral (0)`, `bearish (-1)`
- Scores aggregated into a per-currency bias over the last 30 minutes of headlines
- Entry filter: long EUR/USD requires EUR sentiment ≥ 0 AND USD sentiment ≤ 0; conflicting sentiment blocks the trade
- Sentiment bias logged to the `trades` table for post-analysis

### Feed 3 — COT Data (`cot.py`)

- Source: CFTC website (downloaded every Saturday via cron)
- Parses net non-commercial positioning for EUR, GBP, JPY futures contracts
- Stored in SQLite `cot_snapshots` table with week date
- At session start: loads latest snapshot, calculates institutional bias per currency
- Entry filter: if institutions are strongly positioned against the trade direction (net position > 2 standard deviations from 1-year mean), skip the trade
- Acts as a weekly macro headwind/tailwind filter, not a real-time signal

---

## Configuration (`config.py` — base defaults)

```python
PAIRS = ["EURUSD", "GBPUSD", "USDJPY"]
TIMEFRAME = "M1"
EMA_PERIOD = 20
BODY_RATIO_MIN = 0.60
RISK_PER_TRADE = 0.01           # 1%
DAILY_LOSS_LIMIT = 0.03         # 3%
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
NEWS_REFRESH_INTERVAL_SECONDS = 900   # 15 min
CALENDAR_BUFFER_MINUTES = 10
COT_STD_DEV_THRESHOLD = 2.0
BLACKLIST_TTL_DAYS = 60
MIN_TRADES_FOR_TUNING = 10
REFLECTION_HOUR_UTC = 0               # midnight
```

All values in `learned_config.json` override these at runtime.

---

## Deployment

- Runs as a standalone Python process on the same Linux machine as Agency OS
- Start/stop via systemd service or manual `python bot.py`
- MT5 must be running (Windows VM or Wine) with AutoTrading enabled
- Cron jobs:
  - `reflector.py` — midnight UTC daily (`0 0 * * *`)
  - `cot.py` download — Saturday 08:00 UTC (`0 8 * * 6`)
- Credentials and API keys stored in `.env`, never committed to git
- `learned_config.json` and reflection logs committed to git nightly (traceable history)
- Logs captured by systemd journal or redirected to a log file

---

## Out of Scope

- Web UI or dashboard
- Backtesting engine (use MT5's built-in Strategy Tester)
- Agency OS integration (can be added later as a reporting department)
- Multiple timeframe confirmation
- Order flow / DOM analysis
