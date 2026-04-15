import logging
import anthropic
from datetime import datetime, timezone

from shared.base_agent import BaseAgent, Directive, DepartmentReport
from shared.db import (get_uncontacted_leads, get_leads_without_email, get_leads_for_followup,
                       get_daily_sent_count, insert_lead, insert_email, update_lead_email)
from shared.mailer import send_email, DAILY_SEND_LIMIT
from departments.sales.tools import (scrape_businesses, qualify, find_email,
                                      compose_email, compose_followup, check_replies)

logger = logging.getLogger("sales")


class SalesAgent(BaseAgent):
    def __init__(self, dept_name, config, db, mailer, notifier):
        super().__init__(dept_name, config, db, mailer, notifier)
        self.output_dir = None
        self.client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
        self.model = config["anthropic"]["model"]

    def _get_context(self) -> dict:
        return {
            "daily_sent": get_daily_sent_count(self.db),
            "uncontacted": get_uncontacted_leads(self.db, limit=5),
        }

    def _execute(self, directive: Directive) -> list:
        actions = []

        # Check replies first
        new_replies = check_replies(self.config["gmail"], self.db)
        for r in new_replies:
            actions.append({"action": "reply_received", "lead": r["business_name"]})

        # Scrape new leads
        try:
            raw = scrape_businesses(self.config["google_places"])
            new_leads = qualify(raw, self.db, self.config["google_places"])
            for lead in new_leads:
                try:
                    insert_lead(self.db, lead)
                    actions.append({"action": "lead_scraped", "lead": lead["business_name"]})
                except Exception as e:
                    logger.error("Insert lead failed: %s", e)
        except Exception as e:
            logger.error("Scrape failed: %s", e)

        # Find emails for leads that don't have one
        without_email = get_leads_without_email(self.db, limit=100)
        for lead in without_email:
            try:
                em = find_email(lead)
                if em:
                    update_lead_email(self.db, lead["id"], em)
                    actions.append({"action": "email_found", "lead": lead["business_name"]})
            except Exception as e:
                logger.error("Email find failed for %s: %s", lead.get("business_name"), e)

        # Send outreach emails
        daily_sent = get_daily_sent_count(self.db)
        remaining = DAILY_SEND_LIMIT - daily_sent

        def _send(lead, email_dict, follow_up_number):
            nonlocal remaining
            if remaining <= 0:
                return False
            now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(sep=" ", timespec="seconds")
            try:
                msg_id = send_email(self.mailer, self.mailer["sender"], lead["email"],
                                    email_dict["subject"], email_dict["body"])
                insert_email(self.db, {
                    "lead_id": lead["id"], "sent_at": now, "status": "sent",
                    "subject": email_dict["subject"], "body": email_dict["body"],
                    "outlook_message_id": msg_id, "follow_up_number": follow_up_number,
                })
                actions.append({"action": "email_sent", "lead": lead["business_name"],
                                "follow_up": follow_up_number})
                remaining -= 1
                return True
            except Exception as e:
                logger.error("Send failed for %s: %s", lead.get("business_name"), e)
                insert_email(self.db, {
                    "lead_id": lead["id"], "sent_at": now, "status": "failed",
                    "subject": email_dict.get("subject", ""), "body": email_dict.get("body", ""),
                    "outlook_message_id": "", "follow_up_number": follow_up_number,
                })
                return False

        for lead in get_leads_for_followup(self.db, days_since_first=3, follow_up_number=1):
            if remaining <= 0:
                break
            try:
                em = compose_followup(lead, self.config["agency"], self.client, self.model, 1)
                _send(lead, em, 1)
            except Exception as e:
                logger.error("Follow-up 1 compose failed: %s", e)

        for lead in get_leads_for_followup(self.db, days_since_first=7, follow_up_number=2):
            if remaining <= 0:
                break
            try:
                em = compose_followup(lead, self.config["agency"], self.client, self.model, 2)
                _send(lead, em, 2)
            except Exception as e:
                logger.error("Follow-up 2 compose failed: %s", e)

        for lead in get_uncontacted_leads(self.db, limit=remaining):
            try:
                em = compose_email(lead, self.config["agency"], self.client, self.model)
                _send(lead, em, 0)
            except Exception as e:
                logger.error("Compose failed for %s: %s", lead.get("business_name"), e)

        return actions

    def _report(self, actions: list) -> DepartmentReport:
        sent = sum(1 for a in actions if a["action"] == "email_sent")
        scraped = sum(1 for a in actions if a["action"] == "lead_scraped")
        emails_found = sum(1 for a in actions if a["action"] == "email_found")
        replies = sum(1 for a in actions if a["action"] == "reply_received")
        return DepartmentReport(
            dept="sales",
            status="success",
            actions_taken=[f"{a['action']}: {a.get('lead', '')}" for a in actions],
            emails_sent=sent,
            metrics={"leads_scraped": scraped, "emails_found": emails_found,
                     "emails_sent": sent, "replies_received": replies},
        )
