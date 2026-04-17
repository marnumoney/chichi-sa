import logging
import os
import yaml
import anthropic
from datetime import datetime, timezone

from db import init_db, insert_lead, get_uncontacted_leads, insert_email, get_daily_sent_count, update_lead_email, get_leads_without_email, get_leads_for_followup
from followup import compose_followup
from reply_checker import check_replies
from scraper import scrape_businesses
from qualifier import qualify
from composer import compose_email
from mailer import get_access_token, send_email, DAILY_SEND_LIMIT
from email_finder import find_email
from notifier import notify_run_complete
from phone_mailer import email_new_phone_leads

LOG_PATH = os.path.join(os.path.dirname(__file__), "logs", "agent.log")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(LOG_PATH),
            logging.StreamHandler(),
        ],
    )


def load_config(path: str) -> dict:
    # Load .env from same directory as config (never committed)
    env_path = os.path.join(os.path.dirname(path), ".env")
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()

    with open(path) as f:
        config = yaml.safe_load(f)

    # Inject secrets from .env into config structure
    if "ANTHROPIC_API_KEY" in env:
        config.setdefault("anthropic", {})["api_key"] = env["ANTHROPIC_API_KEY"]
    if "GOOGLE_PLACES_API_KEY" in env:
        config.setdefault("google_places", {})["api_key"] = env["GOOGLE_PLACES_API_KEY"]
    if "GMAIL_SENDER_EMAIL" in env:
        config.setdefault("gmail", {})["sender_email"] = env["GMAIL_SENDER_EMAIL"]
    if "GMAIL_APP_PASSWORD" in env:
        config.setdefault("gmail", {})["app_password"] = env["GMAIL_APP_PASSWORD"]
    if "SMTP_PASSWORD" in env:
        config.setdefault("gmail", {})["smtp_password"] = env["SMTP_PASSWORD"]
    if "MICROSOFT_CLIENT_ID" in env:
        config.setdefault("microsoft", {})["client_id"] = env["MICROSOFT_CLIENT_ID"]
    if "MICROSOFT_CLIENT_SECRET" in env:
        config.setdefault("microsoft", {})["client_secret"] = env["MICROSOFT_CLIENT_SECRET"]
    if "MICROSOFT_TENANT_ID" in env:
        config.setdefault("microsoft", {})["tenant_id"] = env["MICROSOFT_TENANT_ID"]
    if "MICROSOFT_SENDER_EMAIL" in env:
        config.setdefault("microsoft", {})["sender_email"] = env["MICROSOFT_SENDER_EMAIL"]

    return config


def run():
    setup_logging()
    logger = logging.getLogger("main")
    logger.info("=== Lead Agent starting ===")

    try:
        config = load_config(CONFIG_PATH)
    except (FileNotFoundError, Exception) as e:
        logger.error("Failed to load config from %s: %s", CONFIG_PATH, e)
        return

    conn = init_db(config["database"]["path"])
    try:
        _run_pipeline(config, conn)
    finally:
        conn.close()


def _run_pipeline(config: dict, conn) -> None:
    logger = logging.getLogger("main")

    # --- Check for replies ---
    logger.info("Checking Gmail for replies...")
    ntfy_topic = config.get("notifications", {}).get("ntfy_topic")
    anthropic_client_early = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
    new_replies = check_replies(
        gmail_config=config["gmail"],
        agency=config["agency"],
        conn=conn,
        client=anthropic_client_early,
        ntfy_topic=ntfy_topic,
    )
    logger.info("Replies found: %d", new_replies)

    # --- Scrape ---
    logger.info("Scraping Google Places...")
    raw_places = scrape_businesses(config["google_places"])
    logger.info("Scraped %d raw places", len(raw_places))

    # --- Qualify & store new leads ---
    new_leads = qualify(raw_places, conn, config["google_places"])
    logger.info("Qualified %d new leads", len(new_leads))
    for lead in new_leads:
        try:
            insert_lead(conn, lead)
        except Exception as e:
            logger.error("Failed to insert lead %s: %s", lead.get("business_name", "?"), e)

    # --- Email new phone-only leads to Marnu ---
    phone_only = [l for l in new_leads if l.get("phone") and not l.get("email")]
    if phone_only:
        try:
            email_new_phone_leads(config["gmail"], phone_only, config.get("report_recipient", "main.launchpadstudio@outlook.com"))
            logger.info("Emailed %d new phone-only leads to Marnu", len(phone_only))
        except Exception as e:
            logger.error("Failed to email phone leads: %s", e)

    # --- Find emails for leads that don't have one ---
    leads_needing_email = get_leads_without_email(conn, limit=200)
    logger.info("Searching web for emails for %d leads...", len(leads_needing_email))
    found_count = 0
    for lead in leads_needing_email:
        try:
            email = find_email(lead)
            if email:
                update_lead_email(conn, lead["id"], email)
                found_count += 1
        except Exception as e:
            logger.error("Email finder error for %s: %s", lead.get("business_name", "?"), e)
    logger.info("Found emails for %d/%d leads", found_count, len(leads_needing_email))

    # --- Check daily cap ---
    already_sent_today = get_daily_sent_count(conn)
    remaining = DAILY_SEND_LIMIT - already_sent_today
    if remaining <= 0:
        logger.info("Daily send limit of %d already reached. Exiting.", DAILY_SEND_LIMIT)
        return

    # --- Auth ---
    try:
        token = get_access_token(config["gmail"])
    except RuntimeError as e:
        logger.error("Auth failed: %s", e)
        return

    anthropic_client = anthropic_client_early
    sent_count = 0
    failed_count = 0
    emailed_leads = []

    def _send_one(lead: dict, email: dict, follow_up_number: int) -> bool:
        nonlocal sent_count, failed_count
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(sep=" ", timespec="seconds")
        try:
            msg_id = send_email(
                token=token,
                sender=config["gmail"]["sender_email"],
                to_email=lead["email"],
                subject=email["subject"],
                body=email["body"],
            )
            insert_email(conn, {
                "lead_id": lead["id"],
                "sent_at": now,
                "status": "sent",
                "subject": email["subject"],
                "body": email["body"],
                "outlook_message_id": msg_id,
                "follow_up_number": follow_up_number,
            })
            logger.info("Sent follow_up=%d to %s", follow_up_number, lead["email"])
            emailed_leads.append({"business_name": lead["business_name"], "city": lead["city"], "email": lead["email"]})
            sent_count += 1
            return True
        except Exception as e:
            logger.error("Failed for lead %s: %s", lead.get("business_name", "unknown"), e)
            insert_email(conn, {
                "lead_id": lead["id"],
                "sent_at": now,
                "status": "failed",
                "subject": email.get("subject", ""),
                "body": email.get("body", ""),
                "outlook_message_id": "",
                "follow_up_number": follow_up_number,
            })
            failed_count += 1
            return False

    # --- Day 3 follow-ups ---
    day3_leads = get_leads_for_followup(conn, days_since_first=3, follow_up_number=1)
    logger.info("Day-3 follow-ups due: %d", len(day3_leads))
    for lead in day3_leads:
        if remaining <= 0:
            break
        email = compose_followup(lead, config["agency"], follow_up_number=1)
        if _send_one(lead, email, follow_up_number=1):
            remaining -= 1

    # --- Day 7 follow-ups ---
    day7_leads = get_leads_for_followup(conn, days_since_first=7, follow_up_number=2)
    logger.info("Day-7 follow-ups due: %d", len(day7_leads))
    for lead in day7_leads:
        if remaining <= 0:
            break
        email = compose_followup(lead, config["agency"], follow_up_number=2)
        if _send_one(lead, email, follow_up_number=2):
            remaining -= 1

    # --- Get uncontacted leads with emails ---
    leads_to_email = get_uncontacted_leads(conn, limit=remaining)
    logger.info("Found %d new leads to email today (cap remaining: %d)", len(leads_to_email), remaining)

    if not leads_to_email:
        logger.info("No new leads with email addresses available today.")

    for lead in leads_to_email:
        try:
            email = compose_email(lead, config["agency"], anthropic_client)
            _send_one(lead, email, follow_up_number=0)
        except Exception as e:
            logger.error("Compose failed for %s: %s", lead.get("business_name", "unknown"), e)

    logger.info("=== Done: %d sent, %d failed ===", sent_count, failed_count)

    ntfy_topic = config.get("notifications", {}).get("ntfy_topic")
    if ntfy_topic:
        notify_run_complete(ntfy_topic, {
            "scraped": len(raw_places),
            "qualified": len(new_leads),
            "emails_found": found_count,
            "sent": sent_count,
            "failed": failed_count,
            "emailed_leads": emailed_leads,
        })


if __name__ == "__main__":
    run()
