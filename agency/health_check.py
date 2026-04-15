"""Daily health check for Agency OS."""
import logging
import os
from datetime import date

from ceo import load_config
from shared.db import init_db, get_business_metrics
from shared.notifier import send_notification

LOG_PATH = os.path.join(os.path.dirname(__file__), "logs", "agency.log")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")
HEALTH_LOG = os.path.join(os.path.dirname(__file__), "logs", "health.log")


def setup_logging():
    os.makedirs(os.path.dirname(HEALTH_LOG), exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.FileHandler(HEALTH_LOG), logging.StreamHandler()],
    )


def run():
    setup_logging()
    logger = logging.getLogger("health_check")
    config = load_config(CONFIG_PATH)
    conn = init_db(config["database"]["path"])
    ntfy_topic = config["notifications"]["ntfy_topic"]
    issues = []
    today = date.today().isoformat()

    # Check CEO ran today
    if os.path.exists(LOG_PATH):
        with open(LOG_PATH) as f:
            lines = f.readlines()
        if not any(today in line and "CEO Agent starting" in line for line in lines):
            issues.append("CEO agent did not start today")
        errors = [line.strip() for line in lines
                  if today in line and " [ERROR] " in line and "ntfy" not in line.lower()]
        if errors:
            issues.append(f"{len(errors)} errors in today's log")
    else:
        issues.append("agency.log missing")

    # DB health
    try:
        metrics = get_business_metrics(conn)
        conn.close()
        if metrics["total_leads"] == 0:
            issues.append("0 leads in DB — scraper may be broken")
    except Exception as e:
        issues.append(f"DB error: {e}")

    if issues:
        send_notification(
            ntfy_topic,
            f"Agency Health — {len(issues)} issue(s)",
            "\n".join(f"• {i}" for i in issues),
            priority="high",
        )
        logger.warning("Health check FAILED: %s", issues)
    else:
        send_notification(
            ntfy_topic, "Agency Health OK",
            f"All systems normal. {metrics['total_leads']} leads, "
            f"{metrics['reply_rate_pct']}% reply rate.",
            priority="low",
        )
        logger.info("Health check PASSED")


if __name__ == "__main__":
    run()
