import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.base_agent import BaseAgent, Directive, DepartmentReport
from shared.db import init_db


class StubAgent(BaseAgent):
    def _get_context(self):
        return {"stub": True}
    def _execute(self, directive):
        return [{"action": "stub_action", "detail": directive.instruction}]
    def _report(self, actions):
        return DepartmentReport(
            dept=self.dept_name,
            status="success",
            actions_taken=[a["action"] for a in actions],
        )


def test_base_agent_run_skips_on_skip_priority():
    conn = init_db(":memory:", key="testkey")
    agent = StubAgent("stub", {}, conn, None, None)
    report = agent.run(Directive(priority="skip", instruction=""))
    assert report.status == "skipped"
    conn.close()


def test_base_agent_run_returns_report():
    conn = init_db(":memory:", key="testkey")
    agent = StubAgent("stub", {}, conn, None, None)
    report = agent.run(Directive(priority="high", instruction="do the thing"))
    assert report.status == "success"
    assert report.dept == "stub"
    conn.close()


def test_base_agent_run_catches_exception():
    conn = init_db(":memory:", key="testkey")

    class BrokenAgent(BaseAgent):
        def _get_context(self): return {}
        def _execute(self, directive): raise RuntimeError("broken")
        def _report(self, actions): return DepartmentReport(dept="broken", status="success")

    agent = BrokenAgent("broken", {}, conn, None, None)
    report = agent.run(Directive(priority="high", instruction="x"))
    assert report.status == "failed"
    assert "broken" in report.error
    conn.close()
