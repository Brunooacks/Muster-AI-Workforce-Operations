import math
import re
from collections import Counter

from market_lab.analysis_skill import (
    build_heuristic_analysis,
    complete_analysis,
    evaluate_quality,
)
from market_lab.models import EnrichmentItem, RawOpportunity, ScoredOpportunity


LOW_COMPLEXITY_TERMS = {
    "api",
    "dashboard",
    "directory",
    "workflow",
    "automation",
    "marketplace",
    "assistant",
    "monitoring",
}
HIGH_COMPLEXITY_TERMS = {
    "robot",
    "robotics",
    "hardware",
    "healthcare",
    "defense",
    "biotech",
    "infrastructure",
    "operating system",
    "crypto",
}
THEME_TERMS = {
    "agents": ("agent", "agente", "llm", "mcp"),
    "developer tools": ("developer", "code", "api", "sdk", "software"),
    "finance": ("payment", "finance", "pix", "bank", "accounting", "cfo"),
    "workforce": ("workforce", "worker", "hiring", "labor", "employee", "recruit"),
    "health": ("health", "care", "patient", "aging", "fitness"),
    "education": ("education", "learn", "tutor", "school", "child"),
    "marketing": ("marketing", "seo", "sales", "content", "growth"),
    "physical world": ("robot", "physical", "construction", "fleet", "field"),
}


def clamp(value: float) -> int:
    return max(0, min(100, int(round(value))))


def infer_themes(text: str) -> list[str]:
    lowered = text.lower()
    themes = [name for name, terms in THEME_TERMS.items() if any(term in lowered for term in terms)]
    return themes[:5] or ["produto digital"]


def heuristic_enrichment(item: RawOpportunity) -> EnrichmentItem:
    text = f"{item.title} {item.description}".lower()
    low_hits = sum(term in text for term in LOW_COMPLEXITY_TERMS)
    high_hits = sum(term in text for term in HIGH_COMPLEXITY_TERMS)
    complexity = clamp(45 + high_hits * 9 - low_hits * 5 + min(len(item.description) / 900, 12))
    rank_signal = max(0, 35 - ((item.rank or 35) - 1))
    paid_signal = min(30, math.log10((item.paid_value or 0) + 1) * 8)
    click_signal = min(25, math.log10((item.clicks or 0) + 1) * 7)
    yc_signal = 30 if item.source == "yc-rfs" else 0
    hotness = clamp(20 + rank_signal + paid_signal + click_signal + yc_signal)
    return_score = clamp(hotness * 0.68 + (100 - complexity) * 0.32)
    themes = infer_themes(text)
    return build_heuristic_analysis(
        item,
        complexity_score=complexity,
        return_score=return_score,
        hotness_score=hotness,
        themes=themes,
    )


def score_opportunities(
    raw_items: list[RawOpportunity],
    enrichments: dict[str, EnrichmentItem],
    evidence: dict[str, list[dict]],
) -> list[ScoredOpportunity]:
    scored: list[ScoredOpportunity] = []
    for item in raw_items:
        supplied_enrichment = enrichments.get(item.external_key)
        enrichment = complete_analysis(
            item,
            supplied_enrichment or heuristic_enrichment(item),
        )
        item_evidence = evidence.get(item.external_key, [])
        analysis_quality, evidence_strength = evaluate_quality(item, enrichment, item_evidence)
        market_bonus = min(10, len(item_evidence) * 2)
        opportunity = clamp(
            enrichment.hotness_score * 0.42
            + enrichment.return_score * 0.33
            + (100 - enrichment.complexity_score) * 0.25
            + market_bonus
        )
        scored.append(
            ScoredOpportunity(
                **item.model_dump(),
                source_language=enrichment.source_language,
                translation_status=enrichment.translation_status,
                title_pt=enrichment.title_pt,
                summary_pt=enrichment.summary_pt,
                opportunity_statement_pt=enrichment.opportunity_statement_pt,
                solution_concept_pt=enrichment.solution_concept_pt,
                pain_points=enrichment.pain_points,
                themes=enrichment.themes,
                target_user=enrichment.target_user,
                complexity_score=enrichment.complexity_score,
                return_score=enrichment.return_score,
                hotness_score=enrichment.hotness_score,
                opportunity_score=opportunity,
                confidence=min(1, enrichment.confidence + (0.05 if item_evidence else 0)),
                analysis_version=enrichment.analysis_version,
                analysis_method="llm" if supplied_enrichment else "heuristic",
                analysis_quality_score=analysis_quality,
                evidence_strength=evidence_strength,
                rationale=enrichment.rationale,
                market_evidence=item_evidence,
                business_potential=enrichment.business_potential,
            )
        )
    return sorted(scored, key=lambda item: item.opportunity_score, reverse=True)


def theme_summary(items: list[ScoredOpportunity]) -> list[dict]:
    counter = Counter(theme for item in items for theme in item.themes)
    return [
        {"theme": theme, "count": count, "share": round(count / max(len(items), 1), 3)}
        for theme, count in counter.most_common(12)
    ]


def safe_excerpt(value: str, limit: int = 5000) -> str:
    return re.sub(r"\s+", " ", value).strip()[:limit]
