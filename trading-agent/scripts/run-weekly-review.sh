#!/bin/bash
# Weekly Review — runs at 4:45 PM ET (20:45 UTC) every Friday
# Deep review of the week's decisions; writes machine-parseable proposals.md
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_BIN="/home/marnu/.local/bin/claude"
LOG_DIR="$AGENT_DIR/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOGFILE="$LOG_DIR/weekly-review-$DATE.log"

cd "$AGENT_DIR"
source "$AGENT_DIR/.env" 2>/dev/null || true

exec "$CLAUDE_BIN" --dangerously-skip-permissions --print "Run the weekly self-improvement review.

Week ending: $DATE

Steps:
1. Check if journal/proposals.md already exists with unapplied proposals. If so, note this at the top of the new proposals.md.
2. Read all journal/YYYY-MM-DD.md files from this week (Monday to today).
3. Read the full journal/lessons.md.
4. Read the current CLAUDE.md (to know what rules exist before proposing changes).
5. Read the current config.json (to know current parameter values).
6. Read the current watchlist.json (to know current symbols and allocation caps).
7. Stale resolution: for any QUALITY: Pending entry in lessons.md older than 5 trading days, run \`python scripts/research.py bars SYMBOL\` to get the latest price, mark the entry QUALITY: Stale, and add a one-line note with what the price actually did.
8. Analyse: what patterns emerged this week? Which decision rules helped? Which hurt? Which parameters appear miscalibrated? Which symbols no longer belong on the watchlist? Are any new symbols consistently appearing in research with strong setups?
9. Write journal/proposals.md with this EXACT structure (include all three sections even if empty):

---
# Proposals — Week of $DATE
[If prior proposals.md existed: > Note: Prior proposals from YYYY-MM-DD were not applied before this review.]

## Parameters
[For each parameter proposal, use this machine-parseable format:]
- [P1] key=PARAM_NAME from=OLD_VALUE to=NEW_VALUE
  Proposed: [human description]
  Reasoning: [pattern observed]
  Evidence: [specific dates/symbols]

[Valid PARAM_NAME values: stop_loss_pct, limit_order_slippage_pct, ma_short_period, ma_long_period, cash_reserve_pct, max_default_allocation_pct]
[If no changes: write 'No changes proposed.']

## Watchlist
[For each watchlist proposal, use this machine-parseable format:]
- [W1] action=add symbol=SYMBOL max_allocation_pct=N description=\"DESCRIPTION\"
- [W2] action=remove symbol=SYMBOL
- [W3] action=update symbol=SYMBOL max_allocation_pct=N

  Proposed: [human description]
  Reasoning: [pattern observed]
  Evidence: [specific dates/symbols]

[If no changes: write 'No changes proposed.']

## Hard Rules
[For hard rule changes that require manual CLAUDE.md editing:]
- [H1] action=manual
  Proposed: [exact proposed change in plain English]
  Reasoning: [why this rule change is warranted]
  Evidence: [specific decisions that support this]
  Instructions: [which section/line of CLAUDE.md to edit and how]

[If no changes: write 'No changes proposed.']
---

Rules for proposal writing:
- Only propose changes with clear evidence from this week's data.
- Parameter proposals must use the exact key names from config.json.
- Do not propose more than 3 total proposals in the first 4 weeks — the portfolio is new and patterns need time to emerge.
- Proposals should be specific and actionable, not vague." \
  2>&1 | tee "$LOGFILE"
