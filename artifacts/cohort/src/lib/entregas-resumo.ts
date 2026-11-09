/**
 * Valores de taxa chegam do backend em pontos percentuais (0–100) e saem
 * aqui como fração (0–1).
 * Resumo da tela Entregas (área logada). Puro: recebe o GET /agents/:id/outcome
 * de cada agente e devolve os números da tela. Número que o backend não tem
 * fica null com o motivo; nada é preenchido com zero neutro.
 */
import type { OutcomePayload } from "./agent-outcome-view";

export interface AgenteEntregas {
  id: string;
  nome: string;
  papel: string;
  entregas: number;
  aceitas: number | null;
  taxaAceite: number | null;
  custoPorAceitaCents: number | null;
  custoHumanoCents: number | null;
  economiaPct: number | null;
  autoAceite: number | null;
}

export interface ResumoEntregas {
  entregas: number;
  aceitas: number;
  taxaAceite: number | null;
  custoTotalCents: number;
  custoPorAceitaCents: number | null;
  custoHumanoEquivalenteCents: number | null;
  economiaCents: number | null;
  economiaPct: number | null;
  aceiteHumano: number | null;
  aceiteAuto: number | null;
  agentes: AgenteEntregas[];
}

export function resumirEntregas(
  itens: Array<{ id: string; nome: string; papel: string; outcome: OutcomePayload | null | undefined }>,
): ResumoEntregas {
  const agentes: AgenteEntregas[] = itens.map(({ id, nome, papel, outcome }) => {
    const cost = outcome?.layer1.cost.status === "ok" ? outcome.layer1.cost.value : null;
    const taxa = outcome?.layer2.acceptanceRate.status === "ok" ? outcome.layer2.acceptanceRate.value / 100 : null;
    const auto = outcome?.layer2.autoAcceptShare.status === "ok" ? outcome.layer2.autoAcceptShare.value / 100 : null;
    return {
      id,
      nome,
      papel,
      entregas: cost?.tasks ?? outcome?.layer2.tasks ?? 0,
      aceitas: cost?.acceptedTasks ?? null,
      taxaAceite: taxa,
      custoPorAceitaCents: cost?.costPerValidatedTask.cents ?? null,
      custoHumanoCents: cost?.humanCostPerTask?.cents ?? null,
      economiaPct: cost?.breakEven?.savingsPercent != null ? cost.breakEven.savingsPercent / 100 : null,
      autoAceite: auto,
    };
  });
  let entregas = 0, aceitas = 0, custo = 0, humano = 0, temHumano = false, auto = 0, comMix = 0;
  for (const it of itens) {
    const c = it.outcome?.layer1.cost.status === "ok" ? it.outcome.layer1.cost.value : null;
    if (!c) { entregas += it.outcome?.layer2.tasks ?? 0; continue; }
    entregas += c.tasks;
    aceitas += c.acceptedTasks;
    custo += c.totalCost.cents;
    if (c.humanCostPerTask) { humano += c.humanCostPerTask.cents * c.acceptedTasks; temHumano = true; }
    const a = it.outcome!.layer2.autoAcceptShare;
    if (a.status === "ok") { auto += (a.value / 100) * c.acceptedTasks; comMix += c.acceptedTasks; }
  }
  const custoPorAceita = aceitas > 0 ? Math.round(custo / aceitas) : null;
  const economia = temHumano ? humano - custo : null;
  return {
    entregas,
    aceitas,
    taxaAceite: entregas > 0 ? aceitas / entregas : null,
    custoTotalCents: custo,
    custoPorAceitaCents: custoPorAceita,
    custoHumanoEquivalenteCents: temHumano ? humano : null,
    economiaCents: economia,
    economiaPct: temHumano && humano > 0 ? (humano - custo) / humano : null,
    aceiteAuto: comMix > 0 ? auto / comMix : null,
    aceiteHumano: comMix > 0 ? 1 - auto / comMix : null,
    agentes: agentes.sort((x, y) => y.entregas - x.entregas),
  };
}

export function reais(cents: number | null): string {
  if (cents == null) return "sem dado";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(v: number | null): string {
  return v == null ? "sem dado" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
