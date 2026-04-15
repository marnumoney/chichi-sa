import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
DAILY_SEND_LIMIT = 45


def get_access_token(config: dict) -> dict:
    """Return a token dict for Gmail SMTP (just wraps the credentials)."""
    return {
        "sender": config["sender_email"],
        "password": config["app_password"],
    }


def send_email(token: dict, sender: str, to_email: str, subject: str, body: str) -> str:
    """Send email via Gmail SMTP. Returns a message ID string."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain", "utf-8"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(sender, token["password"])
        smtp.sendmail(sender, to_email, msg.as_string())
    logger.info("Email sent to %s via Gmail SMTP", to_email)
    return f"gmail-{to_email}"
