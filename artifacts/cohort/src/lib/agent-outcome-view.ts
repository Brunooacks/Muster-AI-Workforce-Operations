/**
 * View-model da ficha do agente (MUS-195): desempenho vs humano equivalente em
 * primeiro plano, ganho líquido (descontando supervisão/retrabalho) e custo por
 * tarefa validada como métrica secundária. Puro: nunca inventa número neutro.
 */

export type Num<T> = { status: "ok"; value: T } | { status: "unavailable"; reason: string };

interface Money {
  cents: number;
}

export interface PerformancePayload {
  totalTasks: number;
  completedTasks: number;
  validatedTasks: number;
  resolvedAutonomouslyTasks: number;
  escalatedTasks: number;
  unnecessaryEscalationTasks: number;
  unnecessaryEscalationRate: Num<{ rate: number; unnecessaryTasks: number; escalatedTasks: number }>;
  accuracyRate: Num<number>;
  avgDeliveryMs: Num<{ avgMs: number; avgMinutes: number; tasksWithDuration: number }>;
  escalationReworkRate: Num<{ rate: number; affectedTasks: number; escalatedTasks: number; reworkTasks: number }>;
  humanSupervisionAndRework: Num<{
    supervisionMinutes: number;
    reworkMinutes: number;
    totalMinutes: number;
    totalHours: number;
  }>;
  humanBaseline: Num<{
    id: string;
    taskType: string;
    source: "agent_baseline" | "task_type_baseline" | "role_baseline";
    humanMinutesPerTask: number;
    humanAccuracyRate: number;
    humanEscalationRate: number;
    measurementKind: "measured" | "estimated";
    measuredAt: string | null;
    notes: string | null;
    deltas: {
      accuracyPp: number | null;
      speedup: number | null;
      timeSavedMinutesPerTask: number | null;
      escalationReworkPp: number | null;
      grossSavedHours: number | null;
      netSavedHours: number | null;
    };
  }>;
}

export interface OutcomePayload {
  agentId: string;
  taskType?: string | null;
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
  performance?: PerformancePayload;
  verdict: { status: "coming_soon" };
}

export const REASON_LABEL: Record<string, string> = {
  missing_hourly_rate: "sem custo-hora cadastrado para o papel do agente",
  missing_fx_rate: "há valor em USD e nenhum câmbio informado",
  no_tasks: "nenhum evento com tarefa no período",
  no_accepted_tasks: "nenhuma tarefa aceita no período",
  no_events: "nenhum evento no período",
  no_duration: "eventos sem duração registrada",
  no_human_baseline: "referência humana pré-implantação não configurada",
  no_contract: "agente sem contrato numérico (contrato pendente)",
  contract_metric_not_computed: "a métrica do contrato não é calculada pela camada 2",
  no_context_tokens: "eventos sem tokens de contexto",
  missing_price_table: "tabela de preços de referência ainda não disponível",
  quality_goal_not_defined: "contrato sem meta de qualidade (acceptance_rate)",
  no_qualified_model: "nenhum modelo bateu a meta de qualidade do contrato",
  no_token_counts: "eventos sem contagem de tokens",
  no_expected_actual: "eventos sem esperado × obtido",
  too_few_tasks: "menos de 5 tarefas no período",
  no_trail_records: "nenhuma revisão ou aceite registrado na trilha",
  no_active_agent_key: "agente sem chave ativa",
  period_not_closed: "período ainda não fechado",
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

export interface PerformanceCard {
  key: "validated_tasks" | "accuracy" | "delivery_time" | "escalation_rework";
  label: string;
  agentText: string;
  agentUnavailable: boolean;
  agentHint?: string;
  humanText: string;
  humanUnavailable: boolean;
  humanHint?: string;
  deltaText?: string;
  deltaTone?: "positive" | "negative" | "neutral";
}

export interface NetGainSummary {
  netText: string;
  grossText: string;
  supervisionText: string;
  detail: string;
  positive: boolean;
}

export function reasonText(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const pctText = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const numText = (v: number, digits = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: digits });

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${numText(ms / 1000, 1)} s`;
  return `${numText(ms / 60_000, 1)} min`;
}

function signedPp(delta: number): string {
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${numText(delta, 2)} p.p.`;
}

function cell<T>(label: string, n: Num<T>, fmt: (v: T) => string, hint?: (v: T) => string | undefined): Cell {
  if (n.status === "ok") return { label, text: fmt(n.value), unavailable: false, hint: hint?.(n.value) };
  return { label, text: "Indisponível", unavailable: true, hint: reasonText(n.reason) };
}

/** Fechamento do período: mês corrente aparece como "em andamento", não como falta. */
export function snapshotCell(period: string, n: OutcomePayload["layer3"]["snapshot"]): Cell {
  if (n.status !== "ok" && n.reason === "period_not_closed" && /^\d{4}-\d{2}$/.test(period)) {
    const [y, mo] = period.split("-").map(Number) as [number, number];
    const ny = mo === 12 ? y + 1 : y, nm = mo === 12 ? 1 : mo + 1;
    return { label: "Fechamento", text: "Mês em andamento", unavailable: false, hint: `fecha em 01/${String(nm).padStart(2, "0")}/${ny}` };
  }
  return cell("Fechamento", n, (v) => v.inputsHash.slice(0, 12), (v) => `fechado em ${v.createdAt.slice(0, 10)}`);
}

export interface OutcomeView {
  headline: Cell;
  performanceCards: PerformanceCard[];
  netGainSummary: NetGainSummary | null;
  baselineMeta: {
    configured: boolean;
    taskType: string | null;
    originLabel: string | null;
    notes: string | null;
  };
  cost: Cell[];
  quality: Cell[];
  proof: Cell[];
  signals: Cell[];
  coverage: Cell;
  sourceLabel: string;
  empty: boolean;
}

function buildPerformanceView(o: OutcomePayload): Pick<OutcomeView, "performanceCards" | "netGainSummary" | "baselineMeta"> {
  const perf = o.performance;
  const hb = perf?.humanBaseline;
  const hbVal = hb && hb.status === "ok" ? hb.value : null;
  const originLabel = hbVal
    ? hbVal.measurementKind === "measured"
      ? `Medido pré-implantação${hbVal.measuredAt ? ` · ${hbVal.measuredAt}` : ""}`
      : `Estimado${hbVal.measuredAt ? ` · ${hbVal.measuredAt}` : ""}`
    : null;

  const totalTasks = perf?.totalTasks ?? o.layer2.tasks;
  const completedTasks = perf?.completedTasks ?? o.layer2.tasks;
  const validatedTasks =
    perf?.validatedTasks ??
    (o.layer1.cost.status === "ok"
      ? o.layer1.cost.value.acceptedTasks
      : o.layer2.acceptanceRate.status === "ok"
        ? Math.round((o.layer2.acceptanceRate.value * o.layer2.tasks) / 100)
        : 0);
  const resolvedAutonomously = perf?.resolvedAutonomouslyTasks ?? 0;
  const escalatedTasks = perf?.escalatedTasks ?? 0;

  const accuracyNum = perf?.accuracyRate ?? o.layer2.acceptanceRate;
  const deliveryNum = perf?.avgDeliveryMs ?? ({ status: "unavailable", reason: "no_duration" } as const);
  const escalationNum = perf?.escalationReworkRate;
  const unnecessaryNum = perf?.unnecessaryEscalationRate;
  const supervisionNum = perf?.humanSupervisionAndRework;

  const cards: PerformanceCard[] = [
    {
      key: "validated_tasks",
      label: "Tarefas concluídas e validadas",
      agentText: totalTasks === 0 ? "Indisponível" : `${validatedTasks} validadas`,
      agentUnavailable: totalTasks === 0,
      agentHint:
        totalTasks === 0
          ? reasonText("no_tasks")
          : `${resolvedAutonomously} resolvidas sem escalar · ${escalatedTasks} encaminhadas ao humano · ${completedTasks}/${totalTasks} concluídas`,
      humanText: hbVal ? hbVal.taskType : o.taskType ? o.taskType : "Sem referência",
      humanUnavailable: !hbVal,
      humanHint: hbVal ? originLabel ?? undefined : reasonText("no_human_baseline"),
    },
    {
      key: "accuracy",
      label: "Taxa de acerto",
      agentText: accuracyNum.status === "ok" ? pctText(accuracyNum.value) : "Indisponível",
      agentUnavailable: accuracyNum.status !== "ok",
      agentHint: accuracyNum.status === "ok" ? `${validatedTasks} de ${totalTasks} tarefas validadas` : reasonText(accuracyNum.reason),
      humanText: hbVal ? pctText(hbVal.humanAccuracyRate) : "Não configurado",
      humanUnavailable: !hbVal,
      humanHint: hbVal ? "padrão humano equivalente" : reasonText("no_human_baseline"),
      deltaText:
        hbVal && hbVal.deltas.accuracyPp !== null ? `${signedPp(hbVal.deltas.accuracyPp)} vs humano` : undefined,
      deltaTone:
        hbVal && hbVal.deltas.accuracyPp !== null
          ? hbVal.deltas.accuracyPp >= 0
            ? "positive"
            : "negative"
          : "neutral",
    },
    {
      key: "delivery_time",
      label: "Tempo médio de entrega",
      agentText: deliveryNum.status === "ok" ? formatDurationMs(deliveryNum.value.avgMs) : "Indisponível",
      agentUnavailable: deliveryNum.status !== "ok",
      agentHint:
        deliveryNum.status === "ok"
          ? `${plural(deliveryNum.value.tasksWithDuration, "tarefa", "tarefas")} com duração medida`
          : reasonText(deliveryNum.reason),
      humanText: hbVal ? `${numText(hbVal.humanMinutesPerTask, 1)} min` : "Não configurado",
      humanUnavailable: !hbVal,
      humanHint: hbVal ? "tempo médio humano por tarefa" : reasonText("no_human_baseline"),
      deltaText:
        hbVal && hbVal.deltas.speedup !== null
          ? `${numText(hbVal.deltas.speedup, 1)}× mais rápido`
          : undefined,
      deltaTone:
        hbVal && hbVal.deltas.timeSavedMinutesPerTask !== null
          ? hbVal.deltas.timeSavedMinutesPerTask >= 0
            ? "positive"
            : "negative"
          : "neutral",
    },
    {
      key: "escalation_rework",
      label: "Escalonamento / retrabalho humano",
      agentText:
        escalationNum?.status === "ok"
          ? pctText(escalationNum.value.rate)
          : o.layer2.interventionRate.status === "ok"
            ? pctText(o.layer2.interventionRate.value)
            : "Indisponível",
      agentUnavailable: escalationNum ? escalationNum.status !== "ok" : o.layer2.interventionRate.status !== "ok",
      agentHint:
        escalationNum?.status === "ok"
          ? `${escalationNum.value.affectedTasks} de ${totalTasks} tarefas${
              unnecessaryNum?.status === "ok" && unnecessaryNum.value.escalatedTasks > 0
                ? ` · ${pctText(unnecessaryNum.value.rate)} desnecessários (${unnecessaryNum.value.unnecessaryTasks}/${unnecessaryNum.value.escalatedTasks})`
                : ""
            }`
          : reasonText(escalationNum?.reason ?? "no_tasks"),
      humanText: hbVal ? pctText(hbVal.humanEscalationRate) : "Não configurado",
      humanUnavailable: !hbVal,
      humanHint:
        supervisionNum?.status === "ok"
          ? `${numText(supervisionNum.value.totalHours, 2)} h de supervisão/retrabalho`
          : "sem supervisão registrada",
      deltaText:
        hbVal && hbVal.deltas.escalationReworkPp !== null
          ? `${signedPp(hbVal.deltas.escalationReworkPp)} vs humano`
          : undefined,
      deltaTone:
        hbVal && hbVal.deltas.escalationReworkPp !== null
          ? hbVal.deltas.escalationReworkPp <= 0
            ? "positive"
            : "negative"
          : "neutral",
    },
  ];

  let netGainSummary: NetGainSummary | null = null;
  if (hbVal && hbVal.deltas.netSavedHours !== null && hbVal.deltas.grossSavedHours !== null) {
    const supHours = supervisionNum?.status === "ok" ? supervisionNum.value.totalHours : 0;
    const net = hbVal.deltas.netSavedHours;
    netGainSummary = {
      netText: `${net > 0 ? "+" : ""}${numText(net, 2)} h`,
      grossText: `${numText(hbVal.deltas.grossSavedHours, 2)} h`,
      supervisionText: `${numText(supHours, 2)} h`,
      detail: `${numText(hbVal.deltas.grossSavedHours, 2)} h de ganho bruto − ${numText(supHours, 2)} h de supervisão e retrabalho humano`,
      positive: net >= 0,
    };
  }

  return {
    performanceCards: cards,
    netGainSummary,
    baselineMeta: {
      configured: Boolean(hbVal),
      taskType: hbVal?.taskType ?? o.taskType ?? null,
      originLabel,
      notes: hbVal?.notes ?? null,
    },
  };
}

export function outcomeView(o: OutcomePayload): OutcomeView {
  const c = o.layer1.cost;
  const headline = cell("Custo por resultado validado", c, (v) => brl(v.costPerValidatedTask.cents), (v) =>
    `${v.acceptedTasks} de ${v.tasks} tarefas aceitas · ${v.attempts} tentativas`,
  );
  const cost: Cell[] = [
    cell("Custo por tarefa validada", c, (v) => brl(v.costPerValidatedTask.cents), (v) =>
      `${v.acceptedTasks} de ${v.tasks} tarefas aceitas · ${v.attempts} tentativas`,
    ),
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
    cell("Contra o contrato", o.layer2.contract, (v) => `${v.value} (linha de base ${v.baseline} → meta ${v.target})`, (v) =>
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
    snapshotCell(o.period, o.layer3.snapshot),
  ];
  const signals: Cell[] = [
    cell("Adoção", o.signals.adoption, (v) => `${v.tasks} tarefas`, (v) => `${v.activeDays} dias ativos`),
    cell("Vitória Ilusória", o.signals.illusoryWin, (v) => `${v.count} (${pctText(v.rate)})`, () => "sucesso técnico sem aceite"),
    cell("Anomalia de tokens", o.signals.tokenAnomaly, (v) => `${v.count} tarefas`, (v) => `> 3× a mediana (${v.medianTokens}); pico ${v.maxRatio}×`),
  ];

  const { performanceCards, netGainSummary, baselineMeta } = buildPerformanceView(o);
  return {
    headline,
    performanceCards,
    netGainSummary,
    baselineMeta,
    cost,
    quality,
    proof,
    signals,
    coverage: cell("Cobertura de tarefas", o.coverage, (v) => `${Math.round(v.ratio * 100)}%`, (v) =>
      `${v.eventsWithTask} de ${v.totalEvents} eventos com tarefa`,
    ),
    sourceLabel: o.source === "snapshot" ? `Snapshot fechado · ${o.calcVersion}` : `Cálculo ao vivo · ${o.calcVersion}`,
    empty: (o.performance?.totalTasks ?? o.layer2.tasks) === 0,
  };
}
