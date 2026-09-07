from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.models.openai.like import OpenAILike

from market_lab.agents.base import FrameworkEnricher, SYSTEM_PROMPT
from market_lab.models import EnrichmentBatch


class YcRfsAgnoAgent(FrameworkEnricher):
    framework = "Agno"

    def enrich(self, payload: str) -> EnrichmentBatch:
        if self.settings.llm_base_url:
            model = OpenAILike(
                id=self.settings.llm_model,
                api_key=self.settings.openai_api_key,
                base_url=self.settings.llm_base_url,
            )
        else:
            model = OpenAIChat(
                id=self.settings.llm_model,
                api_key=self.settings.openai_api_key,
            )
        agent = Agent(
            name="YC RFS Opportunity Analyst",
            model=model,
            instructions=[
                SYSTEM_PROMPT,
                "Traduza integralmente títulos e sínteses do inglês para português brasileiro.",
                "Dê peso explícito à estação, autoria e referências.",
                "Detalhe quem compraria, como capturar valor, qual MVP validar e quais evidências ainda faltam.",
            ],
            output_schema=EnrichmentBatch,
            markdown=False,
        )
        response = agent.run(
            "Analise estas Requests for Startups e entregue um dossiê traduzido e acionável para cada uma:\n"
            f"{payload}"
        )
        content = response.content
        if isinstance(content, EnrichmentBatch):
            return content
        if isinstance(content, dict):
            return EnrichmentBatch.model_validate(content)
        return EnrichmentBatch.model_validate_json(str(content))
