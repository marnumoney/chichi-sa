#!/usr/bin/env bash
# Encrypted SQLite backup using age (X25519 + ChaCha20-Poly1305)
# Restoring: age --decrypt -i ~/.age_backup.key <file>.db.age > restored.db

set -euo pipefail

BACKUP_DIR="$HOME/.db_backups"
AGE_PUBKEY="$HOME/.age_backup.pub"
KEY_FILE="$HOME/.db_master.key"
DATE=$(date +%Y%m%d_%H%M%S)
PYTHON="$HOME/agency/venv/bin/python"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

DB_KEY=$(cat "$KEY_FILE")

backup_db() {
    local src="$1"
    local name="$2"
    local tmp
    [[ -f "$src" ]] || { echo "ERROR: source $src not found"; exit 1; }
    tmp=$(mktemp --suffix=".db")
    local dest="$BACKUP_DIR/${name}_${DATE}.db.age"
    trap 'rm -f "${tmp:-}" "${dest:-}.tmp"' EXIT

    # Consistent WAL-safe snapshot via sqlcipher — export to plaintext sqlite3
    SQLCIPHER_KEY="$DB_KEY" "$PYTHON" - "$src" "$tmp" <<'PYEOF'
import sys, os
from sqlcipher3 import dbapi2 as sqlite3
src, tmp = sys.argv[1], sys.argv[2]
key = os.environ["SQLCIPHER_KEY"]
conn = sqlite3.connect(src)
conn.execute(f'PRAGMA key="{key}"')
conn.execute("PRAGMA cipher_page_size = 4096")
conn.execute("PRAGMA kdf_iter = 256000")
conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
conn.execute(f"ATTACH DATABASE '{tmp}' AS plaintext KEY ''")
conn.execute("SELECT sqlcipher_export('plaintext')")
conn.execute("DETACH DATABASE plaintext")
conn.close()
PYEOF

    # Encrypt with age — write to staging file then move atomically
    "$HOME/.local/bin/age" --recipients-file "$AGE_PUBKEY" "$tmp" > "${dest}.tmp"
    chmod 600 "${dest}.tmp"
    mv "${dest}.tmp" "$dest"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backed up $name → $dest"
}

backup_db "$HOME/agency/data/agency.db"   "agency"
backup_db "$HOME/lead-agent/leads.db"     "leads"

# Keep last 30 backups per database
find "$BACKUP_DIR" -name "agency_*.db.age" | sort | head -n -30 | xargs -r rm -f
find "$BACKUP_DIR" -name "leads_*.db.age"  | sort | head -n -30 | xargs -r rm -f

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete."
