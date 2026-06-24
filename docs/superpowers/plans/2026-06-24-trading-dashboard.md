# Trading Agent Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + FastAPI dashboard with Portfolio, Journal Browser, and Watchlist Manager views backed by live Alpaca data and local markdown files.

**Architecture:** FastAPI backend (5 REST endpoints) calls existing trade.py scripts via subprocess for live data and reads journal/ + watchlist.json directly. React frontend (Vite) proxies to the backend in dev mode and renders three views in a tab-based SPA. No database — all state lives in files already on disk.

**Tech Stack:** Python 3.12 · FastAPI 0.111 · uvicorn · pytest · React 18 · Vite 5 · marked (markdown) · DOMPurify (XSS sanitization) · plain CSS

---

## File Structure

```
trading-agent/
└── dashboard/
    ├── backend/
    │   ├── main.py                 # FastAPI app: all 5 endpoints
    │   ├── requirements.txt        # fastapi, uvicorn[standard], httpx, pytest
    │   └── tests/
    │       ├── __init__.py
    │       └── test_main.py        # TestClient tests for all endpoints
    └── frontend/
        ├── package.json            # react, react-dom, vite, marked, dompurify
        ├── vite.config.js          # dev server on :3000, proxy to :8000
        ├── index.html              # HTML shell
        └── src/
            ├── main.jsx            # ReactDOM.createRoot → <App />
            ├── App.jsx             # Tab nav: Portfolio | Journal | Watchlist
            ├── api.js              # fetch wrappers for all 5 endpoints
            ├── index.css           # dark theme layout + component styles
            └── components/
                ├── Portfolio.jsx   # Cash + positions table + total value
                ├── Journal.jsx     # Date list (left) + markdown viewer (right)
                └── Watchlist.jsx   # Editable allocation table + save button
```

---

### Task 1: Backend scaffold and /portfolio endpoint

**Files:**
- Create: `trading-agent/dashboard/backend/requirements.txt`
- Create: `trading-agent/dashboard/backend/tests/__init__.py`
- Create: `trading-agent/dashboard/backend/tests/test_main.py`
- Create: `trading-agent/dashboard/backend/main.py`

- [ ] **Step 1: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
httpx==0.27.0
pytest==7.4.0
```

Install:
```bash
pip3 install --user --break-system-packages fastapi "uvicorn[standard]" httpx
```

Expected: no errors

- [ ] **Step 2: Write the failing test**

Create `trading-agent/dashboard/backend/tests/__init__.py` (empty file).

```python
# trading-agent/dashboard/backend/tests/test_main.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
from unittest.mock import patch
from fastapi.testclient import TestClient


def get_client():
    from main import app
    return TestClient(app)


def test_get_portfolio_returns_cash_and_positions():
    client = get_client()
    mock_output = json.dumps({
        "cash": 100000.0,
        "positions": [
            {"symbol": "SPY", "qty": 2.0, "avg_entry_price": 720.0,
             "current_price": 733.0, "market_value": 1466.0, "unrealized_plpc": 0.018}
        ],
        "total_value": 101466.0,
    })
    with patch("main.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = mock_output
        mock_run.return_value.stderr = ""
        response = client.get("/portfolio")
    assert response.status_code == 200
    data = response.json()
    assert data["cash"] == 100000.0
    assert len(data["positions"]) == 1
    assert data["positions"][0]["symbol"] == "SPY"


def test_get_portfolio_handles_trade_error():
    client = get_client()
    with patch("main.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 1
        mock_run.return_value.stdout = ""
        mock_run.return_value.stderr = "Connection error"
        response = client.get("/portfolio")
    assert response.status_code == 502
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd trading-agent/dashboard/backend
python3 -m pytest tests/test_main.py::test_get_portfolio_returns_cash_and_positions -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 4: Implement main.py with /portfolio**

```python
# trading-agent/dashboard/backend/main.py
import json
import subprocess
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
        ["python3", "scripts/trade.py", "portfolio"],
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=502, detail=result.stderr or "trade.py failed")
    return json.loads(result.stdout)
```

- [ ] **Step 5: Run tests**

```bash
python3 -m pytest tests/ -v
```

Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add dashboard/
git commit -m "feat: dashboard backend scaffold with /portfolio endpoint"
```

---

### Task 2: Journal endpoints

**Files:**
- Modify: `trading-agent/dashboard/backend/main.py`
- Modify: `trading-agent/dashboard/backend/tests/test_main.py`

- [ ] **Step 1: Write failing tests — append to test_main.py**

```python
import main as main_module


def test_list_journal_returns_dates_descending(tmp_path):
    journal_dir = tmp_path / "journal"
    journal_dir.mkdir()
    (journal_dir / "2026-06-23.md").write_text("day 1")
    (journal_dir / "2026-06-24.md").write_text("day 2")
    (journal_dir / "summary.md").write_text("summary")  # must be excluded
    original = main_module.BASE_DIR
    main_module.BASE_DIR = tmp_path
    try:
        response = get_client().get("/journal")
        assert response.status_code == 200
        assert response.json()["dates"] == ["2026-06-24", "2026-06-23"]
    finally:
        main_module.BASE_DIR = original


def test_get_journal_entry(tmp_path):
    journal_dir = tmp_path / "journal"
    journal_dir.mkdir()
    (journal_dir / "2026-06-23.md").write_text("# Trade Journal\nContent here")
    original = main_module.BASE_DIR
    main_module.BASE_DIR = tmp_path
    try:
        response = get_client().get("/journal/2026-06-23")
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == "2026-06-23"
        assert "Content here" in data["content"]
    finally:
        main_module.BASE_DIR = original


def test_get_journal_entry_not_found():
    response = get_client().get("/journal/1999-01-01")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_main.py::test_list_journal_returns_dates_descending -v
```

Expected: FAIL — 404 or AttributeError

- [ ] **Step 3: Add journal routes to main.py**

Append after the `/portfolio` route:

```python
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
```

- [ ] **Step 4: Run all tests**

```bash
python3 -m pytest tests/ -v
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add dashboard/backend/main.py dashboard/backend/tests/test_main.py
git commit -m "feat: add GET /journal and GET /journal/{date} endpoints"
```

---

### Task 3: Watchlist endpoints

**Files:**
- Modify: `trading-agent/dashboard/backend/main.py`
- Modify: `trading-agent/dashboard/backend/tests/test_main.py`

- [ ] **Step 1: Write failing tests — append to test_main.py**

```python
def test_get_watchlist(tmp_path):
    watchlist_data = {
        "watchlist": [{"symbol": "SPY", "description": "S&P 500", "max_allocation_pct": 15}],
        "cash_reserve_pct": 20
    }
    (tmp_path / "watchlist.json").write_text(json.dumps(watchlist_data))
    original = main_module.BASE_DIR
    main_module.BASE_DIR = tmp_path
    try:
        response = get_client().get("/watchlist")
        assert response.status_code == 200
        assert response.json()["watchlist"][0]["symbol"] == "SPY"
    finally:
        main_module.BASE_DIR = original


def test_put_watchlist_valid(tmp_path):
    (tmp_path / "watchlist.json").write_text('{"watchlist": [], "cash_reserve_pct": 20}')
    original = main_module.BASE_DIR
    main_module.BASE_DIR = tmp_path
    try:
        body = {
            "watchlist": [
                {"symbol": "SPY", "description": "S&P 500", "max_allocation_pct": 15},
                {"symbol": "AAPL", "description": "Apple", "max_allocation_pct": 8},
            ],
            "cash_reserve_pct": 20
        }
        response = get_client().put("/watchlist", json=body)
        assert response.status_code == 200
        written = json.loads((tmp_path / "watchlist.json").read_text())
        assert written["watchlist"][0]["symbol"] == "SPY"
    finally:
        main_module.BASE_DIR = original


def test_put_watchlist_exceeds_80pct(tmp_path):
    (tmp_path / "watchlist.json").write_text('{"watchlist": [], "cash_reserve_pct": 20}')
    original = main_module.BASE_DIR
    main_module.BASE_DIR = tmp_path
    try:
        body = {
            "watchlist": [
                {"symbol": "SPY", "max_allocation_pct": 50},
                {"symbol": "QQQ", "max_allocation_pct": 40},
            ],
            "cash_reserve_pct": 20
        }
        response = get_client().put("/watchlist", json=body)
        assert response.status_code == 400
        assert "80%" in response.json()["detail"]
    finally:
        main_module.BASE_DIR = original
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_main.py::test_get_watchlist -v
```

Expected: FAIL — 404

- [ ] **Step 3: Add watchlist routes to main.py**

Append after the journal routes:

```python
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
```

- [ ] **Step 4: Run all tests**

```bash
python3 -m pytest tests/ -v
```

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add dashboard/backend/main.py dashboard/backend/tests/test_main.py
git commit -m "feat: add GET /watchlist and PUT /watchlist endpoints"
```

---

### Task 4: Frontend scaffold

**Files:**
- Create: `trading-agent/dashboard/frontend/package.json`
- Create: `trading-agent/dashboard/frontend/vite.config.js`
- Create: `trading-agent/dashboard/frontend/index.html`
- Create: `trading-agent/dashboard/frontend/src/main.jsx`
- Create: `trading-agent/dashboard/frontend/src/App.jsx`
- Create: `trading-agent/dashboard/frontend/src/api.js`
- Create: `trading-agent/dashboard/frontend/src/index.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "trading-dashboard",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "dompurify": "^3.1.5",
    "marked": "^9.1.6",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/portfolio': 'http://localhost:8000',
      '/journal': 'http://localhost:8000',
      '/watchlist': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Trading Agent Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

- [ ] **Step 5: Create src/api.js**

```js
export async function fetchPortfolio() {
  const res = await fetch('/portfolio')
  if (!res.ok) throw new Error('Failed to fetch portfolio')
  return res.json()
}

export async function fetchJournalDates() {
  const res = await fetch('/journal')
  if (!res.ok) throw new Error('Failed to fetch journal list')
  return res.json()
}

export async function fetchJournalEntry(date) {
  const res = await fetch(`/journal/${date}`)
  if (!res.ok) throw new Error(`Failed to fetch journal entry for ${date}`)
  return res.json()
}

export async function fetchWatchlist() {
  const res = await fetch('/watchlist')
  if (!res.ok) throw new Error('Failed to fetch watchlist')
  return res.json()
}

export async function saveWatchlist(body) {
  const res = await fetch('/watchlist', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Failed to save watchlist')
  }
  return res.json()
}
```

- [ ] **Step 6: Create src/App.jsx**

```jsx
import React, { useState } from 'react'
import Portfolio from './components/Portfolio.jsx'
import Journal from './components/Journal.jsx'
import Watchlist from './components/Watchlist.jsx'

const TABS = ['Portfolio', 'Journal', 'Watchlist']

export default function App() {
  const [tab, setTab] = useState('Portfolio')

  return (
    <div className="app">
      <header className="header">
        <h1>Trading Agent</h1>
        <nav className="nav">
          {TABS.map(t => (
            <button
              key={t}
              className={`nav-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>
      <main className="main">
        {tab === 'Portfolio' && <Portfolio />}
        {tab === 'Journal' && <Journal />}
        {tab === 'Watchlist' && <Watchlist />}
      </main>
    </div>
  )
}
```

- [ ] **Step 7: Create src/index.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f1117;
  color: #e2e8f0;
  min-height: 100vh;
}

.app { display: flex; flex-direction: column; min-height: 100vh; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #1a1f2e;
  border-bottom: 1px solid #2d3748;
}

.header h1 { font-size: 1.25rem; font-weight: 600; color: #63b3ed; }

.nav { display: flex; gap: 0.5rem; }

.nav-btn {
  padding: 0.4rem 1rem;
  border: 1px solid #2d3748;
  border-radius: 6px;
  background: transparent;
  color: #a0aec0;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.15s;
}

.nav-btn:hover { background: #2d3748; color: #e2e8f0; }
.nav-btn.active { background: #2b6cb0; border-color: #2b6cb0; color: #fff; }

.main { padding: 2rem; flex: 1; }

.card {
  background: #1a1f2e;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.card h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: #90cdf4; }

table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { text-align: left; padding: 0.5rem 0.75rem; color: #718096; border-bottom: 1px solid #2d3748; }
td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #1e2533; }
tr:last-child td { border-bottom: none; }

.positive { color: #68d391; }
.negative { color: #fc8181; }

.stat-label { font-size: 0.75rem; color: #718096; margin-bottom: 0.25rem; }
.stat-value { font-size: 1.5rem; font-weight: 700; }

.error { color: #fc8181; padding: 1rem; }
.loading { color: #718096; padding: 1rem; }

.journal-layout { display: flex; gap: 1.5rem; height: calc(100vh - 160px); }

.journal-list { width: 200px; flex-shrink: 0; overflow-y: auto; padding: 0.75rem; }

.journal-list-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #a0aec0;
  margin-bottom: 2px;
}
.journal-list-item:hover { background: #2d3748; }
.journal-list-item.selected { background: #2b6cb0; color: #fff; }

.journal-content { flex: 1; overflow-y: auto; }

.markdown { font-size: 0.875rem; line-height: 1.7; }
.markdown h1 { font-size: 1.25rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #2d3748; }
.markdown h2 { font-size: 1rem; margin: 1rem 0 0.5rem; color: #90cdf4; }
.markdown h3 { font-size: 0.875rem; margin: 0.75rem 0 0.25rem; color: #a0aec0; }
.markdown p { margin-bottom: 0.5rem; }
.markdown table { margin: 0.5rem 0; }
.markdown li { margin-left: 1.5rem; margin-bottom: 0.25rem; }

.watchlist-table input[type="number"] {
  width: 80px;
  background: #2d3748;
  border: 1px solid #4a5568;
  color: #e2e8f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.save-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: #2b6cb0;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 0.875rem;
}
.save-btn:hover { background: #2c5282; }
.save-btn:disabled { background: #4a5568; cursor: not-allowed; }

.validation-error { color: #fc8181; font-size: 0.875rem; margin-top: 0.5rem; }
.save-success { color: #68d391; font-size: 0.875rem; margin-top: 0.5rem; }
```

- [ ] **Step 8: Install frontend dependencies**

```bash
cd trading-agent/dashboard/frontend
npm install
```

Expected: `node_modules/` created, no errors

- [ ] **Step 9: Commit**

```bash
cd trading-agent
git add dashboard/frontend/
git commit -m "feat: dashboard frontend scaffold with tab nav and API layer"
```

---

### Task 5: Portfolio view component

**Files:**
- Create: `trading-agent/dashboard/frontend/src/components/Portfolio.jsx`

- [ ] **Step 1: Create components/Portfolio.jsx**

```jsx
import React, { useEffect, useState } from 'react'
import { fetchPortfolio } from '../api.js'

export default function Portfolio() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPortfolio()
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="error">Error: {error}</div>
  if (!data) return <div className="loading">Loading portfolio...</div>

  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="stat-label">Cash</div>
          <div className="stat-value">${fmt(data.cash)}</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="stat-label">Total Value</div>
          <div className="stat-value">${fmt(data.total_value)}</div>
        </div>
      </div>

      <div className="card">
        <h2>Open Positions</h2>
        {data.positions.length === 0 ? (
          <p style={{ color: '#718096' }}>No open positions.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Qty</th>
                <th>Entry Price</th>
                <th>Current Price</th>
                <th>Market Value</th>
                <th>P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map(p => {
                const pnlDollar = p.market_value - p.qty * p.avg_entry_price
                const pnlPct = (p.unrealized_plpc * 100).toFixed(2)
                const sign = pnlDollar >= 0 ? '+' : ''
                return (
                  <tr key={p.symbol}>
                    <td><strong>{p.symbol}</strong></td>
                    <td>{p.qty}</td>
                    <td>${fmt(p.avg_entry_price)}</td>
                    <td>${fmt(p.current_price)}</td>
                    <td>${fmt(p.market_value)}</td>
                    <td className={pnlDollar >= 0 ? 'positive' : 'negative'}>
                      {sign}${fmt(Math.abs(pnlDollar))} ({sign}{pnlPct}%)
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/frontend/src/components/Portfolio.jsx
git commit -m "feat: Portfolio view with cash, positions table, and P&L"
```

---

### Task 6: Journal browser component

**Files:**
- Create: `trading-agent/dashboard/frontend/src/components/Journal.jsx`

Note: markdown HTML is sanitized with DOMPurify before rendering to prevent XSS. Journal content is agent-generated but sanitizing is still correct practice.

- [ ] **Step 1: Create components/Journal.jsx**

```jsx
import React, { useEffect, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { fetchJournalDates, fetchJournalEntry } from '../api.js'

export default function Journal() {
  const [dates, setDates] = useState([])
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchJournalDates()
      .then(data => {
        setDates(data.dates)
        if (data.dates.length > 0) setSelected(data.dates[0])
      })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!selected) return
    fetchJournalEntry(selected)
      .then(data => setContent(data.content))
      .catch(e => setError(e.message))
  }, [selected])

  if (error) return <div className="error">Error: {error}</div>

  const safeHtml = DOMPurify.sanitize(marked.parse(content))

  return (
    <div className="journal-layout">
      <div className="card journal-list">
        {dates.length === 0
          ? <div style={{ color: '#718096', fontSize: '0.875rem' }}>No entries yet.</div>
          : dates.map(date => (
              <div
                key={date}
                className={`journal-list-item ${selected === date ? 'selected' : ''}`}
                onClick={() => setSelected(date)}
              >
                {date}
              </div>
            ))
        }
      </div>
      <div className="card journal-content">
        {selected
          ? <div className="markdown" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          : <div style={{ color: '#718096' }}>Select a journal entry.</div>
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/frontend/src/components/Journal.jsx
git commit -m "feat: Journal browser with date list and sanitized markdown rendering"
```

---

### Task 7: Watchlist manager component

**Files:**
- Create: `trading-agent/dashboard/frontend/src/components/Watchlist.jsx`

- [ ] **Step 1: Create components/Watchlist.jsx**

```jsx
import React, { useEffect, useState } from 'react'
import { fetchWatchlist, saveWatchlist } from '../api.js'

export default function Watchlist() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [saveMsg, setSaveMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWatchlist()
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  function updateAllocation(index, value) {
    const updated = {
      ...data,
      watchlist: data.watchlist.map((w, i) =>
        i === index ? { ...w, max_allocation_pct: Number(value) } : w
      ),
    }
    const total = updated.watchlist.reduce((s, w) => s + w.max_allocation_pct, 0)
    setValidationError(total > 80 ? `Total ${total.toFixed(1)}% exceeds 80% limit` : null)
    setSaveMsg(null)
    setData(updated)
  }

  async function handleSave() {
    if (validationError) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await saveWatchlist(data)
      setSaveMsg('Saved successfully.')
    } catch (e) {
      setValidationError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (error) return <div className="error">Error: {error}</div>
  if (!data) return <div className="loading">Loading watchlist...</div>

  const total = data.watchlist.reduce((s, w) => s + w.max_allocation_pct, 0)

  return (
    <div className="card">
      <h2>Watchlist</h2>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Description</th>
            <th>Max Allocation %</th>
          </tr>
        </thead>
        <tbody>
          {data.watchlist.map((w, i) => (
            <tr key={w.symbol}>
              <td><strong>{w.symbol}</strong></td>
              <td style={{ color: '#a0aec0' }}>{w.description}</td>
              <td>
                <input
                  type="number"
                  min="1"
                  max="80"
                  value={w.max_allocation_pct}
                  onChange={e => updateAllocation(i, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#a0aec0' }}>
        Total: <strong style={{ color: total > 80 ? '#fc8181' : '#68d391' }}>{total.toFixed(1)}%</strong> of 80% max
      </div>
      {validationError && <div className="validation-error">{validationError}</div>}
      {saveMsg && <div className="save-success">{saveMsg}</div>}
      <button
        className="save-btn"
        onClick={handleSave}
        disabled={saving || !!validationError}
      >
        {saving ? 'Saving...' : 'Save Watchlist'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/frontend/src/components/Watchlist.jsx
git commit -m "feat: Watchlist manager with editable allocations and validation"
```

---

### Task 8: Wire up PM2 and smoke test

**Files:**
- Modify: `trading-agent/ecosystem.config.js`

- [ ] **Step 1: Add dashboard backend to ecosystem.config.js**

In the `apps` array in `trading-agent/ecosystem.config.js`, add:

```js
{
  name: "trading-dashboard-api",
  script: "/home/marnu/.local/bin/uvicorn",
  args: "main:app --host 0.0.0.0 --port 8000",
  cwd: "/home/marnu/trading-agent/dashboard/backend",
  autorestart: true,
  watch: false,
  env: {
    PATH: "/home/marnu/.local/bin:/usr/local/bin:/usr/bin:/bin",
  },
},
```

- [ ] **Step 2: Start the backend**

```bash
/home/marnu/.npm-global/bin/pm2 start ecosystem.config.js --only trading-dashboard-api
/home/marnu/.npm-global/bin/pm2 save
```

Expected: `trading-dashboard-api` shows `online`

- [ ] **Step 3: Smoke test each endpoint**

```bash
curl -s http://localhost:8000/portfolio | python3 -m json.tool
curl -s http://localhost:8000/journal | python3 -m json.tool
curl -s http://localhost:8000/watchlist | python3 -m json.tool
```

Expected: valid JSON from each endpoint

- [ ] **Step 4: Start the frontend dev server**

```bash
cd trading-agent/dashboard/frontend
npm run dev
```

Expected: `Local: http://localhost:3000/`

- [ ] **Step 5: Verify in browser at http://localhost:3000**

- Portfolio tab: $100,000 cash, no positions, $100,000 total value
- Journal tab: `2026-06-23` in the left list, "Market closed — no research today." rendered on the right
- Watchlist tab: SPY/QQQ/NVDA/AAPL/MSFT with allocation percentages, total shown in green

- [ ] **Step 6: Commit**

```bash
git add ecosystem.config.js
git commit -m "feat: add trading-dashboard-api to PM2 ecosystem"
```

---

## Self-Review

**Spec coverage:**
- GET /portfolio — Task 1
- GET /journal + GET /journal/{date} — Task 2
- GET /watchlist + PUT /watchlist with 80% validation — Task 3
- Portfolio View (cash, positions, entry/current price, P&L) — Task 5
- Journal Browser (date list + sanitized markdown) — Task 6
- Watchlist Manager (editable table, inline validation, save) — Task 7
- FastAPI + CORS — Tasks 1-3
- React + Vite — Tasks 4-7
- PM2 for backend — Task 8

**Placeholder scan:** None found. All steps include complete code.

**Type consistency:**
- fetchPortfolio() returns {cash, positions[], total_value} — matches Portfolio.jsx
- fetchJournalDates() returns {dates: string[]} — matches Journal.jsx
- fetchJournalEntry(date) returns {date, content} — matches Journal.jsx
- fetchWatchlist() returns {watchlist: [{symbol, description, max_allocation_pct}], cash_reserve_pct} — matches Watchlist.jsx
- saveWatchlist(body) sends same shape — matches PUT /watchlist handler
