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
