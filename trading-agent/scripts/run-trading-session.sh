#!/bin/bash
# Trading Session routine — runs at 10:00 AM ET (14:00 UTC / 16:00 SAST on weekdays)
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_BIN="/home/marnu/.local/bin/claude"
LOG_DIR="$AGENT_DIR/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOGFILE="$LOG_DIR/trading-session-$DATE.log"

cd "$AGENT_DIR"
source "$AGENT_DIR/.env" 2>/dev/null || true

exec "$CLAUDE_BIN" --print "Run the trading session.

Steps:
1. Run \`python scripts/trade.py status\`. If is_open is false, append 'Market closed — trading session skipped.' to journal/$DATE.md and stop.
2. Read journal/$DATE.md (the Research section written earlier today).
3. Run \`python scripts/trade.py portfolio\` to get current cash balance and open positions.
4. Stop-loss check: for each open position, if current price has dropped 8% or more from the average buy price, place a sell limit order immediately: \`python scripts/trade.py order SYMBOL QTY sell LIMIT_PRICE\`. Log the closure to the journal.
5. For each symbol researched this morning, answer the 5 decision framework questions from CLAUDE.md in the journal before deciding whether to act.
6. For any buy decision: run \`python scripts/trade.py order SYMBOL QTY buy LIMIT_PRICE\` (limit within 0.2% of current ask). Log the order result, including any validation rejections.
7. Append the Trades Executed and Positions Closed sections to journal/$DATE.md following the format in CLAUDE.md." \
  --cwd "$AGENT_DIR" \
  2>&1 | tee "$LOGFILE"
