/**
 * Custo por resultado validado (camada 1 da cunha · C4.1/C4.2, MUS-177).
 *
 * Base: `calculateCostPerValidatedTask` do PR #44 (MUS-171, commits 31effc5,
 * 9133750 e b7d3e3c). Ajustes da cunha:
 * - a unidade é a tarefa do envelope (`task_id`), e o custo soma **todas** as
 *   tentativas (`run_id`/`attempt`), não um `taskRunId` por linha;
 * - tarefa aceita = aceite humano, ou aceite `auto` com `accepted_rule_version`
 *   quando o contrato não exige aceite humano (D-C3); a fonte "autorrelato" do
 *   PR #44 deixa de existir (aceite sem regra versionada é recusado no ingest);
 * - custo-hora vem de `role_rates` (sem default, R4) e vale para revisão e
 *   retrabalho humanos; a referência humana usa `reference_human_minutes` do
 *   contrato vigente (D-C2);
 * - custos fora da fatura alocados entram no numerador.
 * Arredondamento ao centavo em cada conversão/divisão, como no original.
 */

export type CostCurrency = "BRL" | "USD";
export type AcceptanceKind = "human" | "auto";

export interface AttemptCostInput {
  runId: string;
  attempt: number;
  /** Custo de tokens da tentativa, em centavos da moeda do evento. */
  costCents: number;
  currency: CostCurrency;
}

export interface TaskCostInput {
  taskId: string;
  attempts: AttemptCostInput[];
  /** Minutos humanos de revisão (eventos human_review). */
  reviewMinutes: number;
  /** Minutos humanos de retrabalho (human_minutes dos demais eventos). */
  reworkMinutes: number;
  acceptance: { kind: AcceptanceKind; by: string | null; ruleVersion: string | null } | null;
}

export interface HourlyRateInput {
  rateId: string;
  hourlyCostCents: number;
  currency: CostCurrency;
  role: string;
  areaId: string | null;
}

export interface HumanReferenceInput {
  /** reference_human_minutes do contrato vigente. */
  minutesPerTask: number;
  contractId: string;
  contractVersion: number;
}

export interface ExchangeRate {
  usdToBrl: number;
  rateDate: string;
  source: string;
}

export interface CostPerValidatedTaskInput {
  tasks: TaskCostInput[];
  hourlyRate: HourlyRateInput | null;
  humanReference: HumanReferenceInput | null;
  requireHumanAccept: boolean;
  /** Custos fora da fatura já alocados ao agente no período (centavos BRL). */
  offInvoice: { cents: number; itemIds: string[] };
  fx?: ExchangeRate;
  outputCurrency: "BRL";
}

export interface MetricProvenance {
  kind: "observed" | "declared" | "derived";
  sources: string[];
  taskIds?: string[];
  runIds?: string[];
  formula?: string;
}

export interface MoneyMetric {
  cents: number;
  currency: "BRL";
  provenance: MetricProvenance;
}

export interface AcceptanceMetric {
  count: number;
  /** % sobre todas as tarefas do período. */
  percent: number;
  provenance: MetricProvenance;
}

export interface CostPerValidatedTaskAvailable {
  status: "available";
  currency: "BRL";
  tasks: number;
  acceptedTasks: number;
  attempts: number;
  totalCost: MoneyMetric;
  breakdown: {
    tokens: MoneyMetric;
    review: MoneyMetric;
    rework: MoneyMetric;
    offInvoice: MoneyMetric;
  };
  costPerValidatedTask: MoneyMetric;
  humanCostPerTask: MoneyMetric | null;
  breakEven: {
    savingsPerTask: MoneyMetric;
    savingsPercent: number | null;
    provenance: MetricProvenance;
  } | null;
  acceptanceByKind: Record<AcceptanceKind | "auto_not_counted", AcceptanceMetric>;
  hourlyRate: { rateId: string; hourlyCostCents: number; currency: CostCurrency };
  fx?: { rate: number; date: string; source: string };
}

export type CostUnavailableReason = "missing_fx_rate" | "missing_hourly_rate" | "no_tasks" | "no_accepted_tasks";

export interface CostPerValidatedTaskUnavailable {
  status: "insufficient_evidence";
  reason: CostUnavailableReason;
}

export type CostPerValidatedTaskResult = CostPerValidatedTaskAvailable | CostPerValidatedTaskUnavailable;

function roundCents(value: number): number {
  return Math.round(value);
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function needsFx(input: CostPerValidatedTaskInput): boolean {
  return (
    input.tasks.some((task) => task.attempts.some((a) => a.currency === "USD")) ||
    input.hourlyRate?.currency === "USD"
  );
}

function toBrlCents(cents: number, currency: CostCurrency, fx?: ExchangeRate): number {
  return roundCents(currency === "BRL" ? cents : cents * fx!.usdToBrl);
}

function provenance(
  kind: MetricProvenance["kind"],
  sources: string[],
  ids?: { taskIds?: string[]; runIds?: string[] },
  formula?: string,
): MetricProvenance {
  return {
    kind,
    sources,
    ...(ids?.taskIds?.length ? { taskIds: ids.taskIds } : {}),
    ...(ids?.runIds?.length ? { runIds: ids.runIds } : {}),
    ...(formula ? { formula } : {}),
  };
}

/** A tarefa conta como aceita? Aceite auto não conta se o contrato exige humano. */
export function countsAsAccepted(task: Pick<TaskCostInput, "acceptance">, requireHumanAccept: boolean): boolean {
  if (!task.acceptance) return false;
  if (task.acceptance.kind === "human") return true;
  return !requireHumanAccept && task.acceptance.ruleVersion !== null;
}

/**
 * Prova de valor, não faturamento: agrega o custo de todas as tentativas de
 * todas as tarefas do período e divide só pelas tarefas aceitas.
 */
export function calculateCostPerValidatedTask(input: CostPerValidatedTaskInput): CostPerValidatedTaskResult {
  if (input.tasks.length === 0) return { status: "insufficient_evidence", reason: "no_tasks" };
  if (needsFx(input) && !input.fx) return { status: "insufficient_evidence", reason: "missing_fx_rate" };
  if (!input.hourlyRate) return { status: "insufficient_evidence", reason: "missing_hourly_rate" };

  const accepted = input.tasks.filter((task) => countsAsAccepted(task, input.requireHumanAccept));
  if (accepted.length === 0) return { status: "insufficient_evidence", reason: "no_accepted_tasks" };

  const rate = input.hourlyRate;
  const minuteCost = (minutes: number) => toBrlCents((rate.hourlyCostCents * minutes) / 60, rate.currency, input.fx);

  const allTaskIds = input.tasks.map((t) => t.taskId);
  const allRunIds = input.tasks.flatMap((t) => t.attempts.map((a) => a.runId));
  const attempts = input.tasks.reduce((n, t) => n + t.attempts.length, 0);

  const tokensCents = input.tasks.reduce(
    (sum, t) => sum + t.attempts.reduce((s, a) => s + toBrlCents(a.costCents, a.currency, input.fx), 0),
    0,
  );
  const reviewMinutes = input.tasks.reduce((s, t) => s + t.reviewMinutes, 0);
  const reworkMinutes = input.tasks.reduce((s, t) => s + t.reworkMinutes, 0);
  const reviewCents = minuteCost(reviewMinutes);
  const reworkCents = minuteCost(reworkMinutes);
  const offInvoiceCents = roundCents(input.offInvoice.cents);
  const totalCostCents = tokensCents + reviewCents + reworkCents + offInvoiceCents;

  const money = (cents: number, p: MetricProvenance): MoneyMetric => ({ cents, currency: "BRL", provenance: p });
  const breakdown = {
    tokens: money(
      tokensCents,
      provenance("observed", ["agent_events.cost_cents"], { taskIds: allTaskIds, runIds: allRunIds }, "Σ custo de tokens de todas as tentativas"),
    ),
    review: money(
      reviewCents,
      provenance("derived", ["agent_events.human_minutes", "role_rates"], { taskIds: allTaskIds }, "Σ minutos de revisão × custo-hora ÷ 60"),
    ),
    rework: money(
      reworkCents,
      provenance("derived", ["agent_events.human_minutes", "role_rates"], { taskIds: allTaskIds }, "Σ minutos de retrabalho × custo-hora ÷ 60"),
    ),
    offInvoice: money(
      offInvoiceCents,
      provenance("declared", ["off_invoice_costs", ...input.offInvoice.itemIds], undefined, "custos fora da fatura alocados ao agente no período"),
    ),
  };

  const totalCost = money(
    totalCostCents,
    provenance(
      "derived",
      ["agent_events", "role_rates", "off_invoice_costs"],
      { taskIds: allTaskIds, runIds: allRunIds },
      "tokens + revisão + retrabalho + fora da fatura",
    ),
  );
  const acceptedIds = accepted.map((t) => t.taskId);
  const costPerValidatedTask = money(
    roundCents(totalCostCents / accepted.length),
    provenance("derived", ["agent_events", "acceptance"], { taskIds: acceptedIds }, "custo total ÷ tarefas aceitas"),
  );

  const byKind = (pred: (t: TaskCostInput) => boolean, kind: MetricProvenance["kind"]): AcceptanceMetric => {
    const tasks = input.tasks.filter(pred);
    return {
      count: tasks.length,
      percent: roundPercent((tasks.length / input.tasks.length) * 100),
      provenance: provenance(kind, ["agent_events.accepted_by_kind"], { taskIds: tasks.map((t) => t.taskId) }),
    };
  };
  const acceptanceByKind = {
    human: byKind((t) => t.acceptance?.kind === "human", "observed"),
    auto: byKind((t) => t.acceptance?.kind === "auto" && countsAsAccepted(t, input.requireHumanAccept), "observed"),
    auto_not_counted: byKind((t) => t.acceptance?.kind === "auto" && !countsAsAccepted(t, input.requireHumanAccept), "observed"),
  };

  const humanCostPerTask = input.humanReference
    ? money(
        minuteCost(input.humanReference.minutesPerTask),
        provenance(
          "declared",
          [`agent_contracts:${input.humanReference.contractId}@v${input.humanReference.contractVersion}`, `role_rates:${rate.rateId}`],
          undefined,
          "reference_human_minutes × custo-hora ÷ 60",
        ),
      )
    : null;

  const breakEven = humanCostPerTask
    ? (() => {
        const savingsCents = humanCostPerTask.cents - costPerValidatedTask.cents;
        const p = provenance(
          "derived",
          ["agent_contracts", "role_rates", "agent_events"],
          { taskIds: acceptedIds },
          "custo humano por tarefa − custo por tarefa aceita",
        );
        return {
          savingsPerTask: money(savingsCents, p),
          savingsPercent: humanCostPerTask.cents === 0 ? null : roundPercent((savingsCents / humanCostPerTask.cents) * 100),
          provenance: p,
        };
      })()
    : null;

  return {
    status: "available",
    currency: "BRL",
    tasks: input.tasks.length,
    acceptedTasks: accepted.length,
    attempts,
    totalCost,
    breakdown,
    costPerValidatedTask,
    humanCostPerTask,
    breakEven,
    acceptanceByKind,
    hourlyRate: { rateId: rate.rateId, hourlyCostCents: rate.hourlyCostCents, currency: rate.currency },
    ...(input.fx ? { fx: { rate: input.fx.usdToBrl, date: input.fx.rateDate, source: input.fx.source } } : {}),
  };
}
