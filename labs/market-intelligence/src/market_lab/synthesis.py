from datetime import datetime
from zoneinfo import ZoneInfo

from market_lab.models import AgentRun, DailyReport, ScoredOpportunity
from market_lab.scoring import theme_summary


def _agent_health(runs: list[AgentRun]) -> list[dict]:
    latest_by_source: dict[str, AgentRun] = {}
    for run in runs:
        latest_by_source.setdefault(run.source, run)
    return [
        {
            "agent_name": run.agent_name,
            "framework": run.framework,
            "source": run.source,
            "status": run.status,
            "started_at": run.started_at.isoformat(),
            "duration_ms": run.metrics.duration_ms,
            "records": run.metrics.records_discovered,
            "links": run.metrics.links_discovered,
            "coverage": run.metrics.enrichment_coverage,
            "translation_coverage": run.metrics.translation_coverage,
            "business_detail_coverage": run.metrics.business_detail_coverage,
            "market_research_coverage": run.metrics.market_research_coverage,
            "cost_usd": run.metrics.estimated_cost_usd,
            "llm_used": run.metrics.llm_used,
            "degraded_reason": run.metrics.degraded_reason,
        }
        for run in latest_by_source.values()
    ]


def build_report(
    items: list[ScoredOpportunity],
    runs: list[AgentRun],
    timezone_name: str = "America/Sao_Paulo",
) -> DailyReport:
    top = sorted(items, key=lambda item: item.opportunity_score, reverse=True)[:30]
    themes = theme_summary(items)
    high_signal = [item for item in items if item.opportunity_score >= 70]
    low_complexity = [item for item in high_signal if item.complexity_score <= 45]
    summary = (
        f"O laboratório consolidou {len(items)} oportunidades públicas. "
        f"{len(high_signal)} apresentam sinal alto e {len(low_complexity)} combinam sinal alto "
        "com menor complexidade relativa para validação."
    )
    recommendations = []
    for item in low_complexity[:5]:
        title = item.title_pt or item.title
        recommendations.append(
            f"Validar {title}: score {item.opportunity_score}, "
            f"complexidade {item.complexity_score} e potencial de negócio {item.return_score}."
        )
    if not recommendations:
        recommendations.append("Aumentar a evidência de mercado antes de selecionar um experimento.")
    return DailyReport(
        report_date=datetime.now(ZoneInfo(timezone_name)).date().isoformat(),
        executive_summary=summary,
        opportunity_count=len(items),
        total_links=sum(len(item.links) for item in items),
        total_paid_value_usd=round(
            sum(item.paid_value or 0 for item in items if item.currency == "USD"), 2
        ),
        total_paid_value_brl=round(
            sum(item.paid_value or 0 for item in items if item.currency == "BRL"), 2
        ),
        top_opportunities=top,
        themes=themes,
        agent_health=_agent_health(runs),
        recommendations=recommendations,
    )
