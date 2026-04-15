import os
import logging
import anthropic
from shared.base_agent import BaseAgent, Directive, DepartmentReport
from shared.notifier import send_notification
from departments.content.tools import find_topic, write_blog_post

logger = logging.getLogger("content")


class ContentAgent(BaseAgent):
    def __init__(self, dept_name, config, db, mailer, notifier):
        super().__init__(dept_name, config, db, mailer, notifier)
        self.output_dir = None
        self.client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
        self.model = config["anthropic"]["model"]

    def _get_context(self) -> dict:
        return {}

    def _execute(self, directive: Directive) -> list:
        topic = find_topic(directive.instruction)
        post = write_blog_post(topic, self.config["agency"], self.client, self.model)
        filename = f"blog-{post['title'][:50].replace(' ', '-').lower()}.md"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w") as f:
            f.write(f"# {post['title']}\n\n{post['body']}\n")
        ntfy_topic = self.config.get("notifications", {}).get("ntfy_topic")
        if ntfy_topic:
            send_notification(ntfy_topic, f"New blog post: {post['title']}", post["body"][:500])
        return [{"action": "blog_post_written", "title": post["title"], "file": filepath}]

    def _report(self, actions: list) -> DepartmentReport:
        return DepartmentReport(
            dept="content",
            status="success",
            actions_taken=[a["title"] for a in actions],
            files_created=[a["file"] for a in actions],
            metrics={"posts_written": len(actions)},
        )
