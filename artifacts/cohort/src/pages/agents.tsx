import { AppLayout } from "@/components/layout";
import { useListAgents } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { ErrorState } from "@/components/query-state";
import { useAppShell } from "@/lib/app-shell";
import {
  PageHeading,
  StatusBadge,
  VerdictBadge,
  FilterChip,
  AgentDisc,
  Eyebrow,
} from "@/components/cohort";
import { platformLabel, platformArea } from "@/lib/platforms";
import { countMissedGoals } from "@/components/carteira";

type Health = { key: string; label: string; test: (score: number) => boolean };

const HEALTH_TABS: Health[] = [
  { key: "all", label: "Todos", test: () => true },
  { key: "healthy", label: "Saudáveis", test: (s) => s >= 80 },
  { key: "attention", label: "Atenção", test: (s) => s >= 60 && s < 80 },
  { key: "critical", label: "Críticos", test: (s) => s < 60 },
];

function formatCurrencyK(value: number) {
  return `R$ ${(value / 1000).toFixed(1)}k`;
}

function healthTone(score: number) {
  if (score >= 80) return "text-chart-1";
  if (score >= 60) return "text-chart-2";
  return "text-chart-3";
}

export default function AgentsPage() {
  const { search, perspective } = useAppShell();
  const [healthTab, setHealthTab] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const { data: agents, isLoading, isError, refetch } = useListAgents({
    search: search || undefined,
  });

  const areas = useMemo(() => {
    const set = new Set<string>();
    agents?.forEach((a) => set.add(platformArea(a.platform)));
    return Array.from(set).sort();
  }, [agents]);

  const activeHealth = HEALTH_TABS.find((t) => t.key === healthTab) ?? HEALTH_TABS[0];

  const filteredAgents = agents?.filter(
    (a) =>
      activeHealth.test(a.healthScore) &&
      (areaFilter === "all" || platformArea(a.platform) === areaFilter),
  );

  const healthCount = (tab: Health) =>
    agents?.filter(
      (a) =>
        tab.test(a.healthScore) && (areaFilter === "all" || platformArea(a.platform) === areaFilter),
    ).length ?? 0;

  const needAttention =
    agents?.filter((a) => a.status === "flagged" || (a.activeAlerts ?? 0) > 0).length ?? 0;
  const onboarding = agents?.filter((a) => a.status === "observation").length ?? 0;

  return (
    <AppLayout breadcrumbs={[{ label: "Operação" }, { label: "Agentes" }]}>
      <div className="space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow="Operação"
          title="Agentes"
          subtitle={
            agents
              ? `${agents.length} agentes na frota · ${needAttention} precisam de atenção · ${onboarding} em onboarding`
              : "Carteira de trabalho e desempenho de toda a frota."
          }
          action={
            <Button asChild>
              <Link href="/admissao">
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar agente
              </Link>
            </Button>
          }
        />

        {/* Health tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Saúde</Eyebrow>
          {HEALTH_TABS.map((t) => (
            <FilterChip
              key={t.key}
              active={healthTab === t.key}
              onClick={() => setHealthTab(t.key)}
              count={healthCount(t)}
            >
              {t.label}
            </FilterChip>
          ))}
        </div>

        {/* Área filter */}
        {areas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <Eyebrow>Área</Eyebrow>
            </span>
            <FilterChip active={areaFilter === "all"} onClick={() => setAreaFilter("all")}>
              Todas
            </FilterChip>
            {areas.map((area) => (
              <FilterChip
                key={area}
                active={areaFilter === area}
                onClick={() => setAreaFilter(area)}
              >
                {area}
              </FilterChip>
            ))}
          </div>
        )}

        {isError ? (
          <ErrorState title="Não foi possível carregar os agentes" onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
          </div>
        ) : filteredAgents && filteredAgents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => {
              const missedGoals = countMissedGoals(agent.targetMetrics ?? []);
              return (
              <Link
                key={agent.id}
                href={`/agentes/${agent.id}`}
                className="group flex flex-col gap-4 rounded-xl border border-card-border bg-card p-5 transition-colors hover-elevate"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <AgentDisc name={agent.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground group-hover:underline">
                        {agent.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-0.5">{platformArea(agent.platform)}</span>
                  {perspective === "platform" ? (
                    <span className="font-mono">
                      {platformLabel(agent.platform)} · v{agent.version}
                    </span>
                  ) : (
                    <span>{platformLabel(agent.platform)}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-card-border pt-3">
                  <div className="space-y-0.5">
                    <Eyebrow>Saúde</Eyebrow>
                    <div className="flex items-center gap-1.5">
                      {agent.activeAlerts ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-chart-3" />
                      ) : null}
                      <span className={`font-mono text-lg font-medium tabular-nums ${healthTone(agent.healthScore)}`}>
                        {agent.healthScore}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <Eyebrow>Valor líq.</Eyebrow>
                    <span className="font-mono text-lg font-medium tabular-nums">
                      {typeof agent.monthlyValue === "number" && typeof agent.monthlyCost === "number"
                        ? formatCurrencyK(agent.monthlyValue - agent.monthlyCost)
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {missedGoals > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-chart-3/10 px-2 py-0.5 font-mono text-xs font-medium text-chart-3"
                        title={`${missedGoals} ${missedGoals === 1 ? "métrica fora" : "métricas fora"} da meta`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {missedGoals} {missedGoals === 1 ? "meta fora" : "metas fora"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Todas na meta</span>
                    )}
                  </div>
                  <VerdictBadge verdict={agent.currentVerdict} />
                </div>
              </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-card-border text-sm text-muted-foreground">
            {agents && agents.length > 0
              ? "Nenhum agente para os filtros atuais."
              : "Nenhum agente encontrado."}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
