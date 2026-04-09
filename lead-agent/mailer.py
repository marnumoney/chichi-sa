import msal
import requests
import logging

logger = logging.getLogger(__name__)

DAILY_SEND_LIMIT = 100
GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/users/{sender}/sendMail"
SCOPES = ["https://graph.microsoft.com/.default"]


def get_access_token(config: dict) -> str:
    """Acquire an OAuth2 access token from Microsoft using client credentials."""
    client_id = config.get("client_id")
    client_secret = config.get("client_secret")
    tenant_id = config.get("tenant_id")
    if not all([client_id, client_secret, tenant_id]):
        raise ValueError("microsoft config missing client_id, client_secret, or tenant_id")
    app = msal.ConfidentialClientApplication(
        client_id=client_id,
        client_credential=client_secret,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
    )
    result = app.acquire_token_for_client(scopes=SCOPES)
    if "access_token" not in result:
        raise RuntimeError(
            f"Failed to acquire token: {result.get('error_description', result.get('error', 'unknown'))}"
        )
    return result["access_token"]


def send_email(token: str, sender: str, to_email: str, subject: str, body: str) -> str:
    """Send an email via Microsoft Graph API. Returns the outlook_message_id."""
    url = GRAPH_SEND_URL.format(sender=sender)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        },
        "saveToSentItems": True,
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 202:
        raise RuntimeError(
            f"Failed to send email to {to_email}: {response.status_code} {response.text}"
        )
    msg_id = response.headers.get("x-ms-request-id", "")
    logger.info("Email sent to %s — message_id: %s", to_email, msg_id)
    return msg_id
