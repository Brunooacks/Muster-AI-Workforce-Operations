import React from "react";
import type {
  AgentValueMetric,
  AgentValueResponse,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/query-state";
import type { Lang } from "@/lib/i18n";

export const AGENT_VALUE_WINDOWS = ["7d", "30d", "90d"] as const;
export type AgentValueWindow = (typeof AGENT_VALUE_WINDOWS)[number];

type QueryError = { status?: number } | null | undefined;
type ValueCurrency = "BRL" | "USD";

const PANEL_I18N: Record<
  Lang,
  {
    analysisWindow: string;
    noCurrencyConversion: string;
    loading: string;
    agentNotFound: string;
    loadError: string;
    loadErrorDescription: string;
    retry: string;
    noTasks: string;
    submitValidation: string;
    noValidatedTasks: string;
    costPerValidatedTask: string;
    observedCost: string;
    insufficientEvidence: string;
    validationCount: (
      status: "validated" | "rejected" | "unvalidated",
      count: number,
    ) => string;
    tasksWithoutCurrency: (count: number) => string;
  }
> = {
  pt: {
    analysisWindow: "Janela de análise",
    noCurrencyConversion: "Sem conversão entre moedas",
    loading: "Carregando custo por tarefa validada",
    agentNotFound: "Agente não encontrado para este painel.",
    loadError: "Não foi possível carregar o custo por tarefa validada",
    loadErrorDescription:
      "Ocorreu um erro ao falar com o servidor. Verifique a conexão e tente novamente.",
    retry: "Tentar novamente",
    noTasks: "Ainda não há tarefas nesta janela.",
    submitValidation: "Como enviar validação",
    noValidatedTasks: "Ainda não há tarefa validada para calcular o custo.",
    costPerValidatedTask: "Custo por tarefa validada",
    observedCost: "Custo observado na janela",
    insufficientEvidence: "Sem evidência observada suficiente.",
    validationCount: (status, count) => {
      const labels = {
        validated: ["validada", "validadas"],
        rejected: ["rejeitada", "rejeitadas"],
        unvalidated: ["não validada", "não validadas"],
      } as const;
      const [singular, plural] = labels[status];
      return pluralize(count, singular, plural);
    },
    tasksWithoutCurrency: (count) =>
      `${pluralize(count, "tarefa sem moeda única", "tarefas sem moeda única")} não entra no cálculo.`,
  },
  en: {
    analysisWindow: "Analysis window",
    noCurrencyConversion: "No currency conversion",
    loading: "Loading cost per validated task",
    agentNotFound: "Agent not found for this panel.",
    loadError: "Could not load cost per validated task",
    loadErrorDescription:
      "There was a problem communicating with the server. Check your connection and try again.",
    retry: "Try again",
    noTasks: "There are no tasks in this window yet.",
    submitValidation: "How to submit validation",
    noValidatedTasks: "There is no validated task to calculate the cost yet.",
    costPerValidatedTask: "Cost per validated task",
    observedCost: "Observed cost in the window",
    insufficientEvidence: "There is not enough observed evidence yet.",
    validationCount: (status, count) => {
      const labels = {
        validated: ["validated task", "validated tasks"],
        rejected: ["rejected task", "rejected tasks"],
        unvalidated: ["unvalidated task", "unvalidated tasks"],
      } as const;
      const [singular, plural] = labels[status];
      return pluralize(count, singular, plural);
    },
    tasksWithoutCurrency: (count) =>
      `${pluralize(count, "task without a single currency", "tasks without a single currency")} are excluded from the calculation.`,
  },
  es: {
    analysisWindow: "Ventana de análisis",
    noCurrencyConversion: "Sin conversión entre monedas",
    loading: "Cargando el costo por tarea validada",
    agentNotFound: "Agente no encontrado para este panel.",
    loadError: "No fue posible cargar el costo por tarea validada",
    loadErrorDescription:
      "Ocurrió un error al comunicarse con el servidor. Verifica la conexión e inténtalo de nuevo.",
    retry: "Intentar de nuevo",
    noTasks: "Aún no hay tareas en esta ventana.",
    submitValidation: "Cómo enviar una validación",
    noValidatedTasks: "Aún no hay tarea validada para calcular el costo.",
    costPerValidatedTask: "Costo por tarea validada",
    observedCost: "Costo observado en la ventana",
    insufficientEvidence: "Aún no hay evidencia observada suficiente.",
    validationCount: (status, count) => {
      const labels = {
        validated: ["validada", "validadas"],
        rejected: ["rechazada", "rechazadas"],
        unvalidated: ["sin validar", "sin validar"],
      } as const;
      const [singular, plural] = labels[status];
      return pluralize(count, singular, plural);
    },
    tasksWithoutCurrency: (count) =>
      `${pluralize(count, "tarea sin una moneda única", "tareas sin una moneda única")} no entra en el cálculo.`,
  },
};

export interface AgentValuePanelProps {
  window: AgentValueWindow;
  data?: AgentValueResponse;
  isLoading?: boolean;
  isError?: boolean;
  error?: QueryError;
  lang?: Lang;
  onWindowChange?: (window: AgentValueWindow) => void;
  onRetry?: () => void;
}

function formatMoney(
  cents: number,
  currency: ValueCurrency,
  lang: Lang,
): string {
  const locale = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR";
  return (cents / 100).toLocaleString(locale, { style: "currency", currency });
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function AgentValuePanel({
  window,
  data,
  isLoading = false,
  isError = false,
  error,
  lang = "pt",
  onWindowChange,
  onRetry,
}: AgentValuePanelProps) {
  const validation = data?.validationByStatus;
  const taskCount = validation
    ? validation.validated + validation.rejected + validation.unvalidated
    : 0;
  const isEmpty = !data || taskCount === 0;
  const hasNoValidatedTasks = !isEmpty && validation!.validated === 0;
  const metrics = Object.entries(data?.metrics ?? {}) as [
    ValueCurrency,
    AgentValueMetric,
  ][];
  const t = PANEL_I18N[lang];

  return (
    <div className="workspace-panel rounded-xl border border-card-border bg-card/90">
      <div className="flex flex-col gap-3 border-b border-card-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex items-center gap-1.5"
          aria-label={t.analysisWindow}
        >
          {AGENT_VALUE_WINDOWS.map((item) => (
            <Button
              key={item}
              type="button"
              variant={item === window ? "secondary" : "ghost"}
              size="sm"
              className="font-mono text-xs"
              aria-pressed={item === window}
              onClick={() => onWindowChange?.(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t.noCurrencyConversion}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-6" role="status" aria-live="polite">
          <span className="sr-only">{t.loading}</span>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <div className="p-6">
          {error?.status === 404 ? (
            <div className="rounded-lg border border-dashed border-card-border p-6 text-center text-sm text-muted-foreground">
              {t.agentNotFound}
            </div>
          ) : (
            <ErrorState
              compact
              title={t.loadError}
              description={t.loadErrorDescription}
              retryLabel={t.retry}
              onRetry={onRetry}
            />
          )}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t.noTasks}</p>
          <a
            href="/docs/validacao-de-tarefas.html"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.submitValidation}
          </a>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          {hasNoValidatedTasks && (
            <p className="text-sm text-muted-foreground">
              {t.noValidatedTasks}
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {metrics.map(([currency, metric]) => (
              <div
                key={currency}
                className="rounded-lg border border-card-border bg-muted/20 p-4"
              >
                <p className="font-mono text-xs text-muted-foreground">
                  {currency}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.costPerValidatedTask}
                </p>
                {metric.status === "available" ? (
                  <>
                    <p className="mt-1 font-serif text-3xl font-medium tabular-nums">
                      {formatMoney(
                        metric.costPerValidatedTask.cents,
                        currency,
                        lang,
                      )}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.observedCost}:{" "}
                      {formatMoney(metric.totalCost.cents, currency, lang)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t.insufficientEvidence}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-card-border pt-4 text-sm text-muted-foreground">
            <span>{t.validationCount("validated", validation!.validated)}</span>
            <span>{t.validationCount("rejected", validation!.rejected)}</span>
            <span>
              {t.validationCount("unvalidated", validation!.unvalidated)}
            </span>
          </div>

          {data!.tasksWithoutCurrency.count > 0 && (
            <p className="rounded-md bg-chart-3/[0.08] px-3 py-2 text-xs text-muted-foreground">
              {t.tasksWithoutCurrency(data!.tasksWithoutCurrency.count)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
