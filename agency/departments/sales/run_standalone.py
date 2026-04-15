"""Standalone sales run — executes outside the CEO for extra outreach volume."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from ceo import load_config
from shared.db import init_db
from shared.base_agent import Directive
from departments.sales.agent import SalesAgent

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "config.yaml")


def run():
    cfg = load_config(CONFIG_PATH)
    conn = init_db(cfg["database"]["path"])
    token = {"sender": cfg["gmail"]["sender_email"], "password": cfg["gmail"]["app_password"]}
    agent = SalesAgent("sales", cfg, conn, token, cfg["notifications"]["ntfy_topic"])
    today = __import__("datetime").date.today().isoformat()
    out_dir = os.path.join(cfg["ceo"]["outputs_path"], today, "sales-standalone")
    os.makedirs(out_dir, exist_ok=True)
    agent.output_dir = out_dir
    report = agent.run(Directive("high", "daily outreach run — standalone"))
    print(f"Sales standalone: {report.status} | {report.emails_sent} emails sent")
    conn.close()


if __name__ == "__main__":
    run()
