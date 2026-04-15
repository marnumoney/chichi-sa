import logging
import time
import requests

logger = logging.getLogger(__name__)

NTFY_BASE = "https://ntfy.sh"


def send_notification(topic: str, title: str, message: str, priority: str = "default") -> bool:
    """Send a push notification via ntfy.sh with 3-attempt retry on network errors."""
    url = f"{NTFY_BASE}/{topic}"
    for attempt in range(3):
        try:
            resp = requests.post(
                url,
                data=message.encode("utf-8"),
                headers={
                    "Title": title,
                    "Priority": priority,
                    "Tags": "robot",
                },
                timeout=10,
            )
            resp.raise_for_status()
            logger.info("ntfy sent: %s", title)
            return True
        except requests.exceptions.ConnectionError as e:
            wait = 5 * (attempt + 1)
            logger.warning("ntfy attempt %d failed (connection): %s — retrying in %ds", attempt + 1, e, wait)
            if attempt < 2:
                time.sleep(wait)
        except Exception as e:
            logger.error("ntfy failed (non-retryable): %s", e)
            return False
    logger.error("ntfy failed after 3 attempts: %s", title)
    return False
