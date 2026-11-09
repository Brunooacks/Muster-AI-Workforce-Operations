import {
  calculateCostPerValidatedTask,
  countsAsAccepted,
  type AcceptanceKind,
  type CostCurrency,
  type CostPerValidatedTaskAvailable,
  type CostUnavailableReason,
  type ExchangeRate,
  type HourlyRateInput,
  type TaskCostInput,
} from "./value/cost-per-validated-task";

/**
 * Camadas de resultado da cunha (C4.2, MUS-177). Tudo aqui é puro e parte de
 * `OutcomeInputs`, um objeto serializável: o snapshot (0026) guarda os inputs e
 * reproduz o cálculo sem ler outra tabela. Fórmula em specs/004-cunha/formula.md.
 *
 * Cada número sai como `{ status: "ok", value }` ou
 * `{ status: "unavailable", reason }` — nunca um valor neutro inventado.
 */

export const CALC_VERSION = "cunha-1";

export type Num<T> = { status: "ok"; value: T } | { status: "unavailable"; reason: string };
const ok = <T>(value: T): Num<T> => ({ status: "ok", value });
const na = <T>(reason: string): Num<T> => ({ status: "unavailable", reason });

// --- Normalização: eventos → tarefas ------------------------------------------

export interface OutcomeEventRow {
  id: string;
  kind: string;
  ts: Date | string;
  taskId: string | null;
  runId: string | null;
  attempt: number | null;
  costCents: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  contextTokens: number | null;
  model: string | null;
  capabilities: { tools?: boolean; vision?: boolean; contextWindow?: number } | null;
  success: boolean | null;
  expected: unknown;
  actual: unknown;
  acceptedBy: string | null;
  acceptedByKind: AcceptanceKind | null;
  acceptedRuleVersion: string | null;
  humanMinutes: number | null;
  reworkCount: number | null;
}

export interface AttemptRecord {
  runId: string;
  attempt: number;
  costCents: number;
  tokensIn: number | null;
  tokensOut: number | null;
  contextTokens: number | null;
  model: string | null;
  capabilities: { tools?: boolean; vision?: boolean; contextWindow?: number } | null;
  success: boolean | null;
}

export interface TaskRecord {
  taskId: string;
  attempts: AttemptRecord[];
  reviewMinutes: number;
  reworkMinutes: number;
  reworkCount: number;
  humanReviews: number;
  acceptance: { kind: AcceptanceKind; by: string | null; ruleVersion: string | null } | null;
  rejected: boolean;
  /** Esperado × obtido da última tentativa (null = sem os dois lados). */
  expectedMatch: boolean | null;
  /** Dias (YYYY-MM-DD) com evento da tarefa. */
  days: string[];
}

const TERMINAL = new Set(["execution", "error"]);

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  return `{${entries.sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

/** JSON com chaves ordenadas: base do inputs_hash. */
export function stableStringify(value: unknown): string {
  return stable(value);
}

const iso = (ts: Date | string) => (typeof ts === "string" ? ts : ts.toISOString());

export function normalizeTasks(events: readonly OutcomeEventRow[]): {
  tasks: TaskRecord[];
  coverage: { eventsWithTask: number; totalEvents: number };
} {
  // Heartbeat não é trabalho: fica fora da cobertura (D-C4).
  const work = events.filter((e) => e.kind !== "heartbeat");
  const byTask = new Map<string, OutcomeEventRow[]>();
  for (const e of work) {
    if (!e.taskId) continue;
    const list = byTask.get(e.taskId) ?? [];
    list.push(e);
    byTask.set(e.taskId, list);
  }

  const tasks: TaskRecord[] = [];
  for (const [taskId, list] of [...byTask.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...list].sort((a, b) => iso(a.ts).localeCompare(iso(b.ts)) || a.id.localeCompare(b.id));
    const attempts: AttemptRecord[] = sorted
      .filter((e) => TERMINAL.has(e.kind) && e.runId && e.attempt)
      .map((e) => ({
        runId: e.runId!,
        attempt: e.attempt!,
        costCents: e.costCents ?? 0,
        tokensIn: e.tokensIn,
        tokensOut: e.tokensOut,
        contextTokens: e.contextTokens,
        model: e.model,
        capabilities: e.capabilities,
        success: e.success,
      }))
      .sort((a, b) => a.attempt - b.attempt);

    let human: { approved: boolean; by: string | null } | null = null;
    let auto: { by: string | null; ruleVersion: string | null } | null = null;
    let reviewMinutes = 0;
    let reworkMinutes = 0;
    let reworkCount = 0;
    let humanReviews = 0;
    for (const e of sorted) {
      if (e.kind === "human_review") {
        humanReviews += 1;
        reviewMinutes += e.humanMinutes ?? 0;
        human = { approved: e.success === true, by: e.acceptedBy };
        continue;
      }
      reworkMinutes += e.humanMinutes ?? 0;
      reworkCount = Math.max(reworkCount, e.reworkCount ?? 0);
      if (e.acceptedByKind === "human") human = { approved: true, by: e.acceptedBy };
      else if (e.acceptedByKind === "auto") auto = { by: e.acceptedBy, ruleVersion: e.acceptedRuleVersion };
    }
    // Decisão humana prevalece sobre aceite automático.
    const acceptance = human
      ? human.approved
        ? { kind: "human" as const, by: human.by, ruleVersion: null }
        : null
      : auto
        ? { kind: "auto" as const, by: auto.by, ruleVersion: auto.ruleVersion }
        : null;

    const last = [...sorted].reverse().find((e) => TERMINAL.has(e.kind));
    const expectedMatch =
      last && last.expected !== null && last.expected !== undefined && last.actual !== null && last.actual !== undefined
        ? stable(last.expected) === stable(last.actual)
        : null;

    tasks.push({
      taskId,
      attempts,
      reviewMinutes: Math.round(reviewMinutes * 100) / 100,
      reworkMinutes: Math.round(reworkMinutes * 100) / 100,
      reworkCount,
      humanReviews,
      acceptance,
      rejected: human !== null && !human.approved,
      expectedMatch,
      days: [...new Set(sorted.map((e) => iso(e.ts).slice(0, 10)))].sort(),
    });
  }

  return {
    tasks,
    coverage: { eventsWithTask: work.filter((e) => e.taskId).length, totalEvents: work.length },
  };
}

// --- Custos fora da fatura ------------------------------------------------------

export interface OffInvoiceCostRow {
  id: string;
  projectId: string | null;
  agentId: string | null;
  amountCents: number;
  currency: CostCurrency;
  periodStart: string;
  periodEnd: string;
  allocation: "agent" | "project" | "per_task";
}

function dayNumber(d: string): number {
  return Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
}

/**
 * Parte de cada custo que cabe ao agente no período: pró-rata pelos dias de
 * sobreposição e, nos rateios, pela fatia de tarefas do agente.
 */
export function allocateOffInvoice(input: {
  costs: readonly OffInvoiceCostRow[];
  period: { start: string; end: string };
  agentId: string;
  projectId: string;
  agentTasks: number;
  projectTasks: number;
  orgTasks: number;
  fx: ExchangeRate | null;
}): { cents: number; itemIds: string[]; missingFx: boolean } {
  let cents = 0;
  const itemIds: string[] = [];
  let missingFx = false;
  for (const c of input.costs) {
    const start = Math.max(dayNumber(c.periodStart), dayNumber(input.period.start));
    const end = Math.min(dayNumber(c.periodEnd), dayNumber(input.period.end));
    if (end < start) continue;
    const prorate = (end - start + 1) / (dayNumber(c.periodEnd) - dayNumber(c.periodStart) + 1);
    let share = 0;
    if (c.allocation === "agent") share = c.agentId === input.agentId ? 1 : 0;
    else if (c.allocation === "project" || (c.allocation === "per_task" && c.projectId)) {
      share = c.projectId === input.projectId && input.projectTasks > 0 ? input.agentTasks / input.projectTasks : 0;
    } else share = input.orgTasks > 0 ? input.agentTasks / input.orgTasks : 0;
    if (share === 0) continue;
    if (c.currency === "USD" && !input.fx) {
      missingFx = true;
      continue;
    }
    const brl = c.currency === "USD" ? c.amountCents * input.fx!.usdToBrl : c.amountCents;
    cents += brl * prorate * share;
    itemIds.push(c.id);
  }
  return { cents: Math.round(cents), itemIds, missingFx };
}

// --- Modelo de referência (D-C1) ----------------------------------------------

export interface PriceTableModel {
  model: string;
  inputCentsPerMTok: number;
  outputCentsPerMTok: number;
  currency: CostCurrency;
  capabilities: { tools: boolean; vision: boolean; contextWindow: number };
}

export interface PriceTable {
  version: string;
  models: PriceTableModel[];
}

export interface RequiredCapabilities {
  tools: boolean;
  vision: boolean;
  contextWindow: number;
}

export function requiredCapabilities(tasks: readonly TaskRecord[]): RequiredCapabilities {
  const caps = tasks.flatMap((t) => t.attempts.map((a) => a.capabilities).filter((c) => c !== null));
  return {
    tools: caps.some((c) => c!.tools === true),
    vision: caps.some((c) => c!.vision === true),
    contextWindow: Math.max(0, ...caps.map((c) => c!.contextWindow ?? 0), ...tasks.flatMap((t) => t.attempts.map((a) => a.contextTokens ?? 0))),
  };
}

export type ReferenceModel = Num<{ model: string; source: "pinned" | "cheapest_qualified"; price: PriceTableModel | null }>;

export function selectReferenceModel(input: {
  pinned: string | null;
  priceTable: PriceTable | null;
  required: RequiredCapabilities;
  qualified: readonly string[];
}): ReferenceModel {
  if (input.pinned) {
    const price = input.priceTable?.models.find((m) => m.model === input.pinned) ?? null;
    return ok({ model: input.pinned, source: "pinned", price });
  }
  if (!input.priceTable) return na("missing_price_table");
  const fits = input.priceTable.models.filter(
    (m) =>
      (!input.required.tools || m.capabilities.tools) &&
      (!input.required.vision || m.capabilities.vision) &&
      m.capabilities.contextWindow >= input.required.contextWindow &&
      input.qualified.includes(m.model),
  );
  if (fits.length === 0) return na("no_qualified_model");
  const cheapest = [...fits].sort(
    (a, b) => a.inputCentsPerMTok + a.outputCentsPerMTok - (b.inputCentsPerMTok + b.outputCentsPerMTok) || a.model.localeCompare(b.model),
  )[0]!;
  return ok({ model: cheapest.model, source: "cheapest_qualified", price: cheapest });
}

// --- Entradas e cálculo --------------------------------------------------------

export interface OutcomeContract {
  id: string;
  version: number;
  metricKey: string;
  unit: string;
  direction: "up" | "down";
  baseline: number;
  target: number;
  referenceHumanMinutes: number | null;
  requireHumanAccept: boolean;
  referenceModel: string | null;
}

export interface OutcomeInputs {
  calcVersion: string;
  agentId: string;
  period: { start: string; end: string };
  tasks: TaskRecord[];
  coverage: { eventsWithTask: number; totalEvents: number };
  contract: OutcomeContract | null;
  hourlyRate: HourlyRateInput | null;
  offInvoice: { cents: number; itemIds: string[]; missingFx: boolean };
  priceTable: PriceTable | null;
  fx: ExchangeRate | null;
}

/** Métricas que a camada 2 calcula e que um contrato pode usar como meta. */
export const COMPUTED_METRIC_KEYS = [
  "acceptance_rate",
  "intervention_rate",
  "expected_match_rate",
  "cost_per_validated_task",
] as const;

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const pct = (num: number, den: number) => (den === 0 ? null : round((num / den) * 100));

export interface ContractComparison {
  metricKey: string;
  value: number;
  baseline: number;
  target: number;
  direction: "up" | "down";
  onTarget: boolean;
  /** 0..1 do baseline até a meta (null se baseline = meta). */
  progress: number | null;
  contractId: string;
  contractVersion: number;
}

export function compareWithContract(contract: OutcomeContract, value: number): ContractComparison {
  const span = contract.target - contract.baseline;
  const progress = span === 0 ? null : Math.min(1, Math.max(0, (value - contract.baseline) / span));
  return {
    metricKey: contract.metricKey,
    value,
    baseline: contract.baseline,
    target: contract.target,
    direction: contract.direction,
    onTarget: contract.direction === "up" ? value >= contract.target : value <= contract.target,
    progress: progress === null ? null : round(progress, 4),
    contractId: contract.id,
    contractVersion: contract.version,
  };
}

function modelAcceptance(tasks: readonly TaskRecord[], requireHumanAccept: boolean) {
  const byModel = new Map<string, { tasks: number; accepted: number }>();
  for (const t of tasks) {
    const model = t.attempts.at(-1)?.model;
    if (!model) continue;
    const m = byModel.get(model) ?? { tasks: 0, accepted: 0 };
    m.tasks += 1;
    if (countsAsAccepted(t, requireHumanAccept)) m.accepted += 1;
    byModel.set(model, m);
  }
  return byModel;
}

export interface OutcomeResult {
  calcVersion: string;
  agentId: string;
  period: { start: string; end: string };
  coverage: Num<{ ratio: number; eventsWithTask: number; totalEvents: number }>;
  layer1: {
    cost: Num<CostPerValidatedTaskAvailable>;
    decomposition: {
      retry: Num<{ cents: number; share: number; tasksWithRetry: number }>;
      context: Num<{ ratio: number; contextTokens: number; tokensIn: number }>;
      model: Num<{ referenceModel: string; source: "pinned" | "cheapest_qualified"; oversizeCents: number; priceVersion: string }>;
    };
    referenceModel: ReferenceModel;
  };
  layer2: {
    tasks: number;
    acceptanceRate: Num<number>;
    interventionRate: Num<number>;
    autoAcceptShare: Num<number>;
    expectedMatchRate: Num<number>;
    contract: Num<ContractComparison>;
  };
  signals: {
    adoption: Num<{ tasks: number; activeDays: number }>;
    illusoryWin: Num<{ count: number; rate: number }>;
    tokenAnomaly: Num<{ count: number; medianTokens: number; maxRatio: number }>;
  };
}

const UNAVAILABLE_MESSAGES: Record<CostUnavailableReason, string> = {
  missing_fx_rate: "missing_fx_rate",
  missing_hourly_rate: "missing_hourly_rate",
  no_tasks: "no_tasks",
  no_accepted_tasks: "no_accepted_tasks",
};

export function computeOutcome(inputs: OutcomeInputs): OutcomeResult {
  const { tasks, contract } = inputs;
  const requireHumanAccept = contract?.requireHumanAccept ?? false;
  const fx = inputs.fx ?? undefined;

  // Camada 1 · custo por resultado validado.
  const costInput: TaskCostInput[] = tasks.map((t) => ({
    taskId: t.taskId,
    attempts: t.attempts.map((a) => ({ runId: a.runId, attempt: a.attempt, costCents: a.costCents, currency: "BRL" as const })),
    reviewMinutes: t.reviewMinutes,
    reworkMinutes: t.reworkMinutes,
    acceptance: t.acceptance,
  }));
  const costResult = inputs.offInvoice.missingFx
    ? ({ status: "insufficient_evidence", reason: "missing_fx_rate" } as const)
    : calculateCostPerValidatedTask({
        tasks: costInput,
        hourlyRate: inputs.hourlyRate,
        humanReference:
          contract && contract.referenceHumanMinutes !== null
            ? { minutesPerTask: contract.referenceHumanMinutes, contractId: contract.id, contractVersion: contract.version }
            : null,
        requireHumanAccept,
        offInvoice: { cents: inputs.offInvoice.cents, itemIds: inputs.offInvoice.itemIds },
        fx,
        outputCurrency: "BRL",
      });
  const cost: Num<CostPerValidatedTaskAvailable> =
    costResult.status === "available" ? ok(costResult) : na(UNAVAILABLE_MESSAGES[costResult.reason]);

  const allAttempts = tasks.flatMap((t) => t.attempts);
  const tokensCents = allAttempts.reduce((s, a) => s + a.costCents, 0);
  const retryAttempts = allAttempts.filter((a) => a.attempt > 1);
  const retry: OutcomeResult["layer1"]["decomposition"]["retry"] =
    allAttempts.length === 0
      ? na("no_tasks")
      : ok({
          cents: retryAttempts.reduce((s, a) => s + a.costCents, 0),
          share: tokensCents === 0 ? 0 : round(retryAttempts.reduce((s, a) => s + a.costCents, 0) / tokensCents, 4),
          tasksWithRetry: tasks.filter((t) => t.attempts.length > 1).length,
        });

  const withContext = allAttempts.filter((a) => a.contextTokens !== null && a.tokensIn !== null && a.tokensIn > 0);
  const contextTokens = withContext.reduce((s, a) => s + a.contextTokens!, 0);
  const tokensIn = withContext.reduce((s, a) => s + a.tokensIn!, 0);
  const context: OutcomeResult["layer1"]["decomposition"]["context"] =
    withContext.length === 0 ? na("no_context_tokens") : ok({ ratio: round(contextTokens / tokensIn, 4), contextTokens, tokensIn });

  // Modelo de referência: qualificado = taxa de aceite do modelo ≥ meta de
  // qualidade do contrato (métrica acceptance_rate). Sem essa meta, ninguém
  // está qualificado e o padrão fica "indisponível" (D-C1).
  const qualityGoal = contract?.metricKey === "acceptance_rate" ? contract.target : null;
  const qualified =
    qualityGoal === null
      ? []
      : [...modelAcceptance(tasks, requireHumanAccept).entries()]
          .filter(([, m]) => m.tasks > 0 && (m.accepted / m.tasks) * 100 >= qualityGoal)
          .map(([model]) => model);
  const referenceModel = selectReferenceModel({
    pinned: contract?.referenceModel ?? null,
    priceTable: inputs.priceTable,
    required: requiredCapabilities(tasks),
    qualified,
  });
  let model: OutcomeResult["layer1"]["decomposition"]["model"];
  if (referenceModel.status !== "ok") {
    model = na(qualityGoal === null && referenceModel.reason === "no_qualified_model" ? "quality_goal_not_defined" : referenceModel.reason);
  } else if (!referenceModel.value.price || !inputs.priceTable) {
    model = na("missing_price_table");
  } else if (referenceModel.value.price.currency === "USD" && !fx) {
    model = na("missing_fx_rate");
  } else {
    const price = referenceModel.value.price;
    const toBrl = (c: number) => (price.currency === "USD" ? c * fx!.usdToBrl : c);
    const priced = allAttempts.filter((a) => a.tokensIn !== null && a.tokensOut !== null);
    const oversize = priced.reduce((s, a) => {
      const atReference = toBrl((a.tokensIn! * price.inputCentsPerMTok + a.tokensOut! * price.outputCentsPerMTok) / 1_000_000);
      return s + Math.max(0, a.costCents - atReference);
    }, 0);
    model = priced.length === 0
      ? na("no_token_counts")
      : ok({
          referenceModel: referenceModel.value.model,
          source: referenceModel.value.source,
          oversizeCents: Math.round(oversize),
          priceVersion: inputs.priceTable.version,
        });
  }

  // Camada 2 · qualidade.
  const accepted = tasks.filter((t) => countsAsAccepted(t, requireHumanAccept));
  const autoAccepted = accepted.filter((t) => t.acceptance?.kind === "auto");
  const intervened = tasks.filter((t) => t.humanReviews > 0 || t.reworkMinutes > 0 || t.reworkCount > 0);
  const compared = tasks.filter((t) => t.expectedMatch !== null);
  const rate = (num: number, den: number, reason: string): Num<number> => {
    const v = pct(num, den);
    return v === null ? na(reason) : ok(v);
  };
  const layer2Values: Record<(typeof COMPUTED_METRIC_KEYS)[number], Num<number>> = {
    acceptance_rate: rate(accepted.length, tasks.length, "no_tasks"),
    intervention_rate: rate(intervened.length, tasks.length, "no_tasks"),
    expected_match_rate: rate(compared.filter((t) => t.expectedMatch).length, compared.length, "no_expected_actual"),
    cost_per_validated_task:
      cost.status === "ok" ? ok(round(cost.value.costPerValidatedTask.cents / 100)) : na(cost.reason),
  };
  let contractComparison: Num<ContractComparison>;
  if (!contract) contractComparison = na("no_contract");
  else if (!(COMPUTED_METRIC_KEYS as readonly string[]).includes(contract.metricKey)) contractComparison = na("contract_metric_not_computed");
  else {
    const v = layer2Values[contract.metricKey as (typeof COMPUTED_METRIC_KEYS)[number]];
    contractComparison = v.status === "ok" ? ok(compareWithContract(contract, v.value)) : na(v.reason);
  }

  // Sinais.
  const activeDays = new Set(tasks.flatMap((t) => t.days)).size;
  const technicalSuccess = tasks.filter((t) => t.attempts.at(-1)?.success === true);
  const illusory = technicalSuccess.filter((t) => !countsAsAccepted(t, requireHumanAccept));
  const tokensPerTask = tasks
    .map((t) => t.attempts.reduce((s, a) => s + (a.tokensIn ?? 0) + (a.tokensOut ?? 0), 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  let tokenAnomaly: OutcomeResult["signals"]["tokenAnomaly"];
  if (tokensPerTask.length < 5) tokenAnomaly = na("too_few_tasks");
  else {
    const mid = Math.floor(tokensPerTask.length / 2);
    const median = tokensPerTask.length % 2 ? tokensPerTask[mid]! : (tokensPerTask[mid - 1]! + tokensPerTask[mid]!) / 2;
    tokenAnomaly = ok({
      count: tokensPerTask.filter((n) => n > 3 * median).length,
      medianTokens: median,
      maxRatio: round(tokensPerTask.at(-1)! / median),
    });
  }

  const { eventsWithTask, totalEvents } = inputs.coverage;
  return {
    calcVersion: inputs.calcVersion,
    agentId: inputs.agentId,
    period: inputs.period,
    coverage: totalEvents === 0 ? na("no_events") : ok({ ratio: round(eventsWithTask / totalEvents, 4), eventsWithTask, totalEvents }),
    layer1: { cost, decomposition: { retry, context, model }, referenceModel },
    layer2: {
      tasks: tasks.length,
      acceptanceRate: layer2Values.acceptance_rate,
      interventionRate: layer2Values.intervention_rate,
      autoAcceptShare: rate(autoAccepted.length, accepted.length, "no_accepted_tasks"),
      expectedMatchRate: layer2Values.expected_match_rate,
      contract: contractComparison,
    },
    signals: {
      adoption: tasks.length === 0 ? na("no_tasks") : ok({ tasks: tasks.length, activeDays }),
      illusoryWin: technicalSuccess.length === 0 && tasks.length === 0
        ? na("no_tasks")
        : ok({ count: illusory.length, rate: pct(illusory.length, tasks.length) ?? 0 }),
      tokenAnomaly,
    },
  };
}
