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
