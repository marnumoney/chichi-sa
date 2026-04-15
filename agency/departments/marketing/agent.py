from shared.base_agent import DocGenAgent, Directive

class MarketingAgent(DocGenAgent):
    dept_label = "marketing_asset"
    file_prefix = "marketing"
    metric_key = "assets_created"

    def _build_prompt(self, directive: Directive) -> str:
        from shared.db import get_all_clients
        clients = get_all_clients(self.db)
        return f"""You are the marketing lead for {self.config['agency']['name']}.
Agency: {self.config['agency']}
Active clients: {clients}
CEO directive: {directive.instruction}
Generate a marketing asset in markdown: either a case study (if clients exist),
a LinkedIn post, or an email newsletter snippet promoting the agency's services to SA businesses."""
