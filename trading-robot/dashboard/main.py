import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "trading_robot.db"

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_db():
    if not DB_PATH.exists():
        return None
    return sqlite3.connect(str(DB_PATH))


@app.get("/api/status")
def get_status():
    db = get_db()
    if db is None:
        return {"status": "db_not_found", "active_trades": 0, "today_pnl": 0.0}
    cur = db.cursor()
    active = cur.execute("SELECT COUNT(*) FROM trades WHERE exit_time IS NULL").fetchone()[0]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    pnl = cur.execute(
        "SELECT SUM(pnl_usd) FROM trades WHERE exit_time LIKE ? AND pnl_usd IS NOT NULL",
        (f"{today}%",),
    ).fetchone()[0] or 0.0
    db.close()
    return {"status": "running", "active_trades": active, "today_pnl": round(pnl, 2)}


@app.get("/api/positions")
def get_positions():
    db = get_db()
    if db is None:
        return []
    db.row_factory = sqlite3.Row
    rows = db.execute(
        "SELECT pair, direction, entry_price, sl, tp, lot_size, entry_time "
        "FROM trades WHERE exit_time IS NULL"
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/api/trades/today")
def get_today_trades():
    db = get_db()
    if db is None:
        return []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    db.row_factory = sqlite3.Row
    rows = db.execute(
        "SELECT pair, direction, entry_price, exit_price, pnl_usd, lot_size, entry_time, exit_time "
        "FROM trades WHERE entry_time LIKE ? ORDER BY entry_time DESC",
        (f"{today}%",),
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/api/pnl/week")
def get_week_pnl():
    db = get_db()
    if db is None:
        return []
    db.row_factory = sqlite3.Row
    rows = db.execute(
        "SELECT DATE(exit_time) as date, SUM(pnl_usd) as pnl "
        "FROM trades WHERE exit_time IS NOT NULL AND pnl_usd IS NOT NULL "
        "AND exit_time >= date('now', '-7 days') "
        "GROUP BY DATE(exit_time) ORDER BY date"
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/", include_in_schema=False)
@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str = ""):
    return FileResponse(Path(__file__).parent / "index.html")
