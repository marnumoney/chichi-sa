#!/bin/bash
# End-of-Day Journal routine — runs at 4:15 PM ET (20:15 UTC / 22:15 SAST on weekdays)
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_BIN="/home/marnu/.local/bin/claude"
LOG_DIR="$AGENT_DIR/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOGFILE="$LOG_DIR/eod-journal-$DATE.log"

cd "$AGENT_DIR"
source "$AGENT_DIR/.env" 2>/dev/null || true

exec "$CLAUDE_BIN" --dangerously-skip-permissions --print "Run the end-of-day journal routine.

Steps:
1. Run \`python scripts/trade.py portfolio\` to get final positions and account value.
2. Read the full journal/$DATE.md written today.
3. Append the End-of-Day Reflection section to journal/$DATE.md: what worked, what didn't, what to watch tomorrow. Be specific — name the symbols and decisions.
4. Rewrite journal/summary.md to include today's key takeaways. Keep it to a rolling 7-day window: summarize what happened each day, the current open positions, and any patterns or lessons. Future sessions read this file for context, so make it useful.
5. Run \`python scripts/notify.py journal/$DATE.md\` to send the email digest.
6. Stage and commit today's journal: \`git add journal/$DATE.md journal/summary.md && git commit -m 'journal: $DATE trading session'\`" \
  --cwd "$AGENT_DIR" \
  2>&1 | tee "$LOGFILE"
