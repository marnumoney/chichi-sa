import json
import logging
import os
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path

import anthropic
import yaml

from shared.base_agent import Directive, DepartmentReport
from shared.db import init_db, get_business_metrics, insert_ceo_directive
from shared.mailer import get_access_token, send_email
from shared.notifier import send_notification

LOG_PATH = os.path.join(os.path.dirname(__file__), "logs", "agency.log")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")


def setup_logging():
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.FileHandler(LOG_PATH), logging.StreamHandler()],
    )


def load_config(path: str) -> dict:
    env_path = os.path.join(os.path.dirname(path), ".env")
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    with open(path) as f:
        config = yaml.safe_load(f)
    if "ANTHROPIC_API_KEY" in env:
        config.setdefault("anthropic", {})["api_key"] = env["ANTHROPIC_API_KEY"]
    if "GOOGLE_PLACES_API_KEY" in env:
        config.setdefault("google_places", {})["api_key"] = env["GOOGLE_PLACES_API_KEY"]
    if "GMAIL_SENDER_EMAIL" in env:
        config.setdefault("gmail", {})["sender_email"] = env["GMAIL_SENDER_EMAIL"]
    if "GMAIL_APP_PASSWORD" in env:
        config.setdefault("gmail", {})["app_password"] = env["GMAIL_APP_PASSWORD"]
    if "MICROSOFT_CLIENT_ID" in env:
        config.setdefault("microsoft", {})["client_id"] = env["MICROSOFT_CLIENT_ID"]
    if "MICROSOFT_CLIENT_SECRET" in env:
        config.setdefault("microsoft", {})["client_secret"] = env["MICROSOFT_CLIENT_SECRET"]
    if "MICROSOFT_TENANT_ID" in env:
        config.setdefault("microsoft", {})["tenant_id"] = env["MICROSOFT_TENANT_ID"]
    if "MICROSOFT_SENDER_EMAIL" in env:
        config.setdefault("microsoft", {})["sender_email"] = env["MICROSOFT_SENDER_EMAIL"]
    return config


def read_business_context(conn: sqlite3.Connection, strategy_path: str, journal_path: str) -> dict:
    """Phase 1: load strategy memory + business metrics."""
    strategy = ""
    if os.path.exists(strategy_path):
        with open(strategy_path) as f:
            strategy = f.read()

    journal_entries = []
    if os.path.exists(journal_path):
        entries = sorted(Path(journal_path).glob("*.md"), reverse=True)[:7]
        for entry in entries:
            journal_entries.append(entry.read_text())

    metrics = get_business_metrics(conn)
    return {"strategy": strategy, "journal_entries": journal_entries, "metrics": metrics}


DECIDE_PROMPT = """\
You are the CEO of Launchpad Studio, a web design agency targeting SA small businesses.
Your goal is to make money. Review the business context below and decide what each department should do TODAY.

## Current Strategy
{strategy}

## Recent Journal (last 7 days)
{journal}

## Business Metrics
{metrics}

## Today's date
{today}

Return a JSON object with this EXACT structure (no markdown, no extra text):
{{
  "date": "{today}",
  "business_context": "2-3 sentence assessment of where the business is right now",
  "departments": {{
    "sales": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "account_mgmt": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "project_mgmt": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "design": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "development": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "content": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "marketing": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "strategy": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "finance": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "hr": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}},
    "qa": {{"priority": "high|medium|low|skip", "instruction": "specific directive"}}
  }}
}}

Rules:
- Sales should almost always be high priority until first 5 clients are signed
- Skip departments that have nothing actionable today
- Be specific in instructions — "focus on restaurants in Cape Town" not "do outreach"
- Revenue-generating actions always beat internal work
"""

DEPT_NAMES = ["sales", "account_mgmt", "project_mgmt", "design", "development",
              "content", "marketing", "strategy", "finance", "hr", "qa"]


def decide(client: anthropic.Anthropic, context: dict, model: str) -> dict:
    """Phase 2: use Claude to produce a DailyDirective for each department."""
    journal_text = "\n\n---\n\n".join(context["journal_entries"]) or "No journal entries yet."
    metrics_text = "\n".join(f"  {k}: {v}" for k, v in context["metrics"].items())
    prompt = DECIDE_PROMPT.format(
        strategy=context["strategy"] or "No strategy yet — build from scratch.",
        journal=journal_text,
        metrics=metrics_text,
        today=str(date.today()),
    )
    response = client.messages.create(
        model=model,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    data = json.loads(raw)
    directives = {}
    for dept in DEPT_NAMES:
        dept_data = data.get("departments", {}).get(dept, {"priority": "skip", "instruction": ""})
        directives[dept] = Directive(
            priority=dept_data.get("priority", "skip"),
            instruction=dept_data.get("instruction", ""),
        )
    return directives


REFLECT_PROMPT = """\
You are the CEO of Launchpad Studio. Today's run is complete. Analyze performance and update your strategy.

## What was planned (directives)
{directives_text}

## What actually happened (department reports)
{reports_text}

## Business metrics before today's run
{metrics_before}

## Current strategy doc
{current_strategy}

Return a JSON object (no markdown, no extra text):
{{
  "journal_entry": "Honest retrospective: what worked, what didn't, surprises, hypotheses for tomorrow. 200-400 words.",
  "updated_strategy": "Complete rewrite of the strategy doc incorporating today's learnings. This is your evolving playbook. 300-600 words. Include: what's working, what to double down on, what to stop, specific tactics for each active department."
}}
"""


def reflect_and_learn(
    client: anthropic.Anthropic,
    model: str,
    directives: dict,
    reports: list,
    metrics_before: dict,
    strategy_path: str,
    journal_path: str,
) -> None:
    """Phase 4: analyse results, write journal entry, rewrite strategy doc."""
    directives_text = "\n".join(
        f"  {dept}: [{d.priority}] {d.instruction}" for dept, d in directives.items()
    )
    reports_text = "\n".join(
        f"  {r.dept}: {r.status} | sent={r.emails_sent} | actions={r.actions_taken} | "
        f"files={r.files_created} | metrics={r.metrics}"
        + (f" | ERROR: {r.error}" if r.error else "")
        for r in reports
    )
    current_strategy = ""
    if os.path.exists(strategy_path):
        with open(strategy_path) as f:
            current_strategy = f.read()

    prompt = REFLECT_PROMPT.format(
        directives_text=directives_text,
        reports_text=reports_text,
        metrics_before=json.dumps(metrics_before, indent=2),
        current_strategy=current_strategy or "No strategy yet.",
    )
    response = client.messages.create(
        model=model,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    data = json.loads(response.content[0].text.strip())

    today = str(date.today())
    os.makedirs(journal_path, exist_ok=True)
    journal_file = os.path.join(journal_path, f"{today}.md")
    with open(journal_file, "w") as f:
        f.write(f"# CEO Journal — {today}\n\n{data['journal_entry']}\n")

    with open(strategy_path, "w") as f:
        f.write(f"# Launchpad Studio Strategy\n\n_Last updated: {today}_\n\n{data['updated_strategy']}\n")

    logging.getLogger("ceo").info("Strategy updated and journal entry written for %s", today)


def _send_briefing(config, reports, metrics_before, ntfy_topic):
    lines = ["=== LAUNCHPAD CEO BRIEFING ===", ""]
    for r in reports:
        if r.status == "skipped":
            continue
        lines.append(f"[{r.dept.upper()}] {r.status} | {r.emails_sent} emails | {r.actions_taken}")
    lines += ["", f"Leads: {metrics_before.get('total_leads', 0)} | "
              f"Reply rate: {metrics_before.get('reply_rate_pct', 0)}% | "
              f"Revenue: ${metrics_before.get('revenue_total', 0)}"]
    message = "\n".join(lines)
    send_notification(ntfy_topic, "CEO Daily Briefing", message, priority="high")
    token = {"sender": config["gmail"]["sender_email"], "password": config["gmail"]["app_password"]}
    try:
        send_email(token, config["gmail"]["sender_email"],
                   config["ceo"]["briefing_email"], "CEO Daily Briefing", message)
    except Exception as e:
        logging.getLogger("ceo").error("Failed to email CEO briefing: %s", e)


def run():
    setup_logging()
    logger = logging.getLogger("ceo")
    logger.info("=== CEO Agent starting ===")
    config = load_config(CONFIG_PATH)
    model = config["anthropic"]["model"]
    client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
    conn = init_db(config["database"]["path"])
    ceo_cfg = config["ceo"]

    from departments.sales.agent import SalesAgent
    from departments.account_mgmt.agent import AccountMgmtAgent
    from departments.project_mgmt.agent import ProjectMgmtAgent
    from departments.design.agent import DesignAgent
    from departments.development.agent import DevelopmentAgent
    from departments.content.agent import ContentAgent
    from departments.marketing.agent import MarketingAgent
    from departments.strategy.agent import StrategyAgent
    from departments.finance.agent import FinanceAgent
    from departments.hr.agent import HRAgent
    from departments.qa.agent import QAAgent

    token = {"sender": config["gmail"]["sender_email"], "password": config["gmail"]["app_password"]}
    ntfy_topic = config["notifications"]["ntfy_topic"]

    dept_agents = {
        "sales":        SalesAgent("sales", config, conn, token, ntfy_topic),
        "account_mgmt": AccountMgmtAgent("account_mgmt", config, conn, token, ntfy_topic),
        "project_mgmt": ProjectMgmtAgent("project_mgmt", config, conn, token, ntfy_topic),
        "design":       DesignAgent("design", config, conn, token, ntfy_topic),
        "development":  DevelopmentAgent("development", config, conn, token, ntfy_topic),
        "content":      ContentAgent("content", config, conn, token, ntfy_topic),
        "marketing":    MarketingAgent("marketing", config, conn, token, ntfy_topic),
        "strategy":     StrategyAgent("strategy", config, conn, token, ntfy_topic),
        "finance":      FinanceAgent("finance", config, conn, token, ntfy_topic),
        "hr":           HRAgent("hr", config, conn, token, ntfy_topic),
        "qa":           QAAgent("qa", config, conn, token, ntfy_topic),
    }

    try:
        context = read_business_context(conn, ceo_cfg["memory_path"], ceo_cfg["journal_path"])
        metrics_before = context["metrics"]
        logger.info("Metrics: %s", metrics_before)

        directives = decide(client, context, model)
        logger.info("Directives: %s", {d: v.priority for d, v in directives.items()})

        priority_order = ["high", "medium", "low"]
        reports = []
        for priority in priority_order:
            for dept_name, directive in directives.items():
                if directive.priority != priority:
                    continue
                today_str = str(date.today())
                out_dir = os.path.join(ceo_cfg["outputs_path"], today_str, dept_name)
                os.makedirs(out_dir, exist_ok=True)
                dept_agents[dept_name].output_dir = out_dir
                logger.info("Running [%s] dept=%s", priority, dept_name)
                report = dept_agents[dept_name].run(directive)
                reports.append(report)
                logger.info("Dept %s: %s", dept_name, report.status)

        for dept_name, directive in directives.items():
            if directive.priority == "skip":
                reports.append(DepartmentReport(dept=dept_name, status="skipped"))

        reflect_and_learn(client, model, directives, reports, metrics_before,
                          ceo_cfg["memory_path"], ceo_cfg["journal_path"])

        outcomes = {r.dept: {"status": r.status, "emails_sent": r.emails_sent,
                             "metrics": r.metrics} for r in reports}
        insert_ceo_directive(conn, {
            "date": str(date.today()),
            "directive_json": json.dumps({d: {"priority": v.priority, "instruction": v.instruction}
                                          for d, v in directives.items()}),
            "outcomes_json": json.dumps(outcomes),
            "strategy_version": 1,
        })

        _send_briefing(config, reports, metrics_before, ntfy_topic)
        logger.info("=== CEO run complete ===")

    finally:
        conn.close()


if __name__ == "__main__":
    run()
