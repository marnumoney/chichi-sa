#!/usr/bin/env python3
"""
Apply approved proposals from journal/proposals.md.
Usage: python scripts/apply_proposals.py P1 [W1] [H1] ...
"""
import sys
import os
import json
import re
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
PROPOSALS_PATH = BASE_DIR / "journal" / "proposals.md"
CONFIG_PATH = BASE_DIR / "config.json"
WATCHLIST_PATH = BASE_DIR / "watchlist.json"

CONFIG_BOUNDS = {
    "stop_loss_pct":             (1,    20),
    "limit_order_slippage_pct":  (0.05, 2.0),
    "ma_short_period":           (5,    50),
    "ma_long_period":            (20,   200),
    "cash_reserve_pct":          (5,    50),
    "max_default_allocation_pct":(1,    20),
}


def parse_proposals(text):
    """Return dict of {proposal_id: {line, raw, section}}."""
    proposals = {}
    current_section = None
    last_pid = None

    for line in text.split('\n'):
        if line.startswith('## Parameters'):
            current_section = 'P'
        elif line.startswith('## Watchlist'):
            current_section = 'W'
        elif line.startswith('## Hard Rules'):
            current_section = 'H'

        m = re.match(r'\s*-\s*\[([PWH]\d+)\]\s*(.*)', line)
        if m:
            pid = m.group(1)
            last_pid = pid
            proposals[pid] = {
                'section': current_section,
                'line': m.group(2).strip(),
                'raw': [line],
            }
        elif last_pid and line.startswith('  '):
            proposals[last_pid]['raw'].append(line)

    return proposals


def apply_parameter(proposal, config_path=None):
    """Apply a P-type proposal: update config.json."""
    path = Path(config_path) if config_path else CONFIG_PATH
    line = proposal['line']

    key_m = re.search(r'key=(\w+)', line)
    to_m  = re.search(r'to=([\d.]+)', line)

    if not key_m or not to_m:
        print(f"ERROR: Cannot parse parameter proposal line: {line}")
        print("Expected format: key=PARAM_NAME from=OLD to=NEW")
        sys.exit(1)

    key   = key_m.group(1)
    value = float(to_m.group(1))

    if key not in CONFIG_BOUNDS:
        print(f"ERROR: Unknown config key '{key}'. Valid: {list(CONFIG_BOUNDS)}")
        sys.exit(1)

    lo, hi = CONFIG_BOUNDS[key]
    if not (lo <= value <= hi):
        print(f"ERROR: {key}={value} out of bounds [{lo}, {hi}]")
        sys.exit(1)

    config = json.loads(path.read_text())
    old    = config.get(key)
    config[key] = int(value) if value == int(value) else value
    path.write_text(json.dumps(config, indent=2) + '\n')
    print(f"  config.json: {key} {old} -> {config[key]}")
    return path


def apply_watchlist(proposal, watchlist_path=None):
    """Apply a W-type proposal: update watchlist.json."""
    path = Path(watchlist_path) if watchlist_path else WATCHLIST_PATH
    line = proposal['line']

    action_m = re.search(r'action=(\w+)', line)
    symbol_m = re.search(r'symbol=(\w+)', line)

    if not action_m or not symbol_m:
        print(f"ERROR: Cannot parse watchlist proposal line: {line}")
        print("Expected: action=add|remove|update symbol=SYM [max_allocation_pct=N] [description=\"...\"]")
        sys.exit(1)

    action = action_m.group(1)
    symbol = symbol_m.group(1).upper()
    wl     = json.loads(path.read_text())
    items  = wl.get("watchlist", [])

    if action == "remove":
        before = len(items)
        items  = [w for w in items if w["symbol"] != symbol]
        if len(items) == before:
            print(f"  WARNING: {symbol} not found in watchlist — nothing removed")
        else:
            print(f"  watchlist.json: removed {symbol}")

    elif action in ("add", "update"):
        alloc_m = re.search(r'max_allocation_pct=([\d.]+)', line)
        desc_m  = re.search(r'description="([^"]+)"', line)

        if not alloc_m:
            print(f"ERROR: max_allocation_pct required for action={action}")
            sys.exit(1)

        max_alloc   = float(alloc_m.group(1))
        description = desc_m.group(1) if desc_m else f"{symbol} — added by self-improvement"
        existing    = [w for w in items if w["symbol"] != symbol]
        total       = sum(w["max_allocation_pct"] for w in existing) + max_alloc

        if total > 80:
            print(f"ERROR: Total allocation {total:.1f}% would exceed 80% limit")
            sys.exit(1)

        entry = {"symbol": symbol, "description": description, "max_allocation_pct": max_alloc}

        if action == "add":
            items.append(entry)
            print(f"  watchlist.json: added {symbol} ({max_alloc}%)")
        else:
            if not any(w["symbol"] == symbol for w in items):
                print(f"ERROR: Cannot update {symbol} — symbol not found in watchlist")
                sys.exit(1)
            for i, w in enumerate(items):
                if w["symbol"] == symbol:
                    items[i] = {**w, **entry}
            print(f"  watchlist.json: updated {symbol} ({max_alloc}%)")

    else:
        print(f"ERROR: Unknown action '{action}'. Use: add, remove, update")
        sys.exit(1)

    wl["watchlist"] = items
    path.write_text(json.dumps(wl, indent=2) + '\n')
    return path


def apply_hard_rule(proposal, pid):
    """Hard rule proposals require manual CLAUDE.md editing."""
    print(f"\n  [Manual edit required for {pid}]")
    for raw_line in proposal['raw']:
        print(f"    {raw_line}")
    print(f"\n  After editing CLAUDE.md, commit with:")
    print(f"  git add CLAUDE.md && git commit -m 'self-improvement: apply {pid}'")
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/apply_proposals.py P1 [W1] [H1] ...")
        sys.exit(1)

    proposal_ids = [p.upper() for p in sys.argv[1:]]

    if not PROPOSALS_PATH.exists():
        print(f"ERROR: {PROPOSALS_PATH} not found. Run the weekly review first.")
        sys.exit(1)

    proposals = parse_proposals(PROPOSALS_PATH.read_text())

    for pid in proposal_ids:
        if pid not in proposals:
            print(f"ERROR: '{pid}' not found in proposals.md")
            print(f"Available: {sorted(proposals.keys())}")
            sys.exit(1)

    modified = []
    applied  = []

    for pid in proposal_ids:
        proposal = proposals[pid]
        print(f"\nApplying {pid}...")

        if pid.startswith('P'):
            f = apply_parameter(proposal)
            modified.append(str(f))
            applied.append(pid)
        elif pid.startswith('W'):
            f = apply_watchlist(proposal)
            modified.append(str(f))
            applied.append(pid)
        elif pid.startswith('H'):
            apply_hard_rule(proposal, pid)

    if not applied:
        print("\nNo auto-apply proposals — see manual instructions above.")
        sys.exit(0)

    summaries = []
    for pid in applied:
        for raw_line in proposals[pid]['raw']:
            if 'Proposed:' in raw_line:
                summaries.append(raw_line.strip().replace('Proposed: ', ''))
                break

    ids_str = ' '.join(applied)
    summary = '; '.join(summaries[:2])
    msg     = f"self-improvement: apply {ids_str} — {summary}"

    subprocess.run(['git', 'add'] + list(dict.fromkeys(modified)), check=True, cwd=BASE_DIR)
    subprocess.run(['git', 'commit', '-m', msg], check=True, cwd=BASE_DIR)
    print(f"\nCommitted: {msg}")


if __name__ == '__main__':
    main()
