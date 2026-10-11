import React from "react";
import type { AgentValueMetric, AgentValueResponse } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/query-state";

export const AGENT_VALUE_WINDOWS = ["7d", "30d", "90d"] as const;
export type AgentValueWindow = (typeof AGENT_VALUE_WINDOWS)[number];

type QueryError = { status?: number } | null | undefined;
type ValueCurrency = "BRL" | "USD";

export interface AgentValuePanelProps {
  window: AgentValueWindow;
  data?: AgentValueResponse;
  isLoading?: boolean;
  isError?: boolean;
  error?: QueryError;
  onWindowChange?: (window: AgentValueWindow) => void;
  onRetry?: () => void;
}

function formatMoney(cents: number, currency: ValueCurrency): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
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
  onWindowChange,
  onRetry,
}: AgentValuePanelProps) {
  const validation = data?.validationByStatus;
  const isEmpty = !data || validation?.validated === 0;
  const metrics = Object.entries(data?.metrics ?? {}) as [ValueCurrency, AgentValueMetric][];

  return (
    <div className="workspace-panel rounded-xl border border-card-border bg-card/90">
      <div className="flex flex-col gap-3 border-b border-card-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5" aria-label="Janela de análise">
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
        <p className="text-xs text-muted-foreground">Sem conversão entre moedas</p>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-6" role="status" aria-live="polite">
          <span className="sr-only">Carregando custo por tarefa validada</span>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <div className="p-6">
          {error?.status === 404 ? (
            <div className="rounded-lg border border-dashed border-card-border p-6 text-center text-sm text-muted-foreground">
              Agente não encontrado para este painel.
            </div>
          ) : (
            <ErrorState compact title="Não foi possível carregar o custo por tarefa validada" onRetry={onRetry} />
          )}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">Ainda não há tarefas validadas nesta janela.</p>
          <a
            href="/docs/validacao-de-tarefas.html"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Como enviar validação
          </a>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {metrics.map(([currency, metric]) => (
              <div key={currency} className="rounded-lg border border-card-border bg-muted/20 p-4">
                <p className="font-mono text-xs text-muted-foreground">{currency}</p>
                <p className="mt-2 text-xs text-muted-foreground">Custo por tarefa validada</p>
                {metric.status === "available" ? (
                  <>
                    <p className="mt-1 font-serif text-3xl font-medium tabular-nums">
                      {formatMoney(metric.costPerValidatedTask.cents, currency)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Custo observado na janela: {formatMoney(metric.totalCost.cents, currency)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Sem evidência observada suficiente.</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-card-border pt-4 text-sm text-muted-foreground">
            <span>{pluralize(validation!.validated, "validada", "validadas")}</span>
            <span>{pluralize(validation!.rejected, "rejeitada", "rejeitadas")}</span>
            <span>{pluralize(validation!.unvalidated, "não validada", "não validadas")}</span>
          </div>

          {data!.tasksWithoutCurrency.count > 0 && (
            <p className="rounded-md bg-chart-3/[0.08] px-3 py-2 text-xs text-muted-foreground">
              {pluralize(data!.tasksWithoutCurrency.count, "tarefa sem moeda única", "tarefas sem moeda única")} não entra no cálculo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
