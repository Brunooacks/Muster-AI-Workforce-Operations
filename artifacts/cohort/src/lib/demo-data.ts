/**
 * Dados ilustrativos da área logada (selo "Dados ilustrativos" em cada tela)
 * até existir dado real na conta. Nenhum nome de cliente real.
 */
import type { BaselineSource } from "./routing-model";

export interface DemoAgent {
  id: string;
  name: string;
  activity: { pt: string; en: string; es: string };
  results: number;
  acceptance: number; // 0..1
  agentCostPerResult: number; // R$, com revisão humana
  teamCostPerResult: number; // R$, baseline humano
  baseline: BaselineSource;
  repetitive: number; // 0..1
  minutesPerResultByTeam: number;
  trend: number[]; // razão custo agente / equipe, jul..out
}

export const DEMO_AGENTS: DemoAgent[] = [
  { id: "triagem", name: "Triagem de chamados", activity: { pt: "Classificar chamados", en: "Ticket triage", es: "Clasificar tickets" }, results: 4210, acceptance: 0.96, agentCostPerResult: 0.42, teamCostPerResult: 2.9, baseline: "measured", repetitive: 0.92, minutesPerResultByTeam: 4, trend: [0.31, 0.22, 0.17, 0.14] },
  { id: "conciliacao", name: "Conciliação de notas", activity: { pt: "Conciliar notas fiscais", en: "Invoice reconciliation", es: "Conciliar facturas" }, results: 1880, acceptance: 0.93, agentCostPerResult: 1.1, teamCostPerResult: 3.6, baseline: "measured", repetitive: 0.88, minutesPerResultByTeam: 9, trend: [0.45, 0.38, 0.33, 0.31] },
  { id: "cadastro", name: "Atualização cadastral", activity: { pt: "Atualizar cadastros", en: "Record updates", es: "Actualizar registros" }, results: 2640, acceptance: 0.9, agentCostPerResult: 0.9, teamCostPerResult: 1.6, baseline: "measured", repetitive: 0.85, minutesPerResultByTeam: 3, trend: [0.7, 0.62, 0.58, 0.56] },
  { id: "resumo", name: "Resumo de contratos", activity: { pt: "Resumir contratos", en: "Contract summaries", es: "Resumir contratos" }, results: 610, acceptance: 0.81, agentCostPerResult: 6.8, teamCostPerResult: 7.5, baseline: "declared", repetitive: 0.55, minutesPerResultByTeam: 25, trend: [0.84, 0.95, 0.88, 0.91] },
  { id: "cobranca", name: "Negociação de cobrança", activity: { pt: "Negociar cobranças", en: "Collections negotiation", es: "Negociar cobros" }, results: 320, acceptance: 0.64, agentCostPerResult: 9.4, teamCostPerResult: 8.1, baseline: "declared", repetitive: 0.3, minutesPerResultByTeam: 30, trend: [0.98, 1.08, 1.12, 1.16] },
];

export const DEMO_MONTHS = { pt: ["jul", "ago", "set", "out"], en: ["Jul", "Aug", "Sep", "Oct"], es: ["jul", "ago", "sep", "oct"] };
/** Cobertura de baseline medido no fechamento de cada mês. */
export const DEMO_COVERAGE = [0.52, 0.71, 0.84, 0.86];
export const DEMO_MONTHLY = [
  { cost: 5120, results: 7900, teamCost: 23800 },
  { cost: 4740, results: 8650, teamCost: 25100 },
  { cost: 4480, results: 9310, teamCost: 26900 },
  { cost: 4120, results: 9660, teamCost: 27600 },
];

export function brl(value: number, locale: string, digits = 2): string {
  return value.toLocaleString(locale, { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function pct(value: number, locale: string): string {
  return value.toLocaleString(locale, { style: "percent", maximumFractionDigits: 0 });
}
export function num(value: number, locale: string): string {
  return value.toLocaleString(locale);
}
