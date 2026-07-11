import type { LayerKey, VerdictType } from "@workspace/db";

/**
 * Explicit, auditable verdict rules. Rules are evaluated top-down and the
 * FIRST matching rule determines the verdict — the full list of matching
 * rule ids is kept in `rulesFired` for auditability.
 *
 * Everything is deterministic from the input: no Math.random, no Date.now.
 */

export interface DecisionInput {
  healthScore: number;
  layerScores: Partial<Record<LayerKey, number>>;
  dataSource: "telemetry" | "seeded" | "mixed";
  totalExecutions: number;
  windowDays: number;
  trendDelta?: number | null;
}

export interface DecisionResult {
  verdict: VerdictType;
  confidence: number;
  rationale: string;
  rulesFired: string[];
}

export interface DecisionRule {
  id: string;
  description: string;
  when: (input: DecisionInput) => boolean;
  verdict: VerdictType;
}

// Missing governance defaults to 100 (no evidence of a problem) for the
// guardrail rules, but to 0 for the promote rule — promotion requires
// POSITIVE governance evidence, not just absence of red flags.
export const DECISION_RULES: DecisionRule[] = [
  {
    id: "insufficient-data",
    description:
      "Dados reais insuficientes (menos de 20 execuções na janela) — mantém em observação até haver base estatística.",
    when: (i) => i.dataSource !== "seeded" && i.totalExecutions < 20,
    verdict: "observation",
  },
  {
    id: "governance-critical-retire",
    description:
      "Governança em colapso (score < 30) — risco inaceitável, aposentadoria imediata.",
    when: (i) => (i.layerScores.governance ?? 100) < 30,
    verdict: "retire",
  },
  {
    id: "governance-critical-mentor",
    description:
      "Governança crítica (score < 45) — intervenção de mentoria antes de qualquer expansão.",
    when: (i) => (i.layerScores.governance ?? 100) < 45,
    verdict: "mentor",
  },
  {
    id: "value-negative",
    description:
      "Valor insuficiente (score < 40) combinado com saúde fraca (< 60) — o agente custa mais do que entrega.",
    when: (i) => (i.layerScores.value ?? 100) < 40 && i.healthScore < 60,
    verdict: "retire",
  },
  {
    id: "declining-trend",
    description:
      "Tendência de queda acentuada (delta ≤ -10) sem saúde de promoção — mentoria para reverter a trajetória.",
    when: (i) =>
      i.trendDelta != null && i.trendDelta <= -10 && i.healthScore < 78,
    verdict: "mentor",
  },
  {
    id: "promote",
    description:
      "Saúde de promoção (≥ 78) com governança comprovada (≥ 60) — pronto para mais volume e escopo.",
    when: (i) => i.healthScore >= 78 && (i.layerScores.governance ?? 0) >= 60,
    verdict: "promote",
  },
  {
    id: "mentor-band",
    description:
      "Saúde intermediária (62–77) — desempenho promissor que ainda exige mentoria dirigida.",
    when: (i) => i.healthScore >= 62,
    verdict: "mentor",
  },
  {
    id: "observation-band",
    description:
      "Saúde baixa (50–61) — permanece em observação com metas de recuperação.",
    when: (i) => i.healthScore >= 50,
    verdict: "observation",
  },
  {
    id: "retire-floor",
    description:
      "Saúde abaixo do piso (< 50) sem regra atenuante — recomendação de aposentadoria.",
    when: () => true,
    verdict: "retire",
  },
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function confidenceFor(input: DecisionInput): number {
  if (input.dataSource === "seeded") {
    // Seeded data deserves lower, deterministic confidence: 65–75 derived
    // from the health score itself (no randomness).
    const h = Math.round(Math.max(0, input.healthScore));
    return 65 + (h % 11);
  }
  const base =
    70 +
    (input.dataSource === "telemetry" ? 20 : 0) +
    Math.min(10, input.totalExecutions / 100);
  return round1(Math.min(98, base));
}

const SOURCE_LABEL: Record<DecisionInput["dataSource"], string> = {
  telemetry: "telemetria real",
  seeded: "dados semeados",
  mixed: "dados mistos (telemetria + semeados)",
};

function rationaleFor(rule: DecisionRule, i: DecisionInput): string {
  const gov = i.layerScores.governance;
  const val = i.layerScores.value;
  const base = `Base: ${SOURCE_LABEL[i.dataSource]}, ${i.totalExecutions} execuções em ${i.windowDays} dias.`;
  switch (rule.id) {
    case "insufficient-data":
      return `Apenas ${i.totalExecutions} execuções na janela de ${i.windowDays} dias — abaixo do mínimo de 20 para um veredito defensável. O agente permanece em observação até acumular base estatística.`;
    case "governance-critical-retire":
      return `Governança em colapso (score ${gov}) — risco operacional inaceitável sobrepõe o score de saúde ${i.healthScore}. Recomendação de aposentadoria. ${base}`;
    case "governance-critical-mentor":
      return `Governança crítica (score ${gov}) exige intervenção de mentoria antes de qualquer expansão, mesmo com saúde ${i.healthScore}. ${base}`;
    case "value-negative":
      return `Camada de valor fraca (score ${val}) combinada com saúde baixa (${i.healthScore}) indica que o agente custa mais do que entrega. Recomendação de aposentadoria. ${base}`;
    case "declining-trend":
      return `Tendência de queda de ${i.trendDelta} pontos com saúde ${i.healthScore} pede mentoria para reverter a trajetória antes que o veredito piore. ${base}`;
    case "promote":
      return `Saúde ${i.healthScore} com governança ${gov} atende os critérios de promoção (saúde ≥ 78 e governança ≥ 60). ${base}`;
    case "mentor-band":
      return `Saúde ${i.healthScore} na faixa intermediária (62–77): desempenho promissor que ainda exige mentoria dirigida. ${base}`;
    case "observation-band":
      return `Saúde ${i.healthScore} na faixa de observação (50–61): permanece monitorado com metas de recuperação. ${base}`;
    default:
      return `Saúde ${i.healthScore} abaixo do piso de 50 sem regra atenuante — recomendação de aposentadoria. ${base}`;
  }
}

/**
 * Evaluate DECISION_RULES top-down; the first match determines the verdict.
 * `rulesFired` lists every rule whose condition held (in rule order) so the
 * decision is fully auditable; `rulesFired[0]` is the deciding rule.
 */
export function decideVerdict(input: DecisionInput): DecisionResult {
  const fired = DECISION_RULES.filter((rule) => rule.when(input));
  // retire-floor always matches, so `fired` is never empty.
  const deciding = fired[0]!;
  return {
    verdict: deciding.verdict,
    confidence: confidenceFor(input),
    rationale: rationaleFor(deciding, input),
    rulesFired: fired.map((r) => r.id),
  };
}
