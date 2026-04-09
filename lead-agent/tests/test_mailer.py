import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from unittest.mock import MagicMock, patch
from mailer import get_access_token, send_email


MICROSOFT_CONFIG = {
    "client_id": "fake_client_id",
    "client_secret": "fake_secret",
    "tenant_id": "fake_tenant",
    "sender_email": "hello.launchpadstudio@outlook.com",
}


def test_get_access_token_returns_token(mocker):
    mock_app = MagicMock()
    mock_app.acquire_token_for_client.return_value = {"access_token": "tok_abc123"}
    mocker.patch("mailer.msal.ConfidentialClientApplication", return_value=mock_app)
    token = get_access_token(MICROSOFT_CONFIG)
    assert token == "tok_abc123"


def test_get_access_token_raises_on_failure(mocker):
    mock_app = MagicMock()
    mock_app.acquire_token_for_client.return_value = {"error": "invalid_client"}
    mocker.patch("mailer.msal.ConfidentialClientApplication", return_value=mock_app)
    with pytest.raises(RuntimeError, match="Failed to acquire token"):
        get_access_token(MICROSOFT_CONFIG)


def test_send_email_returns_message_id(mocker):
    mock_post = mocker.patch("mailer.requests.post")
    mock_post.return_value = MagicMock(
        status_code=202,
        headers={"x-ms-request-id": "msg_xyz789"},
    )
    msg_id = send_email(
        token="tok_abc123",
        sender="hello.launchpadstudio@outlook.com",
        to_email="target@business.com",
        subject="Great opportunity",
        body="Hello, we noticed you have no website...",
    )
    assert msg_id == "msg_xyz789"
    assert mock_post.called


def test_send_email_raises_on_non_202(mocker):
    mock_post = mocker.patch("mailer.requests.post")
    mock_post.return_value = MagicMock(status_code=400, text="Bad Request")
    with pytest.raises(RuntimeError, match="Failed to send email"):
        send_email(
            token="tok_abc123",
            sender="hello.launchpadstudio@outlook.com",
            to_email="target@business.com",
            subject="Hi",
            body="Hello",
        )
