# Database Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt both SQLite databases at rest using SQLCipher 4 with hardened settings, transparent key loading, age-encrypted backups, and a daily cron job.

**Architecture:** SQLCipher replaces the stdlib `sqlite3` module in both `db.py` files — the API is identical so application code is unchanged beyond the import and `init_db` signature. A shared key file at `~/.db_master.key` is read transparently on startup. Existing databases are migrated once using `sqlcipher_export()`. Backups are encrypted with `age` (X25519 + ChaCha20-Poly1305) and scheduled via cron.

**Tech Stack:** SQLCipher 4 (`libsqlcipher-dev`, `sqlcipher3` Python package), `age` backup encryption, Python 3.12, bash, crontab.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `agency/shared/db.py` | Add `_load_key()`, `_apply_cipher_settings()`, update `init_db()` |
| Modify | `lead-agent/db.py` | Same changes |
| Modify | `agency/requirements.txt` | Add `sqlcipher3` |
| Modify | `lead-agent/requirements.txt` | Add `sqlcipher3` |
| Modify | `agency/tests/test_db.py` | Pass `key="testkey"` to `init_db(":memory:", ...)` |
| Create | `agency/tests/test_db_encryption.py` | Verify file-based DB is actually encrypted |
| Create | `migrate_to_encrypted.py` | One-time migration, deleted after use |
| Rewrite | `backup_dbs.sh` | Use `age` instead of `openssl enc` |

---

## Task 1: Install system dependencies

**Files:** none (system-level)

- [ ] **Step 1: Install libsqlcipher-dev and age**

```bash
sudo apt update && sudo apt install -y libsqlcipher-dev age
```

Expected output includes: `Setting up libsqlcipher-dev` and `Setting up age`

- [ ] **Step 2: Verify installations**

```bash
sqlcipher --version
age --version
```

Expected: SQLCipher version line (e.g. `3.x.x`) and age version line (e.g. `v1.x.x`).

- [ ] **Step 3: Install sqlcipher3 Python package in both venvs**

```bash
/home/marnu/agency/venv/venv/bin/pip install sqlcipher3
/home/marnu/lead-agent/venv/bin/pip install sqlcipher3
```

Expected: `Successfully installed sqlcipher3-x.x.x` for each.

- [ ] **Step 4: Update requirements files**

In `agency/requirements.txt`, add:
```
sqlcipher3
```

In `lead-agent/requirements.txt`, add:
```
sqlcipher3
```

- [ ] **Step 5: Commit**

```bash
git add agency/requirements.txt lead-agent/requirements.txt
git commit -m "chore: add sqlcipher3 dependency to both projects"
```

---

## Task 2: Generate encryption keys

**Files:** `~/.db_master.key` (created), `~/.age_backup.key` (created), `~/.age_backup.pub` (created)

- [ ] **Step 1: Generate the master database key**

```bash
python3 -c "import os; open(os.path.expanduser('~/.db_master.key'), 'w').write(os.urandom(32).hex())"
chmod 400 ~/.db_master.key
```

Verify:
```bash
cat ~/.db_master.key | wc -c
```
Expected: `65` (64 hex chars + newline).

- [ ] **Step 2: Generate the age backup key pair**

```bash
age-keygen -o ~/.age_backup.key
chmod 400 ~/.age_backup.key
```

Expected output: `Public key: age1...` — copy that public key value.

- [ ] **Step 3: Save the public key to its own file**

```bash
age-keygen -y ~/.age_backup.key > ~/.age_backup.pub
chmod 400 ~/.age_backup.pub
```

Verify:
```bash
cat ~/.age_backup.pub
```
Expected: a line starting with `age1`.

- [ ] **Step 4: Verify key files exist with correct permissions**

```bash
ls -la ~/.db_master.key ~/.age_backup.key ~/.age_backup.pub
```
Expected: all three show `-r--------` (400).

---

## Task 3: Update agency/shared/db.py

**Files:**
- Modify: `agency/shared/db.py`

- [ ] **Step 1: Replace the sqlite3 import and add os import**

In `agency/shared/db.py`, replace:
```python
import logging
import os
import sqlite3
from datetime import date, timedelta
from typing import Optional
```

With:
```python
import logging
import os
import sqlite3 as _plain_sqlite3
from datetime import date, timedelta
from typing import Optional

from sqlcipher3 import dbapi2 as sqlite3
```

- [ ] **Step 2: Add _load_key() and _apply_cipher_settings() helpers**

After the imports and before `logger = logging.getLogger(__name__)`, add:

```python
def _load_key(key: str | None = None) -> str:
    if key is not None:
        return key
    path = os.path.expanduser("~/.db_master.key")
    with open(path, "r") as f:
        return f.read().strip()


def _apply_cipher_settings(conn: sqlite3.Connection, key: str) -> None:
    conn.execute(f'PRAGMA key="{key}"')
    conn.execute("PRAGMA cipher_page_size = 4096")
    conn.execute("PRAGMA kdf_iter = 256000")
    conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
    conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
```

- [ ] **Step 3: Update init_db() to accept an optional key and apply cipher settings**

Replace the existing `init_db`:
```python
def init_db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    os.chmod(path, 0o600)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn
```

With:
```python
def init_db(path: str, key: str | None = None) -> sqlite3.Connection:
    db_key = _load_key(key)
    conn = sqlite3.connect(path)
    _apply_cipher_settings(conn, db_key)
    if path != ":memory:":
        os.chmod(path, 0o600)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn
```

- [ ] **Step 4: Remove the unused _plain_sqlite3 import**

The `import sqlite3 as _plain_sqlite3` added in Step 1 is not needed — remove it. Final import block:

```python
import logging
import os
from datetime import date, timedelta
from typing import Optional

from sqlcipher3 import dbapi2 as sqlite3
```

---

## Task 4: Update agency tests

**Files:**
- Modify: `agency/tests/test_db.py`
- Create: `agency/tests/test_db_encryption.py`

- [ ] **Step 1: Update the conn fixture to pass key="testkey"**

In `agency/tests/test_db.py`, replace:
```python
@pytest.fixture
def conn():
    c = init_db(":memory:")
    yield c
    c.close()
```

With:
```python
@pytest.fixture
def conn():
    c = init_db(":memory:", key="testkey")
    yield c
    c.close()
```

- [ ] **Step 2: Run existing tests to verify they still pass**

```bash
cd /home/marnu/agency && venv/venv/bin/pytest tests/test_db.py -v
```

Expected: all tests PASS. If any fail, the cipher PRAGMA order or import is wrong — check Task 3.

- [ ] **Step 3: Write the encryption verification test**

Create `agency/tests/test_db_encryption.py`:

```python
import os
import sqlite3 as plain_sqlite3
import tempfile
import pytest
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.db import init_db


def test_database_file_is_encrypted(tmp_path):
    db_path = str(tmp_path / "test_enc.db")
    conn = init_db(db_path, key="testkey")
    conn.close()

    # Plain sqlite3 must NOT be able to read the encrypted file
    plain_conn = plain_sqlite3.connect(db_path)
    with pytest.raises(plain_sqlite3.DatabaseError, match="file is not a database|encrypted"):
        plain_conn.execute("SELECT name FROM sqlite_master").fetchall()
    plain_conn.close()


def test_wrong_key_cannot_open_database(tmp_path):
    db_path = str(tmp_path / "test_wrongkey.db")
    conn = init_db(db_path, key="correctkey")
    conn.close()

    from sqlcipher3 import dbapi2 as sqlcipher3
    bad_conn = sqlcipher3.connect(db_path)
    bad_conn.execute('PRAGMA key="wrongkey"')
    bad_conn.execute("PRAGMA cipher_page_size = 4096")
    bad_conn.execute("PRAGMA kdf_iter = 256000")
    bad_conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
    bad_conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
    with pytest.raises(Exception):
        bad_conn.execute("SELECT name FROM sqlite_master").fetchall()
    bad_conn.close()
```

- [ ] **Step 4: Run to verify it fails (sqlcipher3 not yet wired to test)**

```bash
cd /home/marnu/agency && venv/venv/bin/pytest tests/test_db_encryption.py -v
```

Expected: both tests PASS (encryption is already in place from Task 3).

- [ ] **Step 5: Commit**

```bash
cd /home/marnu/agency
git add tests/test_db.py tests/test_db_encryption.py shared/db.py
git commit -m "feat: encrypt agency db with SQLCipher 4 hardened settings"
```

---

## Task 5: Update lead-agent/db.py

**Files:**
- Modify: `lead-agent/db.py`

- [ ] **Step 1: Replace imports**

In `lead-agent/db.py`, replace:
```python
import os
import sqlite3
from datetime import date
```

With:
```python
import os
from datetime import date

from sqlcipher3 import dbapi2 as sqlite3
```

- [ ] **Step 2: Add _load_key() and _apply_cipher_settings() helpers**

After the imports, add:

```python
def _load_key(key: str | None = None) -> str:
    if key is not None:
        return key
    path = os.path.expanduser("~/.db_master.key")
    with open(path, "r") as f:
        return f.read().strip()


def _apply_cipher_settings(conn: sqlite3.Connection, key: str) -> None:
    conn.execute(f'PRAGMA key="{key}"')
    conn.execute("PRAGMA cipher_page_size = 4096")
    conn.execute("PRAGMA kdf_iter = 256000")
    conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
    conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
```

- [ ] **Step 3: Update init_db() to accept optional key and apply cipher settings**

Replace:
```python
def init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    os.chmod(db_path, 0o600)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
```

With:
```python
def init_db(db_path: str, key: str | None = None) -> sqlite3.Connection:
    db_key = _load_key(key)
    conn = sqlite3.connect(db_path)
    _apply_cipher_settings(conn, db_key)
    if db_path != ":memory:":
        os.chmod(db_path, 0o600)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
```

- [ ] **Step 4: Write a quick smoke test**

Create `lead-agent/test_db_enc.py` (temporary, deleted after this task):

```python
import tempfile, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from db import init_db, insert_lead, lead_exists
from datetime import date

with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
    path = f.name

conn = init_db(path, key="smoketest")
lead = {"place_id": "x1", "business_name": "Test Biz", "industry": "test",
        "city": "Durban", "phone": None, "email": "t@t.com",
        "rating": 4.0, "review_count": 1, "found_date": str(date.today())}
insert_lead(conn, lead)
assert lead_exists(conn, "x1")
conn.close()
os.unlink(path)
print("PASS: lead-agent db encryption works")
```

- [ ] **Step 5: Run smoke test**

```bash
cd /home/marnu/lead-agent && venv/bin/python test_db_enc.py
```

Expected: `PASS: lead-agent db encryption works`

- [ ] **Step 6: Delete smoke test and commit**

```bash
rm /home/marnu/lead-agent/test_db_enc.py
cd /home/marnu
git add lead-agent/db.py
git commit -m "feat: encrypt lead-agent db with SQLCipher 4 hardened settings"
```

---

## Task 6: Migrate existing databases to encrypted format

**Files:**
- Create: `migrate_to_encrypted.py` (deleted after use)

- [ ] **Step 1: Verify both databases have data worth preserving**

```bash
sqlite3 /home/marnu/agency/data/agency.db "SELECT COUNT(*) FROM leads; SELECT COUNT(*) FROM clients;"
sqlite3 /home/marnu/lead-agent/leads.db "SELECT COUNT(*) FROM leads;"
```

Note the row counts — you will verify the same counts after migration.

- [ ] **Step 2: Create the migration script**

Create `/home/marnu/migrate_to_encrypted.py`:

```python
#!/usr/bin/env python3
"""One-time migration: converts plaintext SQLite databases to SQLCipher 4.
Run once, then delete this file.
"""
import os
import shutil
import sys

from sqlcipher3 import dbapi2 as sqlite3

KEY_FILE = os.path.expanduser("~/.db_master.key")
DATABASES = [
    "/home/marnu/agency/data/agency.db",
    "/home/marnu/lead-agent/leads.db",
]


def load_key() -> str:
    with open(KEY_FILE) as f:
        return f.read().strip()


def migrate(db_path: str, key: str) -> None:
    enc_path = db_path + ".enc"
    backup_path = db_path + ".bak"

    print(f"Migrating {db_path} ...")

    # Open plaintext db with SQLCipher (no key = open as plaintext)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA cipher_page_size = 4096")

    # Export to encrypted copy
    conn.execute(f"ATTACH DATABASE '{enc_path}' AS encrypted KEY '{key}'")
    conn.execute("PRAGMA encrypted.cipher_page_size = 4096")
    conn.execute("PRAGMA encrypted.kdf_iter = 256000")
    conn.execute("PRAGMA encrypted.cipher_hmac_algorithm = HMAC_SHA512")
    conn.execute("PRAGMA encrypted.cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
    conn.execute("SELECT sqlcipher_export('encrypted')")
    conn.execute("DETACH DATABASE encrypted")
    conn.close()

    # Verify encrypted copy opens correctly
    verify_conn = sqlite3.connect(enc_path)
    verify_conn.execute(f'PRAGMA key="{key}"')
    verify_conn.execute("PRAGMA cipher_page_size = 4096")
    verify_conn.execute("PRAGMA kdf_iter = 256000")
    verify_conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
    verify_conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
    count = verify_conn.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()[0]
    verify_conn.close()

    if count == 0:
        raise RuntimeError(f"Verification failed for {enc_path} — aborting migration")

    # Swap files
    shutil.copy2(db_path, backup_path)
    os.replace(enc_path, db_path)
    os.chmod(db_path, 0o600)

    print(f"  Done. Backup at {backup_path}. Verify then delete it.")


if __name__ == "__main__":
    key = load_key()
    for db in DATABASES:
        migrate(db, key)
    print("\nMigration complete. Test your agents, then delete the .bak files and this script.")
```

- [ ] **Step 3: Run the migration**

```bash
cd /home/marnu && python3 migrate_to_encrypted.py
```

Expected output:
```
Migrating /home/marnu/agency/data/agency.db ...
  Done. Backup at /home/marnu/agency/data/agency.db.bak. Verify then delete it.
Migrating /home/marnu/lead-agent/leads.db ...
  Done. Backup at /home/marnu/lead-agent/leads.db.bak. Verify then delete it.

Migration complete. Test your agents, then delete the .bak files and this script.
```

- [ ] **Step 4: Verify the migrated databases are readable with the key**

```bash
python3 - <<'EOF'
from sqlcipher3 import dbapi2 as sqlite3
import os

key = open(os.path.expanduser("~/.db_master.key")).read().strip()

for path in ["/home/marnu/agency/data/agency.db", "/home/marnu/lead-agent/leads.db"]:
    conn = sqlite3.connect(path)
    conn.execute(f'PRAGMA key="{key}"')
    conn.execute("PRAGMA cipher_page_size = 4096")
    conn.execute("PRAGMA kdf_iter = 256000")
    conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
    conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
    leads = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    print(f"{path}: {leads} leads — OK")
    conn.close()
EOF
```

Expected: both databases print their lead count.

- [ ] **Step 5: Verify the files are no longer readable as plain SQLite**

```bash
python3 - <<'EOF'
import sqlite3
for path in ["/home/marnu/agency/data/agency.db", "/home/marnu/lead-agent/leads.db"]:
    try:
        conn = sqlite3.connect(path)
        conn.execute("SELECT name FROM sqlite_master").fetchall()
        print(f"FAIL: {path} is NOT encrypted")
    except Exception as e:
        print(f"PASS: {path} is encrypted ({e})")
EOF
```

Expected: both lines print `PASS: ... is encrypted`.

- [ ] **Step 6: Run agency test suite to confirm everything works end-to-end**

```bash
cd /home/marnu/agency && venv/venv/bin/pytest tests/test_db.py tests/test_db_encryption.py -v
```

Expected: all tests PASS.

- [ ] **Step 7: Delete backups and migration script**

```bash
rm /home/marnu/agency/data/agency.db.bak
rm /home/marnu/lead-agent/leads.db.bak
rm /home/marnu/migrate_to_encrypted.py
```

- [ ] **Step 8: Commit**

```bash
git add -u
git commit -m "feat: migrate existing databases to SQLCipher 4 encryption"
```

---

## Task 7: Rewrite backup_dbs.sh with age

**Files:**
- Rewrite: `backup_dbs.sh`

- [ ] **Step 1: Rewrite backup_dbs.sh**

Replace the entire contents of `/home/marnu/backup_dbs.sh` with:

```bash
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

    # Consistent WAL-safe snapshot via sqlcipher
    python3 - <<EOF
from sqlcipher3 import dbapi2 as sqlite3
conn = sqlite3.connect("$src")
conn.execute('PRAGMA key="$DB_KEY"')
conn.execute("PRAGMA cipher_page_size = 4096")
conn.execute("PRAGMA kdf_iter = 256000")
conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
conn.execute("VACUUM INTO '$tmp'")
conn.close()
EOF

    # Encrypt with age
    age --recipients-file "$AGE_PUBKEY" "$tmp" > "$dest"
    rm -f "$tmp"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backed up $name → $dest"
}

backup_db "$HOME/agency/data/agency.db"   "agency"
backup_db "$HOME/lead-agent/leads.db"     "leads"

# Keep last 30 backups per database
find "$BACKUP_DIR" -name "agency_*.db.age" | sort | head -n -30 | xargs -r rm -f
find "$BACKUP_DIR" -name "leads_*.db.age"  | sort | head -n -30 | xargs -r rm -f

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete."
```

- [ ] **Step 2: Make it executable**

```bash
chmod 700 /home/marnu/backup_dbs.sh
```

- [ ] **Step 3: Run it once to verify**

```bash
/home/marnu/backup_dbs.sh
```

Expected output:
```
[2026-04-17 ...] Backed up agency → /home/marnu/.db_backups/agency_....db.age
[2026-04-17 ...] Backed up leads → /home/marnu/.db_backups/leads_....db.age
[2026-04-17 ...] Backup complete.
```

- [ ] **Step 4: Verify backups are encrypted age files**

```bash
ls -lh ~/.db_backups/
file ~/.db_backups/*.db.age
```

Expected: files exist, `file` command reports them as binary data (not SQLite).

- [ ] **Step 5: Test restore**

```bash
LATEST_AGENCY=$(ls ~/.db_backups/agency_*.db.age | sort | tail -1)
age --decrypt -i ~/.age_backup.key "$LATEST_AGENCY" | sqlite3 /tmp/restored_agency.db
python3 -c "
import sqlite3
conn = sqlite3.connect('/tmp/restored_agency.db')
print('Restored leads:', conn.execute('SELECT COUNT(*) FROM leads').fetchone()[0])
conn.close()
"
rm /tmp/restored_agency.db
```

Expected: prints `Restored leads: N` (where N matches your lead count from Task 6 Step 1).

Note: The restored backup is a plaintext SQLite file (decrypted for restore). Delete it immediately after verifying.

- [ ] **Step 6: Commit**

```bash
git add backup_dbs.sh
git commit -m "feat: rewrite backup script using age encryption (X25519 + ChaCha20-Poly1305)"
```

---

## Task 8: Schedule daily cron job

**Files:** crontab (system-level, not in repo)

- [ ] **Step 1: Add cron entry**

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * /home/marnu/backup_dbs.sh >> /home/marnu/.db_backups/backup.log 2>&1") | crontab -
```

- [ ] **Step 2: Verify the cron entry was added**

```bash
crontab -l | grep backup_dbs
```

Expected: `0 3 * * * /home/marnu/backup_dbs.sh >> /home/marnu/.db_backups/backup.log 2>&1`

- [ ] **Step 3: Final commit**

```bash
git add agency/shared/db.py lead-agent/db.py backup_dbs.sh
git commit -m "feat: complete database encryption — SQLCipher 4 + age backups + cron" --allow-empty
```

---

## Verification Checklist

After all tasks are complete, confirm:

- [ ] `python3 -c "import sqlite3; sqlite3.connect('agency/data/agency.db').execute('SELECT 1')"` raises an error (file is encrypted)
- [ ] `cd agency && venv/venv/bin/pytest tests/ -v` — all tests pass
- [ ] `~/.db_master.key` permissions are `400`
- [ ] `~/.age_backup.key` permissions are `400`
- [ ] `crontab -l` shows the 3am backup job
- [ ] `ls ~/.db_backups/*.db.age` shows at least one backup file
