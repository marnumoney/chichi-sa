import os
import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


def send_digest(journal_path):
    with open(journal_path, 'r') as f:
        content = f.read()

    gmail_user = os.getenv("GMAIL_USER")
    gmail_app_password = os.getenv("GMAIL_APP_PASSWORD")
    notify_email = os.getenv("NOTIFY_EMAIL")

    if not gmail_user:
        raise RuntimeError("GMAIL_USER must be set in .env")
    if not gmail_app_password:
        raise RuntimeError("GMAIL_APP_PASSWORD must be set in .env")
    if not notify_email:
        raise RuntimeError("NOTIFY_EMAIL must be set in .env")

    date_str = os.path.basename(journal_path).replace('.md', '')

    msg = MIMEMultipart()
    msg["From"] = gmail_user
    msg["To"] = notify_email
    msg["Subject"] = f"Trading Agent Report — {date_str}"
    msg.attach(MIMEText(content, "plain"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, gmail_app_password)
        server.sendmail(gmail_user, notify_email, msg.as_string())


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python notify.py journal/YYYY-MM-DD.md")
        sys.exit(1)
    try:
        send_digest(sys.argv[1])
        print("Digest sent.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
