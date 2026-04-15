from shared.base_agent import DocGenAgent, Directive

class DesignAgent(DocGenAgent):
    dept_label = "design_brief"
    file_prefix = "design-brief"
    metric_key = "briefs_generated"

    def _build_prompt(self, directive: Directive) -> str:
        from shared.db import get_active_projects
        projects = get_active_projects(self.db)
        return f"""You are the design lead for {self.config['agency']['name']}.
Active projects: {projects}
CEO directive: {directive.instruction}
Generate a detailed design brief in markdown covering: objectives, target audience, brand guidelines,
UI/UX requirements, deliverables, and timeline. If no active projects, write a general design
standards document for the agency."""
