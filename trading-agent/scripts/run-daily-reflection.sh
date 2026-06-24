#!/bin/bash
# Daily Reflection — runs at 4:30 PM ET (20:30 UTC) on weekdays
# Evaluates today's decisions by reasoning quality and appends to lessons.md
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_BIN="/home/marnu/.local/bin/claude"
LOG_DIR="$AGENT_DIR/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOGFILE="$LOG_DIR/daily-reflection-$DATE.log"

cd "$AGENT_DIR"
source "$AGENT_DIR/.env" 2>/dev/null || true

exec "$CLAUDE_BIN" --dangerously-skip-permissions --print "Run the daily reflection routine.

Date: $DATE

Steps:
1. Read journal/$DATE.md — today's full journal entry.
2. Read journal/lessons.md — existing lessons, paying attention to any entries marked QUALITY: Pending.
3. For each QUALITY: Pending entry in lessons.md from prior days: run \`python scripts/research.py bars SYMBOL\` to get today's closing price and resolve the entry. Update from 'Pending' to 'Resolved' (if outcome validates the reasoning) or 'Poor' (if it contradicts it), adding a one-line note with the actual price.
4. For each decision made today (trade placed, trade skipped, stop-loss triggered, no-trade day): evaluate reasoning quality — was the logic internally consistent? Did the stated rationale hold up?
5. Append new structured entries to journal/lessons.md following this EXACT format:

## $DATE

- DECISION: [what was decided — e.g. 'No entry on MU before earnings']
  OUTCOME: [what actually happened or 'Pending — check YYYY-MM-DD']
  QUALITY: [Good | Poor | Pending]
  NOTE: [one sentence explaining why the quality rating was assigned]

Rules:
- Append only — never rewrite existing entries.
- Every decision from today's journal gets an entry (including no-trade decisions).
- If outcome is not yet known (open position, or price move not yet visible), set QUALITY: Pending and OUTCOME: Pending — check YYYY-MM-DD (tomorrow's date).
- Be specific: name the symbol, the price level, and the reasoning that was used." \
  2>&1 | tee "$LOGFILE"
