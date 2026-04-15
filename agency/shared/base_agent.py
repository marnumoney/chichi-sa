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
