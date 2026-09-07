import type { Agent, AgentDetail, KpiMetric } from "@workspace/api-client-react";
import { metricTargetStatus } from "@workspace/metrics";

export type WorkforceAgentStatus = "healthy" | "attention" | "critical" | "probation";

export type WorkforceContractMetric = {
  label: string;
  baseline: string;
  target: string;
  current: string;
  status: "on" | "off" | "watch";
  source: string;
  observed?: boolean;
};

export type WorkforceProfessionalAgent = {
  id: string;
  initials: string;
  name: string;
  role: string;
  team: string;
  purpose: string;
  owner: string;
  platforms: string[];
  status: WorkforceAgentStatus;
  statusLabel: string;
  contractFulfillment: number;
  operationalHealth: number;
  responsibilityCoverage: number;
  evidenceConfidence: number;
  reviewDue: string;
  reviewUrgency: string;
  volume: string;
  monthlyVolume?: number;
  monthlyCost?: number;
  costPerExecution?: number | null;
  autonomy: string;
  duties: string[];
  responsibilities: string[];
  boundaries: string[];
  metrics: WorkforceContractMetric[];
  diagnosis: string;
  recommendation: string;
  observedMetricCount?: number;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AI";
}

function metricValue(metrics: KpiMetric[], patterns: RegExp[]): number | null {
  const metric = metrics.find((candidate) =>
    patterns.some((pattern) => pattern.test(candidate.label)),
  );
  return metric ? clampScore(metric.value) : null;
}

function rawMetricValue(metrics: KpiMetric[], patterns: RegExp[]): number | null {
  const metric = metrics.find((candidate) =>
    patterns.some((pattern) => pattern.test(candidate.label)),
  );
  return metric?.value ?? null;
}

type DeclaredMetricContract = {
  catalogMetricKey?: string;
  layer: string;
  label: string;
  unit: string;
  target?: string;
  rationale?: string;
};

function declaredMetricContracts(detail?: AgentDetail): DeclaredMetricContract[] {
  const businessCase = detail?.identity.businessCase as AgentDetail["identity"]["businessCase"] & {
    metricContracts?: DeclaredMetricContract[];
  } | undefined;
  return businessCase?.metricContracts?.filter((metric) => metric.label && metric.unit) ?? [];
}

function formatMetric(metric: KpiMetric, baseline: string): WorkforceContractMetric {
  const target = metric.target ?? "Meta não definida";
  const percentage = metric.unit === "%";
  const current = `${Number(metric.value.toFixed(2)).toLocaleString("pt-BR")}${percentage ? "%" : ` ${metric.unit}`}`;
  const targetStatus = metricTargetStatus(metric.value, metric.target);
  const status = targetStatus === "on" ? "on" : targetStatus === "off" ? "off" : "watch";
  return {
    label: metric.label,
    baseline,
    target,
    current,
    status,
    source: "Muster telemetry",
    observed: true,
  };
}

function statusFromAgent(agent: Agent): WorkforceAgentStatus {
  if (agent.status === "observation" && agent.healthScore === 0) return "probation";
  if (agent.severity === "critical") return "critical";
  if (agent.severity === "high" || agent.severity === "medium") return "attention";
  return "healthy";
}

function statusLabel(agent: Agent): string {
  if (agent.status === "observation" && agent.healthScore === 0) return "Sem evidência";
  if (agent.currentVerdict === "promote") return "Pronto para ampliar";
  if (agent.currentVerdict === "mentor") return "Mentoria necessária";
  if (agent.currentVerdict === "retire") return "Rever função";
  return "Em observação";
}

function recommendation(agent: Agent): string {
  if (agent.healthScore === 0) return "Conectar telemetria e formar uma baseline antes de decidir.";
  if (agent.currentVerdict === "promote") return "Ampliar gradualmente o escopo, preservando limites e evidência contínua.";
  if (agent.currentVerdict === "mentor") return "Abrir plano de desenvolvimento com owner, prazo e critério de reavaliação.";
  if (agent.currentVerdict === "retire") return "Bloquear novas ampliações e revisar a função com o responsável humano.";
  return "Manter em observação até reunir evidência comparável suficiente.";
}

export function adaptApiAgent(
  agent: Agent,
  detail?: AgentDetail,
): WorkforceProfessionalAgent {
  const observedMetrics = agent.targetMetrics?.length
    ? agent.targetMetrics
    : agent.headlineKpis ?? [];
  const declaredMetrics = declaredMetricContracts(detail);
  const baseline = detail?.identity.businessCase.baseline || "Não informado";
  const metrics = declaredMetrics.length > 0
    ? declaredMetrics.map((contract) => {
        const observed = observedMetrics.find(
          (metric) => metric.label.trim().toLocaleLowerCase("pt-BR") === contract.label.trim().toLocaleLowerCase("pt-BR"),
        );
        return observed && (agent.monthlyVolume ?? 0) > 0
          ? formatMetric(observed, baseline)
          : {
              label: contract.label,
              baseline,
              target: contract.target ?? "Meta não definida",
              current: "Sem evidência",
              status: "watch" as const,
              source: contract.rationale ?? "Contrato de admissão",
              observed: false,
            };
      })
    : observedMetrics.map((metric) => formatMetric(metric, baseline));
  const observedMetricCount = metrics.filter((metric) => metric.observed).length;
  const operationalHealth = clampScore(agent.healthScore);
  const measuredContractFulfillment = metricValue(observedMetrics, [
    /aderência/i,
    /taxa de sucesso/i,
    /trabalho concluído/i,
    /propósito/i,
  ]) ?? operationalHealth;
  const contractFulfillment = declaredMetrics.length > 0
    ? Math.round(metrics.reduce((sum, metric) => sum + (metric.observed ? metric.status === "on" ? 100 : metric.status === "watch" ? 50 : 0 : 0), 0) / declaredMetrics.length)
    : measuredContractFulfillment;
  const measuredResponsibilityCoverage = metricValue(observedMetrics, [
    /evidência/i,
    /governança/i,
    /responsabilidade/i,
  ]) ?? operationalHealth;
  const responsibilityCoverage = declaredMetrics.length > 0
    ? Math.round((observedMetricCount / declaredMetrics.length) * 100)
    : measuredResponsibilityCoverage;
  const rawConfidence = agent.verdictConfidence <= 1
    ? agent.verdictConfidence * 100
    : agent.verdictConfidence;
  const evidenceConfidence = clampScore(rawConfidence);
  const measuredCostPerExecution = rawMetricValue(observedMetrics, [
    /custo por execução/i,
  ]);

  return {
    id: agent.id,
    initials: initials(agent.name),
    name: agent.name,
    role: agent.role,
    team: agent.areaName ?? "Área pendente",
    purpose: detail?.identity.businessCase.description || detail?.identity.bio || agent.bio || agent.tagline || `Executar a função de ${agent.role}.`,
    owner: detail?.owners.businessOwner || agent.businessOwner || "Owner pendente",
    platforms: [agent.platform],
    status: statusFromAgent(agent),
    statusLabel: statusLabel(agent),
    contractFulfillment,
    operationalHealth,
    responsibilityCoverage,
    evidenceConfidence,
    reviewDue: agent.lastEvaluatedAt
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(agent.lastEvaluatedAt))
      : "Sem avaliação",
    reviewUrgency: (agent.activeAlerts ?? 0) > 0
      ? `${agent.activeAlerts} alerta(s)`
      : "Monitorado",
    volume: agent.monthlyVolume?.toLocaleString("pt-BR") ?? "Sem volume",
    monthlyVolume: agent.monthlyVolume ?? 0,
    monthlyCost: agent.monthlyCost ?? 0,
    costPerExecution: agent.monthlyVolume && agent.monthlyCost != null
      ? agent.monthlyCost / agent.monthlyVolume
      : measuredCostPerExecution,
    autonomy: detail?.identity.autonomyLevel === "autonomous" || agent.currentVerdict === "promote"
      ? "Autônoma"
      : detail?.identity.autonomyLevel === "restricted" || agent.currentVerdict === "retire"
        ? "Restrita"
        : "Supervisionada",
    duties: detail?.identity.shouldDo.length
      ? detail.identity.shouldDo
      : [
          `Executar somente a função contratada: ${agent.role}.`,
          "Reportar execuções, falhas e evidências ao Muster.",
          "Escalonar situações fora dos limites declarados.",
        ],
    responsibilities: declaredMetrics.length > 0
      ? declaredMetrics.map((metric) => `${metric.label}: ${metric.target ?? "meta pendente"}.`)
      : observedMetrics.length > 0
        ? observedMetrics.map((metric) => `${metric.label}: ${metric.target ?? "meta pendente"}.`)
      : ["Formar baseline real antes de receber autonomia adicional."],
    boundaries: detail
      ? [...detail.identity.shouldNotDo, ...detail.identity.limits]
      : [
          "Não ocultar falhas ou alterar evidências.",
          "Não ampliar autonomia sem decisão registrada.",
          "Não executar ações irreversíveis fora do contrato.",
        ],
    metrics,
    diagnosis: agent.healthScore === 0
      ? "Profissional admitido, ainda sem telemetria suficiente para avaliação."
      : `Saúde ${operationalHealth}/100, veredito ${agent.currentVerdict} com ${evidenceConfidence}% de confiança.`,
    recommendation: recommendation(agent),
    observedMetricCount,
  };
}
