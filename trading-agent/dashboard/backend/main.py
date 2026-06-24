import json
import os
import subprocess
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).parent.parent.parent  # trading-agent/
load_dotenv(BASE_DIR / ".env")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/portfolio")
def get_portfolio():
    result = subprocess.run(
        [sys.executable, "scripts/trade.py", "portfolio"],
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=502, detail=result.stderr or "trade.py failed")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"trade.py returned invalid JSON: {e}")


@app.get("/journal")
def list_journal():
    journal_dir = BASE_DIR / "journal"
    dates = sorted(
        [f.stem for f in journal_dir.glob("*.md") if f.stem != "summary"],
        reverse=True,
    )
    return {"dates": dates}


@app.get("/journal/{date}")
def get_journal_entry(date: str):
    path = BASE_DIR / "journal" / f"{date}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return {"date": date, "content": path.read_text()}


@app.get("/watchlist")
def get_watchlist():
    path = BASE_DIR / "watchlist.json"
    return json.loads(path.read_text())


@app.put("/watchlist")
def update_watchlist(body: dict):
    watchlist = body.get("watchlist", [])
    total = sum(float(w.get("max_allocation_pct", 0)) for w in watchlist)
    if total > 80:
        raise HTTPException(
            status_code=400,
            detail=f"Total allocation {total:.1f}% exceeds 80% limit"
        )
    path = BASE_DIR / "watchlist.json"
    path.write_text(json.dumps(body, indent=2))
    return body


@app.get("/market")
def get_market():
    result = subprocess.run(
        [sys.executable, "scripts/trade.py", "status"],
        cwd=BASE_DIR, capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=502, detail=result.stderr or "status failed")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"invalid JSON: {e}")


def _alpaca_headers():
    return {
        "APCA-API-KEY-ID": os.getenv("APCA_API_KEY_ID", ""),
        "APCA-API-SECRET-KEY": os.getenv("APCA_API_SECRET_KEY", ""),
    }


@app.get("/orders")
def get_orders():
    base = os.getenv("APCA_BASE_URL", "https://paper-api.alpaca.markets")
    try:
        resp = httpx.get(
            f"{base}/v2/orders",
            params={"status": "all", "limit": 25, "direction": "desc"},
            headers=_alpaca_headers(),
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca orders failed: {e}")
    return resp.json()


@app.get("/news")
def get_news():
    watchlist_path = BASE_DIR / "watchlist.json"
    watchlist = json.loads(watchlist_path.read_text())
    symbols = [w["symbol"] for w in watchlist.get("watchlist", [])]
    if not symbols:
        return []
    try:
        resp = httpx.get(
            "https://data.alpaca.markets/v1beta1/news",
            params={"symbols": ",".join(symbols), "limit": 20, "sort": "desc"},
            headers=_alpaca_headers(),
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca news failed: {e}")
    data = resp.json()
    return data.get("news", []) if isinstance(data, dict) else data


@app.get("/history")
def get_history():
    base = os.getenv("APCA_BASE_URL", "https://paper-api.alpaca.markets")
    try:
        resp = httpx.get(
            f"{base}/v2/account/portfolio/history",
            params={"period": "1M", "timeframe": "1D", "intraday_reporting": "market_hours"},
            headers=_alpaca_headers(),
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca history failed: {e}")
    return resp.json()


@app.get("/prices")
def get_prices():
    watchlist_path = BASE_DIR / "watchlist.json"
    watchlist = json.loads(watchlist_path.read_text())
    symbols = [w["symbol"] for w in watchlist.get("watchlist", [])]
    if not symbols:
        return {}

    try:
        resp = httpx.get(
            "https://data.alpaca.markets/v2/stocks/snapshots",
            params={"symbols": ",".join(symbols), "feed": "iex"},
            headers=_alpaca_headers(),
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca snapshot failed: {e}")

    data = resp.json()
    result = {}
    for sym, snap in data.items():
        trade = snap.get("latestTrade", {})
        quote = snap.get("latestQuote", {})
        bar = snap.get("dailyBar", {})
        prev = snap.get("prevDailyBar", {})

        price = trade.get("p") or bar.get("c")
        prev_close = prev.get("c")
        change_pct = (price - prev_close) / prev_close * 100 if price and prev_close else None

        result[sym] = {
            "price": price,
            "change_pct": change_pct,
            "open": bar.get("o"),
            "high": bar.get("h"),
            "low": bar.get("l"),
            "volume": bar.get("v"),
            "bid": quote.get("bp"),
            "ask": quote.get("ap"),
        }
    return result
