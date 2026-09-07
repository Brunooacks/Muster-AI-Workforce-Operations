from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

from market_lab.agents.base import FrameworkEnricher, SYSTEM_PROMPT
from market_lab.models import EnrichmentBatch


class MelhorLanceLangChainAgent(FrameworkEnricher):
    framework = "LangChain"

    def enrich(self, payload: str) -> EnrichmentBatch:
        model = ChatOpenAI(
            model=self.settings.llm_model,
            api_key=self.settings.openai_api_key,
            base_url=self.settings.llm_base_url or None,
            temperature=0,
            timeout=90,
            max_retries=2,
        )
        agent = create_agent(
            model=model,
            tools=[],
            system_prompt=SYSTEM_PROMPT,
            response_format=EnrichmentBatch,
        )
        result = agent.invoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            "Analise o leaderboard brasileiro. Normalize títulos e resumos em português "
                            "e produza o dossiê completo de oportunidade e potencial de negócio para cada registro:\n"
                            f"{payload}"
                        ),
                    }
                ]
            }
        )
        return EnrichmentBatch.model_validate(result["structured_response"])
