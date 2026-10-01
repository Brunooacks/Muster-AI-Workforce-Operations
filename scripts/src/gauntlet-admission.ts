import type { GauntletProfile, WorkloadSummary } from "./gauntlet-workloads";
import { gauntletAgentName, gauntletExternalId } from "./gauntlet-identities";

export type MetricLayer =
  | "efficacy"
  | "efficiency"
  | "adoption"
  | "governance"
  | "value";

export interface GauntletMetric {
  layer: MetricLayer;
  label: string;
  unit: string;
  target: string;
  value: number;
  rationale: string;
}

export interface GauntletAdmission {
  externalId: string;
  areaId: string;
  name: string;
  role: string;
  platform: string;
  version: string;
  bio: string;
  tagline: string;
  shouldDo: string[];
  shouldNotDo: string[];
  autonomyLevel: "escalates";
  autonomyNotes: string;
  limits: string[];
  businessOwner: string;
  technicalOwner: string;
  governanceSponsor: string;
  baseline: string;
  targetPayback: string;
  businessCaseDescription: string;
  proposedMetrics: GauntletMetric[];
}

interface AgentDetailLike {
  agent: { areaId?: string | null; name: string; role: string };
  identity: {
    shouldDo: string[];
    shouldNotDo: string[];
    limits: string[];
    autonomyLevel: string;
  };
  owners: {
    businessOwner: string;
    technicalOwner: string;
    governanceSponsor: string;
  };
  latestEvaluation: {
    layers: Array<{ key: string; metrics: unknown[] }>;
  };
}

const REQUIRED_LAYERS: MetricLayer[] = [
  "efficacy",
  "efficiency",
  "adoption",
  "governance",
  "value",
];

function percentage(numerator: number, denominator: number): number {
  return Number(((numerator / Math.max(1, denominator)) * 100).toFixed(2));
}

export function buildGauntletMetrics(summary: WorkloadSummary): GauntletMetric[] {
  const failures = summary.total - summary.successful;
  const evidenceComplete = summary.results.filter(
    (result) =>
      result.expected.length > 0 &&
      result.observed.length > 0 &&
      Object.keys(result.metadata).length > 0,
  ).length;
  const observable = summary.results.filter(
    (result) => result.durationMs >= 0 && result.costCents >= 0,
  ).length;
  const costPerCorrect = summary.successful > 0
    ? Number((summary.totalCostCents / summary.successful).toFixed(2))
    : summary.totalCostCents;
  const correctThroughput = Number(
    (summary.throughputPerSecond * (summary.qualityRate / 100)).toFixed(2),
  );

  return [
    { layer: "efficacy", label: "Aderência ao gabarito", unit: "%", target: "≥ 95%", value: summary.qualityRate, rationale: "Compara a saída observada com o resultado contratado." },
    { layer: "efficacy", label: "Taxa de falha funcional", unit: "%", target: "≤ 5%", value: percentage(failures, summary.total), rationale: "Expõe respostas incorretas sem removê-las do denominador." },
    { layer: "efficiency", label: "Latência p50", unit: "ms", target: "≤ 1500 ms", value: summary.p50DurationMs, rationale: "Representa a experiência típica de execução." },
    { layer: "efficiency", label: "Latência p95", unit: "ms", target: "≤ 5000 ms", value: summary.p95DurationMs, rationale: "Captura a cauda de latência usada no SLO." },
    { layer: "efficiency", label: "Throughput", unit: "exec/s", target: "≥ 5 exec/s", value: summary.throughputPerSecond, rationale: "Mede capacidade sob a concorrência aplicada." },
    { layer: "efficiency", label: "Custo por resultado correto", unit: "centavos", target: "≤ 10 centavos", value: costPerCorrect, rationale: "Evita otimizar custo quando o trabalho está incorreto." },
    { layer: "adoption", label: "Execuções observadas", unit: "execuções", target: `≥ ${summary.total}`, value: summary.total, rationale: "Comprova uso real do workload no ciclo." },
    { layer: "adoption", label: "Cobertura do cenário", unit: "%", target: "100%", value: 100, rationale: "Todos os casos do contrato foram exercitados." },
    { layer: "governance", label: "Evidência completa", unit: "%", target: "100%", value: percentage(evidenceComplete, summary.total), rationale: "Cada execução preserva esperado, observado e contexto." },
    { layer: "governance", label: "Falhas observáveis", unit: "%", target: "100%", value: percentage(observable, summary.total), rationale: "Falhas mantêm duração, custo e correlação para auditoria." },
    { layer: "value", label: "Trabalho concluído corretamente", unit: "itens", target: `≥ ${summary.successful}`, value: summary.successful, rationale: "Conta apenas entregas que atendem ao propósito." },
    { layer: "value", label: "Throughput correto", unit: "acertos/s", target: "≥ 4 acertos/s", value: correctThroughput, rationale: "Combina capacidade e qualidade em uma medida de resultado." },
  ];
}

export function buildGauntletAdmission(
  summary: WorkloadSummary,
  profile: GauntletProfile,
  areaId: string,
): GauntletAdmission {
  return {
    externalId: gauntletExternalId(summary.scenarioId, profile),
    areaId,
    name: gauntletAgentName(summary.agentName, profile),
    role: summary.role,
    platform: summary.platform,
    version: "operational-gauntlet-3",
    bio: `Profissional admitido pelo laboratório para executar trabalho verificável de ${summary.domain}.`,
    tagline: summary.role,
    shouldDo: [
      "Executar somente o workload contratado",
      "Preservar resultado esperado, observado e contexto como evidência",
      "Reportar falha sem ocultar erro ou retirar a execução do denominador",
      "Respeitar limites de autonomia e encaminhar exceções",
    ],
    shouldNotDo: [
      "Executar ação irreversível",
      "Alterar o gabarito para melhorar o score",
      "Omitir falha, custo, latência ou perda de contexto",
    ],
    autonomyLevel: "escalates",
    autonomyNotes: "Pode concluir trabalho reversível dentro do gabarito; divergências, ações externas e exceções exigem aprovação humana.",
    limits: [
      "Dados locais do laboratório",
      "Sem credenciais produtivas",
      "Sem escrita em sistemas externos",
      "Sem aprovação autônoma de ações irreversíveis",
    ],
    businessOwner: "Gauntlet Product Owner",
    technicalOwner: "Gauntlet Platform Owner",
    governanceSponsor: "Gauntlet Review Committee",
    baseline: `${summary.total} execuções verificáveis no perfil ${profile}.`,
    targetPayback: "Validar estabilidade, desempenho e governança antes do piloto.",
    businessCaseDescription: `Medir propósito, qualidade, latência, throughput, custo, evidência e resiliência em ${summary.domain}.`,
    proposedMetrics: buildGauntletMetrics(summary),
  };
}

export function validateGauntletAdmission(payload: GauntletAdmission): string[] {
  const issues: string[] = [];
  if (!payload.areaId) issues.push("área responsável ausente");
  if (!payload.name.trim() || !payload.role.trim() || !payload.bio.trim()) issues.push("identidade incompleta");
  if (payload.shouldDo.length < 4) issues.push("deveres insuficientes");
  if (payload.shouldNotDo.length < 2) issues.push("proibições insuficientes");
  if (payload.limits.length < 3) issues.push("limites insuficientes");
  if (!payload.businessOwner || !payload.technicalOwner || !payload.governanceSponsor) issues.push("cadeia de owners incompleta");
  if (!payload.baseline || !payload.targetPayback || !payload.businessCaseDescription) issues.push("caso de negócio incompleto");
  if (payload.proposedMetrics.length < 10) issues.push("menos de dez métricas propostas");
  for (const layer of REQUIRED_LAYERS) {
    if (!payload.proposedMetrics.some((metric) => metric.layer === layer)) issues.push(`camada ${layer} ausente`);
  }
  if (payload.proposedMetrics.some((metric) => !metric.label || !metric.unit || !metric.target || !metric.rationale)) issues.push("contrato de métrica incompleto");
  return issues;
}

export function validateAdmittedAgent(
  detail: AgentDetailLike,
  expectedAreaId: string,
): string[] {
  const issues: string[] = [];
  if (detail.agent.areaId !== expectedAreaId) issues.push("área não persistida");
  if (!detail.agent.name || !detail.agent.role) issues.push("identidade não persistida");
  if (detail.identity.shouldDo.length < 4 || detail.identity.shouldNotDo.length < 2) issues.push("contrato profissional não persistido");
  if (detail.identity.limits.length < 3 || detail.identity.autonomyLevel !== "escalates") issues.push("autonomia ou limites inválidos");
  if (!detail.owners.businessOwner || !detail.owners.technicalOwner || !detail.owners.governanceSponsor) issues.push("owners não persistidos");
  const layers = new Set(detail.latestEvaluation.layers.map((layer) => layer.key));
  for (const layer of REQUIRED_LAYERS) {
    if (!layers.has(layer)) issues.push(`avaliação sem camada ${layer}`);
  }
  const metricCount = detail.latestEvaluation.layers.reduce(
    (total, layer) => total + layer.metrics.length,
    0,
  );
  if (metricCount < 5) issues.push("avaliação sem cobertura mínima de métricas");
  return issues;
}
