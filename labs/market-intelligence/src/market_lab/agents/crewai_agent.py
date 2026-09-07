from crewai import Agent, Crew, LLM, Process, Task

from market_lab.agents.base import FrameworkEnricher, SYSTEM_PROMPT
from market_lab.models import EnrichmentBatch


class OutbidCrewAiAgent(FrameworkEnricher):
    framework = "CrewAI"

    def enrich(self, payload: str) -> EnrichmentBatch:
        llm = LLM(
            model=f"openai/{self.settings.llm_model}",
            api_key=self.settings.openai_api_key,
            base_url=self.settings.llm_base_url or None,
            temperature=0,
        )
        scout = Agent(
            role="Global leaderboard scout",
            goal=(
                "Identificar padrões, sinais de demanda e concentração temática, traduzindo o contexto "
                "internacional para português sem inventar fatos."
            ),
            backstory="Especialista em mercados de atenção e lançamentos de produtos digitais.",
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
        analyst = Agent(
            role="Opportunity analyst",
            goal=(
                "Converter cada sinal público em um dossiê comparável de oportunidade, potencial de negócio, "
                "MVP, entrada no mercado, validação e riscos."
            ),
            backstory=SYSTEM_PROMPT,
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
        research = Task(
            description=(
                "Mapeie padrões e anomalias destes registros do outbid.lol. Traduza os sinais relevantes "
                "para português e separe fatos de hipóteses:\n"
                f"{payload}"
            ),
            expected_output=(
                "Síntese factual em português dos padrões, valores, cliques, categorias, públicos e sinais "
                "de demanda observados."
            ),
            agent=scout,
        )
        score = Task(
            description=(
                "Avalie individualmente todos os registros, preserve cada external_key, traduza título e resumo "
                "e preencha todos os campos do dossiê de potencial de negócio sem inventar dados."
            ),
            expected_output="Um EnrichmentBatch válido, completo e integralmente em português brasileiro.",
            output_pydantic=EnrichmentBatch,
            context=[research],
            agent=analyst,
        )
        result = Crew(
            agents=[scout, analyst],
            tasks=[research, score],
            process=Process.sequential,
            verbose=False,
        ).kickoff()
        parsed = getattr(result, "pydantic", None)
        if parsed is not None:
            return EnrichmentBatch.model_validate(parsed)
        return EnrichmentBatch.model_validate_json(str(result))
