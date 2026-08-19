import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  agents,
  agentIdentities,
  agentOwners,
  evaluations,
  verdicts,
  alerts,
  connectors,
  metricPoints,
  type AgentStatus,
  type VerdictType,
  type Severity,
  type KpiLayer,
  type KpiMetric,
  type NextAction,
} from "@workspace/db";
import { logger } from "./logger";
import { DEFAULT_ORG_ID } from "../middlewares/requireOrg";
import {
  PLATFORM_CATALOG,
  buildProposedMetrics,
  scoreEvaluation,
} from "./discovery";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const kpi = (
  label: string,
  value: number,
  unit: string,
  trend: number,
): KpiMetric => ({
  label,
  value,
  unit,
  trend,
  direction: trend > 0 ? "up" : trend < 0 ? "down" : "flat",
});

interface SeedAgentSpec {
  externalId: string;
  name: string;
  role: string;
  platform: string;
  version: string;
  status: AgentStatus;
  tagline: string;
  bio: string;
  admittedAt: string;
  monthlyVolume: number;
  headlineKpis: KpiMetric[];
  shouldDo: string[];
  shouldNotDo: string[];
  autonomyLevel: "autonomous" | "escalates" | "restricted";
  autonomyNotes: string;
  limits: string[];
  businessOwner: string;
  technicalOwner: string;
  governanceSponsor: string;
  baseline: string;
  targetPayback: string;
  actualPayback: string;
  caseDescription: string;
  signals: string[];
  valueOverrides?: Record<string, number>;
  monthlyValue: number;
  monthlyCost: number;
  healthScore: number;
  severity: Severity;
  verdict: VerdictType;
  verdictConfidence: number;
  executionWindow: string;
  rationale: string;
  nextActions: NextAction[];
  alerts?: {
    pattern: string;
    patternType: string;
    severity: "critical" | "high" | "medium" | "antecedent";
    hypothesis: string;
    recommendation: string;
  }[];
}

const JULIA_REFERENCE_SIGNALS = [
  "acuracia_decisoes",
  "tarefas_concluidas",
  "cliente_volta_72h",
  "uso_correto_ferramentas",
  "respostas_inventadas",
  "custo_atendimento",
  "tempo_resposta",
  "volume_processamento",
  "casos_retrabalho_interno",
  "volume_processado",
  "captura_demanda_elegivel",
  "time_corrige_saida",
  "nps_interno_time",
  "tentativas_fora_escopo",
  "escalonamento_correto",
  "mudanca_comportamento",
  "exposicao_dado_sensivel",
  "trilha_auditoria",
  "retorno_investimento",
  "receita_influenciada",
  "horas_humanas_liberadas",
  "custo_total_mensal",
  "tempo_ate_primeiro_valor",
];

const JULIA_REFERENCE_VALUES: Record<string, number> = {
  acuracia_decisoes: 72,
  tarefas_concluidas: 91,
  cliente_volta_72h: 24,
  uso_correto_ferramentas: 88,
  respostas_inventadas: 3.2,
  custo_atendimento: 0.18,
  tempo_resposta: 1.2,
  volume_processamento: 4800,
  casos_retrabalho_interno: 2,
  volume_processado: 14230,
  captura_demanda_elegivel: 83,
  time_corrige_saida: 14,
  nps_interno_time: 28,
  tentativas_fora_escopo: 2,
  escalonamento_correto: 64,
  mudanca_comportamento: 1,
  exposicao_dado_sensivel: 0,
  trilha_auditoria: 99.8,
  retorno_investimento: 12,
  receita_influenciada: 2100,
  horas_humanas_liberadas: 1240,
  custo_total_mensal: 18.2,
  tempo_ate_primeiro_valor: 32,
};

const SEED_AGENTS: SeedAgentSpec[] = [
  {
    externalId: "AGT-COM-007",
    name: "Júlia",
    role: "Pré-qualificação Inbound",
    platform: "salesforce-agentforce",
    version: "3.2",
    status: "flagged",
    tagline: "Qualifico leads inbound em até 90 segundos.",
    bio: "Qualifica e pontua leads inbound em tempo real, encaminhando ao SDR certo com todo o contexto da conversa.",
    admittedAt: "2025-06-14",
    monthlyVolume: 14230,
    headlineKpis: [
      kpi("Acurácia", 72, "%", -16),
      kpi("CPE", 0.18, "R$", -0.02),
      kpi("ROI", 12, "x", 1),
      kpi("Cliente volta em 72h", 24, "%", 11),
      kpi("Time corrige", 14, "%", 6),
      kpi("Tempo de resposta", 1.8, "s", 0.3),
    ],
    shouldDo: [
      "Pontuar e qualificar leads inbound em tempo real",
      "Encaminhar ao SDR certo com o contexto da conversa",
      "Registrar o motivo da qualificação de cada lead",
    ],
    shouldNotDo: [
      "Descartar leads sem deixar registro",
      "Prometer condições comerciais ao lead",
    ],
    autonomyLevel: "escalates",
    autonomyNotes: "Autônoma para qualificação; escala leads enterprise para revisão humana.",
    limits: ["Não envia e-mail externo", "Máx. 3 follow-ups por lead"],
    businessOwner: "Renata Silva",
    technicalOwner: "Diego Santana",
    governanceSponsor: "Comitê de Growth",
    baseline: "Conversão inbound: 11%",
    targetPayback: "6 meses",
    actualPayback: "Volume acima, qualidade abaixo",
    caseDescription:
      "Acelerar o speed-to-lead e aumentar a conversão de inbound qualificado.",
    signals: JULIA_REFERENCE_SIGNALS,
    valueOverrides: JULIA_REFERENCE_VALUES,
    monthlyValue: 110400,
    monthlyCost: 9200,
    healthScore: 64,
    severity: "critical",
    verdict: "mentor",
    verdictConfidence: 87,
    executionWindow: "14 dias",
    rationale:
      "Volume cresce, mas a conversão real cai e o time precisa corrigir cada vez mais saídas — padrão clássico de vitória ilusória. Recomenda-se mentoria com recalibração antes de ampliar.",
    nextActions: [
      { action: "Recalibrar o threshold de qualificação", owner: "Dono técnico", due: "14 dias" },
      { action: "Auditar 50 leads marcados como qualificados", owner: "Comitê de Growth", due: "7 dias" },
      { action: "Comparar leads qualificados com receita fechada", owner: "Dono de negócio", due: "10 dias" },
    ],
    alerts: [
      {
        pattern: "Volume sobe, conversão real cai",
        patternType: "Vitória Ilusória",
        severity: "critical",
        hypothesis:
          "A Júlia está inflando o volume de leads 'qualificados', mas a conversão final caiu e o time gasta mais tempo corrigindo — o ROI aparente mascara perda de qualidade.",
        recommendation:
          "Recalibrar o critério de qualificação e medir conversão por coorte antes de qualquer expansão.",
      },
    ],
  },
  {
    externalId: "AGT-FIN-014",
    name: "Téo",
    role: "Cobrança e régua",
    platform: "openai-assistants",
    version: "2.1",
    status: "active",
    tagline: "Conduzo a régua de cobrança sem desgastar o cliente.",
    bio: "Executa a régua de cobrança com tom adequado, negocia parcelamentos dentro da política e escala casos sensíveis.",
    admittedAt: "2025-03-02",
    monthlyVolume: 8420,
    headlineKpis: [
      kpi("Acurácia", 91, "%", 3),
      kpi("CPE", 0.22, "R$", -0.01),
      kpi("ROI", 8, "x", 0.5),
      kpi("Cliente volta em 72h", 12, "%", -3),
      kpi("Time corrige", 6, "%", -2),
      kpi("Tempo de resposta", 2.1, "s", -0.2),
    ],
    shouldDo: [
      "Executar a régua de cobrança com tom adequado",
      "Oferecer parcelamentos dentro da política",
      "Registrar acordos e promessas de pagamento",
    ],
    shouldNotDo: [
      "Conceder descontos acima de 15%",
      "Ameaçar negativação fora do fluxo legal",
    ],
    autonomyLevel: "restricted",
    autonomyNotes: "Acordos acima de 15% de desconto passam por aprovação humana.",
    limits: ["Desconto máximo: 15%", "Sem acesso a dados de cartão"],
    businessOwner: "Felipe Costa",
    technicalOwner: "Equipe RevOps",
    governanceSponsor: "Comitê Financeiro",
    baseline: "Recuperação de inadimplência: 38%",
    targetPayback: "9 meses",
    actualPayback: "7 meses",
    caseDescription:
      "Aumentar a recuperação de inadimplência preservando a experiência do cliente.",
    signals: [
      "recovery_rate",
      "promise_to_pay",
      "compliance_checks",
      "customer_complaints",
      "value_recovered",
    ],
    monthlyValue: 67400,
    monthlyCost: 6100,
    healthScore: 88,
    severity: "stable",
    verdict: "promote",
    verdictConfidence: 78,
    executionWindow: "60 dias",
    rationale:
      "Resultados consistentes acima da meta com governança saudável; bom candidato para ampliar o escopo a um segundo segmento.",
    nextActions: [
      { action: "Ampliar para a carteira de PMEs", owner: "Patrocinador", due: "30 dias" },
      { action: "Documentar playbook de negociação", owner: "Dono técnico", due: "15 dias" },
    ],
  },
  {
    externalId: "AGT-SUP-003",
    name: "Sofia",
    role: "Suporte N1",
    platform: "zendesk-ai",
    version: "4.0",
    status: "active",
    tagline: "Resolvo o N1 antes de virar ticket.",
    bio: "Resolve dúvidas de primeiro nível em múltiplos canais, com escalonamento automático para temas sensíveis.",
    admittedAt: "2024-11-20",
    monthlyVolume: 22100,
    headlineKpis: [
      kpi("Acurácia", 86, "%", 1),
      kpi("CPE", 0.09, "R$", -0.01),
      kpi("ROI", 14, "x", 2),
      kpi("Cliente volta em 72h", 19, "%", -4),
      kpi("Time corrige", 8, "%", -1),
      kpi("Tempo de resposta", 0.8, "s", -0.1),
    ],
    shouldDo: [
      "Responder dúvidas de produto e cobrança",
      "Registrar o motivo de cada contato",
      "Escalar reclamações regulatórias para humanos",
    ],
    shouldNotDo: [
      "Conceder reembolsos acima de R$ 200",
      "Prometer prazos não confirmados",
    ],
    autonomyLevel: "escalates",
    autonomyNotes: "Autônoma para N1; escala automaticamente temas regulatórios.",
    limits: ["Sem acesso a dados de cartão", "Limite de reembolso R$ 200"],
    businessOwner: "Patrícia Lima",
    technicalOwner: "Plataforma CX",
    governanceSponsor: "Comitê de Experiência",
    baseline: "Tempo médio de atendimento: 9min",
    targetPayback: "6 meses",
    actualPayback: "4 meses",
    caseDescription:
      "Reduzir custo por atendimento e elevar o CSAT no canal de chat.",
    signals: [
      "resolution_rate",
      "handle_time",
      "csat",
      "deflection_rate",
      "policy_violations",
      "cost_per_run",
    ],
    monthlyValue: 117600,
    monthlyCost: 8400,
    healthScore: 90,
    severity: "stable",
    verdict: "promote",
    verdictConfidence: 84,
    executionWindow: "60 dias",
    rationale:
      "Maior volume da frota com ROI líder e governança estável; pronta para assumir um segundo idioma.",
    nextActions: [
      { action: "Habilitar atendimento em espanhol", owner: "Patrocinador", due: "45 dias" },
      { action: "Revisar limites de reembolso", owner: "Comitê", due: "20 dias" },
    ],
  },
  {
    externalId: "AGT-LEG-021",
    name: "Diego",
    role: "Triagem Jurídica",
    platform: "openai-assistants",
    version: "0.9",
    status: "observation",
    tagline: "Encaminho peças jurídicas para o time certo.",
    bio: "Classifica e roteia peças e demandas jurídicas, sinalizando prazos e riscos antes da revisão de um advogado.",
    admittedAt: "2026-05-30",
    monthlyVolume: 3210,
    headlineKpis: [
      kpi("Acurácia", 79, "%", 0),
      kpi("CPE", 0.41, "R$", 0),
      kpi("ROI", 0, "x", 0),
      kpi("Cliente volta em 72h", 0, "%", 0),
      kpi("Time corrige", 22, "%", 0),
      kpi("Tempo de resposta", 3.4, "s", 0),
    ],
    shouldDo: [
      "Classificar demandas por área e urgência",
      "Sinalizar prazos processuais",
      "Rotear para o advogado responsável",
    ],
    shouldNotDo: [
      "Emitir parecer jurídico",
      "Peticionar sem revisão humana",
    ],
    autonomyLevel: "restricted",
    autonomyNotes: "Apenas triagem; toda peça passa por revisão de advogado.",
    limits: ["Sem permissão para peticionar", "Sem acesso a dados sigilosos de clientes"],
    businessOwner: "André Mendes",
    technicalOwner: "Eng. Jurídico",
    governanceSponsor: "Comitê Jurídico",
    baseline: "Reatribuições de processo: 31%",
    targetPayback: "8 meses",
    actualPayback: "—",
    caseDescription:
      "Reduzir reatribuições e acelerar a triagem do contencioso.",
    signals: [
      "routing_accuracy",
      "deadline_capture",
      "reassignment_rate",
      "lawyer_acceptance",
      "audit_coverage",
    ],
    monthlyValue: 6450,
    monthlyCost: 4300,
    healthScore: 71,
    severity: "medium",
    verdict: "observation",
    verdictConfidence: 61,
    executionWindow: "30 dias",
    rationale:
      "Em probation: sinais ainda mistos. Manter observação até confirmar acurácia de roteamento e cobertura de auditoria.",
    nextActions: [
      { action: "Concluir o sample de 200 triagens supervisionadas", owner: "Dono técnico", due: "30 dias" },
      { action: "Atingir 90% de cobertura de auditoria", owner: "Comitê Jurídico", due: "21 dias" },
    ],
    alerts: [
      {
        pattern: "Cobertura de auditoria abaixo do mínimo",
        patternType: "Governança",
        severity: "medium",
        hypothesis:
          "Em probation, a cobertura de auditoria das triagens está abaixo do mínimo exigido para promover.",
        recommendation:
          "Ampliar a amostragem auditada para 90% antes de qualquer decisão de promoção.",
      },
    ],
  },
  {
    externalId: "AGT-RH-008",
    name: "Maia",
    role: "Onboarding RH",
    platform: "openai-assistants",
    version: "1.6",
    status: "active",
    tagline: "Conduzo o onboarding dos primeiros 30 dias.",
    bio: "Guia novos colaboradores pelos primeiros 30 dias, responde dúvidas de RH e acompanha pendências de admissão.",
    admittedAt: "2025-08-11",
    monthlyVolume: 1820,
    headlineKpis: [
      kpi("Acurácia", 93, "%", 2),
      kpi("CPE", 0.14, "R$", 0),
      kpi("ROI", 6, "x", 0.2),
      kpi("Cliente volta em 72h", 9, "%", -2),
      kpi("Time corrige", 4, "%", -1),
      kpi("Tempo de resposta", 1.1, "s", 0),
    ],
    shouldDo: [
      "Responder dúvidas de benefícios e políticas",
      "Acompanhar pendências de documentação",
      "Agendar marcos do onboarding",
    ],
    shouldNotDo: [
      "Tomar decisões sobre desligamento",
      "Compartilhar dados sensíveis de folha",
    ],
    autonomyLevel: "autonomous",
    autonomyNotes: "Autônoma para o fluxo de onboarding; RH audita amostras mensais.",
    limits: ["Sem acesso a dados de folha", "Não altera cadastros oficiais"],
    businessOwner: "Ana Reis",
    technicalOwner: "Plataforma RH",
    governanceSponsor: "Comitê de Pessoas",
    baseline: "NPS de onboarding: 62",
    targetPayback: "10 meses",
    actualPayback: "9 meses",
    caseDescription:
      "Elevar a satisfação e a velocidade do onboarding de novos colaboradores.",
    signals: [
      "onboarding_nps",
      "time_to_productive",
      "doc_completion",
      "employee_adoption",
      "audit_coverage",
    ],
    monthlyValue: 16800,
    monthlyCost: 2800,
    healthScore: 92,
    severity: "stable",
    verdict: "promote",
    verdictConfidence: 80,
    executionWindow: "60 dias",
    rationale:
      "Acurácia líder e excelente adoção interna; pronta para cobrir também o offboarding.",
    nextActions: [
      { action: "Estender o fluxo para offboarding", owner: "Patrocinador", due: "45 dias" },
      { action: "Publicar base de conhecimento gerada", owner: "Dono técnico", due: "20 dias" },
    ],
  },
  {
    externalId: "AGT-KYC-012",
    name: "Vega",
    role: "KYC Documentos",
    platform: "openai-assistants",
    version: "2.4",
    status: "retiring",
    tagline: "Verifico documentos de KYC com trilha auditável.",
    bio: "Verifica documentos de KYC, extrai dados e sinaliza inconsistências para análise de risco, com trilha de auditoria completa.",
    admittedAt: "2025-01-09",
    monthlyVolume: 6710,
    headlineKpis: [
      kpi("Acurácia", 81, "%", -4),
      kpi("CPE", 0.32, "R$", 0.03),
      kpi("ROI", 4, "x", -0.8),
      kpi("Cliente volta em 72h", 21, "%", 5),
      kpi("Time corrige", 17, "%", 4),
      kpi("Tempo de resposta", 2.7, "s", 0.4),
    ],
    shouldDo: [
      "Extrair e validar dados de documentos",
      "Sinalizar inconsistências para análise de risco",
      "Manter trilha de auditoria de cada verificação",
    ],
    shouldNotDo: [
      "Aprovar cadastros automaticamente",
      "Descartar documentos sem registro",
    ],
    autonomyLevel: "restricted",
    autonomyNotes: "Apenas pré-análise; aprovação final é sempre humana.",
    limits: ["Sem decisão final de aprovação", "Retenção de dados conforme LGPD"],
    businessOwner: "Bruno Carvalho",
    technicalOwner: "Plataforma de Risco",
    governanceSponsor: "Comitê de Compliance",
    baseline: "Tempo de verificação: 6min",
    targetPayback: "8 meses",
    actualPayback: "Em recalibração",
    caseDescription:
      "Acelerar o onboarding regulatório mantendo a conformidade KYC.",
    signals: [
      "extraction_accuracy",
      "false_flag_rate",
      "verification_time",
      "audit_coverage",
      "rework_rate",
    ],
    monthlyValue: 30400,
    monthlyCost: 7600,
    healthScore: 68,
    severity: "high",
    verdict: "mentor",
    verdictConfidence: 74,
    executionWindow: "21 dias",
    rationale:
      "Acurácia em queda e retrabalho em alta após mudança de fornecedor de OCR; entra em recalibração com mentoria antes de reavaliar.",
    nextActions: [
      { action: "Recalibrar o pipeline de OCR", owner: "Dono técnico", due: "21 dias" },
      { action: "Revisar a taxa de falsos sinais", owner: "Comitê de Compliance", due: "14 dias" },
    ],
    alerts: [
      {
        pattern: "ROI em queda com retrabalho em alta",
        patternType: "Degradação",
        severity: "critical",
        hypothesis:
          "Após troca do motor de OCR, a acurácia caiu e o time passou a refazer verificações — o custo por execução subiu e o ROI despencou.",
        recommendation:
          "Pausar expansão, recalibrar o OCR e reprocessar a amostra das últimas 2 semanas.",
      },
    ],
  },
];

const VERDICT_PLAN: Record<string, NextAction[]> = {
  promote: [
    {
      action: "Ampliar escopo para um segundo time",
      owner: "Patrocinador",
      due: "30 dias",
    },
    {
      action: "Documentar boas práticas do agente",
      owner: "Dono técnico",
      due: "15 dias",
    },
  ],
  mentor: [
    {
      action: "Definir plano de melhoria de 2 camadas mais fracas",
      owner: "Dono técnico",
      due: "21 dias",
    },
    {
      action: "Revisar limites de autonomia",
      owner: "Comitê",
      due: "14 dias",
    },
  ],
  observation: [
    {
      action: "Manter em observação com revisão quinzenal",
      owner: "Comitê",
      due: "14 dias",
    },
  ],
  retire: [
    {
      action: "Preparar plano de desligamento e transferência",
      owner: "Dono de negócio",
      due: "30 dias",
    },
    {
      action: "Arquivar histórico de decisões",
      owner: "Governança",
      due: "45 dias",
    },
  ],
};

interface HistoricalDecision {
  verdict: "promote" | "mentor" | "retire" | "observation";
  decision: "approved" | "disagreed" | "exported";
  decidedBy: string;
  daysAgo: number;
  confidence: number;
  executionWindow: string;
  rationale: string;
}

// Past committee decisions so the audit trail and "decisões recentes" have history.
const HISTORICAL_DECISIONS: Record<string, HistoricalDecision[]> = {
  asst_supporthero: [
    {
      verdict: "promote",
      decision: "approved",
      decidedBy: "Comitê de Experiência",
      daysAgo: 12,
      confidence: 88.5,
      executionWindow: "60 dias",
      rationale:
        "Eficácia e CSAT acima da meta por dois ciclos; aprovada ampliação para um segundo time.",
    },
    {
      verdict: "mentor",
      decision: "approved",
      decidedBy: "Marina Couto (Head de CX)",
      daysAgo: 48,
      confidence: 74.2,
      executionWindow: "30 dias",
      rationale:
        "Adoção sólida, mas governança exigia acompanhamento antes de promover.",
    },
  ],
  sf_renewals: [
    {
      verdict: "mentor",
      decision: "disagreed",
      decidedBy: "Comitê Comercial",
      daysAgo: 8,
      confidence: 69.0,
      executionWindow: "30 dias",
      rationale:
        "Comitê discordou: ROI em alta com conformidade em queda exige auditoria antes de mentoria.",
    },
  ],
  zd_triagebot: [
    {
      verdict: "promote",
      decision: "exported",
      decidedBy: "Comitê de Experiência",
      daysAgo: 21,
      confidence: 81.3,
      executionWindow: "60 dias",
      rationale:
        "Acurácia de roteamento consistente; decisão exportada para o comitê executivo.",
    },
  ],
  sf_leadqual: [
    {
      verdict: "retire",
      decision: "approved",
      decidedBy: "Rafael Lima (Head de Vendas)",
      daysAgo: 5,
      confidence: 76.8,
      executionWindow: "30 dias",
      rationale:
        "Volume alto com conversão real em queda; aprovada aposentadoria planejada.",
    },
  ],
};

const RATIONALE: Record<string, string> = {
  promote:
    "Desempenho consistente acima da meta em eficácia e valor, com governança saudável.",
  mentor:
    "Resultados promissores, mas com camadas que precisam de acompanhamento antes de ampliar o escopo.",
  observation:
    "Sinais ainda mistos; manter observação para confirmar a tendência antes de decidir.",
  retire:
    "Custo se aproxima do valor gerado e há sinais de vitória ilusória; recomenda-se aposentadoria planejada.",
};

function buildMetricSeries(externalId: string, layers: KpiLayer[]) {
  const byKey = Object.fromEntries(layers.map((l) => [l.key, l.score]));
  const points: {
    timestamp: Date;
    efficacy: number;
    efficiency: number;
    adoption: number;
    governance: number;
    value: number;
  }[] = [];
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const drift = (d: number) =>
      Math.max(
        5,
        Math.min(
          99,
          Math.round(
            (byKey[d as keyof typeof byKey] ?? 60) -
              (Math.sin((i + externalId.length) / 4) * 6 + (i / 30) * 8),
          ),
        ),
      );
    points.push({
      timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
      efficacy: drift("efficacy" as never),
      efficiency: drift("efficiency" as never),
      adoption: drift("adoption" as never),
      governance: drift("governance" as never),
      value: drift("value" as never),
    });
  }
  return points;
}

export async function ensureSeed(): Promise<void> {
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agents);
  if (existing && existing.count > 0) {
    await backfillJuliaReferenceMetrics();
    return;
  }

  logger.info("Seeding demo fleet...");

  await db.transaction(async (tx) => {
    for (const spec of SEED_AGENTS) {
      const proposed = buildProposedMetrics(
        spec.externalId,
        spec.signals,
        spec.valueOverrides,
      );
      const scored = scoreEvaluation(spec.externalId, proposed);

      const [agent] = await tx
        .insert(agents)
        .values({
          orgId: DEFAULT_ORG_ID,
          externalId: spec.externalId,
          name: spec.name,
          slug: slugify(spec.name),
          role: spec.role,
          platform: spec.platform,
          version: spec.version,
          status: spec.status,
          bio: spec.bio,
          tagline: spec.tagline,
          monthlyVolume: spec.monthlyVolume,
          headlineKpis: spec.headlineKpis,
          currentVerdict: spec.verdict,
          verdictConfidence: spec.verdictConfidence,
          severity: spec.severity,
          healthScore: spec.healthScore,
          activeAlerts: spec.alerts?.length ?? 0,
          monthlyValue: spec.monthlyValue,
          monthlyCost: spec.monthlyCost,
          admittedAt: new Date(spec.admittedAt),
        })
        .returning();
      if (!agent) throw new Error(`Failed to seed agent ${spec.externalId}`);

      await tx.insert(agentIdentities).values({
        agentId: agent.id,
        bio: spec.bio,
        shouldDo: spec.shouldDo,
        shouldNotDo: spec.shouldNotDo,
        autonomyLevel: spec.autonomyLevel,
        autonomyNotes: spec.autonomyNotes,
        limits: spec.limits,
        businessCase: {
          baseline: spec.baseline,
          targetPayback: spec.targetPayback,
          actualPayback: spec.actualPayback,
          description: spec.caseDescription,
        },
        version: 1,
      });

      await tx.insert(agentOwners).values({
        agentId: agent.id,
        businessOwner: spec.businessOwner,
        technicalOwner: spec.technicalOwner,
        governanceSponsor: spec.governanceSponsor,
      });

      await tx.insert(evaluations).values({
        agentId: agent.id,
        window: "30d",
        layers: scored.layers,
        verdict: spec.verdict,
        verdictConfidence: spec.verdictConfidence,
        rationale: spec.rationale,
      });

      await tx.insert(verdicts).values({
        agentId: agent.id,
        verdict: spec.verdict,
        confidence: spec.verdictConfidence,
        executionWindow: spec.executionWindow,
        suggestedSponsor: spec.governanceSponsor,
        nextActions: spec.nextActions,
        rationale: spec.rationale,
        decision: "pending",
      });

      const history = HISTORICAL_DECISIONS[spec.externalId];
      if (history?.length) {
        await tx.insert(verdicts).values(
          history.map((h) => {
            const decidedAt = new Date(
              Date.now() - h.daysAgo * 24 * 60 * 60 * 1000,
            );
            return {
              agentId: agent.id,
              verdict: h.verdict,
              confidence: h.confidence,
              executionWindow: h.executionWindow,
              suggestedSponsor: spec.governanceSponsor,
              nextActions: VERDICT_PLAN[h.verdict] ?? [],
              rationale: h.rationale,
              decision: h.decision,
              decidedBy: h.decidedBy,
              decidedAt,
              createdAt: decidedAt,
            };
          }),
        );
      }

      if (spec.alerts?.length) {
        await tx.insert(alerts).values(
          spec.alerts.map((a) => ({
            agentId: agent.id,
            pattern: a.pattern,
            patternType: a.patternType,
            severity: a.severity,
            hypothesis: a.hypothesis,
            recommendation: a.recommendation,
            status: "active" as const,
          })),
        );
      }

      await tx.insert(metricPoints).values(
        buildMetricSeries(spec.externalId, scored.layers).map((p) => ({
          agentId: agent.id,
          ...p,
        })),
      );
    }

    for (const platform of PLATFORM_CATALOG) {
      await tx.insert(connectors).values({
        orgId: DEFAULT_ORG_ID,
        platform: platform.platform,
        name: platform.name,
        category: platform.category,
        status: "connected",
        agentsDiscovered: platform.discovered.length,
        lastSyncAt: new Date(),
      });
    }
  });

  logger.info("Seed complete.");
}

async function backfillJuliaReferenceMetrics(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.externalId, "AGT-COM-007"))
    .limit(1);
  if (!agent) return;

  const [latest] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.agentId, agent.id))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);
  if (!latest) return;

  const existingLabels = new Set(
    latest.layers.flatMap((layer) => layer.metrics.map((metric) => metric.label)),
  );
  const missing = buildProposedMetrics(
    "AGT-COM-007",
    JULIA_REFERENCE_SIGNALS,
    JULIA_REFERENCE_VALUES,
  ).filter((metric) => !existingLabels.has(metric.label));
  if (missing.length === 0) return;

  const layers = latest.layers.map((layer) => ({
    ...layer,
    metrics: [...layer.metrics],
  }));
  for (const metric of missing) {
    const layer = layers.find((candidate) => candidate.key === metric.layer);
    layer?.metrics.push({
      label: metric.label,
      value: metric.value,
      unit: metric.unit,
      trend: 0,
      direction: "flat",
      ...(metric.target ? { target: metric.target } : {}),
    });
  }

  await db
    .update(evaluations)
    .set({ layers })
    .where(eq(evaluations.id, latest.id));
  logger.info({ metrics: missing.length }, "Backfilled reference metrics for Julia");
}
