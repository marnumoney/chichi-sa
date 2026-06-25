import os
import json
import sys
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


def load_config(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    with open(path) as f:
        return json.load(f)


ALPACA_KEY = os.getenv("APCA_API_KEY_ID")
ALPACA_SECRET = os.getenv("APCA_API_SECRET_KEY")
ALPACA_BASE_URL = os.getenv("APCA_BASE_URL", "https://paper-api.alpaca.markets")


def _headers():
    return {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
    }


def validate_order(symbol, qty, side, current_price, account_value, current_positions, watchlist, cash_reserve_pct=0.80, max_default_allocation_pct=5):
    if side == "sell":
        return True, "Order validated"

    if account_value <= 0:
        return False, "Cannot validate order: account value is zero or negative"

    order_value = qty * current_price

    # Per-symbol allocation cap (always checked first)
    allocation_pct = (order_value / account_value) * 100
    symbol_max = next(
        (w["max_allocation_pct"] for w in watchlist if w["symbol"] == symbol), max_default_allocation_pct
    )
    if allocation_pct > symbol_max:
        return False, f"Order exceeds {symbol_max}% allocation limit: {allocation_pct:.1f}%"

    # Cash reserve: total invested + this order must leave >= cash_reserve_pct cash
    total_invested = sum(float(p.get("market_value", 0)) for p in current_positions)
    if (total_invested + order_value) / account_value > cash_reserve_pct:
        return False, f"Order would violate {round((1 - cash_reserve_pct) * 100)}% cash reserve requirement"

    return True, "Order validated"


def get_market_status():
    response = requests.get(f"{ALPACA_BASE_URL}/v2/clock", headers=_headers())
    response.raise_for_status()
    return response.json()


def get_portfolio():
    account_resp = requests.get(f"{ALPACA_BASE_URL}/v2/account", headers=_headers())
    account_resp.raise_for_status()
    account = account_resp.json()

    positions_resp = requests.get(f"{ALPACA_BASE_URL}/v2/positions", headers=_headers())
    positions_resp.raise_for_status()
    raw_positions = positions_resp.json()

    positions = [
        {
            "symbol": p["symbol"],
            "qty": float(p["qty"]),
            "avg_entry_price": float(p["avg_entry_price"]),
            "current_price": float(p["current_price"]),
            "market_value": float(p["market_value"]),
            "unrealized_plpc": float(p["unrealized_plpc"]),
        }
        for p in raw_positions
    ]

    return {
        "cash": float(account["cash"]),
        "positions": positions,
        "total_value": float(account["portfolio_value"]),
    }


def place_order(symbol, qty, side, limit_price):
    payload = {
        "symbol": symbol,
        "qty": str(qty),
        "side": side,
        "type": "limit",
        "time_in_force": "day",
        "limit_price": str(limit_price),
    }
    response = requests.post(
        f"{ALPACA_BASE_URL}/v2/orders",
        headers=_headers(),
        json=payload,
    )
    response.raise_for_status()
    return response.json()


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

            config = load_config()
            portfolio = get_portfolio()
            invest_cap = 1.0 - (config["cash_reserve_pct"] / 100)
            max_default_allocation_pct = config["max_default_allocation_pct"]
            valid, msg = validate_order(
                symbol, qty, side, limit_price,
                portfolio["total_value"],
                portfolio["positions"],
                wl["watchlist"],
                cash_reserve_pct=invest_cap,
                max_default_allocation_pct=max_default_allocation_pct,
            )
            if not valid:
                print(json.dumps({"error": msg, "order_placed": False}))
                sys.exit(0)

            result = place_order(symbol, qty, side, limit_price)
            print(json.dumps({**result, "order_placed": True}))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
