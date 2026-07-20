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
import { useLang, type Lang } from "@/lib/i18n";

/* ── Dicionário de Agentes (pt canônico · en · es) ─────────── */

type HealthKey = "all" | "healthy" | "attention" | "critical";

interface AgentsDict {
  breadcrumbSection: string;
  breadcrumbPage: string;
  eyebrow: string;
  title: string;
  subtitleStats: (total: number, attention: number, onboarding: number) => string;
  subtitleFallback: string;
  registerAgent: string;
  healthTabs: Record<HealthKey, string>;
  healthEyebrow: string;
  areaEyebrow: string;
  allAreas: string;
  errorTitle: string;
  netValueLabel: string;
  goalsOffTitle: (n: number) => string;
  goalsOff: (n: number) => string;
  allOnTarget: string;
  noAgentsFiltered: string;
  noAgentsFound: string;
}

const L: Record<Lang, AgentsDict> = {
  pt: {
    breadcrumbSection: "Operação",
    breadcrumbPage: "Agentes",
    eyebrow: "Operação",
    title: "Agentes",
    subtitleStats: (total, attention, onboarding) =>
      `${total} agentes na frota · ${attention} precisam de atenção · ${onboarding} em onboarding`,
    subtitleFallback: "Carteira de trabalho e desempenho de toda a frota.",
    registerAgent: "Cadastrar agente",
    healthTabs: {
      all: "Todos",
      healthy: "Saudáveis",
      attention: "Atenção",
      critical: "Críticos",
    },
    healthEyebrow: "Saúde",
    areaEyebrow: "Área",
    allAreas: "Todas",
    errorTitle: "Não foi possível carregar os agentes",
    netValueLabel: "Valor líq.",
    goalsOffTitle: (n) => `${n} ${n === 1 ? "métrica fora" : "métricas fora"} da meta`,
    goalsOff: (n) => `${n} ${n === 1 ? "meta fora" : "metas fora"}`,
    allOnTarget: "Todas na meta",
    noAgentsFiltered: "Nenhum agente para os filtros atuais.",
    noAgentsFound: "Nenhum agente encontrado.",
  },
  en: {
    breadcrumbSection: "Operations",
    breadcrumbPage: "Agents",
    eyebrow: "Operations",
    title: "Agents",
    subtitleStats: (total, attention, onboarding) =>
      `${total} agents in the fleet · ${attention} need attention · ${onboarding} onboarding`,
    subtitleFallback: "Work Record and performance for the entire fleet.",
    registerAgent: "Register agent",
    healthTabs: {
      all: "All",
      healthy: "Healthy",
      attention: "Attention",
      critical: "Critical",
    },
    healthEyebrow: "Health",
    areaEyebrow: "Area",
    allAreas: "All",
    errorTitle: "Could not load agents",
    netValueLabel: "Net value",
    goalsOffTitle: (n) => `${n} ${n === 1 ? "metric off" : "metrics off"} target`,
    goalsOff: (n) => `${n} ${n === 1 ? "goal off" : "goals off"}`,
    allOnTarget: "All on target",
    noAgentsFiltered: "No agents match the current filters.",
    noAgentsFound: "No agents found.",
  },
  es: {
    breadcrumbSection: "Operación",
    breadcrumbPage: "Agentes",
    eyebrow: "Operación",
    title: "Agentes",
    subtitleStats: (total, attention, onboarding) =>
      `${total} agentes en la flota · ${attention} necesitan atención · ${onboarding} en onboarding`,
    subtitleFallback: "Expediente Laboral y desempeño de toda la flota.",
    registerAgent: "Registrar agente",
    healthTabs: {
      all: "Todos",
      healthy: "Saludables",
      attention: "Atención",
      critical: "Críticos",
    },
    healthEyebrow: "Salud",
    areaEyebrow: "Área",
    allAreas: "Todas",
    errorTitle: "No fue posible cargar los agentes",
    netValueLabel: "Valor neto",
    goalsOffTitle: (n) => `${n} ${n === 1 ? "métrica fuera" : "métricas fuera"} de la meta`,
    goalsOff: (n) => `${n} ${n === 1 ? "meta fuera" : "metas fuera"}`,
    allOnTarget: "Todas en meta",
    noAgentsFiltered: "Ningún agente para los filtros actuales.",
    noAgentsFound: "Ningún agente encontrado.",
  },
};

type Health = { key: HealthKey; test: (score: number) => boolean };

const HEALTH_TABS: Health[] = [
  { key: "all", test: () => true },
  { key: "healthy", test: (s) => s >= 80 },
  { key: "attention", test: (s) => s >= 60 && s < 80 },
  { key: "critical", test: (s) => s < 60 },
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
  const { lang } = useLang();
  const t = L[lang];
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

  const activeHealth = HEALTH_TABS.find((tab) => tab.key === healthTab) ?? HEALTH_TABS[0];

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
    <AppLayout breadcrumbs={[{ label: t.breadcrumbSection }, { label: t.breadcrumbPage }]}>
      <div className="space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={
            agents
              ? t.subtitleStats(agents.length, needAttention, onboarding)
              : t.subtitleFallback
          }
          action={
            <Button asChild>
              <Link href="/admissao">
                <Plus className="mr-2 h-4 w-4" />
                {t.registerAgent}
              </Link>
            </Button>
          }
        />

        {/* Health tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>{t.healthEyebrow}</Eyebrow>
          {HEALTH_TABS.map((tab) => (
            <FilterChip
              key={tab.key}
              active={healthTab === tab.key}
              onClick={() => setHealthTab(tab.key)}
              count={healthCount(tab)}
            >
              {t.healthTabs[tab.key]}
            </FilterChip>
          ))}
        </div>

        {/* Área filter */}
        {areas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <Eyebrow>{t.areaEyebrow}</Eyebrow>
            </span>
            <FilterChip active={areaFilter === "all"} onClick={() => setAreaFilter("all")}>
              {t.allAreas}
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
          <ErrorState title={t.errorTitle} onRetry={() => refetch()} />
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
                    <Eyebrow>{t.healthEyebrow}</Eyebrow>
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
                    <Eyebrow>{t.netValueLabel}</Eyebrow>
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
                        title={t.goalsOffTitle(missedGoals)}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {t.goalsOff(missedGoals)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.allOnTarget}</span>
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
              ? t.noAgentsFiltered
              : t.noAgentsFound}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
