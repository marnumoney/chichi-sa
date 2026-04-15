import logging
from datetime import date, timedelta
import anthropic
from shared.base_agent import BaseAgent, Directive, DepartmentReport
from shared.db import get_all_clients
from shared.mailer import send_email
from departments.account_mgmt.tools import compose_checkin_email

logger = logging.getLogger("account_mgmt")


class AccountMgmtAgent(BaseAgent):
    def __init__(self, dept_name, config, db, mailer, notifier):
        super().__init__(dept_name, config, db, mailer, notifier)
        self.output_dir = None
        self.client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
        self.model = config["anthropic"]["model"]

    def _get_context(self) -> dict:
        return {"clients": get_all_clients(self.db)}

    def _execute(self, directive: Directive) -> list:
        actions = []
        clients = get_all_clients(self.db)
        if not clients:
            return [{"action": "no_clients", "detail": "No active clients yet"}]
        cutoff = str(date.today() - timedelta(days=30))
        due = [c for c in clients if not c.get("last_contact_at") or c["last_contact_at"] < cutoff]
        for client_data in due[:5]:
            try:
                email_dict = compose_checkin_email(self.client, self.model,
                                                    client_data, self.config["agency"])
                send_email(self.mailer, self.mailer["sender"], client_data["email"],
                           email_dict["subject"], email_dict["body"])
                self.db.execute("UPDATE clients SET last_contact_at=? WHERE id=?",
                               (str(date.today()), client_data["id"]))
                self.db.commit()
                actions.append({"action": "checkin_sent", "client": client_data["name"]})
            except Exception as e:
                logger.error("Check-in failed for %s: %s", client_data["name"], e)
        return actions

    def _report(self, actions: list) -> DepartmentReport:
        sent = sum(1 for a in actions if a["action"] == "checkin_sent")
        return DepartmentReport(
            dept="account_mgmt", status="success",
            actions_taken=[a["action"] for a in actions],
            emails_sent=sent,
            metrics={"checkins_sent": sent},
        )
