import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

DAILY_SEND_LIMIT = 100
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def get_access_token(config: dict) -> dict:
    """Return Gmail SMTP credentials from config."""
    return {
        "sender": config["sender_email"],
        "password": config["app_password"],
    }


def send_email(token: dict, sender: str, to_email: str, subject: str, body: str) -> str:
    """Send an email via Gmail SMTP. Returns a message ID string."""
    password = token["password"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(sender, password)
        smtp.sendmail(sender, to_email, msg.as_string())

    logger.info("Email sent to %s via Gmail SMTP", to_email)
    return f"gmail-{to_email}"
