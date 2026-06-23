import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from unittest.mock import patch, MagicMock
import pytest
from notify import send_digest


def test_send_digest_calls_gmail_smtp(tmp_path):
    journal = tmp_path / "2026-06-23.md"
    journal.write_text("# Trade Journal — 2026-06-23\nTest content")

    with patch("notify.smtplib.SMTP_SSL") as mock_smtp_class:
        with patch.dict("os.environ", {
            "GMAIL_USER": "test@gmail.com",
            "GMAIL_APP_PASSWORD": "testpassword",
            "NOTIFY_EMAIL": "notify@gmail.com",
        }):
            mock_server = MagicMock()
            mock_smtp_class.return_value.__enter__ = MagicMock(return_value=mock_server)
            mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)
            send_digest(str(journal))

    mock_server.login.assert_called_once_with("test@gmail.com", "testpassword")
    mock_server.sendmail.assert_called_once()


def test_send_digest_raises_on_missing_file():
    with pytest.raises(FileNotFoundError):
        send_digest("/nonexistent/path/journal.md")


def test_send_digest_raises_on_missing_gmail_user(tmp_path):
    journal = tmp_path / "2026-06-23.md"
    journal.write_text("# Trade Journal\nTest content")

    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(RuntimeError, match="GMAIL_USER"):
            send_digest(str(journal))
