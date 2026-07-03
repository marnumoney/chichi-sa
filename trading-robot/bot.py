import json, os, time, sys, uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import anthropic
import config, broker, db, session, strategy, risk
import news as news_module
import cot as cot_module


def load_effective_config() -> dict:
    """Merge base config.py constants with any learned_config.json overrides."""
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
    """Close any trade open longer than TIME_EXIT_MINUTES with no profit."""
    now = datetime.now(timezone.utc)
    for pos in broker.get_open_positions():
        open_dt = datetime.fromtimestamp(pos["time"], tz=timezone.utc)
        minutes_open = (now - open_dt).total_seconds() / 60
        if minutes_open >= cfg["TIME_EXIT_MINUTES"] and pos["profit"] <= 0:
            broker.close_position(pos["ticket"])
            print(f"[TIME EXIT] {pos['symbol']} after {minutes_open:.0f} min")


L3_THRESHOLD_USD = 50.0


def _default_robot_trading_dirs():
    base = Path(os.environ.get("JARVIS_TRADING_DIR", str(Path.home() / "jarvis/runtime/trading")))
    return base / "pending", base / "approved", base / "rejected"


def l3_gate(pair, direction, lot, entry_price,
            pending_dir=None, approved_dir=None, rejected_dir=None, timeout=60):
    """Block long trades with notional value above $50 until Jarvis approves."""
    if direction in ("sell", "short"):
        return True
    notional = lot * 100_000 * entry_price  # standard forex: 1 lot = 100,000 units
    if notional <= L3_THRESHOLD_USD:
        return True

    if pending_dir is None:
        pending_dir, approved_dir, rejected_dir = _default_robot_trading_dirs()
    pending_dir = Path(pending_dir)
    approved_dir = Path(approved_dir)
    rejected_dir = Path(rejected_dir)

    trade_id = str(uuid.uuid4())
    (pending_dir / f"{trade_id}.json").write_text(json.dumps({
        "id": trade_id,
        "bot": "trading-robot",
        "symbol": pair,
        "action": direction,
        "qty": lot,
        "price": entry_price,
        "total": round(notional, 2),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }))

    deadline = time.time() + timeout
    while time.time() < deadline:
        if (approved_dir / f"{trade_id}.json").exists():
            return True
        if (rejected_dir / f"{trade_id}.json").exists():
            return False
        time.sleep(0.5)

    return False


def _evaluate_and_trade(
    pair: str, cfg: dict, sentiment_bias: dict,
    calendar_events: list, now: datetime
) -> None:
    try:
        candles = broker.get_candles(pair, cfg["EMA_PERIOD"] + 5)
    except RuntimeError:
        return

    signal = strategy.get_signal(candles, cfg["EMA_PERIOD"], cfg["BODY_RATIO_MIN"])
    if not signal:
        return

    try:
        bid, ask, spread = broker.get_tick(pair)
    except RuntimeError:
        return

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
    if sl_pips <= 0:
        return
    sl, tp = risk.calculate_sl_tp_prices(entry_price, signal, sl_pips, cfg["RR_RATIO"], pip_size)

    try:
        pip_val = broker.get_pip_value_per_lot(pair)
        balance = broker.get_balance()
    except RuntimeError:
        return

    lot = risk.calculate_lot_size(balance, cfg["RISK_PER_TRADE"], sl_pips, pip_val, cfg["MAX_LOT_SIZE"])

    if not l3_gate(pair, signal, lot, entry_price):
        print(f"[L3 REJECTED] {pair} {signal} — trade rejected or timed out")
        return

    ticket = broker.place_order(pair, signal, lot, sl, tp)
    if ticket:
        db.log_trade(cfg["DB_PATH"], {
            "pair": pair, "direction": signal, "entry_price": entry_price,
            "sl": sl, "tp": tp, "lot_size": lot, "entry_time": now.isoformat(),
            "spread_at_entry": spread,
            "candle_body_ratio": strategy.get_candle_body_ratio(candles[-1]),
            "sentiment_bias": json.dumps(sentiment_bias),
            "cot_bias": "{}",
            "news_blocked": 0
        })
        print(f"[TRADE] {signal.upper()} {pair} @ {entry_price:.5f} | SL:{sl:.5f} TP:{tp:.5f} | Lot:{lot}")


def run_session(cfg: dict) -> None:
    db.init_db(cfg["DB_PATH"])
    if not broker.connect():
        print("ERROR: Could not connect to MT5")
        return

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

        try:
            current_balance = broker.get_balance()
        except RuntimeError:
            current_balance = starting_balance

        if not daily_halt and risk.is_daily_halt(starting_balance, current_balance, cfg["DAILY_LOSS_LIMIT"]):
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
                        _evaluate_and_trade(pair, cfg, sentiment_bias, calendar_events, now)
                    except Exception as e:
                        print(f"[ERROR] {pair}: {e}")

        time.sleep(cfg["LOOP_INTERVAL_SECONDS"])

    try:
        current_balance = broker.get_balance()
    except RuntimeError:
        current_balance = starting_balance

    log_session_summary(cfg, starting_balance, current_balance)
    broker.disconnect()

    # Post-session learning (Layer 1 + Layer 2)
    import learner
    effective_params = {k: cfg[k] for k in learner.PARAM_BOUNDS if k in cfg}
    learner.run_post_session(
        db_path=cfg["DB_PATH"],
        learned_params_path=cfg["LEARNED_PARAMS_PATH"],
        blacklist_path=cfg["BLACKLIST_PATH"],
        current_params=effective_params,
        ttl_days=cfg["BLACKLIST_TTL_DAYS"],
    )


def main() -> None:
    cfg = load_effective_config()
    print("Trading Robot starting. Waiting for NY session (13:00–17:00 UTC)...")
    while True:
        now = datetime.now(timezone.utc)
        if session.is_ny_session(now):
            run_session(cfg)
        time.sleep(30)


if __name__ == "__main__":
    main()
