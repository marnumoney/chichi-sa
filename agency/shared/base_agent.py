import logging
import sqlite3
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class Directive:
    priority: str   # "high" | "medium" | "low" | "skip"
    instruction: str


@dataclass
class DepartmentReport:
    dept: str
    status: str     # "success" | "partial" | "failed" | "skipped"
    actions_taken: list = field(default_factory=list)
    files_created: list = field(default_factory=list)
    emails_sent: int = 0
    metrics: dict = field(default_factory=dict)
    error: Optional[str] = None


class BaseAgent:
    def __init__(self, dept_name: str, config: dict, db: sqlite3.Connection, mailer, notifier):
        self.dept_name = dept_name
        self.config = config
        self.db = db
        self.mailer = mailer
        self.notifier = notifier
        self.logger = logging.getLogger(dept_name)

    def run(self, directive: Directive) -> DepartmentReport:
        if directive.priority == "skip":
            return DepartmentReport(dept=self.dept_name, status="skipped")
        try:
            actions = self._execute(directive)
            return self._report(actions)
        except Exception as e:
            logger.error("[%s] failed: %s", self.dept_name, e)
            return DepartmentReport(dept=self.dept_name, status="failed", error=str(e))

    def _get_context(self) -> dict:
        raise NotImplementedError

    def _execute(self, directive: Directive) -> list:
        raise NotImplementedError

    def _report(self, actions: list) -> DepartmentReport:
        raise NotImplementedError


class DocGenAgent(BaseAgent):
    """Base for agents whose only job is to generate a markdown document using Claude."""
    dept_label: str = "doc"
    file_prefix: str = "doc"
    metric_key: str = "docs_generated"

    def __init__(self, dept_name, config, db, mailer, notifier):
        super().__init__(dept_name, config, db, mailer, notifier)
        self.output_dir = None
        import anthropic
        self.client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
        self.model = config["anthropic"]["model"]

    def _get_context(self) -> dict:
        return {}

    def _build_prompt(self, directive: Directive) -> str:
        raise NotImplementedError

    def _execute(self, directive: Directive) -> list:
        from datetime import date
        import os
        prompt = self._build_prompt(directive)
        resp = self.client.messages.create(model=self.model, max_tokens=1500,
                                            messages=[{"role": "user", "content": prompt}])
        content = resp.content[0].text
        filename = f"{self.file_prefix}-{date.today()}.md"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w") as f:
            f.write(content)
        return [{"action": f"{self.dept_label}_generated", "file": filepath}]

    def _report(self, actions: list) -> DepartmentReport:
        files = [a["file"] for a in actions if a.get("file")]
        return DepartmentReport(
            dept=self.dept_name, status="success",
            actions_taken=[a["action"] for a in actions],
            files_created=files,
            metrics={self.metric_key: len(files)},
        )
