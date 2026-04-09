import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from unittest.mock import MagicMock
from composer import compose_email


AGENCY = {
    "name": "Launchpad Studio",
    "website": "https://launchpadstudio.shop",
    "tone": "friendly and professional",
    "services": "affordable, modern websites for local businesses",
    "cta": "Reply to this email to book a free consultation",
}

LEAD = {
    "business_name": "Joe's Plumbing",
    "industry": "plumber",
    "city": "Durban",
    "rating": 4.7,
    "review_count": 58,
    "email": "joe@example.com",
}


def test_compose_email_returns_subject_and_body(mocker):
    mock_client = MagicMock()
    mocker.patch("composer.anthropic.Anthropic", return_value=mock_client)
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="SUBJECT: Great website opportunity\nBODY: Hello Joe...")]
    )
    result = compose_email(LEAD, AGENCY, mock_client)
    assert "subject" in result
    assert "body" in result
    assert len(result["subject"]) > 0
    assert len(result["body"]) > 0


def test_compose_email_subject_stripped(mocker):
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="SUBJECT: Great website opportunity\nBODY: Hello Joe, your plumbing business is amazing.")]
    )
    result = compose_email(LEAD, AGENCY, mock_client)
    assert result["subject"] == "Great website opportunity"
    assert "SUBJECT:" not in result["subject"]


def test_compose_email_body_contains_business_name(mocker):
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="SUBJECT: Hi Joe\nBODY: Joe's Plumbing is fantastic!")]
    )
    result = compose_email(LEAD, AGENCY, mock_client)
    assert "Joe's Plumbing" in result["body"]


def test_compose_email_calls_claude_with_lead_data(mocker):
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="SUBJECT: Hi\nBODY: Hello")]
    )
    compose_email(LEAD, AGENCY, mock_client)
    call_kwargs = mock_client.messages.create.call_args
    prompt = str(call_kwargs)
    assert "Plumbing" in prompt
    assert "Durban" in prompt
    assert "Launchpad Studio" in prompt
