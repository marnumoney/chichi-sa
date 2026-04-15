from shared.base_agent import DocGenAgent, Directive

class DevelopmentAgent(DocGenAgent):
    dept_label = "tech_spec"
    file_prefix = "tech-spec"
    metric_key = "specs_generated"

    def _build_prompt(self, directive: Directive) -> str:
        from shared.db import get_active_projects
        projects = get_active_projects(self.db)
        return f"""You are the lead developer for {self.config['agency']['name']}.
Active projects: {projects}
CEO directive: {directive.instruction}
Generate a technical specification in markdown covering: stack, architecture, key components,
APIs, hosting, deployment, and estimated effort. If no active projects, write a standard
tech stack reference document for the agency."""
