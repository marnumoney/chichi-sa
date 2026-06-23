import os
import sys
import sendgrid
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


def send_digest(journal_path):
    with open(journal_path, 'r') as f:
        content = f.read()

    date_str = os.path.basename(journal_path).replace('.md', '')
    sg = sendgrid.SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
    message = Mail(
        from_email="agent@yourdomain.com",
        to_emails=os.getenv("NOTIFY_EMAIL"),
        subject=f"Trading Agent Report — {date_str}",
        plain_text_content=content,
    )
    sg.send(message)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python notify.py journal/YYYY-MM-DD.md")
        sys.exit(1)
    send_digest(sys.argv[1])
