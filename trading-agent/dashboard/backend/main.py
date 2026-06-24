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


@app.get("/prices")
def get_prices():
    watchlist_path = BASE_DIR / "watchlist.json"
    watchlist = json.loads(watchlist_path.read_text())
    symbols = [w["symbol"] for w in watchlist.get("watchlist", [])]
    if not symbols:
        return {}

    key = os.getenv("APCA_API_KEY_ID", "")
    secret = os.getenv("APCA_API_SECRET_KEY", "")
    url = "https://data.alpaca.markets/v2/stocks/snapshots"
    params = {"symbols": ",".join(symbols), "feed": "iex"}
    headers = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}

    try:
        resp = httpx.get(url, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca snapshot failed: {e}")

    data = resp.json()
    result = {}
    for sym, snap in data.items():
        price = snap.get("latestTrade", {}).get("p") or snap.get("dailyBar", {}).get("c")
        prev_close = snap.get("prevDailyBar", {}).get("c")
        change_pct = (price - prev_close) / prev_close * 100 if price and prev_close else None
        result[sym] = {"price": price, "change_pct": change_pct}
    return result
