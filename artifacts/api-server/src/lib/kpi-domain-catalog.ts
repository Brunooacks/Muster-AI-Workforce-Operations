import type {
  KpiCadence,
  KpiContract,
  KpiDomain,
  KpiFreshnessPolicy,
} from "./kpi-contract";

export interface KpiDomainVertical {
  key: KpiDomain;
  label: string;
  description: string;
  icon: string;
  metrics: KpiContract[];
}

type KpiDefinition = Omit<
  KpiContract,
  "capability" | "minSampleSize" | "evidence" | "freshness" | "confidence"
> & {
  capability?: KpiContract["capability"];
  minSampleSize?: number;
  evidence?: KpiContract["evidence"];
  freshness?: KpiContract["freshness"];
  confidence?: KpiContract["confidence"];
};

const FRESHNESS_BY_CADENCE: Record<KpiCadence, KpiFreshnessPolicy> = {
  "per-run": { expectedWithinMinutes: 5, staleAfterMinutes: 15, expiresAfterMinutes: 60 },
  daily: { expectedWithinMinutes: 1_440, staleAfterMinutes: 2_160, expiresAfterMinutes: 4_320 },
  weekly: { expectedWithinMinutes: 10_080, staleAfterMinutes: 14_400, expiresAfterMinutes: 21_600 },
  monthly: { expectedWithinMinutes: 43_200, staleAfterMinutes: 64_800, expiresAfterMinutes: 86_400 },
  quarterly: { expectedWithinMinutes: 129_600, staleAfterMinutes: 194_400, expiresAfterMinutes: 259_200 },
};

function defineKpi(definition: KpiDefinition): KpiContract {
  const confidence = definition.confidence ?? { minimum: 80, decisionGrade: 90 };
  return {
    capability: "business-outcome",
    minSampleSize: 30,
    freshness: FRESHNESS_BY_CADENCE[definition.cadence],
    confidence,
    evidence: {
      allowed: ["observed", "inferred"],
      minConfidence: confidence.minimum,
      auditSampleRate: 10,
    },
    ...definition,
  };
}

export const KPI_DOMAIN_VERTICALS: KpiDomainVertical[] = [
  {
    key: "atendimento",
    label: "Atendimento",
    description: "Qualidade, velocidade, custo e confiança na resolução de clientes e usuários.",
    icon: "Headset",
    metrics: [
      defineKpi({ key: "atendimento-fcr", domain: "atendimento", area: "Suporte ao cliente", layer: "efficacy", label: "Resolução no primeiro contato", purpose: "Confirmar que o caso foi resolvido sem novo contato.", unit: "%", direction: "higher-is-better", formula: "casos resolvidos sem reabertura / casos elegíveis × 100", sourceSignals: ["resolution_rate"], cadence: "weekly", baseline: "required", target: "≥ 75%", owner: "Líder de Atendimento", decisionImpact: "promote", guardrail: false, rationale: "FCR alto diferencia resolução real de resposta apenas plausível." }),
      defineKpi({ key: "atendimento-reabertura-72h", domain: "atendimento", area: "Suporte ao cliente", layer: "efficacy", label: "Reabertura em 72 horas", purpose: "Detectar resoluções aparentes que falham logo após o encerramento.", unit: "%", direction: "lower-is-better", formula: "casos reabertos em 72h / casos encerrados × 100", sourceSignals: ["cliente_volta_72h"], cadence: "weekly", baseline: "required", target: "≤ 15%", owner: "Líder de Atendimento", decisionImpact: "mentor", guardrail: true, rationale: "Reabertura recorrente bloqueia expansão mesmo com boa velocidade." }),
      defineKpi({ key: "atendimento-csat", domain: "atendimento", area: "Experiência do cliente", layer: "value", label: "CSAT assistido", purpose: "Medir a satisfação declarada no atendimento com agente.", unit: "/5", direction: "higher-is-better", formula: "média das avaliações válidas pós-atendimento", sourceSignals: ["csat"], cadence: "weekly", baseline: "required", target: "≥ 4,2/5", owner: "Customer Experience", decisionImpact: "promote", guardrail: false, rationale: "Automação que resolve mas irrita não deve ser promovida." }),
      defineKpi({ key: "atendimento-escalonamento-apropriado", domain: "atendimento", area: "Supervisão", layer: "governance", label: "Escalonamento apropriado", purpose: "Verificar se o agente sabe quando e para quem transferir o caso.", unit: "%", direction: "higher-is-better", formula: "escalonamentos corretos / escalonamentos auditados × 100", sourceSignals: ["escalonamento_correto"], cadence: "weekly", baseline: "required", target: "≥ 80%", owner: "Supervisor da Operação", decisionImpact: "mentor", guardrail: true, rationale: "Saber não decidir é requisito de segurança operacional." }),
      defineKpi({ key: "atendimento-mttr", domain: "atendimento", area: "Operação de suporte", layer: "efficiency", label: "Tempo médio de resolução", purpose: "Reduzir o tempo de ponta a ponta sem degradar qualidade.", unit: "h", direction: "lower-is-better", formula: "soma do tempo até resolução / casos resolvidos", sourceSignals: ["mttr_hours"], cadence: "weekly", baseline: "required", target: "≤ 4 h", owner: "Líder de Atendimento", decisionImpact: "mentor", guardrail: false, rationale: "Velocidade só vale quando não aumenta reabertura e escalonamento." }),
    ],
  },
  {
    key: "vendas-crm",
    label: "Vendas & CRM",
    description: "Conversão, velocidade comercial, adoção do time e proteção de margem.",
    icon: "BriefcaseBusiness",
    metrics: [
      defineKpi({ key: "vendas-speed-to-lead", domain: "vendas-crm", area: "Pré-vendas", layer: "efficiency", label: "Speed to lead", purpose: "Medir a velocidade entre a entrada e o primeiro contato qualificado.", unit: "min", direction: "lower-is-better", formula: "mediana do tempo entre lead recebido e primeiro contato", sourceSignals: ["speed_to_lead"], cadence: "daily", baseline: "required", target: "< 5 min", owner: "Líder de SDR", decisionImpact: "promote", guardrail: false, rationale: "Velocidade aumenta a chance de conversão sem exigir mais headcount." }),
      defineKpi({ key: "vendas-conversao-qualificada", domain: "vendas-crm", area: "Qualificação", layer: "efficacy", label: "Conversão qualificada", purpose: "Medir se a qualificação entrega oportunidades com potencial real.", unit: "%", direction: "higher-is-better", formula: "leads qualificados convertidos / leads qualificados × 100", sourceSignals: ["lead_conversion"], cadence: "weekly", baseline: "required", target: "≥ 25%", owner: "Revenue Operations", decisionImpact: "promote", guardrail: false, rationale: "Mais volume sem qualidade desloca custo para o vendedor." }),
      defineKpi({ key: "vendas-win-rate-uplift", domain: "vendas-crm", area: "Pipeline", layer: "value", label: "Uplift de win rate", purpose: "Comprovar ganho incremental contra vendedores ou contas de controle.", unit: "%", direction: "higher-is-better", formula: "win rate assistido − win rate do grupo de controle", sourceSignals: ["win_rate_uplift"], cadence: "monthly", baseline: "required", target: "≥ +5pp", owner: "Diretor Comercial", decisionImpact: "promote", guardrail: false, rationale: "Sem uplift contra baseline não há evidência de valor incremental." }),
      defineKpi({ key: "vendas-falso-positivo-lead", domain: "vendas-crm", area: "Qualificação", layer: "governance", label: "Falso positivo de lead", purpose: "Limitar leads classificados como bons que não atendem aos critérios.", unit: "%", direction: "lower-is-better", formula: "leads rejeitados pelo vendedor / leads qualificados pelo agente × 100", sourceSignals: ["false_positive_rate"], cadence: "weekly", baseline: "required", target: "≤ 5%", owner: "Revenue Operations", decisionImpact: "mentor", guardrail: true, rationale: "Falsos positivos consomem tempo comercial e corroem confiança." }),
      defineKpi({ key: "vendas-adocao-representante", domain: "vendas-crm", area: "Adoção comercial", layer: "adoption", label: "Adoção pelo representante", purpose: "Medir uso recorrente e voluntário pelo time comercial.", unit: "%", direction: "higher-is-better", formula: "representantes ativos no período / representantes elegíveis × 100", sourceSignals: ["rep_adoption"], cadence: "weekly", baseline: "required", target: "≥ 70%", owner: "Enablement Comercial", decisionImpact: "mentor", guardrail: false, rationale: "Sem adoção do time, o agente não muda o processo real." }),
    ],
  },
  {
    key: "engenharia-it",
    label: "Engenharia & IT",
    description: "Entrega técnica, estabilidade, segurança de mudança e colaboração com desenvolvedores.",
    icon: "Code2",
    metrics: [
      defineKpi({ key: "engenharia-sucesso-primeira-passada", domain: "engenharia-it", area: "Entrega técnica", layer: "efficacy", label: "Sucesso na primeira passada", purpose: "Medir tarefas concluídas sem correção posterior significativa.", unit: "%", direction: "higher-is-better", formula: "tarefas aceitas sem retrabalho / tarefas concluídas × 100", sourceSignals: ["task_success"], cadence: "weekly", baseline: "required", target: "≥ 90%", owner: "Engineering Manager", decisionImpact: "promote", guardrail: false, rationale: "Primeira passada conecta produtividade com qualidade entregue." }),
      defineKpi({ key: "engenharia-defeito-escapado", domain: "engenharia-it", area: "Qualidade", layer: "governance", label: "Defeito escapado", purpose: "Detectar defeitos introduzidos pelo fluxo assistido após a entrega.", unit: "%", direction: "lower-is-better", formula: "defeitos em produção atribuídos / mudanças assistidas × 100", sourceSignals: ["escaped_defect_rate"], cadence: "weekly", baseline: "required", target: "≤ 5%", owner: "Engineering Manager", decisionImpact: "mentor", guardrail: true, rationale: "Velocidade não pode ser comprada com regressão em produção." }),
      defineKpi({ key: "engenharia-cobertura-revisao", domain: "engenharia-it", area: "Code review", layer: "efficacy", label: "Cobertura de revisão", purpose: "Garantir que mudanças elegíveis recebam revisão assistida ou humana.", unit: "%", direction: "higher-is-better", formula: "pull requests revisados / pull requests elegíveis × 100", sourceSignals: ["review_coverage"], cadence: "weekly", baseline: "required", target: "≥ 90%", owner: "Tech Lead", decisionImpact: "promote", guardrail: true, rationale: "Cobertura cria evidência de controle antes do merge." }),
      defineKpi({ key: "engenharia-mttr", domain: "engenharia-it", area: "Confiabilidade", layer: "efficiency", label: "MTTR de incidente", purpose: "Medir a redução do tempo até contenção e recuperação.", unit: "h", direction: "lower-is-better", formula: "soma do tempo de recuperação / incidentes encerrados", sourceSignals: ["mttr_hours"], cadence: "monthly", baseline: "required", target: "≤ 4 h", owner: "SRE Lead", decisionImpact: "promote", guardrail: false, rationale: "Agente operacional precisa reduzir impacto, não apenas gerar tickets." }),
      defineKpi({ key: "engenharia-falha-de-mudanca", domain: "engenharia-it", area: "Release", layer: "governance", label: "Taxa de falha de mudança", purpose: "Limitar releases assistidos que geram rollback ou incidente.", unit: "%", direction: "lower-is-better", formula: "mudanças com rollback ou incidente / mudanças assistidas × 100", sourceSignals: ["change_failure_rate"], cadence: "monthly", baseline: "required", target: "≤ 10%", owner: "Platform Engineering", decisionImpact: "mentor", guardrail: true, rationale: "É um guardrail direto contra expansão insegura do agente." }),
    ],
  },
  {
    key: "risco-financas-rh",
    label: "Risco, Finanças & RH",
    description: "Controle, previsibilidade financeira, decisões responsáveis e impacto nas pessoas.",
    icon: "ShieldCheck",
    metrics: [
      defineKpi({ key: "risco-cobertura-auditoria", domain: "risco-financas-rh", area: "Auditoria", layer: "governance", label: "Cobertura de auditoria", purpose: "Garantir que decisões de risco tenham amostra auditável.", unit: "%", direction: "higher-is-better", formula: "decisões com evidência auditada / decisões elegíveis × 100", sourceSignals: ["audit_coverage"], cadence: "weekly", baseline: "required", target: "≥ 99%", owner: "Risk & Compliance", decisionImpact: "mentor", guardrail: true, rationale: "Sem trilha auditável, o resultado não é defensável." }),
      defineKpi({ key: "risco-exposicao-dado-sensivel", domain: "risco-financas-rh", area: "Privacidade", layer: "governance", label: "Exposição de dado sensível", purpose: "Impedir exposição indevida de dados pessoais ou confidenciais.", unit: "neg.", direction: "lower-is-better", formula: "incidentes confirmados de exposição no período", sourceSignals: ["exposicao_dado_sensivel"], cadence: "per-run", baseline: "not-applicable", target: "0", owner: "Data Protection Officer", decisionImpact: "retire", guardrail: true, rationale: "Um incidente pode sobrepor qualquer ganho de eficiência." }),
      defineKpi({ key: "risco-excecao-politica", domain: "risco-financas-rh", area: "Conformidade", layer: "governance", label: "Taxa de exceção de política", purpose: "Medir decisões que exigem exceção à política vigente.", unit: "%", direction: "lower-is-better", formula: "decisões com exceção / decisões avaliadas × 100", sourceSignals: ["exception_rate"], cadence: "weekly", baseline: "required", target: "≤ 5%", owner: "Risk & Compliance", decisionImpact: "mentor", guardrail: true, rationale: "Exceções frequentes indicam que o agente opera fora do contrato." }),
      defineKpi({ key: "financas-variacao-custo", domain: "risco-financas-rh", area: "Finanças", layer: "efficiency", label: "Variação de custo", purpose: "Controlar diferença entre custo previsto e realizado do agente.", unit: "%", direction: "lower-is-better", formula: "(custo realizado − custo previsto) / custo previsto × 100", sourceSignals: ["cost_variance"], cadence: "monthly", baseline: "required", target: "≤ 10%", owner: "FinOps", decisionImpact: "mentor", guardrail: false, rationale: "Previsibilidade permite escalar sem transformar automação em passivo." }),
      defineKpi({ key: "rh-impacto-experiencia", domain: "risco-financas-rh", area: "Pessoas", layer: "value", label: "Experiência do time", purpose: "Medir se a colaboração com o agente melhora ou degrada o trabalho humano.", unit: "/5", direction: "higher-is-better", formula: "média da pesquisa pós-ciclo com usuários impactados", sourceSignals: ["employee_experience"], cadence: "monthly", baseline: "required", target: "≥ 4/5", owner: "People Operations", decisionImpact: "mentor", guardrail: false, rationale: "Performance de equipe mista inclui o impacto percebido pelas pessoas." }),
    ],
  },
  {
    key: "operacoes-backoffice",
    label: "Operações & Backoffice",
    description: "Fluxo ponta a ponta, observabilidade, resiliência e qualidade dos dados operacionais.",
    icon: "Workflow",
    metrics: [
      defineKpi({ key: "operacoes-processamento-sem-toque", domain: "operacoes-backoffice", capability: "business-outcome", area: "Operações", layer: "efficacy", label: "Processamento sem toque", purpose: "Medir casos concluídos sem correção ou intervenção humana não planejada.", unit: "%", direction: "higher-is-better", formula: "casos concluídos sem intervenção / casos elegíveis × 100", sourceSignals: ["straight_through_processing"], cadence: "daily", baseline: "required", target: "≥ 80%", owner: "Líder de Operações", decisionImpact: "promote", guardrail: false, rationale: "Automação só gera capacidade quando conclui o fluxo, não quando apenas desloca trabalho." }),
      defineKpi({ key: "operacoes-taxa-excecao", domain: "operacoes-backoffice", capability: "quality-evaluation", area: "Controle operacional", layer: "governance", label: "Taxa de exceção operacional", purpose: "Detectar casos que saem do caminho padrão por erro de regra, dado ou decisão.", unit: "%", direction: "lower-is-better", formula: "casos com exceção / casos processados × 100", sourceSignals: ["operational_exception_rate"], cadence: "daily", baseline: "required", target: "≤ 8%", owner: "Controle de Operações", decisionImpact: "mentor", guardrail: true, rationale: "Exceções recorrentes escondem retrabalho e risco sob uma taxa alta de execução." }),
      defineKpi({ key: "operacoes-idade-fila-p95", domain: "operacoes-backoffice", capability: "business-outcome", area: "Gestão de filas", layer: "efficiency", label: "Idade da fila p95", purpose: "Controlar a cauda de espera dos itens ainda não processados.", unit: "min", direction: "lower-is-better", formula: "percentil 95 da idade dos itens abertos", sourceSignals: ["queue_age_p95"], cadence: "daily", baseline: "required", target: "≤ 30 min", owner: "Líder de Operações", decisionImpact: "mentor", guardrail: false, rationale: "Média saudável pode ocultar uma fila crítica; o p95 mostra quem está ficando para trás." }),
      defineKpi({ key: "discovery-cobertura-sinais", domain: "operacoes-backoffice", capability: "discovery-observability", area: "Discovery", layer: "adoption", label: "Cobertura de sinais descobertos", purpose: "Medir quanto do workload elegível possui sinais reconhecidos pelo Muster.", unit: "%", direction: "higher-is-better", formula: "workloads com sinais reconhecidos / workloads descobertos × 100", sourceSignals: ["discovery_signal_coverage"], cadence: "daily", baseline: "optional", target: "≥ 90%", owner: "Platform Operations", decisionImpact: "observation", guardrail: false, rationale: "Sem cobertura de sinais, o cadastro existe mas a avaliação permanece cega." }),
      defineKpi({ key: "discovery-prontidao-instrumentacao", domain: "operacoes-backoffice", capability: "discovery-observability", area: "Discovery", layer: "governance", label: "Prontidão de instrumentação", purpose: "Confirmar que os sinais necessários ao kit escolhido estão sendo coletados.", unit: "%", direction: "higher-is-better", formula: "sinais obrigatórios ativos / sinais obrigatórios do kit × 100", sourceSignals: ["instrumentation_readiness"], cadence: "daily", baseline: "not-applicable", target: "≥ 95%", owner: "Observability Lead", decisionImpact: "mentor", guardrail: true, rationale: "Nenhum agente deve ser promovido com lacunas materiais de instrumentação." }),
      defineKpi({ key: "runtime-cobertura-heartbeat", domain: "operacoes-backoffice", capability: "runtime-resilience", area: "Runtime", layer: "governance", label: "Cobertura de heartbeat", purpose: "Detectar agentes ativos que deixaram de publicar sinal de vida dentro da janela.", unit: "%", direction: "higher-is-better", formula: "agentes com heartbeat fresco / agentes ativos × 100", sourceSignals: ["heartbeat_coverage"], cadence: "per-run", freshness: { expectedWithinMinutes: 1, staleAfterMinutes: 3, expiresAfterMinutes: 5 }, baseline: "not-applicable", target: "≥ 99%", owner: "SRE / Platform", decisionImpact: "mentor", guardrail: true, minSampleSize: 1, rationale: "Telemetria contínua começa por saber quais workloads estão realmente vivos." }),
      defineKpi({ key: "runtime-sucesso-fallback", domain: "operacoes-backoffice", capability: "runtime-resilience", area: "Runtime", layer: "efficacy", label: "Sucesso do fallback", purpose: "Medir se a rota alternativa conclui a execução quando o runtime primário falha.", unit: "%", direction: "higher-is-better", formula: "fallbacks concluídos / fallbacks acionados × 100", sourceSignals: ["fallback_success_rate"], cadence: "per-run", baseline: "required", target: "≥ 99%", owner: "SRE / Platform", decisionImpact: "mentor", guardrail: true, minSampleSize: 10, rationale: "Fallback configurado sem teste real cria uma sensação falsa de resiliência." }),
      defineKpi({ key: "dados-completude-trace", domain: "operacoes-backoffice", capability: "data-quality", area: "Qualidade de dados", layer: "governance", label: "Completude de trace", purpose: "Garantir que execuções tenham identidade, timestamps, resultado, custo e linhagem essenciais.", unit: "%", direction: "higher-is-better", formula: "traces com campos obrigatórios / traces recebidos × 100", sourceSignals: ["trace_completeness"], cadence: "daily", baseline: "not-applicable", target: "≥ 98%", owner: "Data Platform", decisionImpact: "mentor", guardrail: true, rationale: "Métrica sem trace reconstruível não sustenta auditoria nem decisão." }),
      defineKpi({ key: "dados-duplicidade-eventos", domain: "operacoes-backoffice", capability: "data-quality", area: "Qualidade de dados", layer: "efficiency", label: "Duplicidade de eventos", purpose: "Medir eventos repetidos que distorcem volume, custo e sucesso.", unit: "%", direction: "lower-is-better", formula: "eventos deduplicados / eventos recebidos × 100", sourceSignals: ["duplicate_event_rate"], cadence: "daily", baseline: "optional", target: "≤ 1%", owner: "Data Platform", decisionImpact: "observation", guardrail: false, rationale: "Duplicidade baixa é requisito para tendências e custos confiáveis." }),
      defineKpi({ key: "eval-saida-fundamentada", domain: "operacoes-backoffice", capability: "quality-evaluation", area: "Avaliação", layer: "efficacy", label: "Saída fundamentada", purpose: "Medir respostas sustentadas pelas evidências e fontes disponíveis à execução.", unit: "%", direction: "higher-is-better", formula: "saídas fundamentadas / saídas auditadas × 100", sourceSignals: ["grounded_output_rate"], cadence: "daily", baseline: "required", target: "≥ 95%", owner: "Quality & Evaluation", decisionImpact: "mentor", guardrail: true, rationale: "Uma resposta plausível sem sustentação não deve orientar ação operacional." }),
    ],
  },
  {
    key: "workforce-hibrida",
    label: "Workforce Híbrida",
    description: "Colaboração humano-agente, supervisão e desempenho de jornadas com múltiplos participantes.",
    icon: "UsersRound",
    metrics: [
      defineKpi({ key: "hibrida-aceite-humano", domain: "workforce-hibrida", capability: "human-agent-collaboration", area: "Colaboração", layer: "adoption", label: "Aceite humano das entregas", purpose: "Medir entregas aceitas sem edição material pelo responsável humano.", unit: "%", direction: "higher-is-better", formula: "entregas aceitas sem edição material / entregas revisadas × 100", sourceSignals: ["human_acceptance_rate"], cadence: "weekly", baseline: "required", target: "≥ 80%", owner: "Workforce Manager", decisionImpact: "promote", guardrail: false, rationale: "Aceite recorrente demonstra confiança e utilidade no trabalho real." }),
      defineKpi({ key: "hibrida-taxa-override", domain: "workforce-hibrida", capability: "human-agent-collaboration", area: "Supervisão", layer: "governance", label: "Taxa de override humano", purpose: "Medir decisões do agente substituídas pelo supervisor.", unit: "%", direction: "lower-is-better", formula: "decisões substituídas / decisões revisadas × 100", sourceSignals: ["human_override_rate"], cadence: "weekly", baseline: "required", target: "≤ 10%", owner: "Supervisor da Jornada", decisionImpact: "mentor", guardrail: true, rationale: "Override alto revela desalinhamento entre autonomia declarada e desempenho real." }),
      defineKpi({ key: "hibrida-retrabalho", domain: "workforce-hibrida", capability: "human-agent-collaboration", area: "Qualidade", layer: "efficacy", label: "Retrabalho humano", purpose: "Quantificar entregas que exigem reconstrução relevante por uma pessoa.", unit: "%", direction: "lower-is-better", formula: "entregas com retrabalho material / entregas concluídas × 100", sourceSignals: ["human_rework_rate"], cadence: "weekly", baseline: "required", target: "≤ 8%", owner: "Workforce Manager", decisionImpact: "mentor", guardrail: false, rationale: "Automação que gera retrabalho consome capacidade em vez de liberá-la." }),
      defineKpi({ key: "hibrida-sla-escalonamento", domain: "workforce-hibrida", capability: "human-agent-collaboration", area: "Supervisão", layer: "efficiency", label: "SLA de escalonamento humano", purpose: "Medir escalonamentos atendidos dentro do tempo necessário à jornada.", unit: "%", direction: "higher-is-better", formula: "escalonamentos atendidos no SLA / escalonamentos elegíveis × 100", sourceSignals: ["human_escalation_sla"], cadence: "daily", baseline: "required", target: "≥ 95%", owner: "Supervisor da Jornada", decisionImpact: "mentor", guardrail: true, rationale: "Human-in-the-loop lento pode ser tão prejudicial quanto uma decisão autônoma incorreta." }),
      defineKpi({ key: "a2a-sucesso-handoff", domain: "workforce-hibrida", capability: "a2a-orchestration", area: "Jornadas A2A", layer: "efficacy", label: "Sucesso de handoff A2A", purpose: "Medir transferências aceitas e processadas pelo próximo participante.", unit: "%", direction: "higher-is-better", formula: "handoffs aceitos e processados / handoffs iniciados × 100", sourceSignals: ["a2a_handoff_success"], cadence: "per-run", baseline: "required", target: "≥ 98%", owner: "Journey Owner", decisionImpact: "mentor", guardrail: true, rationale: "Uma jornada é tão forte quanto a transferência entre seus participantes." }),
      defineKpi({ key: "a2a-integridade-contexto", domain: "workforce-hibrida", capability: "a2a-orchestration", area: "Jornadas A2A", layer: "governance", label: "Integridade de contexto no handoff", purpose: "Verificar se fatos, restrições e evidências obrigatórias chegam ao próximo agente.", unit: "%", direction: "higher-is-better", formula: "handoffs com contexto obrigatório íntegro / handoffs auditados × 100", sourceSignals: ["a2a_context_integrity"], cadence: "per-run", baseline: "not-applicable", target: "≥ 99%", owner: "Journey Owner", decisionImpact: "mentor", guardrail: true, rationale: "Perda de contexto transforma decisões corretas isoladamente em falha end-to-end." }),
      defineKpi({ key: "eval-concordancia-humano-agente", domain: "workforce-hibrida", capability: "quality-evaluation", area: "Avaliação", layer: "efficacy", label: "Concordância humano-agente", purpose: "Medir concordância entre avaliação automatizada e auditoria humana calibrada.", unit: "%", direction: "higher-is-better", formula: "avaliações concordantes / itens avaliados por ambos × 100", sourceSignals: ["human_agent_eval_agreement"], cadence: "weekly", baseline: "required", target: "≥ 85%", owner: "Quality & Evaluation", decisionImpact: "mentor", guardrail: false, rationale: "Sem calibração, o score automatizado pode apenas repetir o viés do avaliador." }),
      defineKpi({ key: "hibrida-cobertura-supervisao", domain: "workforce-hibrida", capability: "human-agent-collaboration", area: "Supervisão", layer: "governance", label: "Cobertura de supervisão", purpose: "Confirmar revisão integral dos casos definidos como obrigatórios pela política.", unit: "%", direction: "higher-is-better", formula: "casos obrigatórios revisados / casos obrigatórios × 100", sourceSignals: ["supervision_coverage"], cadence: "daily", baseline: "not-applicable", target: "100%", owner: "Governance Sponsor", decisionImpact: "retire", guardrail: true, rationale: "Supervisão configurada mas não executada invalida o modelo de autonomia." }),
    ],
  },
];

export const KPI_DOMAIN_CATALOG: KpiContract[] = KPI_DOMAIN_VERTICALS.flatMap((vertical) => vertical.metrics);
