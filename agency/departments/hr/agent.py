from shared.base_agent import DocGenAgent, Directive

class HRAgent(DocGenAgent):
    dept_label = "hr_doc"
    file_prefix = "hr"
    metric_key = "docs_generated"

    def _build_prompt(self, directive: Directive) -> str:
        return f"""You are the HR lead for {self.config['agency']['name']}.
CEO directive: {directive.instruction}
Generate an HR document in markdown. If the directive mentions hiring, write a job post.
Otherwise write an onboarding guide for a new team member joining a web design agency.
Be practical and specific to a small SA agency."""
