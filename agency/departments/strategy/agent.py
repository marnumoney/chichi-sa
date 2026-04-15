from shared.base_agent import DocGenAgent, Directive

class StrategyAgent(DocGenAgent):
    dept_label = "strategy_report"
    file_prefix = "strategy-report"
    metric_key = "reports_generated"

    def _build_prompt(self, directive: Directive) -> str:
        return f"""You are the strategy consultant for {self.config['agency']['name']}, a SA web design agency.
CEO directive: {directive.instruction}
Generate a competitive analysis and strategy report in markdown covering:
- 3-5 SA web design competitors and their pricing
- Gaps in the market Launchpad Studio can exploit
- Recommended positioning and messaging adjustments
- 3 tactical actions for the next 30 days"""
