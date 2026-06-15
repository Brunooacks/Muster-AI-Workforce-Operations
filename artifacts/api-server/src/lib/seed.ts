import { sql } from "drizzle-orm";
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
  type KpiLayer,
  type NextAction,
} from "@workspace/db";
import { logger } from "./logger";
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

interface SeedAgentSpec {
  externalId: string;
  name: string;
  role: string;
  platform: string;
  status: AgentStatus;
  bio: string;
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
  monthlyValue: number;
  monthlyCost: number;
  alerts?: {
    pattern: string;
    patternType: string;
    severity: "critical" | "high" | "medium" | "antecedent";
    hypothesis: string;
    recommendation: string;
  }[];
}

const SEED_AGENTS: SeedAgentSpec[] = [
  {
    externalId: "asst_supporthero",
    name: "Atendente Hero",
    role: "Atendimento ao cliente N1",
    platform: "openai-assistants",
    status: "active",
    bio: "Resolve dúvidas de clientes em primeiro nível, com escalonamento para humanos em casos sensíveis.",
    shouldDo: [
      "Responder dúvidas de produto e cobrança",
      "Registrar o motivo de cada contato",
      "Escalar reclamações jurídicas para humanos",
    ],
    shouldNotDo: [
      "Conceder reembolsos acima de R$ 200",
      "Prometer prazos não confirmados",
    ],
    autonomyLevel: "escalates",
    autonomyNotes: "Autônomo para N1; escala automaticamente temas regulatórios.",
    limits: ["Sem acesso a dados de cartão", "Limite de reembolso R$ 200"],
    businessOwner: "Marina Couto (Head de CX)",
    technicalOwner: "Diego Santana (Plataforma)",
    governanceSponsor: "Comitê de Experiência",
    baseline: "Tempo médio de atendimento: 9min",
    targetPayback: "6 meses",
    actualPayback: "4 meses",
    caseDescription:
      "Reduzir custo por atendimento e melhorar CSAT no canal de chat.",
    signals: [
      "resolution_rate",
      "handle_time",
      "csat",
      "policy_violations",
      "deflection_rate",
      "cost_per_run",
    ],
    monthlyValue: 184000,
    monthlyCost: 32000,
  },
  {
    externalId: "sf_renewals",
    name: "Guardião de Renovações",
    role: "Gestão de renovações de contrato",
    platform: "salesforce-agentforce",
    status: "flagged",
    bio: "Acompanha contratos próximos do vencimento e prepara propostas de renovação para os executivos de conta.",
    shouldDo: [
      "Sinalizar contratos em risco com 90 dias de antecedência",
      "Sugerir condições de renovação",
    ],
    shouldNotDo: [
      "Aplicar descontos sem aprovação",
      "Encerrar contratos automaticamente",
    ],
    autonomyLevel: "restricted",
    autonomyNotes: "Toda proposta passa por aprovação do executivo de conta.",
    limits: ["Desconto máximo sugerido: 8%"],
    businessOwner: "Rafael Lima (Head de Vendas)",
    technicalOwner: "Equipe RevOps",
    governanceSponsor: "Comitê Comercial",
    baseline: "Taxa de renovação: 81%",
    targetPayback: "9 meses",
    actualPayback: "8 meses",
    caseDescription:
      "Aumentar a retenção líquida de receita reduzindo churn de contratos.",
    signals: [
      "renewal_uplift",
      "pipeline_touched",
      "compliance_checks",
      "rep_adoption",
      "value_generated",
    ],
    monthlyValue: 240000,
    monthlyCost: 41000,
    alerts: [
      {
        pattern: "ROI em alta com conformidade em queda",
        patternType: "Vitória Ilusória",
        severity: "high",
        hypothesis:
          "O ganho de receita pode estar mascarando aprovações de desconto fora da política.",
        recommendation:
          "Auditar as últimas 50 renovações e revisar os limites de desconto automático.",
      },
    ],
  },
  {
    externalId: "zd_triagebot",
    name: "Triador de Tickets",
    role: "Triagem e roteamento de chamados",
    platform: "zendesk-ai",
    status: "active",
    bio: "Classifica e roteia chamados para a fila correta, priorizando casos críticos.",
    shouldDo: ["Classificar por urgência", "Rotear para a fila correta"],
    shouldNotDo: ["Fechar chamados sem resolução"],
    autonomyLevel: "autonomous",
    autonomyNotes: "Autônomo para roteamento; humanos auditam amostras semanais.",
    limits: ["Não responde ao cliente diretamente"],
    businessOwner: "Marina Couto (Head de CX)",
    technicalOwner: "Diego Santana (Plataforma)",
    governanceSponsor: "Comitê de Experiência",
    baseline: "Acurácia de roteamento: 72%",
    targetPayback: "5 meses",
    actualPayback: "5 meses",
    caseDescription: "Reduzir reatribuições e acelerar a primeira resposta.",
    signals: [
      "routing_accuracy",
      "first_response_time",
      "escalation_rate",
      "ticket_volume",
      "audit_coverage",
    ],
    monthlyValue: 96000,
    monthlyCost: 14000,
  },
  {
    externalId: "gh_reviewer",
    name: "Revisor de Pull Requests",
    role: "Revisão automatizada de código",
    platform: "github-copilot",
    status: "observation",
    bio: "Revisa pull requests sinalizando riscos de segurança e padrões antes da revisão humana.",
    shouldDo: ["Apontar riscos de segurança", "Sugerir testes faltantes"],
    shouldNotDo: ["Aprovar PRs sozinho", "Fazer merge automático"],
    autonomyLevel: "restricted",
    autonomyNotes: "Apenas comenta; aprovação humana obrigatória.",
    limits: ["Sem permissão de merge"],
    businessOwner: "Bianca Reis (Eng. Lead)",
    technicalOwner: "Plataforma de Dev",
    governanceSponsor: "Comitê de Engenharia",
    baseline: "Defeitos em produção: 12/mês",
    targetPayback: "7 meses",
    actualPayback: "—",
    caseDescription:
      "Reduzir defeitos em produção e acelerar o ciclo de revisão.",
    signals: [
      "review_coverage",
      "defects_caught",
      "false_alarm_rate",
      "dev_acceptance",
      "ci_time_saved",
    ],
    monthlyValue: 58000,
    monthlyCost: 12000,
    alerts: [
      {
        pattern: "Alta adoção com excesso de falsos alarmes",
        patternType: "Vitória Ilusória",
        severity: "medium",
        hypothesis:
          "Devs aceitam o agente, mas começam a ignorar comentários por ruído.",
        recommendation:
          "Calibrar a sensibilidade e medir a taxa de comentários acionáveis.",
      },
    ],
  },
  {
    externalId: "sf_leadqual",
    name: "Qualificador de Leads",
    role: "Qualificação inicial de leads inbound",
    platform: "salesforce-agentforce",
    status: "retiring",
    bio: "Qualifica leads inbound e os encaminha para o SDR adequado.",
    shouldDo: ["Pontuar leads", "Encaminhar para o SDR certo"],
    shouldNotDo: ["Descartar leads sem registro"],
    autonomyLevel: "escalates",
    autonomyNotes: "Escala leads de alto valor para revisão humana.",
    limits: ["Não envia e-mail externo"],
    businessOwner: "Rafael Lima (Head de Vendas)",
    technicalOwner: "Equipe RevOps",
    governanceSponsor: "Comitê Comercial",
    baseline: "Conversão de leads: 14%",
    targetPayback: "8 meses",
    actualPayback: "Abaixo da meta",
    caseDescription: "Aumentar a conversão de leads inbound qualificados.",
    signals: [
      "lead_conversion",
      "false_positive_rate",
      "speed_to_lead",
      "seat_usage",
    ],
    monthlyValue: 22000,
    monthlyCost: 19000,
    alerts: [
      {
        pattern: "Volume alto com conversão real em queda",
        patternType: "Vitória Ilusória",
        severity: "critical",
        hypothesis:
          "O agente qualifica muitos leads, mas a conversão final está caindo — possível inflação de métricas.",
        recommendation:
          "Comparar leads qualificados com receita fechada e considerar aposentadoria.",
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
    return;
  }

  logger.info("Seeding demo fleet...");

  await db.transaction(async (tx) => {
    for (const spec of SEED_AGENTS) {
      const proposed = buildProposedMetrics(spec.externalId, spec.signals);
      const scored = scoreEvaluation(spec.externalId, proposed);

      const [agent] = await tx
        .insert(agents)
        .values({
          externalId: spec.externalId,
          name: spec.name,
          slug: slugify(spec.name),
          role: spec.role,
          platform: spec.platform,
          version: "1.2.0",
          status: spec.status,
          bio: spec.bio,
          currentVerdict: scored.verdict,
          verdictConfidence: scored.verdictConfidence,
          severity: scored.severity,
          healthScore: scored.healthScore,
          activeAlerts: spec.alerts?.length ?? 0,
          monthlyValue: spec.monthlyValue,
          monthlyCost: spec.monthlyCost,
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
        verdict: scored.verdict,
        verdictConfidence: scored.verdictConfidence,
        rationale: RATIONALE[scored.verdict] ?? "",
      });

      await tx.insert(verdicts).values({
        agentId: agent.id,
        verdict: scored.verdict,
        confidence: scored.verdictConfidence,
        executionWindow: scored.verdict === "retire" ? "30 dias" : "60 dias",
        suggestedSponsor: spec.governanceSponsor,
        nextActions: VERDICT_PLAN[scored.verdict] ?? [],
        rationale: RATIONALE[scored.verdict] ?? "",
        decision: "pending",
      });

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
