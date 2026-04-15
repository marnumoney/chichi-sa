import os
import logging
from datetime import date
import anthropic
from shared.base_agent import BaseAgent, Directive, DepartmentReport
from shared.db import get_active_projects
from shared.mailer import send_email

logger = logging.getLogger("project_mgmt")


class ProjectMgmtAgent(BaseAgent):
    def __init__(self, dept_name, config, db, mailer, notifier):
        super().__init__(dept_name, config, db, mailer, notifier)
        self.output_dir = None
        self.client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
        self.model = config["anthropic"]["model"]

    def _get_context(self) -> dict:
        return {"projects": get_active_projects(self.db)}

    def _execute(self, directive: Directive) -> list:
        projects = get_active_projects(self.db)
        if not projects:
            return [{"action": "no_projects", "file": None}]
        overdue = [p for p in projects if p.get("deadline") and p["deadline"] < str(date.today())]
        prompt = f"""You are a project manager for {self.config['agency']['name']}.
Active projects: {projects}
Overdue: {overdue}
Today: {date.today()}
Directive: {directive.instruction}
Write a concise project status report in markdown. Flag overdue items. Suggest next actions."""
        resp = self.client.messages.create(model=self.model, max_tokens=1000,
                                            messages=[{"role": "user", "content": prompt}])
        report_text = resp.content[0].text
        filename = f"project-status-{date.today()}.md"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w") as f:
            f.write(f"# Project Status Report — {date.today()}\n\n{report_text}\n")
        actions = [{"action": "report_generated", "file": filepath, "overdue": len(overdue)}]
        if overdue:
            try:
                send_email(self.mailer, self.mailer["sender"],
                           self.config["ceo"]["briefing_email"],
                           f"⚠ {len(overdue)} overdue project(s)", report_text)
                actions.append({"action": "overdue_alert_sent"})
            except Exception as e:
                logger.error("Failed to send overdue alert: %s", e)
        return actions

    def _report(self, actions: list) -> DepartmentReport:
        files = [a["file"] for a in actions if a.get("file")]
        overdue = next((a.get("overdue", 0) for a in actions if "overdue" in a), 0)
        return DepartmentReport(
            dept="project_mgmt", status="success",
            actions_taken=[a["action"] for a in actions],
            files_created=files,
            metrics={"projects_active": len(get_active_projects(self.db)),
                     "tasks_overdue": overdue},
        )
