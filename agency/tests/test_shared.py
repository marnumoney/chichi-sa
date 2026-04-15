import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from unittest.mock import patch, MagicMock


def test_send_notification_success():
    from shared.notifier import send_notification
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    with patch("shared.notifier.requests.post", return_value=mock_resp) as mock_post:
        result = send_notification("test-topic", "Test Title", "Test message")
    assert result is True
    mock_post.assert_called_once()


def test_send_notification_retries_on_connection_error():
    from shared.notifier import send_notification
    import requests as req_lib
    with patch("shared.notifier.requests.post",
               side_effect=req_lib.exceptions.ConnectionError("DNS fail")) as mock_post:
        with patch("shared.notifier.time.sleep"):  # don't actually sleep
            result = send_notification("test-topic", "Test Title", "Test message")
    assert result is False
    assert mock_post.call_count == 3  # retried 3 times


def test_get_access_token():
    from shared.mailer import get_access_token
    token = get_access_token({"sender_email": "test@gmail.com", "app_password": "secret"})
    assert token["sender"] == "test@gmail.com"
    assert token["password"] == "secret"
