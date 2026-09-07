export type TeamScenarioId = "development" | "professional" | "service";
export type ActorType = "human" | "agent";
export type AutomationMode = "autonomous" | "assisted" | "human";
export type WorkStatus = "planned" | "in_progress" | "review" | "blocked" | "done";
export type WorkPriority = "critical" | "high" | "medium" | "low";
export type MetricStatus = "healthy" | "attention" | "critical";
export type IntegrationStatus = "live" | "contract_ready" | "planned";

export type TeamStage = {
  id: string;
  label: string;
  exitCriteria: string;
  ownerId: string;
  sla: string;
  wipLimit: number;
  successRate: number;
  handoffContract?: string;
};

export type JourneyPulse = {
  name: string;
  successRate: number;
  p95: string;
  activeRuns: number;
  eventsPerMinute: number;
  freshnessSeconds: number;
  telemetryCoverage: number;
};

export type TeamParticipant = {
  id: string;
  name: string;
  actorType: ActorType;
  role: string;
  scope: string;
  decisionRights: string;
  workload: number;
  currentFocus: string;
  platform?: string;
};

export type TeamWorkItem = {
  id: string;
  title: string;
  epic: string;
  stage: string;
  ownerId: string;
  accountableId: string;
  contributorIds: string[];
  mode: AutomationMode;
  status: WorkStatus;
  priority: WorkPriority;
  points: number;
  progress: number;
  evidence: string;
  nextStep: string;
  lastActivity: string;
  blockedReason?: string;
  due: string;
};

export type TeamMetric = {
  key: string;
  label: string;
  value: string;
  target: string;
  status: MetricStatus;
  trend: string;
  category: "outcome" | "quality" | "flow" | "automation" | "governance" | "adoption";
  description: string;
};

export type TeamIntegration = {
  platform: string;
  label: string;
  status: IntegrationStatus;
  role: string;
  contract: string[];
};

export type TeamOperatingScenario = {
  id: TeamScenarioId;
  label: string;
  shortLabel: string;
  description: string;
  purpose: string;
  finalOutcome: string;
  definitionOfDone: string[];
  guardrails: string[];
  cadence: string;
  journey: JourneyPulse;
  stages: TeamStage[];
  participants: TeamParticipant[];
  workItems: TeamWorkItem[];
  metrics: TeamMetric[];
  integrations: TeamIntegration[];
};

export type OperatingSummary = {
  progress: number;
  automationCoverage: number;
  humanDecisionGates: number;
  blockedItems: number;
  activeItems: number;
  completedItems: number;
  backlogItems: number;
  totalItems: number;
  averageWorkload: number;
  overloadedParticipants: number;
};

export type StageOperatingSummary = {
  id: string;
  label: string;
  owner: TeamParticipant;
  workItems: TeamWorkItem[];
  activeItems: number;
  queuedItems: number;
  blockedItems: number;
  wipLimit: number;
  utilization: number;
  progress: number;
  successRate: number;
  sla: string;
  exitCriteria: string;
  handoffContract?: string;
};

const development: TeamOperatingScenario = {
  id: "development",
  label: "Squad de desenvolvimento",
  shortLabel: "Produto & engenharia",
  description: "Épicos e histórias executados por pessoas e agentes, com revisão e evidência técnica.",
  purpose: "Evoluir a plataforma com qualidade previsível, segurança e aprendizado contínuo.",
  finalOutcome: "Incremento utilizável em produção, aderente ao escopo técnico e com telemetria verificável.",
  definitionOfDone: [
    "Critérios de aceite validados",
    "Testes e revisão técnica aprovados",
    "Telemetria e documentação publicadas",
    "Rollback e owner de produção definidos",
  ],
  guardrails: [
    "Agentes não publicam em produção sem aprovação humana",
    "Falha crítica ou regressão bloqueia o release",
    "Mudança de escopo exige decisão do owner",
  ],
  cadence: "Sprint quinzenal · checkpoint diário · revisão contínua",
  journey: {
    name: "Entrega contínua segura",
    successRate: 84,
    p95: "3,1 dias",
    activeRuns: 7,
    eventsPerMinute: 1284,
    freshnessSeconds: 18,
    telemetryCoverage: 97,
  },
  stages: [
    { id: "discovery", label: "Descoberta", exitCriteria: "Escopo, risco e aceite definidos", ownerId: "renata", sla: "8 h", wipLimit: 3, successRate: 93, handoffContract: "Brief + critérios de aceite + risco" },
    { id: "ready", label: "Pronto", exitCriteria: "Owner, dados e dependências disponíveis", ownerId: "renata", sla: "4 h", wipLimit: 4, successRate: 96, handoffContract: "Contexto + dependências + ambiente" },
    { id: "execution", label: "Construção", exitCriteria: "Código, testes e evidência produzidos", ownerId: "atlas", sla: "2 d", wipLimit: 4, successRate: 91, handoffContract: "PR + testes + trace de execução" },
    { id: "review", label: "Validação", exitCriteria: "Revisão humana e guardrails aprovados", ownerId: "caio", sla: "6 h", wipLimit: 3, successRate: 82, handoffContract: "Parecer + risco + decisão" },
    { id: "done", label: "Entrega", exitCriteria: "Produção observável e outcome medido", ownerId: "argus", sla: "24 h", wipLimit: 5, successRate: 97 },
  ],
  participants: [
    {
      id: "renata",
      name: "Renata Silva",
      actorType: "human",
      role: "Product & Engineering Lead",
      scope: "Prioridade, arquitetura, risco e aceite final",
      decisionRights: "Prioriza backlog, altera escopo e aprova produção",
      workload: 68,
      currentFocus: "Fechar escopo do EPIC-24 e remover dependências",
    },
    {
      id: "atlas",
      name: "Atlas",
      actorType: "agent",
      role: "Agente de implementação",
      scope: "Código, testes unitários e documentação técnica",
      decisionRights: "Autônomo em branch; escala mudança arquitetural",
      workload: 82,
      currentFocus: "Instrumentação e ingestão do work graph",
      platform: "github-copilot",
    },
    {
      id: "argus",
      name: "Argus",
      actorType: "agent",
      role: "Agente QA & SRE",
      scope: "Regressão, observabilidade e análise de risco",
      decisionRights: "Pode bloquear release por guardrail",
      workload: 61,
      currentFocus: "Baseline, regressão e cobertura de evidência",
      platform: "opentelemetry",
    },
    {
      id: "caio",
      name: "Caio Mendes",
      actorType: "human",
      role: "Staff reviewer",
      scope: "Revisão de segurança e decisões irreversíveis",
      decisionRights: "Aprova exceções e fallback operacional",
      workload: 44,
      currentFocus: "Decisão sobre fallback local para cloud",
    },
  ],
  workItems: [
    { id: "MUS-142", title: "Definir contrato de métricas do agente", epic: "EPIC-21 · Performance verificável", stage: "done", ownerId: "renata", accountableId: "renata", contributorIds: ["argus"], mode: "human", status: "done", priority: "high", points: 5, progress: 100, evidence: "ADR + contrato KPI", nextStep: "Medir aderência no primeiro ciclo", lastActivity: "há 2 h", due: "Concluída" },
    { id: "MUS-148", title: "Instrumentar traces OpenTelemetry", epic: "EPIC-21 · Performance verificável", stage: "execution", ownerId: "atlas", accountableId: "renata", contributorIds: ["argus"], mode: "assisted", status: "in_progress", priority: "critical", points: 8, progress: 72, evidence: "PR + trace de teste", nextStep: "Cobrir decisões e tool calls", lastActivity: "há 8 min", due: "Hoje, 18h" },
    { id: "MUS-153", title: "Calibrar baseline de acurácia e custo", epic: "EPIC-21 · Performance verificável", stage: "review", ownerId: "argus", accountableId: "caio", contributorIds: ["renata"], mode: "autonomous", status: "review", priority: "high", points: 5, progress: 88, evidence: "Dataset + scorecard", nextStep: "Caio aprovar baseline", lastActivity: "há 21 min", due: "Amanhã" },
    { id: "MUS-161", title: "Ingerir sprint e histórias do Jira", epic: "EPIC-24 · Work graph integrado", stage: "ready", ownerId: "atlas", accountableId: "renata", contributorIds: [], mode: "assisted", status: "planned", priority: "high", points: 8, progress: 18, evidence: "Contrato de ingestão", nextStep: "Liberar credencial sandbox", lastActivity: "há 1 h", due: "28 ago" },
    { id: "MUS-164", title: "Vincular decisões e DoD do Confluence", epic: "EPIC-24 · Work graph integrado", stage: "discovery", ownerId: "renata", accountableId: "renata", contributorIds: ["atlas"], mode: "human", status: "planned", priority: "medium", points: 5, progress: 12, evidence: "Mapa de conteúdo", nextStep: "Definir páginas fonte", lastActivity: "ontem", due: "29 ago" },
    { id: "MUS-166", title: "Validar fallback local para cloud", epic: "EPIC-27 · Resiliência híbrida", stage: "review", ownerId: "caio", accountableId: "caio", contributorIds: ["argus", "atlas"], mode: "human", status: "blocked", priority: "critical", points: 8, progress: 54, evidence: "Teste de failover", nextStep: "Aprovar janela e credencial cloud", lastActivity: "há 14 min", blockedReason: "Credencial de fallback ainda não aprovada", due: "SLA em 6h" },
  ],
  metrics: [
    { key: "outcome", label: "Outcome cumprido", value: "84%", target: "≥ 90%", status: "attention", trend: "+6 pp", category: "outcome", description: "Entregas que cumpriram o resultado e não apenas o escopo." },
    { key: "acceptance", label: "Aceite de histórias", value: "91%", target: "≥ 88%", status: "healthy", trend: "+3 pp", category: "quality", description: "Histórias aceitas sem retrabalho relevante." },
    { key: "cycle", label: "Cycle time", value: "2,8 d", target: "≤ 3,2 d", status: "healthy", trend: "-0,4 d", category: "flow", description: "Tempo entre início e aceite da história." },
    { key: "defects", label: "Defeitos escapados", value: "1,7%", target: "≤ 2%", status: "healthy", trend: "-0,6 pp", category: "quality", description: "Defeitos identificados depois da entrega." },
    { key: "automation", label: "Cobertura automatizada", value: "63%", target: "≥ 70%", status: "attention", trend: "+8 pp", category: "automation", description: "Esforço realizado por agentes de forma autônoma ou assistida." },
    { key: "review", label: "Carga de revisão humana", value: "5,2 h", target: "≤ 6 h", status: "healthy", trend: "-1,1 h", category: "governance", description: "Tempo humano dedicado a validação e decisões críticas." },
    { key: "handoff", label: "Handoffs confiáveis", value: "94%", target: "≥ 95%", status: "attention", trend: "+2 pp", category: "flow", description: "Transferências com contexto e evidência suficientes." },
    { key: "evidence", label: "Cobertura de evidência", value: "96%", target: "100%", status: "attention", trend: "+4 pp", category: "governance", description: "Atividades relevantes com rastreabilidade verificável." },
  ],
  integrations: [
    { platform: "github", label: "GitHub", status: "live", role: "Código e entrega", contract: ["commits", "pull requests", "reviews", "checks"] },
    { platform: "jira", label: "Jira", status: "contract_ready", role: "Planejamento e fluxo", contract: ["épicos", "histórias", "sprints", "status"] },
    { platform: "confluence", label: "Confluence", status: "contract_ready", role: "Contexto e decisão", contract: ["especificações", "ADRs", "DoD", "decisões"] },
    { platform: "opentelemetry", label: "OpenTelemetry", status: "live", role: "Execução contínua", contract: ["traces", "latência", "erros", "tokens"] },
  ],
};

const professional: TeamOperatingScenario = {
  id: "professional",
  label: "Profissional + agentes",
  shortLabel: "Célula individual",
  description: "Uma pessoa amplia sua capacidade com agentes especialistas e mantém as decisões finais.",
  purpose: "Transformar pesquisa dispersa em recomendações claras, confiáveis e acionáveis.",
  finalOutcome: "Briefing executivo aprovado, com fontes, riscos e próximos passos explícitos.",
  definitionOfDone: ["Pergunta respondida", "Fontes rastreáveis", "Revisão crítica concluída", "Decisão registrada"],
  guardrails: ["Agentes não enviam material ao cliente", "Fonte sem confiança é sinalizada", "Recomendação sensível exige aprovação humana"],
  cadence: "Fila contínua · revisão diária · retrospectiva semanal",
  journey: {
    name: "Inteligência até decisão",
    successRate: 92,
    p95: "6,4 h",
    activeRuns: 12,
    eventsPerMinute: 418,
    freshnessSeconds: 32,
    telemetryCoverage: 94,
  },
  stages: [
    { id: "discovery", label: "Enquadrar", exitCriteria: "Pergunta e audiência definidas", ownerId: "marina", sla: "45 min", wipLimit: 4, successRate: 98, handoffContract: "Pergunta + audiência + decisão esperada" },
    { id: "ready", label: "Pesquisar", exitCriteria: "Fontes e hipóteses organizadas", ownerId: "lume", sla: "2 h", wipLimit: 8, successRate: 95, handoffContract: "Fontes + confiança + lacunas" },
    { id: "execution", label: "Analisar", exitCriteria: "Síntese e recomendação produzidas", ownerId: "prisma", sla: "3 h", wipLimit: 5, successRate: 91, handoffContract: "Cenários + trade-offs + recomendação" },
    { id: "review", label: "Revisar", exitCriteria: "Risco e evidência validados", ownerId: "crivo", sla: "1 h", wipLimit: 3, successRate: 88, handoffContract: "Crítica + confiança + ressalvas" },
    { id: "done", label: "Decidir", exitCriteria: "Humano aprova e comunica", ownerId: "marina", sla: "2 h", wipLimit: 4, successRate: 96 },
  ],
  participants: [
    { id: "marina", name: "Marina Lopes", actorType: "human", role: "Consultora responsável", scope: "Relação com cliente, julgamento e decisão", decisionRights: "Aprova recomendações e comunicação externa", workload: 74, currentFocus: "Validar recomendação para expansão regional" },
    { id: "lume", name: "Lume", actorType: "agent", role: "Agente de pesquisa", scope: "Busca, classificação e rastreabilidade de fontes", decisionRights: "Autônomo em fontes aprovadas", workload: 88, currentFocus: "Completar matriz de sinais e fontes", platform: "openai" },
    { id: "prisma", name: "Prisma", actorType: "agent", role: "Agente analista", scope: "Cenários, comparações e síntese", decisionRights: "Propõe; não escolhe recomendação final", workload: 69, currentFocus: "Comparar cenários de entrada", platform: "langgraph" },
    { id: "crivo", name: "Crivo", actorType: "agent", role: "Agente revisor", scope: "Contradições, lacunas e risco", decisionRights: "Pode devolver trabalho para revisão", workload: 52, currentFocus: "Checar confiança e conflitos", platform: "muster-api" },
  ],
  workItems: [
    { id: "BRF-31", title: "Enquadrar decisão e audiência", epic: "Briefing · Expansão regional", stage: "done", ownerId: "marina", accountableId: "marina", contributorIds: [], mode: "human", status: "done", priority: "high", points: 3, progress: 100, evidence: "Brief aprovado", nextStep: "Usar como contrato da análise", lastActivity: "há 5 h", due: "Concluída" },
    { id: "BRF-34", title: "Mapear evidências e sinais de mercado", epic: "Briefing · Expansão regional", stage: "execution", ownerId: "lume", accountableId: "marina", contributorIds: ["prisma"], mode: "autonomous", status: "in_progress", priority: "high", points: 8, progress: 81, evidence: "Matriz de fontes", nextStep: "Fechar três lacunas de evidência", lastActivity: "há 4 min", due: "Hoje, 16h" },
    { id: "BRF-36", title: "Construir cenários e trade-offs", epic: "Briefing · Expansão regional", stage: "execution", ownerId: "prisma", accountableId: "marina", contributorIds: ["lume"], mode: "assisted", status: "in_progress", priority: "critical", points: 5, progress: 64, evidence: "Árvore de cenários", nextStep: "Quantificar risco regulatório", lastActivity: "há 11 min", due: "Hoje, 19h" },
    { id: "BRF-39", title: "Revisar conflitos e confiança", epic: "Briefing · Expansão regional", stage: "review", ownerId: "crivo", accountableId: "marina", contributorIds: ["lume", "prisma"], mode: "autonomous", status: "review", priority: "high", points: 3, progress: 86, evidence: "Relatório de crítica", nextStep: "Resolver duas fontes divergentes", lastActivity: "há 19 min", due: "Amanhã" },
    { id: "BRF-42", title: "Aprovar recomendação executiva", epic: "Briefing · Expansão regional", stage: "review", ownerId: "marina", accountableId: "marina", contributorIds: ["crivo"], mode: "human", status: "planned", priority: "critical", points: 3, progress: 20, evidence: "Decisão registrada", nextStep: "Aguardar revisão de confiança", lastActivity: "há 34 min", due: "26 ago" },
  ],
  metrics: [
    { key: "purpose", label: "Aderência ao propósito", value: "92%", target: "≥ 90%", status: "healthy", trend: "+4 pp", category: "outcome", description: "Entregas que respondem à decisão solicitada." },
    { key: "quality", label: "Qualidade percebida", value: "4,6/5", target: "≥ 4,5", status: "healthy", trend: "+0,2", category: "quality", description: "Avaliação do profissional sobre utilidade e profundidade." },
    { key: "evidence", label: "Fontes verificáveis", value: "97%", target: "100%", status: "attention", trend: "+5 pp", category: "governance", description: "Afirmações relevantes sustentadas por evidência." },
    { key: "lead", label: "Tempo até decisão", value: "6,4 h", target: "≤ 8 h", status: "healthy", trend: "-1,8 h", category: "flow", description: "Tempo desde o pedido até a aprovação humana." },
    { key: "leverage", label: "Alavancagem humana", value: "3,8x", target: "≥ 3x", status: "healthy", trend: "+0,6x", category: "automation", description: "Volume entregue por hora de participação humana." },
    { key: "intervention", label: "Intervenções críticas", value: "7%", target: "≤ 10%", status: "healthy", trend: "-2 pp", category: "governance", description: "Execuções que exigiram correção humana relevante." },
    { key: "adoption", label: "Reuso das recomendações", value: "81%", target: "≥ 85%", status: "attention", trend: "+9 pp", category: "adoption", description: "Recomendações incorporadas em decisões e artefatos." },
    { key: "load", label: "Carga do profissional", value: "74%", target: "≤ 80%", status: "healthy", trend: "-6 pp", category: "flow", description: "Capacidade humana comprometida no período." },
  ],
  integrations: [
    { platform: "openai", label: "OpenAI", status: "contract_ready", role: "Execução de agentes", contract: ["runs", "tokens", "latência", "tool calls"] },
    { platform: "confluence", label: "Confluence", status: "contract_ready", role: "Base de conhecimento", contract: ["páginas", "decisões", "fontes", "revisões"] },
    { platform: "muster-api", label: "Muster API", status: "live", role: "Governança", contract: ["identidade", "contrato", "evidência", "veredito"] },
  ],
};

const service: TeamOperatingScenario = {
  id: "service",
  label: "Operação de atendimento",
  shortLabel: "Serviço híbrido",
  description: "Agentes resolvem o volume repetitivo; pessoas assumem exceções, risco e relacionamento.",
  purpose: "Resolver solicitações com precisão, agilidade e escalonamento seguro.",
  finalOutcome: "Solicitação resolvida, cliente informado e aprendizado incorporado à operação.",
  definitionOfDone: ["Intenção confirmada", "Solução validada", "Cliente notificado", "Evidência e aprendizado registrados"],
  guardrails: ["Risco financeiro ou jurídico exige pessoa", "Baixa confiança bloqueia resposta automática", "Cliente pode solicitar atendimento humano"],
  cadence: "Operação contínua · SLA por fila · calibração semanal",
  journey: {
    name: "Resolução de atendimento",
    successRate: 89,
    p95: "18 min",
    activeRuns: 186,
    eventsPerMinute: 3412,
    freshnessSeconds: 12,
    telemetryCoverage: 98,
  },
  stages: [
    { id: "discovery", label: "Receber", exitCriteria: "Identidade e intenção mínimas", ownerId: "sofia", sla: "30 s", wipLimit: 40, successRate: 99, handoffContract: "Identidade + intenção + canal" },
    { id: "ready", label: "Triar", exitCriteria: "Risco, prioridade e rota definidos", ownerId: "sofia", sla: "2 min", wipLimit: 25, successRate: 96, handoffContract: "Risco + confiança + rota" },
    { id: "execution", label: "Resolver", exitCriteria: "Resposta ou ação executada", ownerId: "teo", sla: "8 min", wipLimit: 30, successRate: 89, handoffContract: "Ação + política + evidência" },
    { id: "review", label: "Validar", exitCriteria: "Qualidade e política verificadas", ownerId: "diego", sla: "5 min", wipLimit: 12, successRate: 82, handoffContract: "Parecer + decisão + comunicação" },
    { id: "done", label: "Aprender", exitCriteria: "Caso fechado e feedback capturado", ownerId: "patricia", sla: "24 h", wipLimit: 50, successRate: 93 },
  ],
  participants: [
    { id: "patricia", name: "Patrícia Lima", actorType: "human", role: "Supervisora de operação", scope: "SLA, capacidade e exceções", decisionRights: "Reprioriza filas e aprova exceções", workload: 76, currentFocus: "Reduzir reabertura e recalibrar a triagem" },
    { id: "sofia", name: "Sofia", actorType: "agent", role: "Agente de triagem", scope: "Intenção, prioridade e roteamento", decisionRights: "Autônoma em casos de baixo risco", workload: 91, currentFocus: "Contestações e prioridade de risco", platform: "zendesk-ai" },
    { id: "teo", name: "Téo", actorType: "agent", role: "Agente resolutor", scope: "Respostas e ações padronizadas", decisionRights: "Executa playbooks aprovados", workload: 83, currentFocus: "Resolver fila de contestação", platform: "salesforce-agentforce" },
    { id: "diego", name: "Diego Alves", actorType: "human", role: "Especialista N2", scope: "Casos críticos e relacionamento", decisionRights: "Decide compensação e encerramento crítico", workload: 64, currentFocus: "Aprovar exceções financeiras" },
  ],
  workItems: [
    { id: "TKT-912", title: "Classificar intenção e risco", epic: "Fila · Contestação de cobrança", stage: "done", ownerId: "sofia", accountableId: "patricia", contributorIds: [], mode: "autonomous", status: "done", priority: "high", points: 2, progress: 100, evidence: "Trace de classificação", nextStep: "Encaminhar contexto ao resolutor", lastActivity: "há 22 s", due: "Concluída" },
    { id: "TKT-914", title: "Validar histórico e política", epic: "Fila · Contestação de cobrança", stage: "execution", ownerId: "teo", accountableId: "patricia", contributorIds: ["sofia"], mode: "autonomous", status: "in_progress", priority: "high", points: 3, progress: 74, evidence: "Consulta + policy id", nextStep: "Simular ajuste autorizado", lastActivity: "há 8 s", due: "SLA em 8 min" },
    { id: "TKT-917", title: "Aprovar exceção de compensação", epic: "Fila · Contestação de cobrança", stage: "review", ownerId: "diego", accountableId: "patricia", contributorIds: ["teo"], mode: "human", status: "review", priority: "critical", points: 5, progress: 82, evidence: "Parecer do especialista", nextStep: "Diego decidir compensação", lastActivity: "há 41 s", due: "SLA em 4 min" },
    { id: "TKT-921", title: "Atualizar playbook de retenção", epic: "Melhoria · Aprendizado da fila", stage: "discovery", ownerId: "patricia", accountableId: "patricia", contributorIds: ["teo"], mode: "assisted", status: "planned", priority: "medium", points: 5, progress: 22, evidence: "Mudança de playbook", nextStep: "Revisar padrão de reabertura", lastActivity: "há 3 h", due: "27 ago" },
    { id: "TKT-924", title: "Recalibrar confiança da triagem", epic: "Melhoria · Aprendizado da fila", stage: "ready", ownerId: "sofia", accountableId: "patricia", contributorIds: ["diego"], mode: "assisted", status: "blocked", priority: "critical", points: 3, progress: 35, evidence: "Amostra rotulada", nextStep: "Patrícia liberar amostra revisada", lastActivity: "há 9 min", blockedReason: "Amostra humana abaixo do mínimo contratual", due: "SLA em 2h" },
  ],
  metrics: [
    { key: "resolution", label: "Resolução correta", value: "89%", target: "≥ 92%", status: "attention", trend: "+3 pp", category: "outcome", description: "Casos resolvidos sem reabertura ou correção." },
    { key: "sla", label: "SLA cumprido", value: "96%", target: "≥ 95%", status: "healthy", trend: "+1 pp", category: "flow", description: "Casos finalizados dentro do prazo contratado." },
    { key: "quality", label: "Qualidade amostral", value: "93%", target: "≥ 90%", status: "healthy", trend: "+2 pp", category: "quality", description: "Aderência a política, tom e precisão." },
    { key: "automation", label: "Resolução autônoma", value: "71%", target: "≥ 75%", status: "attention", trend: "+5 pp", category: "automation", description: "Casos concluídos sem intervenção humana." },
    { key: "escalation", label: "Escalonamento correto", value: "98%", target: "≥ 98%", status: "healthy", trend: "estável", category: "governance", description: "Exceções encaminhadas conforme risco e alçada." },
    { key: "effort", label: "Esforço humano por caso", value: "2,7 min", target: "≤ 3 min", status: "healthy", trend: "-0,5 min", category: "flow", description: "Tempo humano médio por solicitação." },
    { key: "adoption", label: "Aceite da automação", value: "86%", target: "≥ 88%", status: "attention", trend: "+4 pp", category: "adoption", description: "Interações mantidas no fluxo automatizado." },
    { key: "learning", label: "Loops de aprendizado", value: "78%", target: "≥ 85%", status: "attention", trend: "+7 pp", category: "quality", description: "Falhas convertidas em melhoria de playbook ou modelo." },
  ],
  integrations: [
    { platform: "zendesk", label: "Zendesk", status: "contract_ready", role: "Tickets e SLA", contract: ["tickets", "filas", "status", "CSAT"] },
    { platform: "salesforce", label: "Agentforce", status: "contract_ready", role: "Ações e contexto", contract: ["runs", "handoffs", "ações", "feedback"] },
    { platform: "opentelemetry", label: "OpenTelemetry", status: "live", role: "Supervisão", contract: ["traces", "erros", "latência", "dependências"] },
  ],
};

export const teamOperatingScenarios: TeamOperatingScenario[] = [development, professional, service];

export function summarizeOperatingScenario(scenario: TeamOperatingScenario): OperatingSummary {
  const totalPoints = scenario.workItems.reduce((sum, item) => sum + item.points, 0);
  const completedPoints = scenario.workItems.reduce(
    (sum, item) => sum + item.points * (item.progress / 100),
    0,
  );
  const automatedPoints = scenario.workItems.reduce((sum, item) => {
    const weight = item.mode === "autonomous" ? 1 : item.mode === "assisted" ? 0.5 : 0;
    return sum + item.points * weight;
  }, 0);
  const averageWorkload = scenario.participants.length === 0
    ? 0
    : Math.round(scenario.participants.reduce((sum, participant) => sum + participant.workload, 0) / scenario.participants.length);

  return {
    progress: totalPoints === 0 ? 0 : Math.round((completedPoints / totalPoints) * 100),
    automationCoverage: totalPoints === 0 ? 0 : Math.round((automatedPoints / totalPoints) * 100),
    humanDecisionGates: scenario.workItems.filter((item) => item.mode === "human").length,
    blockedItems: scenario.workItems.filter((item) => item.status === "blocked").length,
    activeItems: scenario.workItems.filter((item) => item.status === "in_progress" || item.status === "review").length,
    completedItems: scenario.workItems.filter((item) => item.status === "done").length,
    backlogItems: scenario.workItems.filter((item) => item.status === "planned").length,
    totalItems: scenario.workItems.length,
    averageWorkload,
    overloadedParticipants: scenario.participants.filter((participant) => participant.workload > 85).length,
  };
}

export function participantForWorkItem(
  scenario: TeamOperatingScenario,
  workItem: TeamWorkItem,
): TeamParticipant | undefined {
  return scenario.participants.find((participant) => participant.id === workItem.ownerId);
}

export function accountableForWorkItem(
  scenario: TeamOperatingScenario,
  workItem: TeamWorkItem,
): TeamParticipant | undefined {
  return scenario.participants.find((participant) => participant.id === workItem.accountableId);
}

export function summarizeStageOperation(
  scenario: TeamOperatingScenario,
  stageId: string,
): StageOperatingSummary {
  const stage = scenario.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`Etapa desconhecida: ${stageId}`);

  const owner = scenario.participants.find((participant) => participant.id === stage.ownerId);
  if (!owner) throw new Error(`Responsável da etapa não encontrado: ${stage.ownerId}`);

  const workItems = scenario.workItems.filter((item) => item.stage === stage.id);
  const activeItems = workItems.filter((item) => item.status === "in_progress" || item.status === "review").length;
  const queuedItems = workItems.filter((item) => item.status === "planned").length;
  const blockedItems = workItems.filter((item) => item.status === "blocked").length;
  const totalPoints = workItems.reduce((sum, item) => sum + item.points, 0);
  const completedPoints = workItems.reduce((sum, item) => sum + item.points * (item.progress / 100), 0);
  const currentWip = activeItems + blockedItems;

  return {
    id: stage.id,
    label: stage.label,
    owner,
    workItems,
    activeItems,
    queuedItems,
    blockedItems,
    wipLimit: stage.wipLimit,
    utilization: Math.round((currentWip / Math.max(1, stage.wipLimit)) * 100),
    progress: totalPoints === 0 ? 0 : Math.round((completedPoints / totalPoints) * 100),
    successRate: stage.successRate,
    sla: stage.sla,
    exitCriteria: stage.exitCriteria,
    handoffContract: stage.handoffContract,
  };
}

export function workAllocationForParticipant(
  scenario: TeamOperatingScenario,
  participantId: string,
) {
  const executing = scenario.workItems.filter((item) => item.ownerId === participantId);
  const accountable = scenario.workItems.filter((item) => item.accountableId === participantId);
  const contributing = scenario.workItems.filter((item) => item.contributorIds.includes(participantId));

  return {
    executing,
    accountable,
    contributing,
    active: executing.filter((item) => item.status === "in_progress" || item.status === "review" || item.status === "blocked"),
  };
}
