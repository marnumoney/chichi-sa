#!/usr/bin/env bash
# Encrypted SQLite backup using age (X25519 + ChaCha20-Poly1305)
# Restoring: age --decrypt -i ~/.age_backup.key <file>.db.age | sqlite3 restored.db

set -euo pipefail

BACKUP_DIR="$HOME/.db_backups"
AGE_PUBKEY="$HOME/.age_backup.pub"
KEY_FILE="$HOME/.db_master.key"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

DB_KEY=$(cat "$KEY_FILE")

backup_db() {
    local src="$1"
    local name="$2"
    local tmp
    tmp=$(mktemp --suffix=".db")
    local dest="$BACKUP_DIR/${name}_${DATE}.db.age"

    # Consistent WAL-safe snapshot via sqlcipher — export to plaintext sqlite3
    /home/marnu/agency/venv/bin/python - <<EOF
from sqlcipher3 import dbapi2 as sqlite3
conn = sqlite3.connect("$src")
conn.execute('PRAGMA key="$DB_KEY"')
conn.execute("PRAGMA cipher_page_size = 4096")
conn.execute("PRAGMA kdf_iter = 256000")
conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
conn.execute("ATTACH DATABASE '$tmp' AS plaintext KEY ''")
conn.execute("SELECT sqlcipher_export('plaintext')")
conn.execute("DETACH DATABASE plaintext")
conn.close()
EOF

    # Encrypt with age
    "$HOME/.local/bin/age" --recipients-file "$AGE_PUBKEY" "$tmp" > "$dest"
    rm -f "$tmp"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backed up $name → $dest"
}

backup_db "$HOME/agency/data/agency.db"   "agency"
backup_db "$HOME/lead-agent/leads.db"     "leads"

# Keep last 30 backups per database
find "$BACKUP_DIR" -name "agency_*.db.age" | sort | head -n -30 | xargs -r rm -f
find "$BACKUP_DIR" -name "leads_*.db.age"  | sort | head -n -30 | xargs -r rm -f

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete."
