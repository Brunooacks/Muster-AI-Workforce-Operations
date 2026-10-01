import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow, Pill } from "@/components/cohort";
import { cn } from "@/lib/utils";
import { relativeAge, type OperationalTone } from "./presentation";

const TONE_CLASS: Record<OperationalTone, string> = {
  stable: "border-chart-1/30 bg-chart-1/[0.06] text-chart-1",
  attention: "border-chart-2/35 bg-chart-2/[0.07] text-chart-2",
  critical: "border-chart-3/35 bg-chart-3/[0.07] text-chart-3",
  neutral: "border-card-border bg-card/80 text-muted-foreground",
};

export function OperationalSignal({
  label,
  value,
  detail,
  icon: Icon = Activity,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  tone?: OperationalTone;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border p-4", TONE_CLASS[tone])}>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow className="text-current/75">{label}</Eyebrow>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      </div>
      <div className="mt-3 truncate font-serif text-2xl font-medium leading-none text-foreground">
        {value}
      </div>
      {detail && <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</div>}
    </div>
  );
}
export function RefreshStatusBar({
  updatedAt,
  isRefreshing,
  cadence,
  onRefresh,
  sourceLabel = "Dados da API Muster",
}: {
  updatedAt?: number;
  isRefreshing?: boolean;
  cadence?: string;
  onRefresh?: () => void;
  sourceLabel?: string;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-card-border/80 bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2 font-medium text-foreground">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {isRefreshing && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-1 opacity-60" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-1" />
          </span>
          {isRefreshing ? "Atualizando visão" : "Visão sincronizada"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          {sourceLabel}
        </span>
        <span>consulta {updatedAt ? relativeAge(updatedAt) : "ainda não concluída"}</span>
        {cadence && <span>cadência {cadence}</span>}
      </div>
      {onRefresh && (
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Atualizar agora
        </Button>
      )}
    </div>
  );
}

export function ScenarioSourceBadge({ source }: { source: "synthetic" | "unclassified" }) {
  return source === "synthetic" ? (
    <Pill tone="blue">Cenário sintético</Pill>
  ) : (
    <Pill tone="muted">Origem não classificada</Pill>
  );
}
