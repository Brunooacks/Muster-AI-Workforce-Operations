import { useState } from "react";
import {
  useGetAgentOutcome,
  getGetAgentOutcomeQueryKey,
  useGetAgentHumanBaseline,
  getGetAgentHumanBaselineQueryKey,
  useSaveAgentHumanBaseline,
} from "@workspace/api-client-react";
import { Coins, Gauge, ShieldCheck, Radar, Hourglass, Users, SlidersHorizontal, Clock3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  outcomeView,
  type Cell,
  type OutcomePayload,
  type PerformanceCard,
} from "@/lib/agent-outcome-view";

/**
 * Ficha do agente (MUS-195): desempenho e produtividade lado a lado com o
 * humano equivalente (baseline pré-implantação por tipo de tarefa), ganho
 * líquido descontando supervisão/retrabalho e custo por tarefa validada como
 * métrica secundária.
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

function PerformanceComparisonCard({ card }: { card: PerformanceCard }) {
  const deltaClass =
    card.deltaTone === "positive"
      ? "bg-chart-1/15 text-chart-1"
      : card.deltaTone === "negative"
        ? "bg-chart-3/15 text-chart-3-text"
        : "bg-secondary text-muted-foreground";

  return (
    <article className="flex flex-col justify-between rounded-xl border border-border bg-card/90 p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</h3>
          {card.deltaText && (
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold", deltaClass)}>
              {card.deltaText}
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-b border-border pb-3">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Agente</span>
            <span
              className={cn(
                "mt-0.5 block font-serif text-2xl font-medium leading-tight tabular-nums",
                card.agentUnavailable && "text-base font-sans text-muted-foreground",
              )}
            >
              {card.agentText}
            </span>
          </div>
          <div className="border-l border-border pl-3">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Humano eq.</span>
            <span
              className={cn(
                "mt-0.5 block font-serif text-xl font-medium leading-tight tabular-nums",
                card.humanUnavailable && "text-sm font-sans text-muted-foreground",
              )}
            >
              {card.humanText}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 space-y-1 text-[11px] leading-snug text-muted-foreground">
        {card.agentHint && <p>{card.agentHint}</p>}
        {card.humanHint && <p className="text-muted-foreground/80">Ref. humana: {card.humanHint}</p>}
      </div>
    </article>
  );
}

function Block({ icon: Icon, title, subtitle, cells, children }: { icon: LucideIcon; title: string; subtitle?: string; cells: Cell[]; children?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card/90 p-4 sm:p-5" aria-label={title}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
          <h3 className="font-serif text-lg font-medium leading-none tracking-tight">{title}</h3>
        </div>
        {subtitle && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</span>}
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

interface BaselineFormState {
  taskType: string;
  humanMinutesPerTask: string;
  humanAccuracyRate: string;
  humanEscalationRate: string;
  measurementKind: "measured" | "estimated";
  measuredAt: string;
  scope: "task_type" | "agent";
  notes: string;
}

export function AgentOutcomePanel({ agentId }: { agentId: string }) {
  const { toast } = useToast();
  const months = monthsBack(6);
  const [period, setPeriod] = useState(months[0]!);
  const params = { period };
  const outcomeQueryKey = getGetAgentOutcomeQueryKey(agentId, params);
  const baselineQueryKey = getGetAgentHumanBaselineQueryKey(agentId);

  const { data, isLoading, isError } = useGetAgentOutcome(agentId, params, {
    query: { queryKey: outcomeQueryKey, enabled: !!agentId },
  });
  const { data: baselineCtx } = useGetAgentHumanBaseline(agentId, {
    query: { queryKey: baselineQueryKey, enabled: !!agentId },
  });
  const saveBaseline = useSaveAgentHumanBaseline();
  const [form, setForm] = useState<BaselineFormState | null>(null);

  const openBaselineModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    const resolved = baselineCtx?.resolved;
    setForm({
      taskType: resolved?.taskType ?? baselineCtx?.taskType ?? baselineCtx?.role ?? "",
      humanMinutesPerTask: resolved ? String(resolved.humanMinutesPerTask) : "",
      humanAccuracyRate: resolved ? String(resolved.humanAccuracyRate) : "",
      humanEscalationRate: resolved ? String(resolved.humanEscalationRate) : "",
      measurementKind: resolved?.measurementKind ?? "measured",
      measuredAt: resolved?.measuredAt ?? today,
      scope: resolved?.source === "agent_baseline" ? "agent" : "task_type",
      notes: resolved?.notes ?? "",
    });
  };

  const parsedMinutes = form ? Number(form.humanMinutesPerTask.replace(",", ".")) : Number.NaN;
  const parsedAccuracy = form ? Number(form.humanAccuracyRate.replace(",", ".")) : Number.NaN;
  const parsedEscalation = form ? Number(form.humanEscalationRate.replace(",", ".")) : Number.NaN;
  const formValid =
    form !== null &&
    form.taskType.trim().length > 0 &&
    Number.isFinite(parsedMinutes) &&
    parsedMinutes >= 0 &&
    Number.isFinite(parsedAccuracy) &&
    parsedAccuracy >= 0 &&
    parsedAccuracy <= 100 &&
    Number.isFinite(parsedEscalation) &&
    parsedEscalation >= 0 &&
    parsedEscalation <= 100 &&
    (form.measurementKind === "estimated" || /^\d{4}-\d{2}-\d{2}$/.test(form.measuredAt));

  const submitBaseline = () => {
    if (!form || !formValid) return;
    saveBaseline.mutate(
      {
        agentId,
        data: {
          taskType: form.taskType.trim(),
          humanMinutesPerTask: parsedMinutes,
          humanAccuracyRate: parsedAccuracy,
          humanEscalationRate: parsedEscalation,
          scope: form.scope,
          measurementKind: form.measurementKind,
          measuredAt: form.measuredAt.trim() || null,
          notes: form.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Referência humana salva" });
          setForm(null);
          void queryClient.invalidateQueries({ queryKey: outcomeQueryKey });
          void queryClient.invalidateQueries({ queryKey: baselineQueryKey });
        },
        onError: () => {
          toast({ title: "Não foi possível salvar a referência humana", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-4" data-testid="agent-outcome">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-medium tracking-tight">Desempenho vs humano equivalente</h2>
          <p className="text-xs text-muted-foreground">
            Produtividade, qualidade e autonomia a partir de tarefas ingeridas; custo aparece como métrica secundária.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={openBaselineModal}>
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            {baselineCtx?.resolved ? "Ajustar referência humana" : "Configurar referência humana"}
          </Button>
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
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError || !data ? (
        <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Desempenho indisponível no momento.</p>
      ) : (
        <OutcomeBlocks
          view={outcomeView(data as unknown as OutcomePayload)}
          onConfigureBaseline={openBaselineModal}
        />
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Referência humana pré-implantação</DialogTitle>
            <DialogDescription>
              Registre a linha de base humana por tipo de tarefa para comparar tempo, acerto, escalonamento e ganho líquido.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hb-task-type" className="text-xs">Tipo de tarefa</Label>
                <Input
                  id="hb-task-type"
                  list="org-task-types"
                  value={form.taskType}
                  onChange={(e) => setForm({ ...form, taskType: e.target.value })}
                  placeholder="Ex.: Triagem de chamado N1"
                />
                <datalist id="org-task-types">
                  {(baselineCtx?.orgBaselines ?? []).map((b) => (
                    <option key={b.id} value={b.taskType} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label htmlFor="hb-minutes" className="text-xs">Tempo humano (min/tarefa)</Label>
                <Input
                  id="hb-minutes"
                  inputMode="decimal"
                  value={form.humanMinutesPerTask}
                  onChange={(e) => setForm({ ...form, humanMinutesPerTask: e.target.value })}
                  placeholder="15"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hb-accuracy" className="text-xs">Taxa de acerto humana (%)</Label>
                <Input
                  id="hb-accuracy"
                  inputMode="decimal"
                  value={form.humanAccuracyRate}
                  onChange={(e) => setForm({ ...form, humanAccuracyRate: e.target.value })}
                  placeholder="88"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hb-escalation" className="text-xs">Escalonamento / retrabalho humano (%)</Label>
                <Input
                  id="hb-escalation"
                  inputMode="decimal"
                  value={form.humanEscalationRate}
                  onChange={(e) => setForm({ ...form, humanEscalationRate: e.target.value })}
                  placeholder="18"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hb-kind" className="text-xs">Origem da medição</Label>
                <select
                  id="hb-kind"
                  value={form.measurementKind}
                  onChange={(e) => setForm({ ...form, measurementKind: e.target.value as "measured" | "estimated" })}
                  className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground"
                >
                  <option value="measured">Medido pré-implantação</option>
                  <option value="estimated">Estimado</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="hb-date" className="text-xs">
                  Data da medição{form.measurementKind === "measured" ? " (obrigatória)" : " (opcional)"}
                </Label>
                <Input
                  id="hb-date"
                  type="date"
                  value={form.measuredAt}
                  onChange={(e) => setForm({ ...form, measuredAt: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hb-scope" className="text-xs">Aplicar a</Label>
                <select
                  id="hb-scope"
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value as "task_type" | "agent" })}
                  className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground"
                >
                  <option value="task_type">Tipo de tarefa na conta</option>
                  <option value="agent">Somente este agente</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hb-notes" className="text-xs">Observação / amostra pré-implantação</Label>
                <Input
                  id="hb-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ex.: Média de 200 chamados de outubro antes do agente"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={submitBaseline} disabled={!formValid || saveBaseline.isPending}>
              Salvar referência humana
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OutcomeBlocks({
  view,
  onConfigureBaseline,
}: {
  view: ReturnType<typeof outcomeView>;
  onConfigureBaseline: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{view.sourceLabel}</span>
        <span>
          {view.coverage.label}: <span className="font-mono text-foreground">{view.coverage.text}</span>
          {view.coverage.hint ? ` · ${view.coverage.hint}` : ""}
        </span>
        {view.baselineMeta.configured && view.baselineMeta.originLabel && (
          <span>
            Referência humana ({view.baselineMeta.taskType}):{" "}
            <span className="font-medium text-foreground">{view.baselineMeta.originLabel}</span>
          </span>
        )}
      </div>

      {view.empty && (
        <p role="status" className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Nenhuma tarefa identificada neste período. Envie os identificadores da tarefa, da execução e da tentativa para medir o desempenho do agente.
        </p>
      )}

      {!view.baselineMeta.configured && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-secondary/25 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            <span>
              Referência humana pré-implantação ainda não configurada para este tipo de tarefa. Cadastre para liberar a comparação lado a lado e o ganho líquido.
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={onConfigureBaseline}>
            Definir referência humana
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {view.performanceCards.map((card) => (
          <PerformanceComparisonCard key={card.key} card={card} />
        ))}
      </div>

      {view.netGainSummary && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Clock3 className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <span className="text-xs font-medium text-foreground">Ganho líquido de horas</span>
              <p className="text-[11px] text-muted-foreground">{view.netGainSummary.detail}</p>
            </div>
          </div>
          <span
            className={cn(
              "font-mono text-lg font-semibold tabular-nums",
              view.netGainSummary.positive ? "text-chart-1" : "text-chart-3-text",
            )}
          >
            {view.netGainSummary.netText}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Block icon={Gauge} title="Qualidade e contrato" cells={view.quality} />
        <Block icon={Coins} title="Custo por tarefa validada" subtitle="Métrica secundária" cells={view.cost} />
        <Block icon={ShieldCheck} title="Prova e governança" cells={view.proof} />
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
