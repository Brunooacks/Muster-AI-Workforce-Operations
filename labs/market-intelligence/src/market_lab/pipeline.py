import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

from market_lab.agents import MelhorLanceLangChainAgent, OutbidCrewAiAgent, YcRfsAgnoAgent
from market_lab.collectors import MelhorLanceCollector, OutbidCollector, YcRfsCollector
from market_lab.config import Settings
from market_lab.market_research import MarketResearch
from market_lab.models import EnrichmentItem, RawOpportunity, RunMetrics, ScoredOpportunity
from market_lab.scoring import score_opportunities
from market_lab.store import Store
from market_lab.synthesis import build_report


@dataclass(frozen=True)
class AgentDefinition:
    name: str
    framework: str
    collector: type
    enricher: type


AGENTS = {
    "melhorlance": AgentDefinition(
        "Radar Melhor Lance", "LangChain", MelhorLanceCollector, MelhorLanceLangChainAgent
    ),
    "outbid": AgentDefinition("Outbid Global Scout", "CrewAI", OutbidCollector, OutbidCrewAiAgent),
    "yc-rfs": AgentDefinition("YC RFS Opportunity Miner", "Agno", YcRfsCollector, YcRfsAgnoAgent),
}


class MarketIntelligencePipeline:
    def __init__(self, settings: Settings, store: Store):
        self.settings = settings
        self.store = store

    def run_source(self, source: str) -> list[ScoredOpportunity]:
        definition = AGENTS[source]
        run_id = self.store.start_run(definition.name, definition.framework, source)
        started = time.perf_counter()
        metrics = RunMetrics()
        try:
            collection = definition.collector(self.settings).collect()
            execution = None
            try:
                execution = definition.enricher(self.settings).run(collection.items)
                if execution.degraded_reason:
                    metrics.degraded_reason = execution.degraded_reason
            except Exception as error:
                metrics.degraded_reason = f"Enriquecimento LLM indisponível: {error}"
            enrichments = execution.items if execution else {}
            evidence = {}
            if source in {"outbid", "yc-rfs"}:
                try:
                    evidence = MarketResearch(self.settings).search(collection.items, enrichments)
                except Exception as error:
                    current = metrics.degraded_reason or ""
                    metrics.degraded_reason = f"{current} Pesquisa de mercado indisponível: {error}".strip()
            scored = score_opportunities(collection.items, enrichments, evidence)
            total = max(len(scored), 1)
            metrics.records_discovered = len(scored)
            metrics.links_discovered = collection.page_link_count
            metrics.price_coverage = round(sum(item.paid_value is not None for item in scored) / total, 3)
            metrics.ranking_coverage = round(sum(item.rank is not None for item in scored) / total, 3)
            metrics.author_coverage = round(sum(bool(item.author) for item in scored) / total, 3)
            metrics.enrichment_coverage = round(len(enrichments) / total, 3)
            metrics.translation_coverage = round(
                sum(item.translation_status in {"translated", "not_needed"} for item in scored) / total,
                3,
            )
            metrics.business_detail_coverage = round(
                sum(
                    bool(item.opportunity_statement_pt)
                    and bool(item.business_potential.mvp_scope)
                    and bool(item.business_potential.validation_experiments)
                    for item in scored
                )
                / total,
                3,
            )
            metrics.market_research_coverage = round(len(evidence) / total, 3)
            metrics.analysis_quality = round(
                sum(item.analysis_quality_score for item in scored) / total / 100,
                3,
            )
            metrics.source_hash = collection.source_hash
            if execution:
                metrics.input_tokens = execution.input_tokens
                metrics.output_tokens = execution.output_tokens
                metrics.estimated_cost_usd = execution.estimated_cost_usd
                metrics.llm_used = execution.llm_used
            metrics.duration_ms = int((time.perf_counter() - started) * 1000)
            self.store.save_opportunities(run_id, scored)
            self.store.finish_run(run_id, "completed", metrics)
            return scored
        except Exception as error:
            metrics.duration_ms = int((time.perf_counter() - started) * 1000)
            self.store.finish_run(run_id, "failed", metrics, str(error))
            raise

    def run_all(self) -> dict:
        outcomes: dict[str, dict] = {}
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(self.run_source, source): source for source in AGENTS}
            for future in as_completed(futures):
                source = futures[future]
                try:
                    items = future.result()
                    outcomes[source] = {"status": "completed", "records": len(items)}
                except Exception as error:
                    outcomes[source] = {"status": "failed", "error": str(error)}
        latest_items = self.store.latest_opportunities()
        report = build_report(latest_items, self.store.latest_runs(), self.settings.timezone)
        self.store.save_report(report)
        return {"sources": outcomes, "report": report.model_dump(mode="json")}

    def reanalyze_current(self) -> dict:
        current_items = self.store.latest_opportunities(limit=1000)
        grouped: dict[str, list[ScoredOpportunity]] = defaultdict(list)
        for item in current_items:
            grouped[item.source].append(item)

        outcomes: dict[str, dict] = {}
        for source, existing_items in grouped.items():
            definition = AGENTS[source]
            run_id = self.store.start_run(
                f"{definition.name} · Analysis Skill",
                f"{definition.framework} + Cenyra Skill",
                source,
            )
            started = time.perf_counter()
            raw_items = [RawOpportunity.model_validate(item.model_dump()) for item in existing_items]
            preserved_enrichments = {
                item.external_key: EnrichmentItem.model_validate(item.model_dump())
                for item in existing_items
                if item.analysis_method == "llm" or item.translation_status == "translated"
            }
            evidence = {
                item.external_key: item.market_evidence
                for item in existing_items
                if item.market_evidence
            }
            scored = score_opportunities(raw_items, preserved_enrichments, evidence)
            total = max(len(scored), 1)
            metrics = RunMetrics(
                records_discovered=len(scored),
                links_discovered=sum(len(item.links) for item in scored),
                price_coverage=round(sum(item.paid_value is not None for item in scored) / total, 3),
                ranking_coverage=round(sum(item.rank is not None for item in scored) / total, 3),
                author_coverage=round(sum(bool(item.author) for item in scored) / total, 3),
                enrichment_coverage=1.0,
                translation_coverage=round(
                    sum(item.translation_status in {"translated", "not_needed"} for item in scored)
                    / total,
                    3,
                ),
                business_detail_coverage=round(
                    sum(
                        bool(item.opportunity_statement_pt)
                        and bool(item.business_potential.success_metrics)
                        and bool(item.business_potential.open_questions)
                        for item in scored
                    )
                    / total,
                    3,
                ),
                market_research_coverage=round(len(evidence) / total, 3),
                analysis_quality=round(
                    sum(item.analysis_quality_score for item in scored) / total / 100,
                    3,
                ),
                duration_ms=int((time.perf_counter() - started) * 1000),
            )
            self.store.save_opportunities(run_id, scored)
            self.store.finish_run(run_id, "completed", metrics)
            outcomes[source] = {
                "status": "completed",
                "records": len(scored),
                "analysis_quality": metrics.analysis_quality,
            }

        latest_items = self.store.latest_opportunities(limit=1000)
        report = build_report(latest_items, self.store.latest_runs(), self.settings.timezone)
        self.store.save_report(report)
        return {"sources": outcomes, "report": report.model_dump(mode="json")}
