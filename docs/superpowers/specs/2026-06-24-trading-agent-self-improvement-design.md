# Trading Agent Self-Improvement — Design Spec
*Date: 2026-06-24*

## Overview

The trading agent gains a self-improvement loop: a daily micro-reflection that builds a structured lessons file, a weekly deep review that produces human-readable change proposals, and a manual apply script that executes approved proposals with a traceable git commit. The agent proposes but never self-applies — all changes require human approval.

---

## Goals

- Agent evaluates its own decisions by **reasoning quality**, not P&L
- Lessons accumulate in a persistent `lessons.md` read every session
- Weekly proposals cover parameters, watchlist, and hard rules
- Human approves and applies proposals manually via `apply-proposals.sh`
- Every self-modification is traceable in git history

---

## New Files

```
trading-agent/
├── config.json                        ← NEW: all numeric parameters
├── journal/
│   ├── lessons.md                     ← NEW: structured living strategic memory
│   └── proposals.md                   ← NEW: weekly proposed changes (overwritten each Friday)
└── scripts/
    ├── run-daily-reflection.sh        ← NEW: appends to lessons.md after EOD (4:30 PM ET)
    ├── run-weekly-review.sh           ← NEW: writes proposals.md every Friday (4:45 PM ET)
    └── apply-proposals.sh             ← NEW: you run this manually after approving proposals
```

Modified files:
- `ecosystem.config.js` — two new PM2 cron entries
- `scripts/trade.py` — load numeric params from `config.json`
- `scripts/research.py` — load MA periods from `config.json`
- `watchlist.json` — remove `cash_reserve_pct` (moves to `config.json`)
- `CLAUDE.md` — reference `config.json` as source of truth for numeric params; add instructions to read `lessons.md` each session

---

## config.json

All tuneable numeric parameters in one file, loaded at runtime by `trade.py` and `research.py`:

```json
{
  "stop_loss_pct": 8,
  "limit_order_slippage_pct": 0.2,
  "ma_short_period": 20,
  "ma_long_period": 50,
  "cash_reserve_pct": 20,
  "max_default_allocation_pct": 5
}
```

`CLAUDE.md` prose references these symbolically (e.g., "stop-loss at `stop_loss_pct`% from config.json") so rules stay human-readable and parameters stay data-only. `watchlist.json`'s `cash_reserve_pct` is removed and consolidated here.

---

## lessons.md — Structured Format

Each entry is appended by the daily reflection. The weekly review may update `Pending` entries to `Resolved` or `Stale`.

```markdown
## 2026-06-24

- DECISION: No entry on MU before earnings (96% beat probability, Polymarket)
  OUTCOME: Binary event avoided — validated. Post-earnings reaction pending.
  QUALITY: Good — reasoning held up. Binary risk rule justified.

- DECISION: Skipped SPY at $744.27 (below 20-day MA $747.14)
  OUTCOME: Pending — check 2026-06-25 close.
  QUALITY: Pending
```

**Rules:**
- Daily reflection **appends only** — never rewrites existing entries
- If a prior `Pending` entry now has an outcome, the reflection updates that specific entry to `Resolved`
- After 5 trading days unresolved, the weekly review marks it `Stale` with a price summary

---

## Daily Micro-Reflection — `run-daily-reflection.sh`

**When:** 4:30 PM ET weekdays (15 min after EOD journal)

**Reads:**
- `journal/YYYY-MM-DD.md` (today's decisions)
- `journal/lessons.md` (existing lessons for pending resolution)
- For any `Pending` lesson entry: runs `python scripts/research.py bars SYMBOL` to get today's closing price

**Does:**
- For each decision today: evaluates reasoning quality — was the logic internally consistent, did the outcome validate or invalidate the stated rationale?
- Appends new structured entries to `lessons.md`
- Resolves any prior `Pending` entries by checking today's close via `research.py bars` — updates the entry to `Resolved` with the price outcome
- On no-trade days: evaluates no-trade decisions and marks them `Pending` for resolution once price data is available

**Does NOT:** touch `CLAUDE.md`, `watchlist.json`, `config.json`, or `proposals.md`

---

## Weekly Deep Review — `run-weekly-review.sh`

**When:** 4:45 PM ET every Friday

**Reads:**
- All `journal/YYYY-MM-DD.md` files from the current week
- Full `journal/lessons.md`
- Current `CLAUDE.md`
- Current `watchlist.json` and `config.json`

**Produces:** A fresh `journal/proposals.md` (overwrites prior week's). If a prior `proposals.md` was detected with unapplied proposals, notes this at the top.

**proposals.md structure:**

```markdown
# Proposals — Week of YYYY-MM-DD

> Note: Prior proposals from YYYY-MM-DD were not applied before this review.

## Parameters
- [P1] Proposed: Lower stop_loss_pct from 8 to 6
  Reasoning: Two positions hit 7% before recovering — stop triggered too early
  Evidence: NVDA 2026-06-18, AAPL 2026-06-20

## Watchlist
- [W1] Proposed: Add MU with max_allocation_pct: 8
  Reasoning: Strongly bullish structure confirmed post-earnings; high-conviction setup
  Evidence: Post-earnings gap, lessons 2026-06-25

## Hard Rules
No changes proposed.
```

Always includes all three sections, even if empty.

---

## apply-proposals.sh

Run manually after reviewing `proposals.md`:

```bash
./scripts/apply-proposals.sh P1 W1    # apply specific proposal IDs
```

**Behaviour:**
- Parses `proposals.md` for the specified IDs
- For `config.json` changes: validates numeric bounds (stop-loss 1–20%, allocation sum ≤ 80%) before writing
- For `CLAUDE.md` changes: shows a diff and requires explicit confirmation before writing
- For `watchlist.json` changes: validates totals before writing
- On success: `git add` + `git commit -m "self-improvement: apply proposals P1 W1 — <summary>"`
- Never applies blindly — exits with error on any validation failure

---

## PM2 Cron Schedule (additions to ecosystem.config.js)

| Name | Script | Cron (UTC) | ET equivalent |
|------|--------|------------|---------------|
| `trading-daily-reflection` | `run-daily-reflection.sh` | `30 20 * * 1-5` | 4:30 PM ET (EDT) |
| `trading-weekly-review` | `run-weekly-review.sh` | `45 20 * * 5` | 4:45 PM ET Fridays (EDT) |

---

## CLAUDE.md Changes

Two additions to the agent's instructions:

1. **Read `journal/lessons.md`** at the start of every session (alongside `summary.md`) for accumulated strategic context.
2. **Numeric parameters** reference `config.json` as source of truth — the prose in CLAUDE.md reflects current values but always defers to `config.json` at runtime.

---

## Edge Cases

| Case | Handling |
|------|----------|
| No trades all week | Weekly review still runs; evaluates no-trade decisions against actual price moves that occurred |
| Proposals not reviewed before next Friday | New review notes unapplied proposals at top of file; old proposals overwritten but traceable in git |
| Bad proposal in apply script | Validates bounds before writing; shows diff for CLAUDE.md changes; exits on failure |
| Pending lesson > 5 trading days | Weekly review marks `Stale`, records what price actually did |

---

## What the Agent Can Propose

| Scope | File Modified | Validation |
|-------|--------------|------------|
| Numeric parameters | `config.json` | Bounds check (stop-loss 1–20%, etc.) |
| Watchlist symbols + caps | `watchlist.json` | Total allocation ≤ 80% |
| Decision framework & hard rules | `CLAUDE.md` | Diff shown, manual confirmation |

---

## What the Agent Cannot Do

- Self-apply any proposal — human approval always required
- Modify `apply-proposals.sh` itself
- Modify ecosystem cron schedules
- Delete journal entries or lesson history
