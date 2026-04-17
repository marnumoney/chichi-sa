import requests
import logging
import time

logger = logging.getLogger(__name__)

NTFY_URL = "https://ntfy.sh/{topic}"


def send_notification(topic: str, title: str, message: str, priority: str = "default") -> None:
    """Send a push notification via ntfy.sh, retrying up to 3 times on network errors."""
    for attempt in range(3):
        try:
            requests.post(
                NTFY_URL.format(topic=topic),
                data=message.encode("utf-8"),
                headers={
                    "Title": title.encode("utf-8"),
                    "Priority": priority,
                    "Tags": "robot",
                },
                timeout=10,
            )
            logger.info("Notification sent to ntfy topic: %s", topic)
            return
        except Exception as e:
            if attempt < 2:
                time.sleep(5 * (attempt + 1))
            else:
                logger.error("Failed to send ntfy notification after 3 attempts: %s", e)


def notify_run_complete(topic: str, stats: dict) -> None:
    """Send a detailed end-of-run notification."""
    sent = stats.get("sent", 0)
    failed = stats.get("failed", 0)
    scraped = stats.get("scraped", 0)
    qualified = stats.get("qualified", 0)
    emails_found = stats.get("emails_found", 0)
    emailed_leads = stats.get("emailed_leads", [])

    title = f"Launchpad Agent — {sent} emails sent"
    priority = "high" if sent > 0 else "default"

    lines = [
        f"Run complete for Launchpad Studio",
        f"",
        f"Scraped:        {scraped} businesses",
        f"Qualified:      {qualified} new leads",
        f"Emails found:   {emails_found} via web search",
        f"Emails sent:    {sent}",
        f"Failed:         {failed}",
    ]

    if emailed_leads:
        lines.append("")
        lines.append("Businesses emailed:")
        for lead in emailed_leads:
            lines.append(f"  • {lead['business_name']} ({lead['city']}) — {lead['email']}")

    message = "\n".join(lines)
    send_notification(topic, title, message, priority)
