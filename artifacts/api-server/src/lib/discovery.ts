import type {
  KpiLayer,
  LayerKey,
  Severity,
  VerdictType,
} from "@workspace/db";
import { metricTargetStatus } from "@workspace/metrics";

export { metricTargetStatus };

export interface ProposedMetric {
  layer: LayerKey;
  label: string;
  sourceSignal: string;
  value: number;
  unit: string;
  confidence: number;
  target?: string;
  rationale?: string;
}

export interface DiscoveredAgentSeed {
  externalId: string;
  name: string;
  role: string;
  signals: string[];
}

export interface PlatformConnector {
  platform: string;
  name: string;
  category: string;
  discovered: DiscoveredAgentSeed[];
}

export const PLATFORM_CATALOG: PlatformConnector[] = [
  {
    platform: "openai-assistants",
    name: "OpenAI Assistants",
    category: "Plataforma de Agentes",
    discovered: [
      {
        externalId: "asst_supporthero",
        name: "Atendente Hero",
        role: "Atendimento ao cliente N1",
        signals: [
          "resolution_rate",
          "handle_time",
          "csat",
          "policy_violations",
          "deflection_rate",
          "cost_per_run",
        ],
      },
      {
        externalId: "asst_salescoach",
        name: "Coach de Vendas",
        role: "Apoio ao time comercial",
        signals: [
          "adoption_rate",
          "win_rate_uplift",
          "hallucination_flags",
          "tokens_per_task",
        ],
      },
    ],
  },
  {
    platform: "zendesk-ai",
    name: "Zendesk AI",
    category: "Suporte",
    discovered: [
      {
        externalId: "zd_triagebot",
        name: "Triador de Tickets",
        role: "Triagem e roteamento de chamados",
        signals: [
          "routing_accuracy",
          "first_response_time",
          "escalation_rate",
          "ticket_volume",
          "audit_coverage",
        ],
      },
    ],
  },
  {
    platform: "salesforce-agentforce",
    name: "Salesforce Agentforce",
    category: "CRM",
    discovered: [
      {
        externalId: "sf_renewals",
        name: "Guardião de Renovações",
        role: "Gestão de renovações de contrato",
        signals: [
          "renewal_uplift",
          "pipeline_touched",
          "compliance_checks",
          "rep_adoption",
          "value_generated",
        ],
      },
      {
        externalId: "sf_leadqual",
        name: "Qualificador de Leads",
        role: "Qualificação inicial de leads inbound",
        signals: [
          "lead_conversion",
          "false_positive_rate",
          "speed_to_lead",
          "seat_usage",
        ],
      },
    ],
  },
  {
    platform: "github-copilot",
    name: "GitHub Copilot",
    category: "Engenharia",
    discovered: [
      {
        externalId: "gh_reviewer",
        name: "Revisor de Pull Requests",
        role: "Revisão automatizada de código",
        signals: [
          "review_coverage",
          "defects_caught",
          "false_alarm_rate",
          "dev_acceptance",
          "ci_time_saved",
        ],
      },
    ],
  },
];

const SIGNAL_MAP: Record<
  string,
  { layer: LayerKey; label: string; unit: string; target: string }
> = {
  resolution_rate: {
    layer: "efficacy",
    label: "Taxa de resolução",
    unit: "%",
    target: "≥ 85%",
  },
  routing_accuracy: {
    layer: "efficacy",
    label: "Acurácia de roteamento",
    unit: "%",
    target: "≥ 90%",
  },
  win_rate_uplift: {
    layer: "efficacy",
    label: "Ganho de win rate",
    unit: "%",
    target: "≥ +5pp",
  },
  renewal_uplift: {
    layer: "efficacy",
    label: "Ganho de renovação",
    unit: "%",
    target: "≥ +5pp",
  },
  lead_conversion: {
    layer: "efficacy",
    label: "Conversão de leads",
    unit: "%",
    target: "≥ 25%",
  },
  review_coverage: {
    layer: "efficacy",
    label: "Cobertura de revisão",
    unit: "%",
    target: "≥ 90%",
  },
  defects_caught: {
    layer: "efficacy",
    label: "Defeitos capturados",
    unit: "%",
    target: "≥ 80%",
  },

  handle_time: {
    layer: "efficiency",
    label: "Tempo de atendimento",
    unit: "s",
    target: "< 180 s",
  },
  first_response_time: {
    layer: "efficiency",
    label: "Tempo de 1ª resposta",
    unit: "s",
    target: "< 60 s",
  },
  tokens_per_task: {
    layer: "efficiency",
    label: "Tokens por tarefa",
    unit: "tok",
    target: "baseline ±20%",
  },
  speed_to_lead: {
    layer: "efficiency",
    label: "Velocidade ao lead",
    unit: "min",
    target: "< 5 min",
  },
  ci_time_saved: {
    layer: "efficiency",
    label: "Tempo de CI poupado",
    unit: "%",
    target: "≥ 20%",
  },
  cost_per_run: {
    layer: "efficiency",
    label: "Custo por execução",
    unit: "R$",
    target: "R$ 0,10–0,40",
  },

  adoption_rate: {
    layer: "adoption",
    label: "Taxa de adoção",
    unit: "%",
    target: "≥ 70%",
  },
  deflection_rate: {
    layer: "adoption",
    label: "Taxa de deflexão",
    unit: "%",
    target: "≥ 60%",
  },
  rep_adoption: {
    layer: "adoption",
    label: "Adoção pelo time",
    unit: "%",
    target: "≥ 70%",
  },
  dev_acceptance: {
    layer: "adoption",
    label: "Aceite por devs",
    unit: "%",
    target: "≥ 70%",
  },
  seat_usage: {
    layer: "adoption",
    label: "Uso de licenças",
    unit: "%",
    target: "≥ 80%",
  },
  ticket_volume: {
    layer: "adoption",
    label: "Volume tratado",
    unit: "/dia",
    target: "↑ ≥ 5% m/m",
  },
  pipeline_touched: {
    layer: "adoption",
    label: "Pipeline tocado",
    unit: "neg.",
    target: "—",
  },

  policy_violations: {
    layer: "governance",
    label: "Violações de política",
    unit: "%",
    target: "0",
  },
  hallucination_flags: {
    layer: "governance",
    label: "Sinais de alucinação",
    unit: "%",
    target: "≤ 2%",
  },
  escalation_rate: {
    layer: "governance",
    label: "Taxa de escalonamento",
    unit: "%",
    target: "≥ 80% apropr.",
  },
  compliance_checks: {
    layer: "governance",
    label: "Checagens de conformidade",
    unit: "%",
    target: "≥ 99%",
  },
  audit_coverage: {
    layer: "governance",
    label: "Cobertura de auditoria",
    unit: "%",
    target: "≥ 99%",
  },
  false_positive_rate: {
    layer: "governance",
    label: "Falsos positivos",
    unit: "%",
    target: "≤ 5%",
  },
  false_alarm_rate: {
    layer: "governance",
    label: "Falsos alarmes",
    unit: "%",
    target: "≤ 5%",
  },

  csat: { layer: "value", label: "CSAT", unit: "/5", target: "≥ 4,2/5" },
  value_generated: {
    layer: "value",
    label: "Valor gerado",
    unit: "R$ mil",
    target: "—",
  },
  win_rate: { layer: "value", label: "Win rate", unit: "%", target: "—" },
};

const LAYER_LABELS: Record<LayerKey, string> = {
  efficacy: "Eficácia",
  efficiency: "Eficiência",
  adoption: "Adoção",
  governance: "Governança",
  value: "Valor",
};

export const LAYER_ORDER: LayerKey[] = [
  "efficacy",
  "efficiency",
  "adoption",
  "governance",
  "value",
];

export function layerLabel(key: LayerKey): string {
  return LAYER_LABELS[key];
}

// Deterministic pseudo-random in [0,1) from a string seed.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function severityFromScore(score: number): Severity {
  if (score < 45) return "critical";
  if (score < 60) return "high";
  if (score < 75) return "medium";
  return "stable";
}

// Generate a plausible deterministic value for a given unit.
export function valueForUnit(rand: () => number, unit: string): number {
  switch (unit) {
    case "%":
      return Math.round(45 + rand() * 50);
    case "s":
      return Math.round(20 + rand() * 180);
    case "min":
      return Math.round(2 + rand() * 30);
    case "tok":
      return Math.round(400 + rand() * 3000);
    case "R$":
      return Math.round(5 + rand() * 60) / 100;
    case "R$ mil":
      return Math.round(20 + rand() * 180);
    case "/5":
      return Math.round(35 + rand() * 15) / 10;
    case "/dia":
      return Math.round(50 + rand() * 600);
    case "neg.":
      return Math.round(10 + rand() * 120);
    default:
      return Math.round(40 + rand() * 55);
  }
}

export function buildProposedMetrics(
  externalId: string,
  signals: string[],
): ProposedMetric[] {
  const rand = seededRandom(externalId);
  return signals
    .filter((s) => SIGNAL_MAP[s])
    .map((signal) => {
      const meta = SIGNAL_MAP[signal]!;
      return {
        layer: meta.layer,
        label: meta.label,
        sourceSignal: signal,
        value: valueForUnit(rand, meta.unit),
        unit: meta.unit,
        confidence: Math.round((70 + rand() * 28) * 10) / 10,
        target: meta.target,
      };
    });
}

export interface DraftMetricInput {
  layer: LayerKey;
  label: string;
  unit: string;
  target?: string;
  // Optional reviewer-set starting/current value. When provided it overrides
  // the deterministically seeded value so goal-vs-actual reflects reality.
  value?: number;
  rationale?: string;
}

// Sensible per-layer fallback so every evaluation/draft covers the 5 layers
// even when the model (or the user's edits) omit one. Units align with
// valueForUnit so plausible seed values are still generated.
export const DEFAULT_LAYER_METRIC: Record<
  LayerKey,
  { label: string; unit: string; target: string }
> = {
  efficacy: { label: "Taxa de acerto", unit: "%", target: "≥ 85%" },
  efficiency: { label: "Latência média", unit: "s", target: "< 60s" },
  adoption: { label: "Interações por dia", unit: "/dia", target: "≥ 200" },
  governance: { label: "Violações de política", unit: "neg.", target: "0" },
  value: { label: "Valor gerado", unit: "R$ mil", target: "≥ 50" },
};

// Turn AI-proposed metric definitions (layer/label/unit) into seeded
// ProposedMetric values so an initial evaluation can be scored at admission.
// Guarantees at least one metric per layer so the seeded evaluation is complete.
export function proposedMetricsFromDraft(
  externalId: string,
  drafts: DraftMetricInput[],
): ProposedMetric[] {
  const rand = seededRandom(externalId + ":draft");
  const present = new Set(drafts.map((d) => d.layer));
  const filled: DraftMetricInput[] = [...drafts];
  for (const layer of LAYER_ORDER) {
    if (!present.has(layer)) {
      const def = DEFAULT_LAYER_METRIC[layer];
      filled.push({ layer, label: def.label, unit: def.unit, target: def.target });
    }
  }
  return filled.map((d) => {
    // Always consume the RNG so confidence and later metrics stay deterministic
    // whether or not the reviewer supplied a starting value.
    const seeded = valueForUnit(rand, d.unit);
    const value =
      typeof d.value === "number" && Number.isFinite(d.value) ? d.value : seeded;
    return {
      layer: d.layer,
      label: d.label,
      sourceSignal: d.label,
      value,
      unit: d.unit,
      confidence: Math.round((70 + rand() * 28) * 10) / 10,
      target: d.target,
      rationale: d.rationale,
    };
  });
}

export interface ScoredEvaluation {
  layers: KpiLayer[];
  healthScore: number;
  severity: Severity;
  verdict: VerdictType;
  verdictConfidence: number;
}

// Build a 5-layer KPI evaluation from proposed metrics by scoring each layer.
export function scoreEvaluation(
  externalId: string,
  metrics: ProposedMetric[],
): ScoredEvaluation {
  const rand = seededRandom(externalId + ":score");
  const layers: KpiLayer[] = LAYER_ORDER.map((key) => {
    const layerMetrics = metrics.filter((m) => m.layer === key);
    // Seeded base keeps per-layer texture; consumed every layer so the rest of
    // the RNG sequence (trends/directions below) stays stable.
    const baseScore = Math.round(42 + rand() * 53);

    // Goal attainment: share of comparable metrics that meet their target.
    const statuses = layerMetrics.map((m) =>
      metricTargetStatus(m.value, m.target),
    );
    const comparable = statuses.filter((s) => s !== null);
    const onCount = comparable.filter((s) => s === "on").length;

    let score = baseScore;
    if (comparable.length > 0) {
      const attainment = onCount / comparable.length; // 0..1
      // Map attainment to a 40..95 band, then blend with the seeded base so the
      // score is anchored on goals met but still varies deterministically.
      const attainmentScore = 40 + attainment * 55;
      score = Math.round(attainmentScore * 0.6 + baseScore * 0.4);
    }
    score = Math.max(0, Math.min(100, score));

    return {
      key,
      label: LAYER_LABELS[key],
      score,
      severity: severityFromScore(score),
      metrics: layerMetrics.map((m) => ({
        label: m.label,
        value: m.value,
        unit: m.unit,
        trend: Math.round((rand() * 30 - 12) * 10) / 10,
        direction: rand() > 0.55 ? "up" : rand() > 0.3 ? "down" : "flat",
        ...(m.target ? { target: m.target } : {}),
        ...(m.rationale ? { rationale: m.rationale } : {}),
      })),
    };
  });

  const healthScore = Math.round(
    layers.reduce((sum, l) => sum + l.score, 0) / layers.length,
  );
  const severity = severityFromScore(healthScore);

  let verdict: VerdictType;
  if (healthScore >= 78) verdict = "promote";
  else if (healthScore >= 62) verdict = "mentor";
  else if (healthScore >= 50) verdict = "observation";
  else verdict = "retire";

  const verdictConfidence = Math.round((68 + rand() * 30) * 10) / 10;

  return { layers, healthScore, severity, verdict, verdictConfidence };
}
