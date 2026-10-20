#!/usr/bin/env bash
# Take Checker installer for macOS and Linux.
#   bash install.sh
# Installs ffmpeg + Python, creates ~/TakeChecker (inbox/ trimmed/ reports/),
# sets up a private virtualenv with faster-whisper and pre-downloads "small.en".
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${TAKECHECKER_DIR:-$HOME/TakeChecker}"
OS="$(uname -s)"
echo "==> Detected OS: $OS"

case "$OS" in
  Darwin)
    if ! command -v brew >/dev/null 2>&1; then
      echo "==> Installing Homebrew (you may be asked for your Mac password)"
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
    fi
    command -v ffmpeg >/dev/null 2>&1 || brew install ffmpeg
    command -v python3 >/dev/null 2>&1 || brew install python
    ;;
  Linux)
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update && sudo apt-get install -y ffmpeg python3 python3-venv python3-pip
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y ffmpeg python3 python3-pip || {
        echo "ffmpeg may need RPM Fusion on Fedora: https://rpmfusion.org/Configuration"; exit 1; }
    elif command -v pacman >/dev/null 2>&1; then
      sudo pacman -Sy --needed --noconfirm ffmpeg python python-pip
    elif command -v zypper >/dev/null 2>&1; then
      sudo zypper install -y ffmpeg python3 python3-pip
    else
      echo "Unknown Linux package manager. Install ffmpeg and python3 yourself, then re-run."; exit 1
    fi
    ;;
  *)
    echo "On Windows, run install.ps1 in PowerShell instead."; exit 1 ;;
esac

echo "==> Setting up $DEST"
mkdir -p "$DEST"/{inbox,trimmed,reports}
cp "$SRC/take_check.py" "$DEST/"
[ -f "$DEST/script.txt" ] || cp "$SRC/script.txt" "$DEST/"
mkdir -p "$DEST/scripts"
[ -f "$DEST/scripts/gym_ad.txt" ] || cp "$SRC/script.txt" "$DEST/scripts/gym_ad.txt"

echo "==> Creating virtualenv + installing faster-whisper"
python3 -m venv "$DEST/.venv"
"$DEST/.venv/bin/python" -m pip install --upgrade pip >/dev/null
"$DEST/.venv/bin/python" -m pip install faster-whisper numpy

echo "==> Downloading Whisper model small.en (one time, ~500 MB)"
"$DEST/.venv/bin/python" -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8')"

cat <<EOF

Done. Take Checker lives in: $DEST
  1. AirDrop your takes into:  $DEST/inbox
  2. Run:                      cd $DEST && python3 take_check.py
  3. Read the report:          $DEST/reports/report.md
EOF
