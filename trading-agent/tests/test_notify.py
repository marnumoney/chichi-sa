import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from unittest.mock import patch, MagicMock
import pytest
from notify import send_digest


def test_send_digest_calls_sendgrid(tmp_path):
    journal = tmp_path / "2026-06-23.md"
    journal.write_text("# Trade Journal — 2026-06-23\nTest content")

    with patch("notify.sendgrid.SendGridAPIClient") as mock_sg_class:
        with patch("notify.os.getenv") as mock_getenv:
            mock_getenv.side_effect = lambda key, default=None: "test-api-key" if key == "SENDGRID_API_KEY" else default
            mock_client = MagicMock()
            mock_sg_class.return_value = mock_client
            send_digest(str(journal))

    mock_client.send.assert_called_once()


def test_send_digest_raises_on_missing_file():
    with pytest.raises(FileNotFoundError):
        send_digest("/nonexistent/path/journal.md")


def test_send_digest_raises_on_missing_api_key(tmp_path):
    journal = tmp_path / "2026-06-23.md"
    journal.write_text("# Trade Journal\nTest content")

    with patch("notify.os.getenv", return_value=None):
        with pytest.raises(RuntimeError, match="SENDGRID_API_KEY"):
            send_digest(str(journal))
