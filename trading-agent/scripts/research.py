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
    if not ALPACA_KEY or not ALPACA_SECRET:
        raise RuntimeError("APCA_API_KEY_ID and APCA_API_SECRET_KEY must be set in .env")
    url = f"{DATA_URL}/v2/stocks/{symbol}/bars"
    params = {"timeframe": timeframe, "limit": limit, "adjustment": "raw"}
    response = requests.get(url, headers=_headers(), params=params)
    response.raise_for_status()
    return response.json()


def get_news(symbol):
    if not ALPACA_KEY or not ALPACA_SECRET:
        raise RuntimeError("APCA_API_KEY_ID and APCA_API_SECRET_KEY must be set in .env")
    url = f"{DATA_URL}/v1beta1/news"
    params = {"symbols": symbol, "limit": 5, "sort": "desc"}
    response = requests.get(url, headers=_headers(), params=params)
    response.raise_for_status()
    return response.json()


def calculate_ma(bars, period):
    closes = [bar["c"] for bar in bars.get("bars", [])]
    if len(closes) < period:
        return None
    return sum(closes[-period:]) / period


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "bars"
    symbol = sys.argv[2] if len(sys.argv) > 2 else "SPY"

    try:
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
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
