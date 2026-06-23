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


def validate_order(symbol, qty, side, current_price, account_value, current_positions, watchlist, cash_reserve_pct=0.80):
    if side == "sell":
        return True, "Order validated"

    if account_value <= 0:
        return False, "Cannot validate order: account value is zero or negative"

    order_value = qty * current_price

    # Per-symbol allocation cap (always checked first)
    allocation_pct = (order_value / account_value) * 100
    symbol_max = next(
        (w["max_allocation_pct"] for w in watchlist if w["symbol"] == symbol), 5
    )
    if allocation_pct > symbol_max:
        return False, f"Order exceeds {symbol_max}% allocation limit: {allocation_pct:.1f}%"

    # Cash reserve: total invested + this order must leave >= 20% cash
    total_invested = sum(float(p.get("market_value", 0)) for p in current_positions)
    if (total_invested + order_value) / account_value > cash_reserve_pct:
        return False, "Order would violate 20% cash reserve requirement"

    return True, "Order validated"


def get_market_status():
    headers = {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
    }
    response = requests.get(f"{ALPACA_BASE_URL}/v2/clock", headers=headers)
    response.raise_for_status()
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

    try:
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
            cash_reserve_pct = wl.get("cash_reserve_pct", 20) / 100
            valid, msg = validate_order(
                symbol, qty, side, limit_price,
                portfolio["total_value"],
                portfolio["positions"],
                wl["watchlist"],
                cash_reserve_pct=cash_reserve_pct,
            )
            if not valid:
                print(json.dumps({"error": msg, "order_placed": False}))
                sys.exit(0)

            result = place_order(symbol, qty, side, limit_price)
            if result is None:
                print(json.dumps({"error": "Robinhood rejected the order (returned None)", "order_placed": False}))
                sys.exit(1)
            print(json.dumps({**result, "order_placed": True}))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
