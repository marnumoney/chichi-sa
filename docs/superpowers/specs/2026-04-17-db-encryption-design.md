# Database Encryption Design

**Date:** 2026-04-17  
**Status:** Approved  
**Scope:** `agency/data/agency.db` and `lead-agent/leads.db`

---

## Overview

Full at-rest encryption of both SQLite databases using SQLCipher 4 with hardened settings, transparent key loading from a local key file, `age`-encrypted backups, and a daily cron job.

---

## 1. At-Rest Encryption — SQLCipher 4 Hardened

### Library

Replace `import sqlite3` with `from sqlcipher3 import dbapi2 as sqlite3` in both:
- `agency/shared/db.py`
- `lead-agent/db.py`

### Cipher settings (applied via PRAGMA after every `connect()`)

| PRAGMA | Value | Reason |
|---|---|---|
| `key` | 64-char hex key | Unlocks the database |
| `cipher_page_size` | 4096 | Larger pages, harder to partially decrypt |
| `kdf_iter` | 256000 | PBKDF2 rounds — slows brute force |
| `cipher_hmac_algorithm` | HMAC_SHA512 | Page integrity check with SHA-512 |
| `cipher_kdf_algorithm` | PBKDF2_HMAC_SHA512 | Key derivation with SHA-512 |

### Migration

Existing plain `.db` files are migrated once using SQLCipher's `ATTACH` + `sqlcipher_export()` pattern. Original files are deleted after migration is verified. Data is fully preserved.

---

## 2. Key Management

### Key file

- Path: `~/.db_master.key`
- Format: 64-character lowercase hex string (256 bits from `os.urandom(32)`)
- Permissions: `400` (owner read-only)
- Never committed to git, never in `.env`, never logged

### Key loading helper

Both `db.py` files call a shared `_load_key()` helper that reads and strips the key file. The key is passed to the `PRAGMA key` immediately after `connect()`.

### Key rotation

A standalone `rekey.py` script re-encrypts both databases with a new key using `PRAGMA rekey`. The old key file is overwritten atomically.

---

## 3. Encrypted Backups — `age` + Cron

### Tool: `age`

- Installed via `apt install age`
- Key pair generated once: `age-keygen -o ~/.age_backup.key`
- Public key extracted to `~/.age_backup.pub` (`400` permissions on private key)
- Backups encrypted to public key — private key never used by the backup script itself

### Backup script: `backup_dbs.sh`

Per database:
1. `sqlite3 <db> ".backup <tmpfile>"` — consistent WAL-safe snapshot
2. `age --recipients-file ~/.age_backup.pub <tmpfile> > <dest>.db.age` — encrypt
3. Delete temp file
4. Prune: keep last 30 backups per database

Output directory: `~/.db_backups/` (`700`)  
Log: `~/.db_backups/backup.log`

### Cron schedule

```
0 3 * * * /home/marnu/backup_dbs.sh >> ~/.db_backups/backup.log 2>&1
```

### Restore command

```bash
age --decrypt -i ~/.age_backup.key agency_YYYYMMDD_HHMMSS.db.age | sqlite3 restored.db
```

---

## 4. System Dependencies

| Package | Install | Purpose |
|---|---|---|
| `libsqlcipher-dev` | `apt install libsqlcipher-dev` | SQLCipher C library |
| `sqlcipher3` | `pip install sqlcipher3` | Python binding |
| `age` | `apt install age` | Backup encryption |

---

## 5. Files Changed

| File | Change |
|---|---|
| `agency/shared/db.py` | Use sqlcipher3, add `_load_key()`, apply 4 PRAGMAs in `init_db()` |
| `lead-agent/db.py` | Same as above |
| `backup_dbs.sh` | Rewrite to use `age` instead of `openssl enc` |
| `migrate_to_encrypted.py` | One-time migration script (deleted after use) |
| `~/.db_master.key` | Generated key file (not in repo) |
| `~/.age_backup.key` | age private key (not in repo) |
| `~/.age_backup.pub` | age public key (not in repo) |

---

## 6. Security Properties After Implementation

| Attack | Protection |
|---|---|
| File theft of `.db` | AES-256-CBC + HMAC-SHA512 per page, 256K PBKDF2 rounds |
| Backup theft | X25519 + ChaCha20-Poly1305 (age) — no password to brute-force |
| Git exposure | `.db`, `.key`, `.age` files all gitignored |
| SQL injection | Parameterized queries throughout (unchanged) |
| Unauthorized file read | `chmod 400/600` on key files and databases |
