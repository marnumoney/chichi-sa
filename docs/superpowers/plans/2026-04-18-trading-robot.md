# Trading Robot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully automated, self-improving Forex scalping bot that trades EUR/USD, GBP/USD, USD/JPY on MetaTrader 5 during the NY session using price action + 20 EMA, with a three-layer self-learning loop and macro awareness via economic calendar, news sentiment, and COT data.

**Architecture:** Standalone Python process connecting to MetaTrader5 via the `MetaTrader5` library. Core loop ticks every 5 seconds during NY session (13:00–17:00 UTC). Self-learning runs post-session (parameter tuner, blacklist) and nightly (Claude reflection). Macro filters check economic calendar, live news sentiment, and weekly COT institutional positioning before each entry.

**Tech Stack:** Python 3.11+, MetaTrader5 (Windows only — see Note), SQLite (stdlib sqlite3), pandas, numpy, anthropic SDK, requests, beautifulsoup4, icalendar, python-dotenv, pytest

**⚠️ Platform Note:** The `MetaTrader5` Python library only runs on Windows. All files in this plan must run on a Windows machine with MT5 installed. Tests mock MT5 so they run anywhere. The `reflector.py` cron can run on Linux if preferred.

---

## File Map

| File | Responsibility |
|---|---|
| `config.py` | All base parameter defaults |
| `db.py` | SQLite init, trade CRUD, COT snapshots, balance records |
| `session.py` | NY session and late-session time gates |
| `broker.py` | MT5 connect/disconnect, tick fetch, candle fetch, order placement, position management |
| `strategy.py` | EMA calculation, candle body ratio, entry signal evaluation |
| `risk.py` | Pip size, SL/TP price calculation, lot sizing, daily halt check |
| `news.py` | ForexFactory calendar fetch + event blocking; NewsAPI headline fetch + Claude sentiment scoring |
| `cot.py` | CFTC COT download, parse, store in SQLite, bias check |
| `learner.py` | Post-session parameter tuner (Layer 1) + blacklist builder (Layer 2) |
| `reflector.py` | Nightly Claude reflection (Layer 3): rewrites strategy_notes.md + learned_config.json |
| `bot.py` | Main entry: load config, run session loop, orchestrate all modules |
| `tests/conftest.py` | Shared pytest fixtures (sample candles, sample trades) |
| `tests/test_db.py` | DB CRUD tests |
| `tests/test_session.py` | Session gating tests |
| `tests/test_strategy.py` | Signal logic tests |
| `tests/test_risk.py` | Risk calculation tests |
| `tests/test_news.py` | Calendar block + sentiment filter tests (mocked HTTP) |
| `tests/test_cot.py` | COT parse + bias check tests (mocked download) |
| `tests/test_learner.py` | Parameter tuner + blacklist tests |

---

## Phase 1: Core Bot (Tasks 1–7)
*After Task 7 you have a working, deployable scalping bot with no macro filters yet.*

---

### Task 1: Project Setup

**Files:**
- Create: `trading-robot/` (directory)
- Create: `trading-robot/config.py`
- Create: `trading-robot/requirements.txt`
- Create: `trading-robot/.env.example`
- Create: `trading-robot/tests/__init__.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p trading-robot/tests
touch trading-robot/tests/__init__.py
```

- [ ] **Step 2: Create `trading-robot/requirements.txt`**

```
MetaTrader5>=5.0.45
pandas>=2.0.0
numpy>=1.24.0
anthropic>=0.25.0
requests>=2.31.0
beautifulsoup4>=4.12.0
icalendar>=5.0.0
python-dotenv>=1.0.0
pytest>=7.4.0
pytest-mock>=3.11.0
```

- [ ] **Step 3: Create `trading-robot/.env.example`**

```
MT5_LOGIN=12345678
MT5_PASSWORD=your_password
MT5_SERVER=YourBroker-Server
ANTHROPIC_API_KEY=sk-ant-...
NEWS_API_KEY=your_newsapi_key
```

- [ ] **Step 4: Create `trading-robot/config.py`**

```python
PAIRS = ["EURUSD", "GBPUSD", "USDJPY"]
TIMEFRAME = "M1"
EMA_PERIOD = 20
BODY_RATIO_MIN = 0.60
RISK_PER_TRADE = 0.01
DAILY_LOSS_LIMIT = 0.03
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
NEWS_REFRESH_INTERVAL_SECONDS = 900
CALENDAR_BUFFER_MINUTES = 10
COT_STD_DEV_THRESHOLD = 2.0
BLACKLIST_TTL_DAYS = 60
MIN_TRADES_FOR_TUNING = 10
REFLECTION_HOUR_UTC = 0
DB_PATH = "trading_robot.db"
LEARNED_CONFIG_PATH = "learned_config.json"
LEARNED_PARAMS_PATH = "learned_params.json"
BLACKLIST_PATH = "blacklist.json"
STRATEGY_NOTES_PATH = "strategy_notes.md"
```

- [ ] **Step 5: Commit**

```bash
git add trading-robot/
git commit -m "feat: trading robot project scaffold and config"
```

---

### Task 2: SQLite Database (`db.py`)

**Files:**
- Create: `trading-robot/db.py`
- Create: `trading-robot/tests/test_db.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_db.py
import pytest, sqlite3, tempfile, os
from db import init_db, log_trade, update_trade_exit, get_recent_trades, get_daily_pnl, set_starting_balance, get_starting_balance

@pytest.fixture
def db_path(tmp_path):
    path = str(tmp_path / "test.db")
    init_db(path)
    return path

def test_init_creates_tables(db_path):
    conn = sqlite3.connect(db_path)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert "trades" in tables
    assert "cot_snapshots" in tables
    assert "daily_balances" in tables
    conn.close()

def test_log_and_retrieve_trade(db_path):
    trade_id = log_trade(db_path, {
        "pair": "EURUSD", "direction": "long", "entry_price": 1.0850,
        "sl": 1.0830, "tp": 1.0882, "lot_size": 0.02,
        "entry_time": "2026-04-18T13:05:00", "spread_at_entry": 0.8,
        "candle_body_ratio": 0.72, "sentiment_bias": "{}", "cot_bias": "{}", "news_blocked": 0
    })
    assert trade_id is not None
    trades = get_recent_trades(db_path, 10)
    assert len(trades) == 1
    assert trades[0]["pair"] == "EURUSD"

def test_update_trade_exit(db_path):
    trade_id = log_trade(db_path, {
        "pair": "GBPUSD", "direction": "short", "entry_price": 1.2700,
        "sl": 1.2720, "tp": 1.2670, "lot_size": 0.01,
        "entry_time": "2026-04-18T14:00:00", "spread_at_entry": 1.2,
        "candle_body_ratio": 0.65, "sentiment_bias": "{}", "cot_bias": "{}", "news_blocked": 0
    })
    update_trade_exit(db_path, trade_id, {
        "exit_price": 1.2670, "exit_time": "2026-04-18T14:08:00",
        "pnl_usd": 30.0, "exit_reason": "tp_hit", "daily_pnl_snapshot": 30.0
    })
    trades = get_recent_trades(db_path, 10)
    assert trades[0]["exit_reason"] == "tp_hit"
    assert trades[0]["pnl_usd"] == 30.0

def test_daily_pnl(db_path):
    log_trade(db_path, {
        "pair": "EURUSD", "direction": "long", "entry_price": 1.085,
        "sl": 1.083, "tp": 1.088, "lot_size": 0.01,
        "entry_time": "2026-04-18T13:10:00", "spread_at_entry": 0.9,
        "candle_body_ratio": 0.70, "sentiment_bias": "{}", "cot_bias": "{}", "news_blocked": 0
    })
    # trade with no exit: pnl_usd is NULL, daily_pnl should be 0
    assert get_daily_pnl(db_path, "2026-04-18") == 0.0

def test_starting_balance(db_path):
    set_starting_balance(db_path, "2026-04-18", 1000.0)
    assert get_starting_balance(db_path, "2026-04-18") == 1000.0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd trading-robot && pytest tests/test_db.py -v
```
Expected: `ModuleNotFoundError: No module named 'db'`

- [ ] **Step 3: Implement `trading-robot/db.py`**

```python
import sqlite3
from typing import Optional

def init_db(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pair TEXT NOT NULL,
            direction TEXT NOT NULL,
            entry_price REAL,
            sl REAL,
            tp REAL,
            lot_size REAL,
            entry_time TEXT,
            exit_time TEXT,
            exit_price REAL,
            pnl_usd REAL,
            exit_reason TEXT,
            spread_at_entry REAL,
            candle_body_ratio REAL,
            daily_pnl_snapshot REAL,
            sentiment_bias TEXT,
            cot_bias TEXT,
            news_blocked INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS cot_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_date TEXT NOT NULL,
            currency TEXT NOT NULL,
            net_position REAL NOT NULL,
            UNIQUE(week_date, currency)
        );
        CREATE TABLE IF NOT EXISTS daily_balances (
            date TEXT PRIMARY KEY,
            starting_balance REAL NOT NULL
        );
    """)
    conn.commit()
    conn.close()

def log_trade(db_path: str, trade: dict) -> int:
    conn = sqlite3.connect(db_path)
    cur = conn.execute(
        """INSERT INTO trades
           (pair, direction, entry_price, sl, tp, lot_size, entry_time,
            spread_at_entry, candle_body_ratio, sentiment_bias, cot_bias, news_blocked)
           VALUES (:pair, :direction, :entry_price, :sl, :tp, :lot_size, :entry_time,
                   :spread_at_entry, :candle_body_ratio, :sentiment_bias, :cot_bias, :news_blocked)""",
        trade
    )
    trade_id = cur.lastrowid
    conn.commit()
    conn.close()
    return trade_id

def update_trade_exit(db_path: str, trade_id: int, exit_data: dict) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """UPDATE trades SET exit_price=:exit_price, exit_time=:exit_time,
           pnl_usd=:pnl_usd, exit_reason=:exit_reason,
           daily_pnl_snapshot=:daily_pnl_snapshot WHERE id=:id""",
        {**exit_data, "id": trade_id}
    )
    conn.commit()
    conn.close()

def get_recent_trades(db_path: str, count: int) -> list[dict]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM trades ORDER BY id DESC LIMIT ?", (count,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_daily_pnl(db_path: str, date: str) -> float:
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT COALESCE(SUM(pnl_usd), 0) FROM trades WHERE entry_time LIKE ? AND exit_time IS NOT NULL",
        (f"{date}%",)
    ).fetchone()
    conn.close()
    return float(row[0])

def set_starting_balance(db_path: str, date: str, balance: float) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT OR REPLACE INTO daily_balances (date, starting_balance) VALUES (?, ?)",
        (date, balance)
    )
    conn.commit()
    conn.close()

def get_starting_balance(db_path: str, date: str) -> Optional[float]:
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT starting_balance FROM daily_balances WHERE date=?", (date,)
    ).fetchone()
    conn.close()
    return float(row[0]) if row else None

def save_cot_snapshot(db_path: str, week_date: str, currency: str, net_position: float) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT OR REPLACE INTO cot_snapshots (week_date, currency, net_position) VALUES (?,?,?)",
        (week_date, currency, net_position)
    )
    conn.commit()
    conn.close()

def get_cot_history(db_path: str, currency: str, weeks: int = 52) -> list[dict]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT week_date, net_position FROM cot_snapshots WHERE currency=? ORDER BY week_date DESC LIMIT ?",
        (currency, weeks)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_db.py -v
```
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add db.py tests/test_db.py
git commit -m "feat: SQLite trade journal, COT snapshots, daily balance tracking"
```

---

### Task 3: Session Gating (`session.py`)

**Files:**
- Create: `trading-robot/session.py`
- Create: `trading-robot/tests/test_session.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_session.py
from datetime import datetime, timezone
from session import is_ny_session, is_late_session

def test_inside_ny_session():
    dt = datetime(2026, 4, 18, 14, 30, tzinfo=timezone.utc)
    assert is_ny_session(dt) is True

def test_before_ny_session():
    dt = datetime(2026, 4, 18, 12, 59, tzinfo=timezone.utc)
    assert is_ny_session(dt) is False

def test_after_ny_session():
    dt = datetime(2026, 4, 18, 17, 0, tzinfo=timezone.utc)
    assert is_ny_session(dt) is False

def test_session_start_boundary():
    dt = datetime(2026, 4, 18, 13, 0, tzinfo=timezone.utc)
    assert is_ny_session(dt) is True

def test_late_session_before_cutoff():
    dt = datetime(2026, 4, 18, 16, 49, tzinfo=timezone.utc)
    assert is_late_session(dt) is False

def test_late_session_at_cutoff():
    dt = datetime(2026, 4, 18, 16, 50, tzinfo=timezone.utc)
    assert is_late_session(dt) is True

def test_weekend_not_in_session():
    dt = datetime(2026, 4, 19, 14, 0, tzinfo=timezone.utc)  # Sunday
    assert is_ny_session(dt) is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_session.py -v
```
Expected: `ModuleNotFoundError: No module named 'session'`

- [ ] **Step 3: Implement `trading-robot/session.py`**

```python
from datetime import datetime, timezone, time

SESSION_START = time(13, 0)
SESSION_END = time(17, 0)
LATE_CUTOFF = time(16, 50)

def is_ny_session(dt: datetime) -> bool:
    if dt.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    t = dt.astimezone(timezone.utc).time()
    return SESSION_START <= t < SESSION_END

def is_late_session(dt: datetime) -> bool:
    t = dt.astimezone(timezone.utc).time()
    return t >= LATE_CUTOFF
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_session.py -v
```
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add session.py tests/test_session.py
git commit -m "feat: NY session time gating with weekend guard"
```

---

### Task 4: MT5 Broker Wrapper (`broker.py`)

**Files:**
- Create: `trading-robot/broker.py`
- Create: `trading-robot/tests/test_broker.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_broker.py
from unittest.mock import patch, MagicMock
import numpy as np
import pytest

@pytest.fixture
def mock_mt5():
    with patch("broker.mt5") as m:
        m.TIMEFRAME_M1 = 1
        m.ORDER_TYPE_BUY = 0
        m.ORDER_TYPE_SELL = 1
        m.TRADE_ACTION_DEAL = 1
        m.ORDER_TIME_GTC = 0
        m.ORDER_FILLING_IOC = 1
        yield m

def test_get_tick_returns_bid_ask_spread(mock_mt5):
    tick = MagicMock(); tick.bid = 1.0850; tick.ask = 1.0851
    mock_mt5.symbol_info_tick.return_value = tick
    info = MagicMock(); info.trade_tick_size = 0.00001
    mock_mt5.symbol_info.return_value = info

    from broker import get_tick
    bid, ask, spread = get_tick("EURUSD")
    assert bid == 1.0850
    assert ask == 1.0851
    assert abs(spread - 1.0) < 0.01

def test_get_candles_returns_list_of_dicts(mock_mt5):
    dtype = np.dtype([("time","i8"),("open","f8"),("high","f8"),("low","f8"),("close","f8")])
    rates = np.array([(1713441600, 1.0840, 1.0860, 1.0835, 1.0855),
                      (1713441660, 1.0855, 1.0870, 1.0850, 1.0865)], dtype=dtype)
    mock_mt5.copy_rates_from_pos.return_value = rates

    from broker import get_candles
    candles = get_candles("EURUSD", 2)
    assert len(candles) == 2
    assert candles[0]["close"] == 1.0855
    assert "open" in candles[0]

def test_get_pip_value_per_lot(mock_mt5):
    info = MagicMock()
    info.trade_tick_value = 1.0
    info.trade_tick_size = 0.00001
    mock_mt5.symbol_info.return_value = info

    from broker import get_pip_value_per_lot
    val = get_pip_value_per_lot("EURUSD")
    assert abs(val - 10.0) < 0.01  # 1.0 * (0.0001/0.00001) = 10

def test_place_order_returns_ticket(mock_mt5):
    tick = MagicMock(); tick.ask = 1.0851
    mock_mt5.symbol_info_tick.return_value = tick
    result = MagicMock(); result.retcode = 10009; result.order = 987654
    mock_mt5.order_send.return_value = result

    from broker import place_order
    ticket = place_order("EURUSD", "long", 0.02, 1.0831, 1.0882)
    assert ticket == 987654
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_broker.py -v
```
Expected: `ModuleNotFoundError: No module named 'broker'`

- [ ] **Step 3: Implement `trading-robot/broker.py`**

```python
import os
import MetaTrader5 as mt5
from dotenv import load_dotenv

load_dotenv()

MAGIC = 20260418  # unique magic number for this bot's orders

def connect() -> bool:
    if not mt5.initialize():
        return False
    login = int(os.environ["MT5_LOGIN"])
    password = os.environ["MT5_PASSWORD"]
    server = os.environ["MT5_SERVER"]
    return mt5.login(login, password=password, server=server)

def disconnect() -> None:
    mt5.shutdown()

def get_balance() -> float:
    info = mt5.account_info()
    return info.balance

def get_tick(symbol: str) -> tuple[float, float, float]:
    tick = mt5.symbol_info_tick(symbol)
    info = mt5.symbol_info(symbol)
    pip_size = 0.01 if "JPY" in symbol else 0.0001
    spread_pips = (tick.ask - tick.bid) / pip_size
    return tick.bid, tick.ask, spread_pips

def get_candles(symbol: str, count: int) -> list[dict]:
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 1, count)
    return [
        {"time": int(r["time"]), "open": float(r["open"]), "high": float(r["high"]),
         "low": float(r["low"]), "close": float(r["close"])}
        for r in rates
    ]

def get_pip_value_per_lot(symbol: str) -> float:
    info = mt5.symbol_info(symbol)
    pip_size = 0.01 if "JPY" in symbol else 0.0001
    return info.trade_tick_value * (pip_size / info.trade_tick_size)

def place_order(symbol: str, direction: str, lot_size: float, sl: float, tp: float) -> int | None:
    tick = mt5.symbol_info_tick(symbol)
    price = tick.ask if direction == "long" else tick.bid
    order_type = mt5.ORDER_TYPE_BUY if direction == "long" else mt5.ORDER_TYPE_SELL
    request = {
        "action": mt5.TRADE_ACTION_DEAL, "symbol": symbol, "volume": lot_size,
        "type": order_type, "price": price, "sl": sl, "tp": tp,
        "deviation": 20, "magic": MAGIC, "comment": "trading-robot",
        "type_time": mt5.ORDER_TIME_GTC, "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    if result.retcode == 10009:
        return result.order
    return None

def get_open_positions(symbol: str | None = None) -> list[dict]:
    positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
    if not positions:
        return []
    return [
        {"ticket": p.ticket, "symbol": p.symbol, "type": "long" if p.type == 0 else "short",
         "volume": p.volume, "open_price": p.price_open, "sl": p.sl, "tp": p.tp,
         "profit": p.profit, "time": p.time}
        for p in positions if p.magic == MAGIC
    ]

def close_position(ticket: int) -> bool:
    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        return False
    pos = positions[0]
    tick = mt5.symbol_info_tick(pos.symbol)
    price = tick.bid if pos.type == 0 else tick.ask
    order_type = mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY
    request = {
        "action": mt5.TRADE_ACTION_DEAL, "symbol": pos.symbol, "volume": pos.volume,
        "type": order_type, "position": ticket, "price": price, "deviation": 20,
        "magic": MAGIC, "comment": "trading-robot-close",
        "type_time": mt5.ORDER_TIME_GTC, "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    return result.retcode == 10009

def close_all_positions() -> None:
    for pos in get_open_positions():
        close_position(pos["ticket"])
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_broker.py -v
```
Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add broker.py tests/test_broker.py
git commit -m "feat: MT5 broker wrapper with mocked tests"
```

---

### Task 5: Strategy Signal (`strategy.py`)

**Files:**
- Create: `trading-robot/strategy.py`
- Create: `trading-robot/tests/test_strategy.py`
- Create: `trading-robot/tests/conftest.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/conftest.py
import pytest

def make_candle(open_, high, low, close):
    return {"time": 0, "open": open_, "high": high, "low": low, "close": close}

@pytest.fixture
def bullish_crossover_candles():
    # 21 candles: first 19 below EMA, candle 20 (prev) below, candle 21 (last) above with strong body
    # Build candles that produce a clear EMA crossover
    candles = [make_candle(1.0800, 1.0810, 1.0790, 1.0795) for _ in range(19)]
    candles.append(make_candle(1.0795, 1.0800, 1.0790, 1.0795))  # prev: below ema
    candles.append(make_candle(1.0860, 1.0875, 1.0858, 1.0872))  # last: strong bullish body
    return candles

@pytest.fixture
def bearish_crossover_candles():
    candles = [make_candle(1.0870, 1.0880, 1.0860, 1.0875) for _ in range(19)]
    candles.append(make_candle(1.0875, 1.0880, 1.0870, 1.0875))  # prev: above ema
    candles.append(make_candle(1.0810, 1.0815, 1.0795, 1.0800))  # last: strong bearish body
    return candles
```

```python
# tests/test_strategy.py
from conftest import make_candle
from strategy import calculate_ema, get_candle_body_ratio, get_signal

def test_ema_increases_on_rising_prices():
    closes = [1.0800 + i * 0.0001 for i in range(30)]
    ema = calculate_ema(closes, 20)
    assert ema[-1] > ema[0]

def test_ema_length_matches_input():
    closes = [1.0800] * 25
    ema = calculate_ema(closes, 20)
    assert len(ema) == 25

def test_body_ratio_strong_candle():
    c = make_candle(1.0800, 1.0820, 1.0798, 1.0816)  # body=16, range=22
    ratio = get_candle_body_ratio(c)
    assert ratio == pytest.approx(16 / 22, rel=1e-3)

def test_body_ratio_doji():
    c = make_candle(1.0810, 1.0820, 1.0800, 1.0811)  # body=1, range=20
    ratio = get_candle_body_ratio(c)
    assert ratio < 0.10

def test_no_signal_on_weak_body(bullish_crossover_candles):
    # Override last candle with weak body
    bullish_crossover_candles[-1] = make_candle(1.0860, 1.0875, 1.0858, 1.0861)  # tiny body
    result = get_signal(bullish_crossover_candles, 20, 0.60)
    assert result is None

def test_long_signal_on_bullish_crossover(bullish_crossover_candles):
    result = get_signal(bullish_crossover_candles, 20, 0.60)
    assert result == "long"

def test_short_signal_on_bearish_crossover(bearish_crossover_candles):
    result = get_signal(bearish_crossover_candles, 20, 0.60)
    assert result == "short"

def test_no_signal_when_no_crossover():
    # All candles clearly above EMA — no crossover
    candles = [make_candle(1.0900, 1.0910, 1.0890, 1.0905) for _ in range(21)]
    result = get_signal(candles, 20, 0.60)
    assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_strategy.py -v
```
Expected: `ModuleNotFoundError: No module named 'strategy'`

- [ ] **Step 3: Implement `trading-robot/strategy.py`**

```python
import pandas as pd

def calculate_ema(closes: list[float], period: int) -> list[float]:
    s = pd.Series(closes)
    return s.ewm(span=period, adjust=False).mean().tolist()

def get_candle_body_ratio(candle: dict) -> float:
    total_range = candle["high"] - candle["low"]
    if total_range == 0:
        return 0.0
    body = abs(candle["close"] - candle["open"])
    return body / total_range

def get_signal(candles: list[dict], ema_period: int, body_ratio_min: float) -> str | None:
    if len(candles) < ema_period + 1:
        return None

    closes = [c["close"] for c in candles]
    ema_values = calculate_ema(closes, ema_period)

    last = candles[-1]
    prev = candles[-2]
    last_ema = ema_values[-1]
    prev_ema = ema_values[-2]

    if get_candle_body_ratio(last) < body_ratio_min:
        return None

    bullish_cross = prev["close"] < prev_ema and last["close"] > last_ema
    bearish_cross = prev["close"] > prev_ema and last["close"] < last_ema

    if bullish_cross:
        return "long"
    if bearish_cross:
        return "short"
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_strategy.py -v
```
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add strategy.py tests/test_strategy.py tests/conftest.py
git commit -m "feat: price action + EMA crossover signal with body ratio filter"
```

---

### Task 6: Risk Management (`risk.py`)

**Files:**
- Create: `trading-robot/risk.py`
- Create: `trading-robot/tests/test_risk.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_risk.py
import pytest
from conftest import make_candle
from risk import get_pip_size, calculate_sl_pips, calculate_sl_tp_prices, calculate_lot_size, is_daily_halt

def test_pip_size_standard_pair():
    assert get_pip_size("EURUSD") == 0.0001
    assert get_pip_size("GBPUSD") == 0.0001

def test_pip_size_jpy_pair():
    assert get_pip_size("USDJPY") == 0.01

def test_sl_pips_long():
    candle = make_candle(1.0840, 1.0860, 1.0835, 1.0855)  # range = 0.0025
    # sl = range * 1.5 = 0.00375, in pips = 37.5
    pips = calculate_sl_pips(candle, sl_multiplier=1.5, pip_size=0.0001)
    assert abs(pips - 37.5) < 0.1

def test_sl_tp_prices_long():
    sl, tp = calculate_sl_tp_prices(
        entry_price=1.0855, direction="long",
        sl_pips=15.0, rr_ratio=1.5, pip_size=0.0001
    )
    assert abs(sl - 1.0840) < 0.00001   # entry - 15 pips
    assert abs(tp - 1.0877) < 0.00002   # entry + 22.5 pips

def test_sl_tp_prices_short():
    sl, tp = calculate_sl_tp_prices(
        entry_price=1.0840, direction="short",
        sl_pips=10.0, rr_ratio=1.5, pip_size=0.0001
    )
    assert abs(sl - 1.0850) < 0.00001   # entry + 10 pips
    assert abs(tp - 1.0825) < 0.00001   # entry - 15 pips

def test_lot_size_calculation():
    # balance=1000, risk=1%, sl=20pips, pip_value=10 USD/lot
    # lot = (1000 * 0.01) / (20 * 10) = 0.05
    lot = calculate_lot_size(1000.0, 0.01, 20.0, 10.0, 0.10)
    assert abs(lot - 0.05) < 0.001

def test_lot_size_capped_at_max():
    lot = calculate_lot_size(100000.0, 0.01, 5.0, 10.0, 0.10)
    assert lot == 0.10

def test_lot_size_rounded_to_two_decimals():
    lot = calculate_lot_size(1000.0, 0.01, 17.0, 10.0, 0.10)
    assert lot == round(lot, 2)

def test_daily_halt_triggered():
    assert is_daily_halt(1000.0, 969.9, 0.03) is True

def test_daily_halt_not_triggered():
    assert is_daily_halt(1000.0, 975.0, 0.03) is False

def test_daily_halt_exact_boundary():
    assert is_daily_halt(1000.0, 970.0, 0.03) is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_risk.py -v
```
Expected: `ModuleNotFoundError: No module named 'risk'`

- [ ] **Step 3: Implement `trading-robot/risk.py`**

```python
def get_pip_size(symbol: str) -> float:
    return 0.01 if "JPY" in symbol else 0.0001

def calculate_sl_pips(candle: dict, sl_multiplier: float, pip_size: float) -> float:
    candle_range = candle["high"] - candle["low"]
    return (candle_range * sl_multiplier) / pip_size

def calculate_sl_tp_prices(
    entry_price: float, direction: str,
    sl_pips: float, rr_ratio: float, pip_size: float
) -> tuple[float, float]:
    sl_distance = sl_pips * pip_size
    tp_distance = sl_pips * rr_ratio * pip_size
    if direction == "long":
        return round(entry_price - sl_distance, 5), round(entry_price + tp_distance, 5)
    return round(entry_price + sl_distance, 5), round(entry_price - tp_distance, 5)

def calculate_lot_size(
    balance: float, risk_pct: float,
    sl_pips: float, pip_value_per_lot: float, max_lot: float
) -> float:
    risk_amount = balance * risk_pct
    raw_lot = risk_amount / (sl_pips * pip_value_per_lot)
    return round(min(raw_lot, max_lot), 2)

def is_daily_halt(starting_balance: float, current_balance: float, limit: float) -> bool:
    drawdown = (starting_balance - current_balance) / starting_balance
    return drawdown >= limit
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_risk.py -v
```
Expected: all 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add risk.py tests/test_risk.py
git commit -m "feat: lot sizing, SL/TP calculation, daily halt check"
```

---

### Task 7: Main Trading Loop (`bot.py` — Phase 1)

**Files:**
- Create: `trading-robot/bot.py`

No unit tests for `bot.py` — it is the orchestrator. Test by running in a demo MT5 account.

- [ ] **Step 1: Create `trading-robot/bot.py`**

```python
import json, os, time, sys
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

import config, broker, db, session, strategy, risk

def load_effective_config() -> dict:
    cfg = {k: getattr(config, k) for k in dir(config) if k.isupper()}
    path = Path(config.LEARNED_CONFIG_PATH)
    if path.exists():
        overrides = json.loads(path.read_text())
        cfg.update(overrides)
    return cfg

def read_strategy_notes() -> str:
    path = Path(config.STRATEGY_NOTES_PATH)
    return path.read_text() if path.exists() else "(no strategy notes yet)"

def log_session_summary(cfg: dict, starting_balance: float, current_balance: float) -> None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    trades = db.get_recent_trades(cfg["DB_PATH"], 50)
    today_trades = [t for t in trades if (t["entry_time"] or "").startswith(today)]
    closed = [t for t in today_trades if t["exit_time"]]
    wins = [t for t in closed if (t["pnl_usd"] or 0) > 0]
    total_pnl = sum(t["pnl_usd"] or 0 for t in closed)
    win_rate = round(len(wins) / len(closed) * 100) if closed else 0
    drawdown = round((starting_balance - current_balance) / starting_balance * 100, 2)
    print(f"\n=== NY Session Summary {today} ===")
    print(f"Trades: {len(closed)} | Win: {len(wins)} | Loss: {len(closed)-len(wins)} | Win rate: {win_rate}%")
    print(f"Total PnL: ${total_pnl:+.2f} | Starting balance: ${starting_balance:.2f}")
    print(f"Daily drawdown: {drawdown}% (limit: {cfg['DAILY_LOSS_LIMIT']*100:.0f}%)")

def check_time_exits(cfg: dict) -> None:
    now = datetime.now(timezone.utc)
    for pos in broker.get_open_positions():
        open_dt = datetime.fromtimestamp(pos["time"], tz=timezone.utc)
        minutes_open = (now - open_dt).total_seconds() / 60
        if minutes_open >= cfg["TIME_EXIT_MINUTES"] and pos["profit"] <= 0:
            broker.close_position(pos["ticket"])
            print(f"[TIME EXIT] {pos['symbol']} after {minutes_open:.0f} min")

def run_session(cfg: dict) -> None:
    db.init_db(cfg["DB_PATH"])
    if not broker.connect():
        print("ERROR: Could not connect to MT5"); return

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    starting_balance = broker.get_balance()
    db.set_starting_balance(cfg["DB_PATH"], today, starting_balance)
    daily_halt = False

    print(f"Session started. Balance: ${starting_balance:.2f}")
    print(f"Strategy notes: {read_strategy_notes()[:200]}")

    while True:
        now = datetime.now(timezone.utc)

        if not session.is_ny_session(now):
            break

        check_time_exits(cfg)

        current_balance = broker.get_balance()
        if risk.is_daily_halt(starting_balance, current_balance, cfg["DAILY_LOSS_LIMIT"]):
            if not daily_halt:
                print(f"DAILY HALT triggered. Closing all positions.")
                broker.close_all_positions()
                daily_halt = True

        if not daily_halt and not session.is_late_session(now):
            open_positions = broker.get_open_positions()
            if len(open_positions) < cfg["MAX_CONCURRENT_TRADES"]:
                open_symbols = {p["symbol"] for p in open_positions}
                for pair in cfg["PAIRS"]:
                    if pair in open_symbols:
                        continue
                    try:
                        _evaluate_and_trade(pair, cfg, starting_balance)
                    except Exception as e:
                        print(f"[ERROR] {pair}: {e}")

        time.sleep(cfg["LOOP_INTERVAL_SECONDS"])

    current_balance = broker.get_balance()
    log_session_summary(cfg, starting_balance, current_balance)
    broker.disconnect()

def _evaluate_and_trade(pair: str, cfg: dict, starting_balance: float) -> None:
    candles = broker.get_candles(pair, cfg["EMA_PERIOD"] + 5)
    signal = strategy.get_signal(candles, cfg["EMA_PERIOD"], cfg["BODY_RATIO_MIN"])
    if not signal:
        return

    _, ask, spread = broker.get_tick(pair)
    bid, _, _ = broker.get_tick(pair)
    if spread > cfg["SPREAD_LIMIT_PIPS"]:
        return

    entry_price = ask if signal == "long" else bid
    pip_size = risk.get_pip_size(pair)
    sl_pips = risk.calculate_sl_pips(candles[-1], cfg["SL_MULTIPLIER"], pip_size)
    sl, tp = risk.calculate_sl_tp_prices(entry_price, signal, sl_pips, cfg["RR_RATIO"], pip_size)
    pip_val = broker.get_pip_value_per_lot(pair)
    balance = broker.get_balance()
    lot = risk.calculate_lot_size(balance, cfg["RISK_PER_TRADE"], sl_pips, pip_val, cfg["MAX_LOT_SIZE"])

    ticket = broker.place_order(pair, signal, lot, sl, tp)
    if ticket:
        now = datetime.now(timezone.utc).isoformat()
        db.log_trade(cfg["DB_PATH"], {
            "pair": pair, "direction": signal, "entry_price": entry_price,
            "sl": sl, "tp": tp, "lot_size": lot, "entry_time": now,
            "spread_at_entry": spread,
            "candle_body_ratio": strategy.get_candle_body_ratio(candles[-1]),
            "sentiment_bias": "{}", "cot_bias": "{}", "news_blocked": 0
        })
        print(f"[TRADE] {signal.upper()} {pair} @ {entry_price:.5f} | SL:{sl:.5f} TP:{tp:.5f} | Lot:{lot}")

def main():
    cfg = load_effective_config()
    print(f"Trading Robot starting. Waiting for NY session (13:00–17:00 UTC)...")
    while True:
        now = datetime.now(timezone.utc)
        if session.is_ny_session(now):
            run_session(cfg)
        time.sleep(30)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run all Phase 1 tests**

```bash
pytest tests/ -v --ignore=tests/test_news.py --ignore=tests/test_cot.py --ignore=tests/test_learner.py 2>/dev/null || pytest tests/test_db.py tests/test_session.py tests/test_strategy.py tests/test_risk.py tests/test_broker.py -v
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add bot.py
git commit -m "feat: main trading loop — Phase 1 core bot complete"
```

---

## Phase 2: Macro Awareness (Tasks 8–11)

---

### Task 8: Economic Calendar (`news.py` — Part 1)

**Files:**
- Create: `trading-robot/news.py` (calendar section)
- Create: `trading-robot/tests/test_news.py` (calendar tests)

- [ ] **Step 1: Write failing tests**

```python
# tests/test_news.py
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

# --- Calendar tests ---

SAMPLE_ICAL = b"""BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:USD Non-Farm Payrolls (High)
DTSTART:20260418T133000Z
DTEND:20260418T133000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:EUR ECB Press Conference (Medium)
DTSTART:20260418T143000Z
DTEND:20260418T143000Z
END:VEVENT
END:VCALENDAR"""

@patch("news.requests.get")
def test_fetch_calendar_returns_high_impact_events(mock_get):
    mock_get.return_value = MagicMock(status_code=200, content=SAMPLE_ICAL)
    from news import fetch_calendar_events
    events = fetch_calendar_events(datetime(2026, 4, 18, tzinfo=timezone.utc))
    usd_events = [e for e in events if e["currency"] == "USD"]
    assert len(usd_events) == 1
    assert usd_events[0]["impact"] == "High"

@patch("news.requests.get")
def test_calendar_blocks_within_buffer(mock_get):
    mock_get.return_value = MagicMock(status_code=200, content=SAMPLE_ICAL)
    from news import fetch_calendar_events, is_calendar_blocked
    events = fetch_calendar_events(datetime(2026, 4, 18, tzinfo=timezone.utc))
    # 5 minutes before USD NFP at 13:30
    check_time = datetime(2026, 4, 18, 13, 25, tzinfo=timezone.utc)
    assert is_calendar_blocked("EURUSD", check_time, events, buffer_minutes=10) is True

@patch("news.requests.get")
def test_calendar_not_blocked_outside_buffer(mock_get):
    mock_get.return_value = MagicMock(status_code=200, content=SAMPLE_ICAL)
    from news import fetch_calendar_events, is_calendar_blocked
    events = fetch_calendar_events(datetime(2026, 4, 18, tzinfo=timezone.utc))
    # 20 minutes before USD NFP
    check_time = datetime(2026, 4, 18, 13, 10, tzinfo=timezone.utc)
    assert is_calendar_blocked("EURUSD", check_time, events, buffer_minutes=10) is False

@patch("news.requests.get")
def test_jpy_event_blocks_usdjpy_only(mock_get):
    jpy_ical = b"""BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:JPY BOJ Rate Decision (High)
DTSTART:20260418T030000Z
DTEND:20260418T030000Z
END:VEVENT
END:VCALENDAR"""
    mock_get.return_value = MagicMock(status_code=200, content=jpy_ical)
    from news import fetch_calendar_events, is_calendar_blocked
    events = fetch_calendar_events(datetime(2026, 4, 18, tzinfo=timezone.utc))
    check_time = datetime(2026, 4, 18, 2, 55, tzinfo=timezone.utc)
    assert is_calendar_blocked("USDJPY", check_time, events, buffer_minutes=10) is True
    assert is_calendar_blocked("EURUSD", check_time, events, buffer_minutes=10) is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_news.py::test_fetch_calendar_returns_high_impact_events -v
```
Expected: `ModuleNotFoundError: No module named 'news'`

- [ ] **Step 3: Implement calendar section of `trading-robot/news.py`**

```python
import requests
from datetime import datetime, timezone, timedelta
from icalendar import Calendar

FOREXFACTORY_ICAL = "https://www.forexfactory.com/calendar.ics"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

PAIR_CURRENCIES = {
    "EURUSD": ["EUR", "USD"],
    "GBPUSD": ["GBP", "USD"],
    "USDJPY": ["USD", "JPY"],
}

def fetch_calendar_events(date: datetime) -> list[dict]:
    resp = requests.get(FOREXFACTORY_ICAL, headers=HEADERS, timeout=10)
    cal = Calendar.from_ical(resp.content)
    events = []
    for component in cal.walk():
        if component.name != "VEVENT":
            continue
        summary = str(component.get("SUMMARY", ""))
        dtstart = component.get("DTSTART")
        if dtstart is None:
            continue
        event_dt = dtstart.dt
        if hasattr(event_dt, "date") and event_dt.date() != date.date():
            continue
        # Impact is embedded in summary as "(High)", "(Medium)", "(Low)"
        impact = "Low"
        for level in ["High", "Medium", "Low"]:
            if f"({level})" in summary:
                impact = level
                break
        if impact != "High":
            continue
        # Extract currency from first 3 chars of summary
        currency = summary[:3].upper()
        if currency in ("EUR", "GBP", "USD", "JPY"):
            if not hasattr(event_dt, "hour"):
                event_dt = datetime.combine(event_dt, datetime.min.time(), tzinfo=timezone.utc)
            elif event_dt.tzinfo is None:
                event_dt = event_dt.replace(tzinfo=timezone.utc)
            events.append({"time": event_dt, "currency": currency, "impact": impact, "summary": summary})
    return events

def is_calendar_blocked(symbol: str, current_time: datetime, events: list[dict], buffer_minutes: int) -> bool:
    relevant_currencies = PAIR_CURRENCIES.get(symbol, [])
    buffer = timedelta(minutes=buffer_minutes)
    for event in events:
        if event["currency"] not in relevant_currencies:
            continue
        diff = abs((current_time - event["time"]).total_seconds())
        if diff <= buffer.total_seconds():
            return True
    return False
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_news.py -k "calendar" -v
```
Expected: all 4 calendar tests PASS

- [ ] **Step 5: Commit**

```bash
git add news.py tests/test_news.py
git commit -m "feat: economic calendar fetch and event blocking"
```

---

### Task 9: News Sentiment (`news.py` — Part 2)

**Files:**
- Modify: `trading-robot/news.py` (add sentiment functions)
- Modify: `trading-robot/tests/test_news.py` (add sentiment tests)

- [ ] **Step 1: Write failing tests (append to test_news.py)**

```python
# Append to tests/test_news.py

# --- Sentiment tests ---

@patch("news.requests.get")
def test_fetch_headlines_returns_list(mock_get):
    mock_get.return_value = MagicMock(status_code=200, json=lambda: {
        "articles": [
            {"title": "EUR strengthens as ECB hints at rate hike"},
            {"title": "USD weakens on poor jobs data"},
        ]
    })
    from news import fetch_headlines
    headlines = fetch_headlines(["EUR", "USD"])
    assert len(headlines) == 2

@patch("news.anthropic.Anthropic")
def test_score_sentiment_bullish(mock_anthropic_class):
    mock_client = MagicMock()
    mock_anthropic_class.return_value = mock_client
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="bullish")]
    )
    from news import score_sentiment_batch
    result = score_sentiment_batch(["EUR strengthens on rate hike"], "EUR", mock_client)
    assert result == 1

@patch("news.anthropic.Anthropic")
def test_score_sentiment_bearish(mock_anthropic_class):
    mock_client = MagicMock()
    mock_anthropic_class.return_value = mock_client
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="bearish")]
    )
    from news import score_sentiment_batch
    result = score_sentiment_batch(["EUR falls sharply"], "EUR", mock_client)
    assert result == -1

def test_sentiment_blocks_conflicting_trade():
    from news import is_sentiment_blocked
    # Long EURUSD: EUR must be >= 0 and USD must be <= 0
    bias = {"EUR": -1, "USD": 1}  # strongly against long EUR/USD
    assert is_sentiment_blocked("EURUSD", "long", bias) is True

def test_sentiment_allows_aligned_trade():
    from news import is_sentiment_blocked
    bias = {"EUR": 1, "USD": -1}
    assert is_sentiment_blocked("EURUSD", "long", bias) is False

def test_sentiment_allows_neutral():
    from news import is_sentiment_blocked
    bias = {"EUR": 0, "USD": 0}
    assert is_sentiment_blocked("EURUSD", "long", bias) is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_news.py -k "sentiment" -v
```
Expected: tests fail (functions not yet defined)

- [ ] **Step 3: Append sentiment functions to `trading-robot/news.py`**

```python
import os
import anthropic

NEWS_API_URL = "https://newsapi.org/v2/everything"

def fetch_headlines(currencies: list[str]) -> list[str]:
    query = " OR ".join(currencies)
    api_key = os.environ.get("NEWS_API_KEY", "")
    resp = requests.get(NEWS_API_URL, params={
        "q": query, "language": "en", "pageSize": 20,
        "sortBy": "publishedAt", "apiKey": api_key
    }, timeout=10)
    articles = resp.json().get("articles", [])
    return [a["title"] for a in articles if a.get("title")]

def score_sentiment_batch(headlines: list[str], currency: str, client) -> int:
    if not headlines:
        return 0
    headlines_text = "\n".join(f"- {h}" for h in headlines[:10])
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=10,
        messages=[{
            "role": "user",
            "content": (
                f"Based on these headlines, is the overall sentiment for {currency} "
                f"bullish, bearish, or neutral? Reply with exactly one word.\n\n{headlines_text}"
            )
        }]
    )
    answer = message.content[0].text.strip().lower()
    if "bullish" in answer:
        return 1
    if "bearish" in answer:
        return -1
    return 0

def get_sentiment_bias(client) -> dict[str, int]:
    currencies = ["EUR", "GBP", "USD", "JPY"]
    headlines = fetch_headlines(currencies)
    return {c: score_sentiment_batch(headlines, c, client) for c in currencies}

def is_sentiment_blocked(symbol: str, direction: str, bias: dict[str, int]) -> bool:
    currencies = PAIR_CURRENCIES.get(symbol, [])
    if len(currencies) < 2:
        return False
    base, quote = currencies[0], currencies[1]
    if direction == "long":
        # Long = buy base, sell quote. Need base >= 0 and quote <= 0
        return bias.get(base, 0) < 0 or bias.get(quote, 0) > 0
    # Short = sell base, buy quote. Need base <= 0 and quote >= 0
    return bias.get(base, 0) > 0 or bias.get(quote, 0) < 0
```

- [ ] **Step 4: Run all news tests**

```bash
pytest tests/test_news.py -v
```
Expected: all 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add news.py tests/test_news.py
git commit -m "feat: live news sentiment scoring via Claude + sentiment trade filter"
```

---

### Task 10: COT Data (`cot.py`)

**Files:**
- Create: `trading-robot/cot.py`
- Create: `trading-robot/tests/test_cot.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_cot.py
import pytest, tempfile
from unittest.mock import patch, MagicMock
from db import init_db

SAMPLE_CSV = (
    "Market_and_Exchange_Names,As_of_Date_in_Form_YYMMDD,"
    "NonComm_Positions_Long_All,NonComm_Positions_Short_All\n"
    "EURO FX - CHICAGO MERCANTILE EXCHANGE,260415,200000,150000\n"
    "EURO FX - CHICAGO MERCANTILE EXCHANGE,260408,190000,160000\n"
    "BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE,260415,80000,120000\n"
    "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE,260415,60000,100000\n"
)

def test_parse_cot_data_extracts_net_positions():
    from cot import parse_cot_data
    records = parse_cot_data(SAMPLE_CSV)
    eur_records = [r for r in records if r["currency"] == "EUR"]
    assert len(eur_records) == 2
    # net = long - short = 200000 - 150000 = 50000
    latest = max(eur_records, key=lambda r: r["week_date"])
    assert latest["net_position"] == 50000

def test_parse_cot_data_gbp():
    from cot import parse_cot_data
    records = parse_cot_data(SAMPLE_CSV)
    gbp = [r for r in records if r["currency"] == "GBP"][0]
    assert gbp["net_position"] == -40000  # 80000 - 120000

@pytest.fixture
def db_path(tmp_path):
    path = str(tmp_path / "test.db")
    init_db(path)
    return path

def test_save_and_retrieve_cot(db_path):
    from cot import parse_cot_data, save_cot_snapshots
    from db import get_cot_history
    records = parse_cot_data(SAMPLE_CSV)
    save_cot_snapshots(db_path, records)
    eur_history = get_cot_history(db_path, "EUR", 52)
    assert len(eur_history) == 2

def test_cot_bias_neutral_on_no_data(db_path):
    from cot import get_cot_bias
    # No data in DB — should return neutral
    assert get_cot_bias(db_path, "EUR", threshold=2.0) == "neutral"

def test_cot_bias_strongly_long(db_path):
    from cot import parse_cot_data, save_cot_snapshots, get_cot_bias
    # Insert 10 weeks of data with EUR strongly net long (> 2 std devs)
    csv_rows = ["Market_and_Exchange_Names,As_of_Date_in_Form_YYMMDD,NonComm_Positions_Long_All,NonComm_Positions_Short_All"]
    for i in range(10):
        week = f"2604{10+i:02d}"
        csv_rows.append(f"EURO FX - CHICAGO MERCANTILE EXCHANGE,{week},100000,50000")
    # Add one extreme outlier
    csv_rows.append("EURO FX - CHICAGO MERCANTILE EXCHANGE,260501,500000,50000")
    records = parse_cot_data("\n".join(csv_rows))
    save_cot_snapshots(db_path, records)
    bias = get_cot_bias(db_path, "EUR", threshold=1.5)
    assert bias == "long"

def test_cot_blocks_trade_against_strong_positioning(db_path):
    from cot import parse_cot_data, save_cot_snapshots, is_cot_blocked
    csv_rows = ["Market_and_Exchange_Names,As_of_Date_in_Form_YYMMDD,NonComm_Positions_Long_All,NonComm_Positions_Short_All"]
    for i in range(10):
        week = f"2604{10+i:02d}"
        csv_rows.append(f"BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE,{week},80000,120000")
    csv_rows.append("BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE,260501,20000,200000")
    records = parse_cot_data("\n".join(csv_rows))
    save_cot_snapshots(db_path, records)
    # Institutions strongly short GBP — block long GBPUSD
    assert is_cot_blocked("GBPUSD", "long", db_path, threshold=1.5) is True
    assert is_cot_blocked("GBPUSD", "short", db_path, threshold=1.5) is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_cot.py -v
```
Expected: `ModuleNotFoundError: No module named 'cot'`

- [ ] **Step 3: Implement `trading-robot/cot.py`**

```python
import io, zipfile, statistics
import requests
from db import save_cot_snapshot, get_cot_history

CFTC_URL = "https://www.cftc.gov/dea/newcot/f_year.zip"
CURRENCY_KEYWORDS = {
    "EUR": "EURO FX",
    "GBP": "BRITISH POUND",
    "JPY": "JAPANESE YEN",
}
PAIR_BASE_CURRENCIES = {
    "EURUSD": "EUR",
    "GBPUSD": "GBP",
    "USDJPY": "JPY",
}
PAIR_DIRECTION_ALIGNS = {
    # For USDJPY long (buy USD): JPY being short is aligned
    "USDJPY": {"long": "short", "short": "long"},
    "EURUSD": {"long": "long", "short": "short"},
    "GBPUSD": {"long": "long", "short": "short"},
}

def download_cot_csv() -> str:
    resp = requests.get(CFTC_URL, timeout=30)
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    csv_name = [n for n in zf.namelist() if n.endswith(".txt")][0]
    return zf.read(csv_name).decode("latin-1")

def parse_cot_data(csv_text: str) -> list[dict]:
    lines = csv_text.strip().split("\n")
    if not lines:
        return []
    headers = [h.strip().strip('"') for h in lines[0].split(",")]
    market_idx = headers.index("Market_and_Exchange_Names")
    date_idx = headers.index("As_of_Date_in_Form_YYMMDD")
    long_idx = headers.index("NonComm_Positions_Long_All")
    short_idx = headers.index("NonComm_Positions_Short_All")

    records = []
    for line in lines[1:]:
        if not line.strip():
            continue
        cols = [c.strip().strip('"') for c in line.split(",")]
        if len(cols) <= max(market_idx, date_idx, long_idx, short_idx):
            continue
        market = cols[market_idx]
        for currency, keyword in CURRENCY_KEYWORDS.items():
            if keyword in market.upper():
                try:
                    net = int(cols[long_idx].replace(",","")) - int(cols[short_idx].replace(",",""))
                    week_date = cols[date_idx].strip()
                    records.append({"week_date": week_date, "currency": currency, "net_position": net})
                except ValueError:
                    pass
    return records

def save_cot_snapshots(db_path: str, records: list[dict]) -> None:
    for r in records:
        save_cot_snapshot(db_path, r["week_date"], r["currency"], r["net_position"])

def get_cot_bias(db_path: str, currency: str, threshold: float) -> str:
    history = get_cot_history(db_path, currency, weeks=52)
    if len(history) < 5:
        return "neutral"
    net_positions = [r["net_position"] for r in history]
    latest = net_positions[0]
    mean = statistics.mean(net_positions)
    stdev = statistics.stdev(net_positions)
    if stdev == 0:
        return "neutral"
    z_score = (latest - mean) / stdev
    if z_score >= threshold:
        return "long"
    if z_score <= -threshold:
        return "short"
    return "neutral"

def is_cot_blocked(symbol: str, direction: str, db_path: str, threshold: float) -> bool:
    base_currency = PAIR_BASE_CURRENCIES.get(symbol)
    if not base_currency:
        return False
    bias = get_cot_bias(db_path, base_currency, threshold)
    if bias == "neutral":
        return False
    aligned_bias = PAIR_DIRECTION_ALIGNS.get(symbol, {}).get(direction)
    # Block if institutional bias opposes our direction
    return bias != aligned_bias
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_cot.py -v
```
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add cot.py tests/test_cot.py
git commit -m "feat: CFTC COT data download, parse, and institutional bias filter"
```

---

### Task 11: Wire Macro Filters into `bot.py`

**Files:**
- Modify: `trading-robot/bot.py`

- [ ] **Step 1: Add macro filter imports and initialization to `bot.py`**

At the top of `bot.py`, add imports:
```python
import anthropic
import news as news_module
import cot as cot_module
```

- [ ] **Step 2: Add macro context to `run_session()`**

Replace the `run_session` signature and opening block:
```python
def run_session(cfg: dict) -> None:
    db.init_db(cfg["DB_PATH"])
    if not broker.connect():
        print("ERROR: Could not connect to MT5"); return

    today = datetime.now(timezone.utc)
    today_str = today.strftime("%Y-%m-%d")
    starting_balance = broker.get_balance()
    db.set_starting_balance(cfg["DB_PATH"], today_str, starting_balance)
    daily_halt = False

    # Macro context — fetched once at session start, sentiment refreshed every 15 min
    anthropic_client = anthropic.Anthropic()
    calendar_events = news_module.fetch_calendar_events(today)
    sentiment_bias = news_module.get_sentiment_bias(anthropic_client)
    last_sentiment_refresh = time.time()

    print(f"Session started. Balance: ${starting_balance:.2f}")
    print(f"Calendar events today: {len(calendar_events)}")
    print(f"Sentiment bias: {sentiment_bias}")
    print(f"Strategy notes: {read_strategy_notes()[:200]}")

    while True:
        now = datetime.now(timezone.utc)
        if not session.is_ny_session(now):
            break

        # Refresh sentiment every 15 minutes
        if time.time() - last_sentiment_refresh >= cfg["NEWS_REFRESH_INTERVAL_SECONDS"]:
            sentiment_bias = news_module.get_sentiment_bias(anthropic_client)
            last_sentiment_refresh = time.time()

        check_time_exits(cfg)

        current_balance = broker.get_balance()
        if risk.is_daily_halt(starting_balance, current_balance, cfg["DAILY_LOSS_LIMIT"]):
            if not daily_halt:
                print("DAILY HALT triggered. Closing all positions.")
                broker.close_all_positions()
                daily_halt = True

        if not daily_halt and not session.is_late_session(now):
            open_positions = broker.get_open_positions()
            if len(open_positions) < cfg["MAX_CONCURRENT_TRADES"]:
                open_symbols = {p["symbol"] for p in open_positions}
                for pair in cfg["PAIRS"]:
                    if pair in open_symbols:
                        continue
                    try:
                        _evaluate_and_trade(
                            pair, cfg, sentiment_bias,
                            calendar_events, now, anthropic_client
                        )
                    except Exception as e:
                        print(f"[ERROR] {pair}: {e}")

        time.sleep(cfg["LOOP_INTERVAL_SECONDS"])

    current_balance = broker.get_balance()
    log_session_summary(cfg, starting_balance, current_balance)
    broker.disconnect()
```

- [ ] **Step 3: Update `_evaluate_and_trade` to apply macro filters**

Replace the `_evaluate_and_trade` function:
```python
def _evaluate_and_trade(
    pair: str, cfg: dict, sentiment_bias: dict,
    calendar_events: list, now: datetime, anthropic_client
) -> None:
    candles = broker.get_candles(pair, cfg["EMA_PERIOD"] + 5)
    signal = strategy.get_signal(candles, cfg["EMA_PERIOD"], cfg["BODY_RATIO_MIN"])
    if not signal:
        return

    _, ask, spread = broker.get_tick(pair)
    bid, _, _ = broker.get_tick(pair)
    if spread > cfg["SPREAD_LIMIT_PIPS"]:
        return

    # Macro filter: economic calendar
    if news_module.is_calendar_blocked(pair, now, calendar_events, cfg["CALENDAR_BUFFER_MINUTES"]):
        print(f"[CALENDAR BLOCK] {pair} near high-impact event")
        return

    # Macro filter: news sentiment
    if news_module.is_sentiment_blocked(pair, signal, sentiment_bias):
        print(f"[SENTIMENT BLOCK] {pair} {signal} — sentiment: {sentiment_bias}")
        return

    # Macro filter: COT institutional positioning
    if cot_module.is_cot_blocked(pair, signal, cfg["DB_PATH"], cfg["COT_STD_DEV_THRESHOLD"]):
        print(f"[COT BLOCK] {pair} {signal} — institutions opposing direction")
        return

    entry_price = ask if signal == "long" else bid
    pip_size = risk.get_pip_size(pair)
    sl_pips = risk.calculate_sl_pips(candles[-1], cfg["SL_MULTIPLIER"], pip_size)
    sl, tp = risk.calculate_sl_tp_prices(entry_price, signal, sl_pips, cfg["RR_RATIO"], pip_size)
    pip_val = broker.get_pip_value_per_lot(pair)
    balance = broker.get_balance()
    lot = risk.calculate_lot_size(balance, cfg["RISK_PER_TRADE"], sl_pips, pip_val, cfg["MAX_LOT_SIZE"])

    import json as _json
    ticket = broker.place_order(pair, signal, lot, sl, tp)
    if ticket:
        entry_dt = now.isoformat()
        db.log_trade(cfg["DB_PATH"], {
            "pair": pair, "direction": signal, "entry_price": entry_price,
            "sl": sl, "tp": tp, "lot_size": lot, "entry_time": entry_dt,
            "spread_at_entry": spread,
            "candle_body_ratio": strategy.get_candle_body_ratio(candles[-1]),
            "sentiment_bias": _json.dumps(sentiment_bias),
            "cot_bias": "{}",
            "news_blocked": 0
        })
        print(f"[TRADE] {signal.upper()} {pair} @ {entry_price:.5f} | SL:{sl:.5f} TP:{tp:.5f} | Lot:{lot}")
```

- [ ] **Step 4: Run all tests**

```bash
pytest tests/ -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add bot.py
git commit -m "feat: wire calendar, sentiment, and COT macro filters into trading loop"
```

---

## Phase 3: Self-Learning Loop (Tasks 12–14)

---

### Task 12: Parameter Tuner — Layer 1 (`learner.py`)

**Files:**
- Create: `trading-robot/learner.py`
- Create: `trading-robot/tests/test_learner.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_learner.py
import pytest, json, tempfile
from pathlib import Path

def make_trade(pnl, body_ratio, spread, hour, pair="EURUSD", day=0):
    return {
        "pair": pair, "direction": "long", "entry_price": 1.085,
        "pnl_usd": pnl, "exit_reason": "tp_hit" if pnl > 0 else "sl_hit",
        "candle_body_ratio": body_ratio, "spread_at_entry": spread,
        "entry_time": f"2026-04-{14+day:02d}T{hour:02d}:05:00",
    }

@pytest.fixture
def mixed_trades():
    wins = [make_trade(20, 0.75, 0.8, 14) for _ in range(15)]
    losses = [make_trade(-15, 0.55, 1.8, 14) for _ in range(10)]
    return wins + losses

def test_tune_raises_body_ratio_when_losses_have_low_ratio(mixed_trades):
    from learner import tune_parameters
    base = {"BODY_RATIO_MIN": 0.60, "SPREAD_LIMIT_PIPS": 2.0, "TIME_EXIT_MINUTES": 15}
    result = tune_parameters(mixed_trades, base)
    # Losses have avg body_ratio=0.55, wins=0.75 → should suggest raising minimum
    assert result["BODY_RATIO_MIN"] > base["BODY_RATIO_MIN"]

def test_tune_lowers_spread_limit_when_losses_have_high_spread(mixed_trades):
    from learner import tune_parameters
    base = {"BODY_RATIO_MIN": 0.60, "SPREAD_LIMIT_PIPS": 2.0, "TIME_EXIT_MINUTES": 15}
    result = tune_parameters(mixed_trades, base)
    # Losses have avg spread=1.8 → suggest tightening spread limit
    assert result["SPREAD_LIMIT_PIPS"] < base["SPREAD_LIMIT_PIPS"]

def test_apply_bounds_clamps_body_ratio():
    from learner import apply_param_bounds
    params = {"BODY_RATIO_MIN": 0.90, "SPREAD_LIMIT_PIPS": 2.0, "TIME_EXIT_MINUTES": 15}
    bounded = apply_param_bounds(params)
    assert bounded["BODY_RATIO_MIN"] <= 0.80

def test_apply_bounds_clamps_spread_limit():
    from learner import apply_param_bounds
    params = {"BODY_RATIO_MIN": 0.60, "SPREAD_LIMIT_PIPS": 0.3, "TIME_EXIT_MINUTES": 15}
    bounded = apply_param_bounds(params)
    assert bounded["SPREAD_LIMIT_PIPS"] >= 1.0

def test_tune_requires_minimum_samples():
    from learner import tune_parameters
    base = {"BODY_RATIO_MIN": 0.60, "SPREAD_LIMIT_PIPS": 2.0, "TIME_EXIT_MINUTES": 15}
    few_trades = [make_trade(20, 0.80, 0.5, 14) for _ in range(3)]
    result = tune_parameters(few_trades, base)
    # Not enough samples — should return base unchanged
    assert result == base
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_learner.py -k "tune or bounds" -v
```
Expected: `ModuleNotFoundError: No module named 'learner'`

- [ ] **Step 3: Implement Layer 1 of `trading-robot/learner.py`**

```python
import json, statistics
from datetime import datetime, timezone
from pathlib import Path

PARAM_BOUNDS = {
    "BODY_RATIO_MIN":    (0.50, 0.80),
    "SPREAD_LIMIT_PIPS": (1.0,  3.0),
    "TIME_EXIT_MINUTES": (10,   30),
}
MIN_SAMPLES = 10

def _closed_trades(trades: list[dict]) -> list[dict]:
    return [t for t in trades if t.get("exit_time") or t.get("exit_reason")]

def tune_parameters(trades: list[dict], current_params: dict) -> dict:
    closed = _closed_trades(trades)
    wins = [t for t in closed if (t.get("pnl_usd") or 0) > 0]
    losses = [t for t in closed if (t.get("pnl_usd") or 0) <= 0]

    if len(wins) < MIN_SAMPLES or len(losses) < MIN_SAMPLES:
        return current_params

    new_params = dict(current_params)

    # Body ratio: raise minimum toward winning trades' average
    avg_win_ratio = statistics.mean(t["candle_body_ratio"] for t in wins)
    avg_loss_ratio = statistics.mean(t["candle_body_ratio"] for t in losses)
    if avg_win_ratio > avg_loss_ratio:
        new_params["BODY_RATIO_MIN"] = round(
            current_params["BODY_RATIO_MIN"] + (avg_win_ratio - avg_loss_ratio) * 0.1, 3
        )

    # Spread limit: lower toward winning trades' average spread
    avg_win_spread = statistics.mean(t["spread_at_entry"] for t in wins)
    avg_loss_spread = statistics.mean(t["spread_at_entry"] for t in losses)
    if avg_loss_spread > avg_win_spread:
        new_params["SPREAD_LIMIT_PIPS"] = round(
            current_params["SPREAD_LIMIT_PIPS"] - (avg_loss_spread - avg_win_spread) * 0.2, 2
        )

    return apply_param_bounds(new_params)

def apply_param_bounds(params: dict) -> dict:
    result = dict(params)
    for key, (lo, hi) in PARAM_BOUNDS.items():
        if key in result:
            result[key] = max(lo, min(hi, result[key]))
    return result

def write_learned_params(params: dict, path: str) -> None:
    Path(path).write_text(json.dumps(params, indent=2))
```

- [ ] **Step 4: Run Layer 1 tests**

```bash
pytest tests/test_learner.py -k "tune or bounds" -v
```
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add learner.py tests/test_learner.py
git commit -m "feat: post-session parameter tuner (Layer 1 self-learning)"
```

---

### Task 13: Blacklist Builder — Layer 2 (`learner.py` additions)

**Files:**
- Modify: `trading-robot/learner.py`
- Modify: `trading-robot/tests/test_learner.py`

- [ ] **Step 1: Write failing tests (append to test_learner.py)**

```python
# Append to tests/test_learner.py

def test_blacklist_adds_losing_pattern():
    from learner import analyze_blacklist_candidates, update_blacklist
    # 25 trades: GBPUSD, Friday (day=4), hour=16, all losses
    trades = [make_trade(-15, 0.65, 1.0, 16, pair="GBPUSD", day=4) for _ in range(25)]
    candidates = analyze_blacklist_candidates(trades)
    bl = update_blacklist(candidates, {})
    keys = list(bl.keys())
    assert any("GBPUSD" in k and "16" in k for k in keys)

def test_blacklist_does_not_add_insufficient_samples():
    from learner import analyze_blacklist_candidates, update_blacklist
    trades = [make_trade(-15, 0.65, 1.0, 14, pair="EURUSD", day=1) for _ in range(5)]
    candidates = analyze_blacklist_candidates(trades)
    bl = update_blacklist(candidates, {})
    assert bl == {}

def test_blacklist_does_not_add_high_win_rate():
    from learner import analyze_blacklist_candidates, update_blacklist
    wins = [make_trade(20, 0.75, 0.8, 14, pair="EURUSD") for _ in range(18)]
    losses = [make_trade(-15, 0.55, 1.8, 14, pair="EURUSD") for _ in range(5)]
    candidates = analyze_blacklist_candidates(wins + losses)
    bl = update_blacklist(candidates, {})
    # win rate > 40% — should not be blacklisted
    assert bl == {}

def test_blacklist_expiry(tmp_path):
    from learner import expire_blacklist_entries
    old_entry = {"added": "2025-01-01", "win_rate": 0.25, "count": 22}
    recent_entry = {"added": "2026-04-01", "win_rate": 0.30, "count": 22}
    bl = {"GBPUSD_16_4": old_entry, "EURUSD_14_1": recent_entry}
    pruned = expire_blacklist_entries(bl, ttl_days=60)
    assert "GBPUSD_16_4" not in pruned
    assert "EURUSD_14_1" in pruned

def test_is_blacklisted():
    from learner import is_blacklisted
    bl = {"GBPUSD_16_4": {"added": "2026-04-01", "win_rate": 0.25, "count": 22}}
    # Friday (weekday=4), hour=16
    entry_time = "2026-04-18T16:05:00"  # 2026-04-18 is Saturday, so use a Friday
    entry_time = "2026-04-17T16:05:00"  # Friday
    assert is_blacklisted("GBPUSD", entry_time, bl) is True
    assert is_blacklisted("EURUSD", entry_time, bl) is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_learner.py -k "blacklist" -v
```
Expected: tests fail (functions not defined)

- [ ] **Step 3: Append Layer 2 to `trading-robot/learner.py`**

```python
# Append to learner.py

BLACKLIST_MIN_SAMPLES = 20
BLACKLIST_MAX_WIN_RATE = 0.40

def analyze_blacklist_candidates(trades: list[dict]) -> list[dict]:
    from collections import defaultdict
    groups = defaultdict(list)
    for t in _closed_trades(trades):
        if not t.get("entry_time"):
            continue
        dt = datetime.fromisoformat(t["entry_time"])
        key = f"{t['pair']}_{dt.hour}_{dt.weekday()}"
        groups[key].append(t)

    candidates = []
    for key, group in groups.items():
        if len(group) < BLACKLIST_MIN_SAMPLES:
            continue
        wins = sum(1 for t in group if (t.get("pnl_usd") or 0) > 0)
        win_rate = wins / len(group)
        if win_rate < BLACKLIST_MAX_WIN_RATE:
            candidates.append({"key": key, "win_rate": win_rate, "count": len(group)})
    return candidates

def update_blacklist(candidates: list[dict], existing: dict) -> dict:
    result = dict(existing)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for c in candidates:
        result[c["key"]] = {"added": today, "win_rate": c["win_rate"], "count": c["count"]}
    return result

def expire_blacklist_entries(blacklist: dict, ttl_days: int) -> dict:
    cutoff = datetime.now(timezone.utc)
    result = {}
    for key, entry in blacklist.items():
        added = datetime.fromisoformat(entry["added"]).replace(tzinfo=timezone.utc)
        age_days = (cutoff - added).days
        if age_days <= ttl_days:
            result[key] = entry
    return result

def is_blacklisted(symbol: str, entry_time_str: str, blacklist: dict) -> bool:
    dt = datetime.fromisoformat(entry_time_str)
    key = f"{symbol}_{dt.hour}_{dt.weekday()}"
    return key in blacklist

def write_blacklist(blacklist: dict, path: str) -> None:
    Path(path).write_text(json.dumps(blacklist, indent=2))

def run_post_session(db_path: str, learned_params_path: str, blacklist_path: str,
                     current_params: dict, ttl_days: int = 60) -> None:
    from db import get_recent_trades
    trades = get_recent_trades(db_path, 100)

    # Layer 1: parameter tuning
    new_params = tune_parameters(trades, current_params)
    write_learned_params(new_params, learned_params_path)
    print(f"[LEARNER] Updated params: {new_params}")

    # Layer 2: blacklist update
    existing = json.loads(Path(blacklist_path).read_text()) if Path(blacklist_path).exists() else {}
    candidates = analyze_blacklist_candidates(trades)
    updated = update_blacklist(candidates, existing)
    pruned = expire_blacklist_entries(updated, ttl_days)
    write_blacklist(pruned, blacklist_path)
    print(f"[LEARNER] Blacklist entries: {len(pruned)}")
```

- [ ] **Step 4: Run all learner tests**

```bash
pytest tests/test_learner.py -v
```
Expected: all 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add learner.py tests/test_learner.py
git commit -m "feat: blacklist builder with TTL expiry (Layer 2 self-learning)"
```

---

### Task 14: Claude Reflection — Layer 3 (`reflector.py`)

**Files:**
- Create: `trading-robot/reflector.py`

No unit tests — the reflection output is prose + JSON validated structurally, not by fixed expected values. Test manually by running against real trade data.

- [ ] **Step 1: Create `trading-robot/reflector.py`**

```python
import json, os, subprocess
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import anthropic

load_dotenv()

def load_reflection_context(db_path: str, config_path: str,
                             learned_config_path: str, notes_path: str,
                             learned_params_path: str, blacklist_path: str) -> str:
    from db import get_recent_trades
    trades = get_recent_trades(db_path, 200)

    # Last 7 days only
    cutoff = datetime.now(timezone.utc)
    recent = [
        t for t in trades
        if t.get("entry_time") and
        (cutoff - datetime.fromisoformat(t["entry_time"]).replace(tzinfo=timezone.utc)).days <= 7
    ]

    closed = [t for t in recent if t.get("exit_reason")]
    wins = [t for t in closed if (t.get("pnl_usd") or 0) > 0]
    total_pnl = sum(t.get("pnl_usd") or 0 for t in closed)
    win_rate = round(len(wins) / len(closed) * 100, 1) if closed else 0

    import importlib.util, sys as _sys
    spec = importlib.util.spec_from_file_location("config_mod", config_path)
    cfg_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cfg_mod)
    base_config = {k: getattr(cfg_mod, k) for k in dir(cfg_mod) if k.isupper()}

    learned_config = {}
    if Path(learned_config_path).exists():
        learned_config = json.loads(Path(learned_config_path).read_text())

    effective_config = {**base_config, **learned_config}
    notes = Path(notes_path).read_text() if Path(notes_path).exists() else "(none)"
    learned_params = json.loads(Path(learned_params_path).read_text()) if Path(learned_params_path).exists() else {}
    blacklist = json.loads(Path(blacklist_path).read_text()) if Path(blacklist_path).exists() else {}

    sample_trades = json.dumps(closed[-20:], indent=2, default=str)

    return f"""# Trading Robot Reflection Context

## Performance (last 7 days)
- Total closed trades: {len(closed)}
- Win rate: {win_rate}%
- Total PnL: ${total_pnl:.2f}
- Wins: {len(wins)} | Losses: {len(closed) - len(wins)}

## Prior Strategy Notes
{notes}

## Current Effective Config
```json
{json.dumps(effective_config, indent=2, default=str)}
```

## Auto-Tuned Params
```json
{json.dumps(learned_params, indent=2)}
```

## Active Blacklist ({len(blacklist)} entries)
```json
{json.dumps(blacklist, indent=2)}
```

## Last 20 Closed Trades
```json
{sample_trades}
```
"""

def run_reflection(client, context: str) -> dict:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": (
                "You are the strategy brain of a Forex scalping bot. "
                "Analyse the performance data below and provide:\n\n"
                "1. A `strategy_notes` field (markdown, 200-400 words): "
                "key observations, what patterns you see in wins vs losses, "
                "what the bot should pay attention to this session.\n\n"
                "2. A `learned_config` field (JSON object): parameter overrides "
                "you recommend. You may change ANY parameter from the effective config "
                "including PAIRS, RISK_PER_TRADE, DAILY_LOSS_LIMIT, RR_RATIO, "
                "EMA_PERIOD, SESSION_START_UTC, SESSION_END_UTC, or any other. "
                "Only include parameters you want to change — omit unchanged ones.\n\n"
                "Respond in this exact JSON format:\n"
                '{"strategy_notes": "...", "learned_config": {...}}\n\n'
                f"{context}"
            )
        }]
    )
    raw = message.content[0].text.strip()
    # Strip markdown code block if present
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
        if raw.endswith("```"):
            raw = raw[:-3]
    return json.loads(raw.strip())

def write_reflection_outputs(notes: str, config_overrides: dict,
                             notes_path: str, learned_config_path: str) -> None:
    Path(notes_path).write_text(notes)
    Path(learned_config_path).write_text(json.dumps(config_overrides, indent=2))
    print(f"[REFLECTOR] strategy_notes updated ({len(notes)} chars)")
    print(f"[REFLECTOR] learned_config: {config_overrides}")

def commit_reflection() -> None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    subprocess.run(["git", "add", "strategy_notes.md", "learned_config.json"], check=False)
    subprocess.run(
        ["git", "commit", "-m", f"chore: nightly reflection {today}"],
        check=False
    )

def main():
    import config
    client = anthropic.Anthropic()
    context = load_reflection_context(
        db_path=config.DB_PATH,
        config_path="config.py",
        learned_config_path=config.LEARNED_CONFIG_PATH,
        notes_path=config.STRATEGY_NOTES_PATH,
        learned_params_path=config.LEARNED_PARAMS_PATH,
        blacklist_path=config.BLACKLIST_PATH,
    )
    result = run_reflection(client, context)
    write_reflection_outputs(
        notes=result["strategy_notes"],
        config_overrides=result["learned_config"],
        notes_path=config.STRATEGY_NOTES_PATH,
        learned_config_path=config.LEARNED_CONFIG_PATH,
    )
    commit_reflection()
    print("[REFLECTOR] Nightly reflection complete.")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Integrate `run_post_session` into `bot.py`**

At the end of `run_session()`, after `broker.disconnect()`, add:
```python
    # Post-session learning (Layer 1 + Layer 2)
    import learner
    import config as _config
    effective_params = {k: cfg[k] for k in learner.PARAM_BOUNDS if k in cfg}
    learner.run_post_session(
        db_path=cfg["DB_PATH"],
        learned_params_path=cfg["LEARNED_PARAMS_PATH"],
        blacklist_path=cfg["BLACKLIST_PATH"],
        current_params=effective_params,
        ttl_days=cfg["BLACKLIST_TTL_DAYS"],
    )
```

- [ ] **Step 3: Run full test suite**

```bash
pytest tests/ -v
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add reflector.py bot.py
git commit -m "feat: Claude nightly reflection (Layer 3) and post-session learner integration"
```

---

## Phase 4: Deployment (Task 15)

---

### Task 15: Deployment — Systemd + Cron

**Files:**
- Create: `trading-robot/trading_robot.service`
- Create: `trading-robot/setup.bat` (Windows setup script)

- [ ] **Step 1: Create `trading-robot/trading_robot.service`**

```ini
[Unit]
Description=Forex Trading Robot
After=network.target

[Service]
Type=simple
WorkingDirectory=C:/trading-robot
ExecStart=C:/Python311/python.exe bot.py
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

*Note: On Windows, use NSSM (Non-Sucking Service Manager) to run Python scripts as services:*
```
nssm install TradingRobot "C:\Python311\python.exe" "C:\trading-robot\bot.py"
nssm set TradingRobot AppDirectory C:\trading-robot
nssm start TradingRobot
```

- [ ] **Step 2: Create `trading-robot/setup.bat`**

```batch
@echo off
echo Installing trading robot dependencies...
pip install -r requirements.txt
if not exist .env (
    copy .env.example .env
    echo Created .env — fill in your MT5 credentials and API keys
)
if not exist trading_robot.db (
    python -c "import config; import db; db.init_db(config.DB_PATH); print('DB initialized')"
)
echo Setup complete.
```

- [ ] **Step 3: Add cron entries for reflector and COT download**

On the Windows Task Scheduler (or Linux cron if running reflector on Linux):

```
# Nightly Claude reflection — midnight UTC
0 0 * * * cd C:\trading-robot && python reflector.py >> logs/reflector.log 2>&1

# COT data download — Saturday 08:00 UTC
0 8 * * 6 cd C:\trading-robot && python -c "import cot, config; raw = cot.download_cot_csv(); records = cot.parse_cot_data(raw); cot.save_cot_snapshots(config.DB_PATH, records); print(f'COT: {len(records)} records saved')" >> logs/cot.log 2>&1
```

- [ ] **Step 4: Create `.gitignore`**

```
.env
trading_robot.db
learned_config.json
learned_params.json
blacklist.json
strategy_notes.md
logs/
__pycache__/
*.pyc
```

- [ ] **Step 5: Run final test suite and commit**

```bash
pytest tests/ -v
```
Expected: all tests PASS

```bash
git add trading_robot.service setup.bat .gitignore
git commit -m "feat: deployment config, systemd service, cron setup for reflector and COT"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| MT5 Python connection | Task 4 (broker.py) |
| Price action + 20 EMA signal | Task 5 (strategy.py) |
| 1% per-trade risk sizing | Task 6 (risk.py) |
| 3% daily hard stop | Task 6 (risk.py) + Task 7 (bot.py) |
| Max 3 concurrent trades | Task 7 (bot.py) |
| Spread filter (2.0 pips) | Task 7 (bot.py) |
| Late session cutoff (16:50) | Task 3 (session.py) + Task 7 |
| Time exit (15 min) | Task 7 (bot.py) |
| SL/TP 1:1.5 R:R | Task 6 (risk.py) |
| Trade journal + session summary | Task 2 (db.py) + Task 7 |
| Economic calendar blocking | Task 8 (news.py) |
| News sentiment filter | Task 9 (news.py) |
| COT institutional filter | Task 10 (cot.py) |
| Blacklist in bot entry check | Task 13 — ⚠️ **gap: blacklist not checked in bot.py** |
| Parameter tuner post-session | Task 12 (learner.py) + Task 14 (bot.py integration) |
| Blacklist builder post-session | Task 13 (learner.py) + Task 14 |
| Claude nightly reflection | Task 14 (reflector.py) |
| learned_config.json overrides | Task 7 (load_effective_config) |
| Deployment + cron | Task 15 |

**Gap fix — blacklist not checked in entry evaluation:**

In Task 13's integration, `is_blacklisted` must be called in `_evaluate_and_trade` in `bot.py`. Add this after the COT block check (Task 11, Step 3):

```python
    # Self-learning filter: blacklist check
    import learner as _learner
    from pathlib import Path as _Path
    blacklist = json.loads(_Path(cfg["BLACKLIST_PATH"]).read_text()) if _Path(cfg["BLACKLIST_PATH"]).exists() else {}
    entry_time_str = datetime.now(timezone.utc).isoformat()
    if _learner.is_blacklisted(pair, entry_time_str, blacklist):
        print(f"[BLACKLIST] {pair} at this hour/day is blocked")
        return
```

Add this as a step in Task 13 (Step 3.5) before the commit.
