import logging
import os
import yaml
import anthropic
from datetime import datetime, timezone

from db import init_db, insert_lead, get_uncontacted_leads, insert_email, get_daily_sent_count
from scraper import scrape_businesses
from qualifier import qualify
from composer import compose_email
from mailer import get_access_token, send_email, DAILY_SEND_LIMIT

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
    with open(path) as f:
        return yaml.safe_load(f)


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

    # --- Check daily cap ---
    already_sent_today = get_daily_sent_count(conn)
    remaining = DAILY_SEND_LIMIT - already_sent_today
    if remaining <= 0:
        logger.info("Daily send limit of %d already reached. Exiting.", DAILY_SEND_LIMIT)
        return

    # --- Get uncontacted leads with emails ---
    leads_to_email = get_uncontacted_leads(conn, limit=remaining)
    logger.info("Found %d leads to email today (cap: %d)", len(leads_to_email), remaining)

    if not leads_to_email:
        logger.info("No leads with email addresses available today.")
        return

    # --- Auth ---
    try:
        token = get_access_token(config["microsoft"])
    except RuntimeError as e:
        logger.error("Auth failed: %s", e)
        return

    # --- Compose & Send ---
    anthropic_client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
    sent_count = 0
    failed_count = 0

    for lead in leads_to_email:
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(sep=" ", timespec="seconds")
        try:
            email = compose_email(lead, config["agency"], anthropic_client)
            msg_id = send_email(
                token=token,
                sender=config["microsoft"]["sender_email"],
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
            })
            logger.info("Sent to %s", lead["email"])
            sent_count += 1
        except Exception as e:
            logger.error("Failed for lead %s: %s", lead.get("business_name", "unknown"), e)
            insert_email(conn, {
                "lead_id": lead["id"],
                "sent_at": now,
                "status": "failed",
                "subject": "",
                "body": "",
                "outlook_message_id": "",
            })
            failed_count += 1

    logger.info("=== Done: %d sent, %d failed ===", sent_count, failed_count)


if __name__ == "__main__":
    run()
