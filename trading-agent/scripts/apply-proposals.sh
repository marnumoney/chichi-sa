#!/bin/bash
# Thin wrapper — applies approved proposals from journal/proposals.md
# Usage: ./scripts/apply-proposals.sh P1 [W1] [H1] ...
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/apply_proposals.py "$@"
