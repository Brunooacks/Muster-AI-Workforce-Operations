export type CostCurrency = "BRL" | "USD";

export type ValidationStatus = "validated" | "rejected";
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
  outputCurrency: "BRL";
}

export interface MetricProvenance {
  kind: "observed" | "declared" | "derived";
  sources: string[];
  taskRunIds?: string[];
  formula?: string;
}

export interface MoneyMetric {
  cents: number;
  currency: "BRL";
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
  currency: "BRL";
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
  return input.tasks.some((task) => task.currency === "USD")
    || input.humanReference?.currency === "USD";
}

function toBrlCents(cents: number, currency: CostCurrency, fx?: ExchangeRate): number {
  return roundCents(currency === "BRL" ? cents : cents * fx!.usdToBrl);
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
    return { status: "insufficient_evidence", reason: "missing_human_reference" };
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
    return { status: "insufficient_evidence", reason: "no_observed_validations" };
  }

  const automatedAndCorrectionCost = input.tasks.reduce((sum, task) => (
    sum
      + toBrlCents(task.modelCostCents, task.currency, input.fx)
      + toBrlCents(task.correctionCostCents ?? 0, task.currency, input.fx)
  ), 0);
  const escalatedCost = input.humanReference
    ? toBrlCents(
      (input.humanReference.hourlyRateCents * totalEscalatedMinutes) / 60,
      input.humanReference.currency,
      input.fx,
    )
    : 0;
  const totalCostCents = automatedAndCorrectionCost + escalatedCost;

  const totalValidatedTasks = Object.values(validatedBySource)
    .reduce((sum, tasks) => sum + tasks.length, 0);
  const validationBySource = Object.fromEntries(
    (Object.entries(validatedBySource) as [ValidationSource, TaskCostInput[]][]).map(
      ([source, tasks]) => [source, {
        count: tasks.length,
        percent: roundPercent((tasks.length / totalValidatedTasks) * 100),
        provenance: provenance(
          source === "self_reported" ? "declared" : "observed",
          source === "self_reported" ? ["validation", "self_reported"] : ["validation"],
          tasks.map((task) => task.taskRunId),
        ),
      }],
    ),
  ) as Record<ValidationSource, ValidationSourceMetric>;

  const allTaskRunIds = input.tasks.map((task) => task.taskRunId);
  const totalCost: MoneyMetric = {
    cents: totalCostCents,
    currency: "BRL",
    provenance: provenance(
      "derived",
      input.humanReference ? ["task_input", "human_reference"] : ["task_input"],
      allTaskRunIds,
      "Σ custo do modelo + Σ custo de correção + Σ minutos escalonados × R$/h",
    ),
  };
  const costPerValidatedTask: MoneyMetric = {
    cents: roundCents(totalCostCents / observedValidatedTasks.length),
    currency: "BRL",
    provenance: provenance(
      "derived",
      ["task_input", "validation"],
      observedValidatedTasks.map((task) => task.taskRunId),
      "custo total ÷ tarefas validated com fonte observada",
    ),
  };

  const humanCostPerTask = input.humanReference
    ? {
      cents: toBrlCents(
        (input.humanReference.hourlyRateCents * input.humanReference.minutesPerTask) / 60,
        input.humanReference.currency,
        input.fx,
      ),
      currency: "BRL" as const,
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
      const savingsCents = humanCostPerTask.cents - costPerValidatedTask.cents;
      return {
        savingsPerTask: {
          cents: savingsCents,
          currency: "BRL" as const,
          provenance: provenance(
            "derived",
            ["manual_entry", "task_input", "validation"],
            observedValidatedTasks.map((task) => task.taskRunId),
            "custo humano por tarefa − custo por tarefa validada",
          ),
        },
        savingsPercent: humanCostPerTask.cents === 0
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
    currency: "BRL",
    totalCost,
    costPerValidatedTask,
    humanCostPerTask,
    breakEven,
    validationBySource,
    ...(input.fx ? {
      fx: {
        rate: input.fx.usdToBrl,
        date: input.fx.rateDate,
        source: input.fx.source,
      },
    } : {}),
  };
}
