import os
import logging
from datetime import date, timedelta
import anthropic
from shared.base_agent import BaseAgent, Directive, DepartmentReport
from shared.db import get_unpaid_invoices, get_active_projects, insert_invoice

logger = logging.getLogger("finance")


class FinanceAgent(BaseAgent):
    def __init__(self, dept_name, config, db, mailer, notifier):
        super().__init__(dept_name, config, db, mailer, notifier)
        self.output_dir = None
        self.client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
        self.model = config["anthropic"]["model"]

    def _get_context(self) -> dict:
        return {"unpaid": get_unpaid_invoices(self.db), "projects": get_active_projects(self.db)}

    def _execute(self, directive: Directive) -> list:
        actions = []
        unpaid = get_unpaid_invoices(self.db)
        projects = get_active_projects(self.db)

        completed = [p for p in projects if p.get("status") == "completed"]
        for project in completed[:3]:
            prompt = f"""Generate a professional invoice in markdown for:
Client: {project.get('client_name', 'Client')}
Project: {project['name']}
Budget: ${project.get('budget', 200)}
Agency: {self.config['agency']['name']} — {self.config['agency']['website']}
Date: {date.today()}
Due: {str(date.today() + timedelta(days=14))}
Include itemised services, payment instructions (EFT), and bank details placeholder."""
            resp = self.client.messages.create(model=self.model, max_tokens=800,
                                               messages=[{"role": "user", "content": prompt}])
            filename = f"invoice-{project['name'].replace(' ', '-').lower()}-{date.today()}.md"
            filepath = os.path.join(self.output_dir, filename)
            with open(filepath, "w") as f:
                f.write(resp.content[0].text)
            actions.append({"action": "invoice_generated", "file": filepath,
                            "project": project["name"]})

        overdue = [i for i in unpaid if i.get("due_date") and i["due_date"] < str(date.today())]
        for inv in overdue:
            actions.append({"action": "overdue_flagged", "client": inv.get("client_name"),
                            "amount": inv.get("amount")})

        if not actions:
            actions.append({"action": "no_action_needed",
                            "detail": f"No completed unbilled projects. {len(unpaid)} unpaid invoices tracked."})
        return actions

    def _report(self, actions: list) -> DepartmentReport:
        files = [a["file"] for a in actions if a.get("file")]
        overdue = sum(1 for a in actions if a["action"] == "overdue_flagged")
        return DepartmentReport(
            dept="finance", status="success",
            actions_taken=[a["action"] for a in actions],
            files_created=files,
            metrics={
                "invoices_generated": len(files),
                "payments_overdue": overdue,
                "revenue_outstanding": sum(i.get("amount", 0) for i in get_unpaid_invoices(self.db)),
            },
        )
