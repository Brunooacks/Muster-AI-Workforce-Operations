/**
 * View-model da página do agente nas três camadas (cunha · C12.2). Puro: recebe
 * a resposta de GET /agents/:id/outcome e devolve textos prontos, com
 * "indisponível" + motivo legível em vez de qualquer número inventado.
 */

export type Num<T> = { status: "ok"; value: T } | { status: "unavailable"; reason: string };

interface Money {
  cents: number;
}

export interface OutcomePayload {
  agentId: string;
  period: string;
  source: "live" | "snapshot";
  calcVersion: string;
  coverage: Num<{ ratio: number; eventsWithTask: number; totalEvents: number }>;
  layer1: {
    cost: Num<{
      tasks: number;
      acceptedTasks: number;
      attempts: number;
      totalCost: Money;
      costPerValidatedTask: Money;
      humanCostPerTask: Money | null;
      breakEven: { savingsPerTask: Money; savingsPercent: number | null } | null;
      breakdown: { tokens: Money; review: Money; rework: Money; offInvoice: Money };
    }>;
    decomposition: {
      retry: Num<{ cents: number; share: number; tasksWithRetry: number }>;
      context: Num<{ ratio: number }>;
      model: Num<{ referenceModel: string; source: string; oversizeCents: number; priceVersion: string }>;
    };
  };
  layer2: {
    tasks: number;
    acceptanceRate: Num<number>;
    interventionRate: Num<number>;
    autoAcceptShare: Num<number>;
    expectedMatchRate: Num<number>;
    contract: Num<{ metricKey: string; value: number; baseline: number; target: number; onTarget: boolean; contractVersion: number }>;
  };
  layer3: {
    provenance: Num<{ sources: string[]; formula: string; taskCount: number; runCount: number }>;
    trail: Num<{ records: number; humanReviews: number; autoAcceptances: number; ruleVersions: string[] }>;
    ownerCoverage: Num<{ covered: number; of: number; missing: string[] }>;
    credentialCoverage: Num<{ activeKeys: number; environments: string[] }>;
    snapshot: Num<{ id: string; inputsHash: string; createdAt: string }>;
  };
  signals: {
    adoption: Num<{ tasks: number; activeDays: number }>;
    illusoryWin: Num<{ count: number; rate: number }>;
    tokenAnomaly: Num<{ count: number; medianTokens: number; maxRatio: number }>;
  };
  verdict: { status: "coming_soon" };
}

export const REASON_LABEL: Record<string, string> = {
  missing_hourly_rate: "sem custo-hora cadastrado para o papel do agente",
  missing_fx_rate: "há valor em USD e nenhum câmbio informado",
  no_tasks: "nenhum evento com tarefa no período",
  no_accepted_tasks: "nenhuma tarefa aceita no período",
  no_events: "nenhum evento no período",
  no_contract: "agente sem contrato numérico (contrato pendente)",
  contract_metric_not_computed: "a métrica do contrato não é calculada pela camada 2",
  no_context_tokens: "eventos sem tokens de contexto",
  missing_price_table: "tabela de preços da Veltrix ainda não disponível",
  quality_goal_not_defined: "contrato sem meta de qualidade (acceptance_rate)",
  no_qualified_model: "nenhum modelo bateu a meta de qualidade do contrato",
  no_token_counts: "eventos sem contagem de tokens",
  no_expected_actual: "eventos sem esperado × obtido",
  too_few_tasks: "menos de 5 tarefas no período",
  no_trail_records: "nenhuma revisão ou aceite registrado na trilha",
  no_active_agent_key: "agente sem chave ativa",
  period_not_closed: "período ainda não fechado em snapshot",
};

const OWNER_LABEL: Record<string, string> = {
  business_owner: "dono de negócio",
  technical_owner: "dono técnico",
  governance_sponsor: "patrocinador de governança",
  contract_owner: "dono do contrato",
};

export interface Cell {
  label: string;
  text: string;
  unavailable: boolean;
  hint?: string;
}

export function reasonText(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const pctText = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function cell<T>(label: string, n: Num<T>, fmt: (v: T) => string, hint?: (v: T) => string | undefined): Cell {
  if (n.status === "ok") return { label, text: fmt(n.value), unavailable: false, hint: hint?.(n.value) };
  return { label, text: "Indisponível", unavailable: true, hint: reasonText(n.reason) };
}

export interface OutcomeView {
  headline: Cell;
  cost: Cell[];
  quality: Cell[];
  proof: Cell[];
  signals: Cell[];
  coverage: Cell;
  sourceLabel: string;
  empty: boolean;
}

export function outcomeView(o: OutcomePayload): OutcomeView {
  const c = o.layer1.cost;
  const headline = cell("Custo por resultado validado", c, (v) => brl(v.costPerValidatedTask.cents), (v) =>
    `${v.acceptedTasks} de ${v.tasks} tarefas aceitas · ${v.attempts} tentativas`,
  );
  const cost: Cell[] = [
    cell("Custo humano por tarefa", c, (v) => (v.humanCostPerTask ? brl(v.humanCostPerTask.cents) : "Sem referência"), (v) =>
      v.humanCostPerTask ? undefined : "contrato sem minutos humanos de referência",
    ),
    cell("Economia por tarefa", c, (v) =>
      v.breakEven ? `${brl(v.breakEven.savingsPerTask.cents)}${v.breakEven.savingsPercent === null ? "" : ` (${pctText(v.breakEven.savingsPercent)})`}` : "—",
    ),
    cell("Tokens · revisão · retrabalho · fora da fatura", c, (v) =>
      [v.breakdown.tokens, v.breakdown.review, v.breakdown.rework, v.breakdown.offInvoice].map((m) => brl(m.cents)).join(" · "),
    ),
    cell("Retry (tentativas > 1)", o.layer1.decomposition.retry, (v) => brl(v.cents), (v) => `${plural(v.tasksWithRetry, "tarefa", "tarefas")} com retry`),
    cell("Contexto", o.layer1.decomposition.context, (v) => `${Math.round(v.ratio * 100)}% dos tokens de entrada`),
    cell("Modelo superdimensionado", o.layer1.decomposition.model, (v) => brl(v.oversizeCents), (v) =>
      `referência ${v.referenceModel} (${v.source === "pinned" ? "fixado pela conta" : "mais barato aprovado"}) · preços ${v.priceVersion}`,
    ),
  ];
  const quality: Cell[] = [
    cell("Taxa de aceite", o.layer2.acceptanceRate, pctText),
    cell("Aceites automáticos", o.layer2.autoAcceptShare, pctText),
    cell("Intervenção humana", o.layer2.interventionRate, pctText),
    cell("Esperado × obtido", o.layer2.expectedMatchRate, pctText),
    cell("Contra o contrato", o.layer2.contract, (v) => `${v.value} (baseline ${v.baseline} → meta ${v.target})`, (v) =>
      `${v.metricKey} · v${v.contractVersion} · ${v.onTarget ? "na meta" : "fora da meta"}`,
    ),
  ];
  const proof: Cell[] = [
    cell("Proveniência", o.layer3.provenance, (v) => `${v.taskCount} tarefas · ${v.runCount} execuções`, (v) => v.sources.join(", ")),
    cell("Trilha", o.layer3.trail, (v) => `${v.records} registros`, (v) =>
      `${plural(v.humanReviews, "revisão humana", "revisões humanas")} · ${plural(v.autoAcceptances, "aceite auto", "aceites auto")}${v.ruleVersions.length ? ` (regras ${v.ruleVersions.join(", ")})` : ""}`,
    ),
    cell("Cobertura de dono", o.layer3.ownerCoverage, (v) => `${v.covered} de ${v.of}`, (v) =>
      v.missing.length ? `falta: ${v.missing.map((m) => OWNER_LABEL[m] ?? m).join(", ")}` : "completa",
    ),
    cell("Credencial", o.layer3.credentialCoverage, (v) => plural(v.activeKeys, "chave ativa", "chaves ativas"), (v) => v.environments.join(", ")),
    cell("Snapshot", o.layer3.snapshot, (v) => v.inputsHash.slice(0, 12), (v) => `fechado em ${v.createdAt.slice(0, 10)}`),
  ];
  const signals: Cell[] = [
    cell("Adoção", o.signals.adoption, (v) => `${v.tasks} tarefas`, (v) => `${v.activeDays} dias ativos`),
    cell("Vitória Ilusória", o.signals.illusoryWin, (v) => `${v.count} (${pctText(v.rate)})`, () => "sucesso técnico sem aceite"),
    cell("Anomalia de tokens", o.signals.tokenAnomaly, (v) => `${v.count} tarefas`, (v) => `> 3× a mediana (${v.medianTokens}); pico ${v.maxRatio}×`),
  ];
  return {
    headline,
    cost,
    quality,
    proof,
    signals,
    coverage: cell("Cobertura de tarefas", o.coverage, (v) => `${Math.round(v.ratio * 100)}%`, (v) =>
      `${v.eventsWithTask} de ${v.totalEvents} eventos com tarefa`,
    ),
    sourceLabel: o.source === "snapshot" ? `Snapshot fechado · ${o.calcVersion}` : `Cálculo ao vivo · ${o.calcVersion}`,
    empty: o.layer2.tasks === 0,
  };
}
