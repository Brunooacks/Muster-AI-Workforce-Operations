import re
from dataclasses import dataclass

from market_lab.models import BusinessPotential, EnrichmentItem, RawOpportunity


ANALYSIS_VERSION = "opportunity-analysis-v1"


@dataclass(frozen=True)
class AnalysisProfile:
    key: str
    label: str
    terms: tuple[str, ...]
    target_user: str
    economic_buyer: str
    problem: str
    consequence: str
    solution: str
    pains: tuple[str, ...]
    value_capture: str
    revenue_models: tuple[str, ...]
    success_metrics: tuple[str, ...]
    mvp_scope: tuple[str, ...]
    go_to_market: tuple[str, ...]
    risks: tuple[str, ...]


PROFILES = (
    AnalysisProfile(
        key="consumer-credit",
        label="crédito e liquidez ao consumidor",
        terms=("cash advance", "credit", "loan", "lending", "borrow", "liquidez"),
        target_user="consumidores com descasamento de caixa e baixa disponibilidade de crédito",
        economic_buyer="liderança de produto, risco ou crédito da instituição financeira",
        problem="o acesso a liquidez de curto prazo costuma ser lento, caro ou incompatível com o perfil do usuário",
        consequence="gerar abandono, inadimplência, pressão financeira e baixa confiança",
        solution="validar uma jornada limitada de elegibilidade, oferta transparente e acompanhamento da liquidação",
        pains=("tempo para obter liquidez", "custo e transparência da oferta", "avaliação de risco e fraude"),
        value_capture="receita por operação ou assinatura, condicionada a risco, regulação e benefício comprovado ao usuário",
        revenue_models=("Tarifa por operação elegível.", "Assinatura com benefícios financeiros recorrentes."),
        success_metrics=("taxa de elegibilidade", "tempo até disponibilização", "inadimplência", "reincidência de uso saudável", "NPS da jornada"),
        mvp_scope=("Simular elegibilidade com dados mínimos.", "Exibir custo total e condições antes do aceite.", "Acompanhar liquidação e suporte em uma coorte controlada."),
        go_to_market=("Piloto com uma instituição ou comunidade financeira delimitada.",),
        risks=("Risco regulatório e de crédito.", "Incentivo a endividamento inadequado.", "Fraude de identidade ou renda."),
    ),
    AnalysisProfile(
        key="payment-operations",
        label="operações e infraestrutura de pagamentos",
        terms=("payment", "payments", "checkout", "authorization", "failed payment", "chargeback", "acquirer", "billing", "pix"),
        target_user="times de pagamentos, receita, finops e engenharia de empresas digitais",
        economic_buyer="Head de Pagamentos, CFO, VP de Engenharia ou liderança de Receita",
        problem="operações de pagamento fragmentadas reduzem aprovação e tornam falhas difíceis de diagnosticar e recuperar",
        consequence="provocar perda de receita, maior custo operacional e pior experiência de compra",
        solution="instrumentar um fluxo de pagamento com roteamento, observabilidade e recuperação de falhas mensuráveis",
        pains=("baixa taxa de autorização", "pagamentos falhos sem recuperação", "integrações e reconciliação fragmentadas"),
        value_capture="capturar parte da receita recuperada ou cobrar por volume processado e capacidade operacional",
        revenue_models=("Cobrança por transação processada.", "Assinatura por volume e recursos de orquestração.", "Success fee sobre receita recuperada."),
        success_metrics=("taxa de autorização", "receita recuperada", "custo por pagamento aprovado", "latência", "taxa de falha e chargeback"),
        mvp_scope=("Integrar um provedor e um fluxo de pagamento.", "Classificar falhas e aplicar uma estratégia de recuperação.", "Comparar aprovação e receita antes e depois."),
        go_to_market=("Piloto com uma operação digital que tenha volume e falhas mensuráveis.",),
        risks=("Dependência de adquirentes e gateways.", "Requisitos PCI e proteção de dados.", "Atribuição incorreta da receita recuperada."),
    ),
    AnalysisProfile(
        key="agent-infrastructure",
        label="infraestrutura e operação de agentes",
        terms=("agent", "agents", "agente", "llm", "mcp", "autonomous", "copilot"),
        target_user="times de plataforma de IA, automação e operações que executam agentes em produção",
        economic_buyer="CTO, Head de IA, Head de Plataforma ou liderança de Operações",
        problem="agentes executam tarefas com pouca visibilidade de qualidade, custo, autonomia e falhas",
        consequence="aumentar risco operacional, intervenção humana e dificuldade para provar resultado",
        solution="observar uma tarefa ponta a ponta, registrar decisão, evidência, custo, intervenção e resultado esperado",
        pains=("baixa rastreabilidade de decisões", "custos e falhas imprevisíveis", "ausência de critérios consistentes de supervisão"),
        value_capture="reduzir falhas, tempo de supervisão e custo por resultado validado",
        revenue_models=("Assinatura por agente ou ambiente.", "Cobrança por execução monitorada.", "Plano enterprise por governança e retenção."),
        success_metrics=("sucesso por tarefa", "custo por execução válida", "taxa de intervenção", "latência", "aderência ao propósito", "incidentes por mil execuções"),
        mvp_scope=("Instrumentar um agente e uma tarefa recorrente.", "Capturar entradas, decisões, ferramentas, custo e resultado.", "Aplicar revisão humana nos casos de baixa confiança."),
        go_to_market=("Piloto em um workload recorrente com owner e critério de sucesso definidos.",),
        risks=("Telemetria incompleta.", "Métricas desconectadas do resultado real.", "Automação acima da autonomia autorizada."),
    ),
    AnalysisProfile(
        key="developer-tools",
        label="ferramentas e infraestrutura para desenvolvimento",
        terms=("developer", "code", "coding", "api", "sdk", "devtool", "software", "cloud", "deploy"),
        target_user="engenheiros de software, times de plataforma e líderes de desenvolvimento",
        economic_buyer="CTO, VP de Engenharia ou Head de Plataforma",
        problem="tarefas técnicas repetitivas e integrações fragmentadas consomem tempo e aumentam risco de entrega",
        consequence="reduzir velocidade, qualidade e previsibilidade do ciclo de desenvolvimento",
        solution="automatizar um fluxo técnico delimitado com integração simples, observabilidade e reversibilidade",
        pains=("tempo de integração", "retrabalho técnico", "falhas difíceis de reproduzir"),
        value_capture="economia de horas de engenharia e redução de incidentes ou lead time",
        revenue_models=("Assinatura por desenvolvedor.", "Cobrança por uso ou execução.", "Plano por equipe com governança."),
        success_metrics=("tempo até primeira integração", "adoção semanal", "lead time", "taxa de sucesso", "incidentes", "horas economizadas"),
        mvp_scope=("Atender uma stack e um fluxo técnico.", "Medir tempo manual e automatizado.", "Disponibilizar logs, erros e reversão."),
        go_to_market=("Design partners em equipes com o mesmo stack e problema recorrente.",),
        risks=("Integração específica demais.", "Baixa frequência do problema.", "Economia de tempo não comprovada."),
    ),
    AnalysisProfile(
        key="growth",
        label="marketing, vendas e crescimento",
        terms=("marketing", "seo", "sales", "content", "growth", "lead", "campaign", "affiliate"),
        target_user="times de marketing, growth, conteúdo e receita",
        economic_buyer="CMO, Head de Growth ou liderança de Receita",
        problem="aquisição e produção de conteúdo exigem coordenação manual com atribuição limitada",
        consequence="elevar CAC, reduzir conversão e dificultar a priorização de canais",
        solution="automatizar uma etapa do funil com atribuição explícita e revisão de qualidade",
        pains=("alto custo de aquisição", "produção inconsistente", "atribuição fraca entre ação e resultado"),
        value_capture="redução de CAC ou aumento verificável de conversão e produtividade",
        revenue_models=("Assinatura por equipe ou volume.", "Cobrança por campanha ou ativo produzido."),
        success_metrics=("CAC", "taxa de conversão", "pipeline influenciado", "tempo por ativo", "taxa de aprovação"),
        mvp_scope=("Escolher um canal e uma etapa do funil.", "Medir baseline de custo e conversão.", "Executar campanha controlada com revisão humana."),
        go_to_market=("Piloto com uma equipe que possua histórico de campanhas comparável.",),
        risks=("Atribuição incorreta.", "Qualidade de marca insuficiente.", "Dependência de mudanças nas plataformas de distribuição."),
    ),
    AnalysisProfile(
        key="workforce",
        label="trabalho, contratação e produtividade",
        terms=("workforce", "worker", "hiring", "recruit", "team", "labor", "employee", "talent"),
        target_user="equipes de pessoas, operações e gestores de times humanos ou híbridos",
        economic_buyer="CHRO, COO ou liderança da área operacional",
        problem="distribuição de trabalho e avaliação de desempenho têm baixa clareza de responsabilidade e resultado",
        consequence="gerar sobrecarga, baixa adoção e decisões de gestão pouco comparáveis",
        solution="definir propósito, papéis, contratos de trabalho e indicadores por responsabilidade",
        pains=("papéis pouco claros", "carga desequilibrada", "avaliação sem evidência de resultado"),
        value_capture="melhorar produtividade, qualidade e capacidade sem aumentar proporcionalmente a equipe",
        revenue_models=("Assinatura por colaborador ou agente gerenciado.", "Plano por equipe ou unidade de negócio."),
        success_metrics=("entregas no prazo", "qualidade", "carga por papel", "intervenções", "adoção", "resultado por equipe"),
        mvp_scope=("Modelar uma equipe e seu propósito.", "Atribuir responsabilidades e indicadores.", "Executar um ciclo de acompanhamento e feedback."),
        go_to_market=("Piloto com um squad misto e uma jornada de trabalho conhecida.",),
        risks=("Métricas usadas como vigilância.", "Resultados sem contexto de carga e complexidade.", "Baixa adesão dos gestores."),
    ),
    AnalysisProfile(
        key="public-sector",
        label="governo, segurança e operações reguladas",
        terms=("government", "public safety", "defense", "compliance", "audit", "fraud", "regulatory"),
        target_user="equipes públicas, regulatórias, de auditoria ou segurança responsáveis por decisões críticas",
        economic_buyer="CIO público, secretário, diretor de operações, risco ou compliance",
        problem="processos críticos dependem de sistemas fragmentados, análise manual e baixa rastreabilidade de decisão",
        consequence="aumentar tempo de resposta, risco de erro e dificuldade de prestação de contas",
        solution="instrumentar um caso de uso delimitado com trilha de auditoria, revisão humana e política de decisão",
        pains=("dados fragmentados", "tempo de investigação", "baixa auditabilidade de decisões"),
        value_capture="redução de tempo e risco operacional com evidência de conformidade e resultado público",
        revenue_models=("Contrato institucional por unidade ou programa.", "Licença por volume, usuários e requisitos de governança."),
        success_metrics=("tempo de resolução", "cobertura de auditoria", "falso positivo", "incidentes", "decisões revisadas", "aderência à política"),
        mvp_scope=("Selecionar um caso de baixo risco e alto volume.", "Integrar duas fontes com trilha de decisão.", "Medir tempo, qualidade e revisão humana."),
        go_to_market=("Piloto institucional com sponsor, jurídico e operação definidos.",),
        risks=("Compra e integração prolongadas.", "Privacidade, segurança e devido processo.", "Automação de decisão sem supervisão adequada."),
    ),
    AnalysisProfile(
        key="physical-operations",
        label="operações físicas, indústria e robótica",
        terms=("robot", "robotics", "manufacturing", "construction", "fleet", "warehouse", "hardware", "semiconductor", "agriculture"),
        target_user="operações industriais, de campo, logística ou infraestrutura com ativos físicos",
        economic_buyer="COO, diretor industrial, de frota, engenharia ou operações de campo",
        problem="operações físicas têm baixa visibilidade em tempo real e dependem de coordenação manual entre ativos, sistemas e pessoas",
        consequence="aumentar parada, desperdício, risco de segurança e custo por operação",
        solution="instrumentar um ativo e um fluxo operacional com telemetria, alerta, decisão e intervenção segura",
        pains=("paradas e falhas não previstas", "coordenação manual", "dados operacionais fragmentados"),
        value_capture="redução de downtime, desperdício, incidentes ou custo por unidade produzida",
        revenue_models=("Assinatura por ativo ou local.", "Licença de software com implantação e suporte.", "Cobrança por resultado operacional validado."),
        success_metrics=("downtime", "tempo de ciclo", "custo por unidade", "incidentes", "utilização do ativo", "intervenções"),
        mvp_scope=("Selecionar um ativo e uma falha recorrente.", "Capturar telemetria mínima e baseline.", "Executar recomendação com aprovação humana e medir resultado."),
        go_to_market=("Piloto em uma planta, frota ou operação de campo com sponsor local.",),
        risks=("Capex e integração legada.", "Segurança física.", "Dados insuficientes ou não padronizados."),
    ),
    AnalysisProfile(
        key="health",
        label="saúde e cuidado",
        terms=("health", "healthcare", "patient", "clinical", "medicine", "care", "fitness"),
        target_user="pacientes, profissionais de saúde e operações de cuidado no recorte indicado",
        economic_buyer="liderança clínica, operacional ou de benefícios da organização",
        problem="jornadas de cuidado fragmentadas dificultam acesso, acompanhamento e decisão consistente",
        consequence="aumentar risco, custo assistencial e atraso no cuidado",
        solution="validar uma etapa não crítica da jornada com supervisão profissional e rastreabilidade",
        pains=("acesso fragmentado", "baixa continuidade do cuidado", "informação insuficiente para decisão"),
        value_capture="redução de custo evitável ou melhora de acesso e continuidade com segurança clínica",
        revenue_models=("Contrato B2B por população coberta.", "Cobrança por jornada acompanhada."),
        success_metrics=("tempo de acesso", "adesão", "desfecho definido", "escalonamentos", "segurança e satisfação"),
        mvp_scope=("Limitar a uma condição e etapa não emergencial.", "Definir protocolo e supervisão clínica.", "Medir acesso, adesão e segurança."),
        go_to_market=("Piloto com um prestador ou empregador e protocolo aprovado.",),
        risks=("Risco clínico e regulatório.", "Viés e privacidade de dados.", "Desfecho inadequadamente atribuído."),
    ),
    AnalysisProfile(
        key="education",
        label="educação e aprendizagem",
        terms=("education", "learn", "learning", "tutor", "school", "student", "teacher"),
        target_user="estudantes, educadores e organizações responsáveis pela aprendizagem",
        economic_buyer="liderança acadêmica, escola, empregador ou responsável pelo aluno",
        problem="aprendizagem pouco personalizada dificulta diagnóstico, prática e acompanhamento de progresso",
        consequence="reduzir domínio do conteúdo e aumentar tempo até competência",
        solution="diagnosticar uma habilidade, recomendar prática e medir evolução com supervisão adequada",
        pains=("feedback tardio", "conteúdo pouco adaptado", "progresso difícil de demonstrar"),
        value_capture="melhora de aprendizagem, conclusão ou tempo até competência",
        revenue_models=("Assinatura individual.", "Licença por turma ou organização."),
        success_metrics=("ganho de domínio", "retenção", "conclusão", "tempo de aprendizagem", "uso ativo"),
        mvp_scope=("Escolher uma habilidade e uma coorte.", "Aplicar diagnóstico e trilha curta.", "Comparar domínio antes e depois."),
        go_to_market=("Piloto com uma turma, curso ou programa corporativo.",),
        risks=("Engajamento superficial.", "Métrica de atividade confundida com aprendizagem.", "Conteúdo inadequado ao contexto."),
    ),
    AnalysisProfile(
        key="general-digital",
        label="produto ou serviço digital",
        terms=(),
        target_user="usuários diretamente afetados pelo fluxo descrito na fonte",
        economic_buyer="owner operacional ou executivo responsável pelo resultado do fluxo",
        problem="o fluxo observado aparenta ter fricção, custo ou baixa qualidade ainda não quantificados",
        consequence="consumir tempo e produzir resultado inconsistente",
        solution="executar manualmente o resultado central para uma coorte pequena antes de automatizar",
        pains=("fricção no fluxo atual", "resultado inconsistente", "ausência de baseline comparável"),
        value_capture="redução de tempo, custo ou risco validada contra o processo atual",
        revenue_models=("Assinatura.", "Cobrança por uso ou resultado validado."),
        success_metrics=("tempo por tarefa", "taxa de conclusão", "qualidade percebida", "recorrência", "disposição a pagar"),
        mvp_scope=("Escolher um público e um fluxo.", "Entregar o resultado de forma concierge.", "Medir baseline, uso e qualidade."),
        go_to_market=("Entrevistas e piloto com usuários que já executam o fluxo.",),
        risks=("Sinal de atenção sem dor recorrente.", "Comprador e orçamento não comprovados.", "Mercado superestimado."),
    ),
)


def _contains_term(text: str, term: str) -> bool:
    if " " in term:
        return term in text
    return re.search(rf"\b{re.escape(term)}\b", text) is not None


def select_profile(item: RawOpportunity) -> tuple[AnalysisProfile, int]:
    text = f"{item.title} {item.description} {item.category or ''}".lower()
    ranked = [
        (sum(_contains_term(text, term) for term in profile.terms), profile)
        for profile in PROFILES[:-1]
    ]
    matches, profile = max(ranked, key=lambda entry: entry[0])
    return (profile, matches) if matches else (PROFILES[-1], 0)


def observed_facts(item: RawOpportunity) -> list[str]:
    facts = [f"Fonte pública monitorada: {item.source}."]
    description = re.sub(r"\s+", " ", item.description).strip()
    description = re.sub(r"^#\s*\d+\s+", "", description)
    description = re.sub(
        r"\s+\d+\s+(?:minutes?|hours?|days?|weeks?|months?)\s+ago\b[\s\S]*$",
        "",
        description,
        flags=re.IGNORECASE,
    ).strip()
    description = re.sub(r"\s+see details\b[\s\S]*$", "", description, flags=re.IGNORECASE).strip()
    if description:
        facts.append(f"Descrição publicada: {description[:280]}")
    if item.rank is not None:
        facts.append(f"Posição observada no ranking: #{item.rank}.")
    if item.clicks is not None:
        facts.append(f"Interesse público observado: {item.clicks} cliques.")
    if item.paid_value is not None:
        facts.append(f"Valor público associado: {item.paid_value:g} {item.currency or ''}.".strip())
    if item.category:
        facts.append(f"Categoria declarada pela fonte: {item.category}.")
    if item.season:
        facts.append(f"Tema publicado na estação {item.season} do YC RFS.")
    if item.author:
        facts.append(f"Autoria pública atribuída a {item.author}.")
    return facts


def build_heuristic_analysis(
    item: RawOpportunity,
    *,
    complexity_score: int,
    return_score: int,
    hotness_score: int,
    themes: list[str],
) -> EnrichmentItem:
    profile, matches = select_profile(item)
    source_language = "pt-BR" if item.source == "melhorlance" else "en"
    translated = source_language == "pt-BR"
    facts = observed_facts(item)
    profile_confidence = min(0.72, 0.42 + matches * 0.07)
    potential_level = "alto" if return_score >= 70 else "médio" if return_score >= 45 else "baixo"
    return EnrichmentItem(
        external_key=item.external_key,
        source_language=source_language,
        translation_status="not_needed" if translated else "unavailable",
        title_pt=item.title if translated else "",
        summary_pt=(item.description[:360] or item.title) if translated else "",
        opportunity_statement_pt=(
            f"{profile.problem.capitalize()}. Para {profile.target_user}, isso pode {profile.consequence}. "
            "A recorrência, a prioridade e a disposição para mudança ainda precisam ser confirmadas."
        ),
        solution_concept_pt=profile.solution.capitalize() + ".",
        pain_points=list(profile.pains),
        themes=themes,
        target_user=profile.target_user,
        complexity_score=complexity_score,
        return_score=return_score,
        hotness_score=hotness_score,
        confidence=profile_confidence,
        rationale=(
            f"Classificação pela skill {ANALYSIS_VERSION}: domínio provável de {profile.label}, com {matches} "
            "sinais semânticos. Potencial e complexidade são hipóteses até existir baseline e evidência de uso."
        ),
        market_search_queries=[
            f'"{item.title}" clientes concorrentes',
            f'"{profile.label}" software mercado',
            f'"{profile.problem}" alternativas',
        ],
        analysis_version=ANALYSIS_VERSION,
        analysis_method="heuristic",
        business_potential=BusinessPotential(
            level=potential_level,
            customer_profile=profile.target_user,
            economic_buyer=profile.economic_buyer,
            market_scope="Sinal de categoria identificado; tamanho e orçamento ainda não dimensionados com fonte independente.",
            problem_frequency="A validar com dados operacionais e entrevistas do perfil indicado.",
            value_capture=profile.value_capture,
            revenue_models=list(profile.revenue_models),
            market_signals=facts[2:] or facts,
            why_now=["A fonte monitorada registrou atenção recente para esta proposta."],
            competitive_landscape="Mapear processo atual, soluções verticais e alternativas internas antes de assumir espaço competitivo.",
            differentiation="Demonstrar resultado superior no KPI principal com menor esforço, risco ou tempo de adoção.",
            mvp_scope=list(profile.mvp_scope),
            go_to_market=list(profile.go_to_market),
            validation_experiments=[
                "Entrevistar 10 usuários e 5 compradores do perfil indicado.",
                "Medir o processo atual antes de apresentar a solução.",
                "Executar um piloto com critério de sucesso e decisão de continuidade definidos.",
            ],
            risks=list(profile.risks),
            success_metrics=list(profile.success_metrics),
            evidence=facts,
            assumptions=[
                f"Inferência: a oportunidade pertence principalmente ao domínio de {profile.label}.",
                f"Hipótese: {profile.economic_buyer} controla prioridade ou orçamento.",
                f"Hipótese de captura de valor: {profile.value_capture}.",
            ],
            open_questions=[
                "Com que frequência o problema ocorre e qual é o baseline atual?",
                "Quem aprova orçamento e quais alternativas já são usadas?",
                "Qual KPI determina sucesso, pausa ou encerramento do piloto?",
            ],
        ),
    )


def complete_analysis(item: RawOpportunity, enrichment: EnrichmentItem) -> EnrichmentItem:
    fallback = build_heuristic_analysis(
        item,
        complexity_score=enrichment.complexity_score,
        return_score=enrichment.return_score,
        hotness_score=enrichment.hotness_score,
        themes=enrichment.themes,
    )
    potential = enrichment.business_potential
    fallback_potential = fallback.business_potential
    placeholders = {
        "não avaliado",
        "não identificado",
        "não identificada",
        "não pesquisado",
        "não definida",
        "evidência insuficiente para dimensionar",
        "hipótese ainda não validada",
    }

    def completed_text(current: str, default: str) -> str:
        return default if not current.strip() or current.strip().lower() in placeholders else current

    completed_potential = potential.model_copy(
        update={
            "level": completed_text(potential.level, fallback_potential.level),
            "customer_profile": completed_text(
                potential.customer_profile,
                fallback_potential.customer_profile,
            ),
            "economic_buyer": completed_text(
                potential.economic_buyer,
                fallback_potential.economic_buyer,
            ),
            "market_scope": completed_text(potential.market_scope, fallback_potential.market_scope),
            "problem_frequency": completed_text(
                potential.problem_frequency,
                fallback_potential.problem_frequency,
            ),
            "value_capture": completed_text(
                potential.value_capture,
                fallback_potential.value_capture,
            ),
            "revenue_models": potential.revenue_models or fallback_potential.revenue_models,
            "market_signals": potential.market_signals or fallback_potential.market_signals,
            "why_now": potential.why_now or fallback_potential.why_now,
            "competitive_landscape": completed_text(
                potential.competitive_landscape,
                fallback_potential.competitive_landscape,
            ),
            "differentiation": completed_text(
                potential.differentiation,
                fallback_potential.differentiation,
            ),
            "mvp_scope": potential.mvp_scope or fallback_potential.mvp_scope,
            "go_to_market": potential.go_to_market or fallback_potential.go_to_market,
            "validation_experiments": (
                potential.validation_experiments or fallback_potential.validation_experiments
            ),
            "risks": potential.risks or fallback_potential.risks,
            "success_metrics": potential.success_metrics or fallback_potential.success_metrics,
            "evidence": potential.evidence or fallback_potential.evidence,
            "assumptions": potential.assumptions or fallback_potential.assumptions,
            "open_questions": potential.open_questions or fallback_potential.open_questions,
        }
    )
    return enrichment.model_copy(
        update={
            "opportunity_statement_pt": enrichment.opportunity_statement_pt or fallback.opportunity_statement_pt,
            "solution_concept_pt": enrichment.solution_concept_pt or fallback.solution_concept_pt,
            "pain_points": enrichment.pain_points or fallback.pain_points,
            "themes": enrichment.themes or fallback.themes,
            "target_user": enrichment.target_user if enrichment.target_user != "não identificado" else fallback.target_user,
            "analysis_version": ANALYSIS_VERSION,
            "rationale": enrichment.rationale or fallback.rationale,
            "market_search_queries": enrichment.market_search_queries or fallback.market_search_queries,
            "business_potential": completed_potential,
        }
    )


def evaluate_quality(
    item: RawOpportunity,
    enrichment: EnrichmentItem,
    market_evidence: list[dict],
) -> tuple[int, str]:
    score = 15
    score += 15 if len(item.description.strip()) >= 60 else 5 if item.description.strip() else 0
    score += 8 if item.rank is not None else 0
    score += 8 if item.clicks is not None else 0
    score += 8 if item.paid_value is not None else 0
    score += min(18, len(market_evidence) * 4)
    score += 10 if enrichment.translation_status in {"translated", "not_needed"} else 0
    score += 8 if enrichment.business_potential.success_metrics else 0
    score += 5 if enrichment.business_potential.open_questions else 0
    score = min(100, score)
    strength = "alta" if score >= 75 else "média" if score >= 50 else "baixa"
    return score, strength
