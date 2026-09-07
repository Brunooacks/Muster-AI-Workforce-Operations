from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


SourceName = Literal["melhorlance", "outbid", "yc-rfs"]
TranslationStatus = Literal["not_needed", "translated", "unavailable"]
BusinessPotentialLevel = Literal["baixo", "médio", "alto", "não avaliado"]
AnalysisMethod = Literal["heuristic", "llm"]
EvidenceStrength = Literal["baixa", "média", "alta"]


class RawOpportunity(BaseModel):
    source: SourceName
    external_key: str
    title: str
    description: str = ""
    url: str | None = None
    author: str | None = None
    season: str | None = None
    category: str | None = None
    rank: int | None = None
    paid_value: float | None = None
    currency: str | None = None
    clicks: int | None = None
    links: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    collected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BusinessPotential(BaseModel):
    level: BusinessPotentialLevel = "não avaliado"
    customer_profile: str = "não identificado"
    economic_buyer: str = "não identificado"
    market_scope: str = "evidência insuficiente para dimensionar"
    problem_frequency: str = "não identificada"
    value_capture: str = "hipótese ainda não validada"
    revenue_models: list[str] = Field(default_factory=list)
    market_signals: list[str] = Field(default_factory=list)
    why_now: list[str] = Field(default_factory=list)
    competitive_landscape: str = "não pesquisado"
    differentiation: str = "não definida"
    mvp_scope: list[str] = Field(default_factory=list)
    go_to_market: list[str] = Field(default_factory=list)
    validation_experiments: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    success_metrics: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)


class EnrichmentItem(BaseModel):
    external_key: str
    source_language: str = "não identificado"
    translation_status: TranslationStatus = "unavailable"
    title_pt: str = ""
    summary_pt: str
    opportunity_statement_pt: str = ""
    solution_concept_pt: str = ""
    pain_points: list[str] = Field(default_factory=list)
    themes: list[str] = Field(default_factory=list)
    target_user: str = "não identificado"
    complexity_score: int = Field(ge=0, le=100)
    return_score: int = Field(ge=0, le=100)
    hotness_score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    rationale: str
    market_search_queries: list[str] = Field(default_factory=list)
    analysis_version: str = "legacy"
    analysis_method: AnalysisMethod = "heuristic"
    business_potential: BusinessPotential = Field(default_factory=BusinessPotential)


class EnrichmentBatch(BaseModel):
    items: list[EnrichmentItem]


class ScoredOpportunity(RawOpportunity):
    source_language: str = "não identificado"
    translation_status: TranslationStatus = "unavailable"
    title_pt: str = ""
    summary_pt: str = ""
    opportunity_statement_pt: str = ""
    solution_concept_pt: str = ""
    pain_points: list[str] = Field(default_factory=list)
    themes: list[str] = Field(default_factory=list)
    target_user: str = "não identificado"
    complexity_score: int = Field(ge=0, le=100)
    return_score: int = Field(ge=0, le=100)
    hotness_score: int = Field(ge=0, le=100)
    opportunity_score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    analysis_version: str = "legacy"
    analysis_method: AnalysisMethod = "heuristic"
    analysis_quality_score: int = Field(default=0, ge=0, le=100)
    evidence_strength: EvidenceStrength = "baixa"
    rationale: str = ""
    market_evidence: list[dict[str, Any]] = Field(default_factory=list)
    business_potential: BusinessPotential = Field(default_factory=BusinessPotential)


class CollectionResult(BaseModel):
    source: SourceName
    source_url: str
    http_status: int
    page_link_count: int
    source_hash: str
    items: list[RawOpportunity]
    collected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RunMetrics(BaseModel):
    records_discovered: int = 0
    links_discovered: int = 0
    price_coverage: float = 0
    ranking_coverage: float = 0
    author_coverage: float = 0
    enrichment_coverage: float = 0
    translation_coverage: float = 0
    business_detail_coverage: float = 0
    market_research_coverage: float = 0
    analysis_quality: float = 0
    duration_ms: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0
    llm_used: bool = False
    source_hash: str = ""
    degraded_reason: str | None = None


class AgentRun(BaseModel):
    id: str
    agent_name: str
    framework: str
    source: SourceName | Literal["synthesis"]
    status: Literal["running", "completed", "failed"]
    started_at: datetime
    completed_at: datetime | None = None
    metrics: RunMetrics = Field(default_factory=RunMetrics)
    error: str | None = None


class DailyReport(BaseModel):
    report_date: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    executive_summary: str
    opportunity_count: int
    total_links: int
    total_paid_value_usd: float
    total_paid_value_brl: float
    top_opportunities: list[ScoredOpportunity]
    themes: list[dict[str, Any]]
    agent_health: list[dict[str, Any]]
    recommendations: list[str]
