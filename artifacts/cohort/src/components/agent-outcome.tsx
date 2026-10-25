import { useState } from "react";
import { useGetAgentOutcome, getGetAgentOutcomeQueryKey } from "@workspace/api-client-react";
import { Coins, Gauge, ShieldCheck, Radar, Hourglass } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { outcomeView, type Cell, type OutcomePayload } from "@/lib/agent-outcome-view";

/**
 * Página do agente nas três camadas (cunha · C12.2): Custo por resultado,
 * Qualidade e Prova, com a faixa de sinais separada. Número indisponível
 * mostra o motivo; nada é preenchido com valor neutro.
 */

function CellRow({ cell }: { cell: Cell }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-xs text-muted-foreground">{cell.label}</span>
      <span className="min-w-0 text-left sm:text-right">
        <span className={cn("block font-mono text-sm", cell.unavailable ? "text-muted-foreground" : "text-foreground")}>{cell.text}</span>
        {cell.hint && <span className="block break-words text-[11px] leading-snug text-muted-foreground">{cell.hint}</span>}
      </span>
    </div>
  );
}

function Block({ icon: Icon, title, cells, children }: { icon: LucideIcon; title: string; cells: Cell[]; children?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card/90 p-4 sm:p-5" aria-label={title}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
        <h3 className="font-serif text-lg font-medium leading-none tracking-tight">{title}</h3>
      </div>
      {children}
      <div className="divide-y divide-border">
        {cells.map((c) => <CellRow key={c.label} cell={c} />)}
      </div>
    </section>
  );
}

function monthsBack(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export function AgentOutcomePanel({ agentId }: { agentId: string }) {
  const months = monthsBack(6);
  const [period, setPeriod] = useState(months[0]!);
  const params = { period };
  const { data, isLoading, isError } = useGetAgentOutcome(agentId, params, {
    query: { queryKey: getGetAgentOutcomeQueryKey(agentId, params), enabled: !!agentId },
  });

  return (
    <div className="space-y-4" data-testid="agent-outcome">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-medium tracking-tight">Resultado validado</h2>
          <p className="text-xs text-muted-foreground">Só entram tarefas com task_id; cada número diz de onde veio.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Período
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-9 rounded-md border border-input bg-secondary/40 px-2 text-sm text-foreground"
          >
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError || !data ? (
        <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Resultado indisponível no momento.</p>
      ) : (
        <OutcomeBlocks view={outcomeView(data as unknown as OutcomePayload)} />
      )}
    </div>
  );
}

function OutcomeBlocks({ view }: { view: ReturnType<typeof outcomeView> }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{view.sourceLabel}</span>
        <span>
          {view.coverage.label}: <span className="font-mono text-foreground">{view.coverage.text}</span>
          {view.coverage.hint ? ` · ${view.coverage.hint}` : ""}
        </span>
      </div>
      {view.empty && (
        <p role="status" className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Nenhuma tarefa com task_id neste período. Envie taskId/runId/attempt pelo SDK para medir o resultado.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Block icon={Coins} title="Custo por resultado" cells={view.cost}>
          <div className="mb-1 border-b border-border pb-3">
            <div className={cn("font-serif text-3xl tabular-nums", view.headline.unavailable && "text-muted-foreground")}>{view.headline.text}</div>
            {view.headline.hint && <p className="mt-1 text-[11px] text-muted-foreground">{view.headline.hint}</p>}
          </div>
        </Block>
        <Block icon={Gauge} title="Qualidade" cells={view.quality} />
        <Block icon={ShieldCheck} title="Prova" cells={view.proof} />
      </div>
      <section aria-label="Sinais" className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Radar className="h-4 w-4 text-primary" strokeWidth={1.75} />
          <h3 className="text-sm font-medium">Sinais</h3>
        </div>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
          {view.signals.map((c) => <CellRow key={c.label} cell={c} />)}
        </div>
      </section>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Hourglass className="h-3.5 w-3.5" /> Veredito manter / ajustar / aposentar: em breve.
      </p>
    </>
  );
}
