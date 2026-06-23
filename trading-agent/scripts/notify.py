import os
import sys
import sendgrid
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


def send_digest(journal_path):
    with open(journal_path, 'r') as f:
        content = f.read()

    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY must be set in .env")

    date_str = os.path.basename(journal_path).replace('.md', '')
    sg = sendgrid.SendGridAPIClient(api_key)
    message = Mail(
        from_email=os.getenv("SENDGRID_FROM_EMAIL", "agent@yourdomain.com"),
        to_emails=os.getenv("NOTIFY_EMAIL"),
        subject=f"Trading Agent Report — {date_str}",
        plain_text_content=content,
    )
    sg.send(message)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python notify.py journal/YYYY-MM-DD.md")
        sys.exit(1)
    try:
        send_digest(sys.argv[1])
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
