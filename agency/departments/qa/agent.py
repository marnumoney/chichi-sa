from shared.base_agent import DocGenAgent, Directive

class QAAgent(DocGenAgent):
    dept_label = "qa_checklist"
    file_prefix = "qa-checklist"
    metric_key = "checklists_generated"

    def _build_prompt(self, directive: Directive) -> str:
        from shared.db import get_active_projects
        projects = get_active_projects(self.db)
        return f"""You are the QA lead for {self.config['agency']['name']}.
Active projects nearing completion: {projects}
CEO directive: {directive.instruction}
Generate a QA checklist in markdown covering:
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile responsiveness (iPhone, Android)
- Accessibility (WCAG 2.1 AA: contrast, alt text, keyboard nav)
- Performance (PageSpeed score target >80)
- Broken links and form testing
- SEO basics (meta tags, sitemap, robots.txt)
Tailor to the active project(s) if any exist."""
