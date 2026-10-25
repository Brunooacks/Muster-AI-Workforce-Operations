/**
 * Regras de negócio das telas da fase 2 (puras, testáveis).
 * Muster mede o direcionamento de atividades triviais e repetitivas para
 * agentes; a equipe fica com o trabalho de julgamento. Nunca substituição.
 */

/** Horas produtivas: 168 h é carga bruta; o padrão é 70%, editável. */
export const DEFAULT_PRODUCTIVE_SHARE = 0.7;
export function productiveHours(monthlyHours: number, share = DEFAULT_PRODUCTIVE_SHARE): number {
  if (monthlyHours <= 0 || share <= 0 || share > 1) return 0;
  return Math.round(monthlyHours * share * 10) / 10;
}

/** Custo da equipe por resultado, a partir do baseline humano. */
export function teamCostPerResult(input: {
  monthlyHours: number;
  productiveShare?: number;
  hourlyCost: number;
  resultsPerMonth: number;
}): number | null {
  if (input.resultsPerMonth <= 0) return null;
  const hours = productiveHours(input.monthlyHours, input.productiveShare);
  return (hours * input.hourlyCost) / input.resultsPerMonth;
}

/** Cobertura mínima de baseline medido para mostrar ROI em destaque. */
export const MEASURED_COVERAGE_TARGET = 0.8;
export function isPartialMonth(measuredCoverage: number): boolean {
  return measuredCoverage < MEASURED_COVERAGE_TARGET;
}
export function canHighlightRoi(measuredCoverage: number): boolean {
  return !isPartialMonth(measuredCoverage);
}

export type BaselineSource = "declared" | "measured";
/** Declarado vira medido com histórico importado ou 30 dias em paralelo. */
export function resolveBaselineSource(input: {
  historyImported: boolean;
  parallelDays: number;
}): BaselineSource {
  return input.historyImported || input.parallelDays >= 30 ? "measured" : "declared";
}

export type Band = "green" | "yellow" | "red";
/**
 * Faixa aceitável: razão entre o custo por resultado com agente (já com a
 * revisão humana) e o custo da equipe.
 * verde ≤ 0,8 · amarelo ≤ 1,0 · vermelho > 1,0 (dá prejuízo → devolver para a equipe).
 */
export function costBand(agentCostPerResult: number, teamCost: number): Band {
  if (teamCost <= 0) return "red";
  const r = agentCostPerResult / teamCost;
  if (r <= 0.8) return "green";
  if (r <= 1) return "yellow";
  return "red";
}

export type Suggestion = "keep" | "adjust" | "return_to_team";
export function suggestionFor(band: Band): Suggestion {
  return band === "green" ? "keep" : band === "yellow" ? "adjust" : "return_to_team";
}

/** Dentro da faixa de tolerância da meta (ex.: 40% ± 10 pp). */
export function withinTolerance(value: number, target: number, tolerance: number): boolean {
  return Math.abs(value - target) <= tolerance;
}

/** Horas da equipe liberadas para trabalho de julgamento. */
export function hoursFreed(resultsByAgent: number, minutesPerResultByTeam: number): number {
  return Math.round((resultsByAgent * minutesPerResultByTeam) / 60);
}
