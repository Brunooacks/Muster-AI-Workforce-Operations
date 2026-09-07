from market_lab.models import BusinessPotential, EnrichmentItem, RawOpportunity
from market_lab.scoring import heuristic_enrichment, score_opportunities, theme_summary


def test_scoring_rewards_high_signal_and_lower_complexity():
    easy = RawOpportunity(
        source="outbid",
        external_key="easy",
        title="API monitoring dashboard",
        description="Developer API and automation dashboard",
        rank=1,
        paid_value=15000,
        currency="USD",
        clicks=16000,
    )
    hard = RawOpportunity(
        source="yc-rfs",
        external_key="hard",
        title="Healthcare robotics infrastructure",
        description="Hardware robots for physical healthcare infrastructure",
    )
    easy_score = heuristic_enrichment(easy)
    hard_score = heuristic_enrichment(hard)
    assert easy_score.complexity_score < hard_score.complexity_score
    scored = score_opportunities([easy, hard], {}, {})
    assert scored[0].opportunity_score >= scored[1].opportunity_score


def test_theme_summary_counts_agent_signals():
    item = RawOpportunity(
        source="melhorlance",
        external_key="agents",
        title="MCP agent API",
        description="SDK for AI agents",
    )
    scored = score_opportunities([item], {}, {})
    themes = {entry["theme"] for entry in theme_summary(scored)}
    assert "agents" in themes
    assert "developer tools" in themes


def test_international_fallback_is_honest_and_business_ready():
    item = RawOpportunity(
        source="outbid",
        external_key="international",
        title="AI procurement assistant",
        description="A workflow for procurement teams",
        rank=2,
        paid_value=12000,
        currency="USD",
    )

    enrichment = heuristic_enrichment(item)

    assert enrichment.source_language == "en"
    assert enrichment.translation_status == "unavailable"
    assert enrichment.title_pt == ""
    assert enrichment.summary_pt == ""
    assert enrichment.opportunity_statement_pt
    assert enrichment.business_potential.mvp_scope
    assert enrichment.business_potential.validation_experiments
    assert any("12000" in signal for signal in enrichment.business_potential.market_signals)
    assert enrichment.business_potential.success_metrics
    assert enrichment.business_potential.evidence
    assert enrichment.business_potential.open_questions


def test_analysis_skill_uses_payment_specific_contract():
    item = RawOpportunity(
        source="outbid",
        external_key="flopay",
        title="FloPay",
        description=(
            "Payment orchestration SDK that improves authorization rates and recovers failed payments."
        ),
        rank=10,
        paid_value=3551,
        currency="USD",
        clicks=426,
    )

    scored = score_opportunities([item], {}, {})[0]

    assert "pagamentos" in scored.target_user
    assert "Head de Pagamentos" in scored.business_potential.economic_buyer
    assert "taxa de autorização" in scored.business_potential.success_metrics
    assert any("426 cliques" in fact for fact in scored.business_potential.evidence)
    assert "workforce" not in scored.themes
    assert scored.analysis_version == "opportunity-analysis-v1"
    assert scored.analysis_quality_score >= 50
    assert scored.evidence_strength == "média"


def test_analysis_skill_distinguishes_consumer_credit_from_payments():
    item = RawOpportunity(
        source="outbid",
        external_key="klover",
        title="Klover",
        description="Cash advance up to $750 with no interest or credit check.",
        rank=21,
        paid_value=2000,
        currency="USD",
        clicks=2520,
    )

    enrichment = heuristic_enrichment(item)

    assert "consumidores" in enrichment.target_user
    assert "inadimplência" in enrichment.business_potential.success_metrics
    assert any("Risco regulatório" in risk for risk in enrichment.business_potential.risks)


def test_portuguese_source_does_not_require_translation():
    item = RawOpportunity(
        source="melhorlance",
        external_key="brasil",
        title="Agente para conciliação financeira",
        description="Automatiza a conferência de pagamentos.",
    )

    enrichment = heuristic_enrichment(item)

    assert enrichment.source_language == "pt-BR"
    assert enrichment.translation_status == "not_needed"
    assert enrichment.title_pt == item.title
    assert enrichment.summary_pt == item.description


def test_scoring_preserves_translation_and_business_dossier():
    item = RawOpportunity(
        source="yc-rfs",
        external_key="translated",
        title="Tools for public safety",
        description="Infrastructure for emergency response teams.",
    )
    enrichment = EnrichmentItem(
        external_key=item.external_key,
        source_language="en",
        translation_status="translated",
        title_pt="Ferramentas para segurança pública",
        summary_pt="Infraestrutura para equipes de resposta a emergências.",
        opportunity_statement_pt="Reduzir o tempo de coordenação em incidentes críticos.",
        solution_concept_pt="Uma central operacional interoperável.",
        pain_points=["Sistemas fragmentados"],
        themes=["physical world"],
        target_user="equipes de resposta a emergências",
        complexity_score=68,
        return_score=76,
        hotness_score=82,
        confidence=0.74,
        rationale="A fonte e o problema foram identificados; a compra ainda precisa ser validada.",
        business_potential=BusinessPotential(
            level="alto",
            customer_profile="operações de segurança pública",
            economic_buyer="gestor de operações",
            mvp_scope=["Unificar alertas de dois sistemas."],
            validation_experiments=["Executar um piloto com uma central regional."],
        ),
    )

    scored = score_opportunities([item], {item.external_key: enrichment}, {})[0]

    assert scored.translation_status == "translated"
    assert scored.title_pt == enrichment.title_pt
    assert scored.opportunity_statement_pt == enrichment.opportunity_statement_pt
    assert scored.business_potential.economic_buyer == "gestor de operações"
    assert scored.business_potential.success_metrics
    assert scored.analysis_method == "llm"
