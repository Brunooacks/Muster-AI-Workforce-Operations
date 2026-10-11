export type CostCurrency = "BRL" | "USD";

export type ValidationStatus = "validated" | "rejected" | "unvalidated";
export type ValidationSource = "human_review" | "connector" | "self_reported";

export interface TaskCostInput {
  taskRunId: string;
  modelCostCents: number;
  correctionCostCents?: number;
  escalatedMinutes?: number;
  currency: CostCurrency;
  validation: {
    status: ValidationStatus;
    source: ValidationSource;
  } | null;
}

export interface HumanCostReference {
  hourlyRateCents: number;
  minutesPerTask: number;
  currency: CostCurrency;
  declaredBy: string;
  declaredAt: string;
  source: "manual_entry";
}

export interface ExchangeRate {
  usdToBrl: number;
  rateDate: string;
  source: string;
}

export interface CostPerValidatedTaskInput {
  tasks: TaskCostInput[];
  humanReference?: HumanCostReference;
  fx?: ExchangeRate;
  outputCurrency: CostCurrency;
}

export interface MetricProvenance {
  kind: "observed" | "declared" | "derived";
  sources: string[];
  taskRunIds?: string[];
  formula?: string;
}

export interface MoneyMetric {
  cents: number;
  currency: CostCurrency;
  provenance: MetricProvenance;
}

export interface ValidationSourceMetric {
  count: number;
  percent: number;
  provenance: MetricProvenance;
}

export interface HumanCostPerTaskMetric extends MoneyMetric {
  declared: "manual_entry";
  declaredBy: string;
  declaredAt: string;
  source: "manual_entry";
}

export interface CostPerValidatedTaskAvailable {
  status: "available";
  currency: CostCurrency;
  totalCost: MoneyMetric;
  costPerValidatedTask: MoneyMetric;
  humanCostPerTask: HumanCostPerTaskMetric | null;
  breakEven: {
    savingsPerTask: MoneyMetric;
    savingsPercent: number | null;
    provenance: MetricProvenance;
  } | null;
  validationBySource: Record<ValidationSource, ValidationSourceMetric>;
  fx?: {
    rate: number;
    date: string;
    source: string;
  };
}

export interface CostPerValidatedTaskInsufficientEvidence {
  status: "insufficient_evidence";
  reason:
    | "missing_fx_rate"
    | "missing_human_reference"
    | "no_observed_validations";
}

export type CostPerValidatedTaskResult =
  | CostPerValidatedTaskAvailable
  | CostPerValidatedTaskInsufficientEvidence;

const OBSERVED_SOURCES = new Set<ValidationSource>([
  "human_review",
  "connector",
]);

function roundCents(value: number): number {
  return Math.round(value);
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function needsFx(input: CostPerValidatedTaskInput): boolean {
  return (
    input.tasks.some((task) => task.currency !== input.outputCurrency) ||
    input.humanReference?.currency !== undefined &&
      input.humanReference.currency !== input.outputCurrency
  );
}

function toOutputCents(
  cents: number,
  currency: CostCurrency,
  outputCurrency: CostCurrency,
  fx?: ExchangeRate,
): number {
  if (currency === outputCurrency) return roundCents(cents);
  return roundCents(
    outputCurrency === "BRL" ? cents * fx!.usdToBrl : cents / fx!.usdToBrl,
  );
}

function provenance(
  kind: MetricProvenance["kind"],
  sources: string[],
  taskRunIds?: string[],
  formula?: string,
): MetricProvenance {
  return {
    kind,
    sources,
    ...(taskRunIds?.length ? { taskRunIds } : {}),
    ...(formula ? { formula } : {}),
  };
}

/**
 * Prova de valor, não faturamento: agrega custos reais de todas as tarefas e
 * divide exclusivamente pelas tarefas com validação observada. Cada divisão e
 * conversão é arredondada ao centavo mais próximo para manter valores inteiros.
 */
export function calculateCostPerValidatedTask(
  input: CostPerValidatedTaskInput,
): CostPerValidatedTaskResult {
  if (needsFx(input) && !input.fx) {
    return { status: "insufficient_evidence", reason: "missing_fx_rate" };
  }

  const totalEscalatedMinutes = input.tasks.reduce(
    (sum, task) => sum + (task.escalatedMinutes ?? 0),
    0,
  );
  if (totalEscalatedMinutes > 0 && !input.humanReference) {
    return {
      status: "insufficient_evidence",
      reason: "missing_human_reference",
    };
  }

  const validatedBySource: Record<ValidationSource, TaskCostInput[]> = {
    human_review: [],
    connector: [],
    self_reported: [],
  };
  for (const task of input.tasks) {
    if (task.validation?.status === "validated") {
      validatedBySource[task.validation.source].push(task);
    }
  }

  const observedValidatedTasks = [
    ...validatedBySource.human_review,
    ...validatedBySource.connector,
  ];
  if (observedValidatedTasks.length === 0) {
    return {
      status: "insufficient_evidence",
      reason: "no_observed_validations",
    };
  }

  const automatedAndCorrectionCost = input.tasks.reduce(
    (sum, task) =>
      sum +
      toOutputCents(task.modelCostCents, task.currency, input.outputCurrency, input.fx) +
      toOutputCents(
        task.correctionCostCents ?? 0,
        task.currency,
        input.outputCurrency,
        input.fx,
      ),
    0,
  );
  const escalatedCost = input.humanReference
    ? toOutputCents(
        (input.humanReference.hourlyRateCents * totalEscalatedMinutes) / 60,
        input.humanReference.currency,
        input.outputCurrency,
        input.fx,
      )
    : 0;
  const totalCostCents = automatedAndCorrectionCost + escalatedCost;

  const validationBySource = Object.fromEntries(
    (
      Object.entries(validatedBySource) as [ValidationSource, TaskCostInput[]][]
    ).map(([source, tasks]) => [
      source,
      {
        count: tasks.length,
        // % sobre todas as tarefas do período (o painel mostra "% validada").
        percent: roundPercent((tasks.length / input.tasks.length) * 100),
        provenance: provenance(
          source === "self_reported" ? "declared" : "observed",
          source === "self_reported"
            ? ["validation", "self_reported"]
            : ["validation"],
          tasks.map((task) => task.taskRunId),
        ),
      },
    ]),
  ) as Record<ValidationSource, ValidationSourceMetric>;

  const allTaskRunIds = input.tasks.map((task) => task.taskRunId);
  const totalCost: MoneyMetric = {
    cents: totalCostCents,
    currency: input.outputCurrency,
    provenance: provenance(
      "derived",
      input.humanReference ? ["task_input", "human_reference"] : ["task_input"],
      allTaskRunIds,
      "Σ custo do modelo + Σ custo de correção + Σ minutos escalonados × R$/h",
    ),
  };
  const costPerValidatedTask: MoneyMetric = {
    cents: roundCents(totalCostCents / observedValidatedTasks.length),
    currency: input.outputCurrency,
    provenance: provenance(
      "derived",
      ["task_input", "validation"],
      observedValidatedTasks.map((task) => task.taskRunId),
      "custo total ÷ tarefas validated com fonte observada",
    ),
  };

  const humanCostPerTask = input.humanReference
    ? {
        cents: toOutputCents(
          (input.humanReference.hourlyRateCents *
            input.humanReference.minutesPerTask) /
            60,
          input.humanReference.currency,
          input.outputCurrency,
          input.fx,
        ),
        currency: input.outputCurrency,
        declared: "manual_entry" as const,
        declaredBy: input.humanReference.declaredBy,
        declaredAt: input.humanReference.declaredAt,
        source: "manual_entry" as const,
        provenance: provenance(
          "declared",
          ["manual_entry"],
          undefined,
          "valor-hora declarado × minutos por tarefa ÷ 60",
        ),
      }
    : null;

  const breakEven = humanCostPerTask
    ? (() => {
        const savingsCents =
          humanCostPerTask.cents - costPerValidatedTask.cents;
        return {
          savingsPerTask: {
            cents: savingsCents,
            currency: input.outputCurrency,
            provenance: provenance(
              "derived",
              ["manual_entry", "task_input", "validation"],
              observedValidatedTasks.map((task) => task.taskRunId),
              "custo humano por tarefa − custo por tarefa validada",
            ),
          },
          savingsPercent:
            humanCostPerTask.cents === 0
              ? null
              : roundPercent((savingsCents / humanCostPerTask.cents) * 100),
          provenance: provenance(
            "derived",
            ["manual_entry", "task_input", "validation"],
            observedValidatedTasks.map((task) => task.taskRunId),
            "economia por tarefa ÷ custo humano por tarefa × 100",
          ),
        };
      })()
    : null;

  return {
    status: "available",
    currency: input.outputCurrency,
    totalCost,
    costPerValidatedTask,
    humanCostPerTask,
    breakEven,
    validationBySource,
    ...(input.fx
      ? {
          fx: {
            rate: input.fx.usdToBrl,
            date: input.fx.rateDate,
            source: input.fx.source,
          },
        }
      : {}),
  };
}
