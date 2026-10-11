import {
  calculateCostPerValidatedTask,
  type CostCurrency,
  type CostPerValidatedTaskResult,
  type TaskCostInput,
  type ValidationSource,
  type ValidationStatus,
} from "./cost-per-validated-task";

const EXECUTION_KINDS = new Set(["execution", "error", "escalation"]);
const VALIDATION_STATUSES = new Set<ValidationStatus>([
  "validated",
  "rejected",
  "unvalidated",
]);
const VALIDATION_SOURCES = new Set<ValidationSource>([
  "human_review",
  "connector",
  "self_reported",
]);
const CURRENCIES = new Set<CostCurrency>(["BRL", "USD"]);

export interface TaskValueEvent {
  id: string;
  taskRunId: string | null;
  currency: string | null;
  kind: string;
  costCents: number | null;
  ts: Date;
  metadata: Record<string, unknown> | null;
}

export interface TaskValueAggregate {
  metrics: Partial<Record<CostCurrency, CostPerValidatedTaskResult>>;
  validationByStatus: Record<ValidationStatus, number>;
  tasksWithoutCurrency: {
    count: number;
    taskRunIds: string[];
  };
}

interface TaskEvents {
  executions: TaskValueEvent[];
  feedback: TaskValueEvent | null;
}

function validationFrom(metadata: Record<string, unknown> | null): TaskCostInput["validation"] {
  const validation = metadata?.validation;
  if (!validation || typeof validation !== "object") return null;
  const { status, source } = validation as Record<string, unknown>;
  if (
    typeof status !== "string" ||
    typeof source !== "string" ||
    !VALIDATION_STATUSES.has(status as ValidationStatus) ||
    !VALIDATION_SOURCES.has(source as ValidationSource)
  ) {
    return null;
  }
  return {
    status: status as ValidationStatus,
    source: source as ValidationSource,
  };
}

function isMoreRecent(candidate: TaskValueEvent, current: TaskValueEvent | null): boolean {
  return current === null || candidate.ts.getTime() > current.ts.getTime();
}

function isCostCurrency(currency: string | null): currency is CostCurrency {
  return currency !== null && CURRENCIES.has(currency as CostCurrency);
}

/**
 * Agrupa a telemetria já limitada à organização e janela solicitadas. Eventos
 * sem execução não representam uma tarefa de custo, mesmo que tragam feedback.
 */
export function aggregateTaskValue(events: TaskValueEvent[]): TaskValueAggregate {
  const byTaskRunId = new Map<string, TaskEvents>();
  for (const event of events) {
    if (!event.taskRunId) continue;
    const task = byTaskRunId.get(event.taskRunId) ?? {
      executions: [],
      feedback: null,
    };
    if (EXECUTION_KINDS.has(event.kind)) {
      task.executions.push(event);
    } else if (event.kind === "feedback" && isMoreRecent(event, task.feedback)) {
      task.feedback = event;
    }
    byTaskRunId.set(event.taskRunId, task);
  }

  const tasksByCurrency: Partial<Record<CostCurrency, TaskCostInput[]>> = {};
  const validationByStatus: Record<ValidationStatus, number> = {
    validated: 0,
    rejected: 0,
    unvalidated: 0,
  };
  const tasksWithoutCurrency: string[] = [];

  for (const [taskRunId, task] of byTaskRunId) {
    if (task.executions.length === 0) continue;
    const validation = validationFrom(task.feedback?.metadata ?? null);
    validationByStatus[validation?.status ?? "unvalidated"] += 1;

    const currencies = new Set(task.executions.map((event) => event.currency));
    const currency = task.executions[0]!.currency;
    if (currencies.size !== 1 || !isCostCurrency(currency)) {
      tasksWithoutCurrency.push(taskRunId);
      continue;
    }
    const input: TaskCostInput = {
      taskRunId,
      modelCostCents: task.executions.reduce(
        (sum, event) => sum + (event.costCents ?? 0),
        0,
      ),
      currency,
      validation,
    };
    (tasksByCurrency[currency] ??= []).push(input);
  }

  const metrics = Object.fromEntries(
    (Object.entries(tasksByCurrency) as [CostCurrency, TaskCostInput[]][]).map(
      ([currency, tasks]) => [
        currency,
        calculateCostPerValidatedTask({ tasks, outputCurrency: currency }),
      ],
    ),
  ) as TaskValueAggregate["metrics"];

  return {
    metrics,
    validationByStatus,
    tasksWithoutCurrency: {
      count: tasksWithoutCurrency.length,
      taskRunIds: tasksWithoutCurrency,
    },
  };
}
