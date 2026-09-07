from market_lab.agents.base import FrameworkEnricher
from market_lab.config import Settings
from market_lab.models import EnrichmentBatch, RawOpportunity


class StubEnricher(FrameworkEnricher):
    framework = "test"

    def enrich(self, payload: str) -> EnrichmentBatch:
        raise AssertionError("O LLM não deve ser chamado sem credencial.")


def test_enricher_reports_when_llm_translation_is_unavailable():
    item = RawOpportunity(
        source="yc-rfs",
        external_key="international",
        title="International opportunity",
    )

    execution = StubEnricher(Settings(openai_api_key=None)).run([item])

    assert execution.items == {}
    assert execution.llm_used is False
    assert "Tradução e análise por IA indisponível" in execution.degraded_reason


def test_enricher_reports_when_enrichment_is_disabled():
    item = RawOpportunity(
        source="outbid",
        external_key="disabled",
        title="Disabled enrichment",
    )

    execution = StubEnricher(Settings(openai_api_key="configured", max_enrichment_items=0)).run(
        [item]
    )

    assert execution.items == {}
    assert "desativado por configuração" in execution.degraded_reason


def test_portuguese_source_reports_analysis_without_translation_warning():
    item = RawOpportunity(
        source="melhorlance",
        external_key="portuguese",
        title="Oportunidade brasileira",
    )

    execution = StubEnricher(Settings(openai_api_key=None)).run([item])

    assert "Análise aprofundada por IA indisponível" in execution.degraded_reason
    assert "Tradução" not in execution.degraded_reason
