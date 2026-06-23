#!/bin/bash
# Morning Research routine — runs at 9:45 AM ET (13:45 UTC / 15:45 SAST on weekdays)
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_BIN="/home/marnu/.local/bin/claude"
LOG_DIR="$AGENT_DIR/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOGFILE="$LOG_DIR/morning-research-$DATE.log"

cd "$AGENT_DIR"
source "$AGENT_DIR/.env" 2>/dev/null || true

exec "$CLAUDE_BIN" --print "Run the morning research routine.

Steps:
1. Run \`python scripts/trade.py status\` and parse the JSON. If is_open is false, write a one-line note to journal/$DATE.md (create it if it does not exist) saying 'Market closed — no research today.' then stop.
2. Read journal/summary.md for prior context.
3. Read watchlist.json to get the list of symbols.
4. For each symbol in watchlist.json: run \`python scripts/research.py bars SYMBOL\` and \`python scripts/research.py news SYMBOL\`. Extract ma20 and ma50 from the bars response and summarize the news in 1-2 sentences.
5. From the news headlines across all symbols, identify 3-5 additional tickers worth researching. Run bars and news for those too.
6. Write the Research section of today's journal to journal/$DATE.md following the format in CLAUDE.md. Include all symbols researched (watchlist + discovered). Do NOT write Trades Executed or End-of-Day Reflection — those come later." \
  --cwd "$AGENT_DIR" \
  2>&1 | tee "$LOGFILE"
