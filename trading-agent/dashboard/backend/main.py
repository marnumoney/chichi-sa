import json
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent.parent.parent  # trading-agent/


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
