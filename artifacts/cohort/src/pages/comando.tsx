import { AppLayout } from "@/components/layout";
import {
  useGetFleetSummary,
  useListFleetDecisions,
  useListFleetAlerts,
  useListAgents,
  useListContinuousTelemetryActivity,
  getGetFleetSummaryQueryKey,
  getListFleetDecisionsQueryKey,
  getListFleetAlertsQueryKey,
  getListAgentsQueryKey,
  getListContinuousTelemetryActivityQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Users,
  Gavel,
  AlertTriangle,
  Activity,
  ArrowRight,
  ShieldCheck,
  Clock3,
  Radio,
  Siren,
} from "lucide-react";
import { ErrorState } from "@/components/query-state";
import {
  PageHeading,
  StatCard,
  VerdictBadge,
  Pill,
  AgentDisc,
  SeverityBadge,
} from "@/components/cohort";
import { platformLabel } from "@/lib/platforms";
import { useLang, localeOf, type Lang } from "@/lib/i18n";
import {
  OperationalSignal,
  RefreshStatusBar,
} from "@/components/mission-control/operational-status";
import { RealtimeGovernancePanel } from "@/components/mission-control/realtime-governance-panel";
import { dueState, relativeAge } from "@/components/mission-control/presentation";

/* ── Dicionário do Comando (pt canônico · en · es) ─────────── */

interface ComandoDict {
  breadcrumbSection: string;
  breadcrumbPage: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  viewFullPanel: string;
  continuousEyebrow: string;
  continuousTitle: string;
  continuousDesc: string;
  activeNow: string;
  activeNowDetail: string;
  recentCoverage: string;
  recentCoverageDetail: string;
  criticalIncidents: string;
  criticalIncidentsDetail: string;
  overdueItems: string;
  overdueItemsDetail: string;
  recentProjections: string;
  recentProjectionsDetail: string;
  noProjectionActivity: string;
  errorTitle: string;
  errorDesc: string;
  statAgents: string;
  platformsConnected: string;
  statPending: string;
  pendingDelta: string;
  statAlerts: string;
  alertsDelta: string;
  statHealth: string;
  healthDelta: string;
  pendingCardDesc: string;
  priorityTitle: string;
  priorityDesc: string;
  incident: string;
  decision: string;
  assignedTo: string;
  detected: string;
  confidence: string;
  window: string;
  review: string;
  noPendingTitle: string;
  noPendingDesc: string;
  noPriorityTitle: string;
  noPriorityDesc: string;
  recentTitle: string;
  recentDesc: string;
  noDecisions: string;
  alertsTitle: string;
  alertsDesc: string;
  viewAll: string;
  noActiveAlerts: string;
  decisions: Record<string, string>;
}

const L: Record<Lang, ComandoDict> = {
  pt: {
    breadcrumbSection: "Operação",
    breadcrumbPage: "Comando",
    eyebrow: "Operação",
    title: "Comando",
    subtitle:
      "Seu posto de comando: decisões do comitê pendentes, vereditos recentes e o pulso geral da frota.",
    viewFullPanel: "Ver painel completo",
    continuousEyebrow: "Controle contínuo",
    continuousTitle: "Estado operacional agora",
    continuousDesc: "Sinais consolidados da API. A atualização da tela não substitui a origem e a cadência de cada telemetria.",
    activeNow: "Agentes ativos",
    activeNowDetail: "cadastros em estado operacional",
    recentCoverage: "Avaliação recente",
    recentCoverageDetail: "avaliados nos últimos 7 dias",
    criticalIncidents: "Incidentes críticos",
    criticalIncidentsDetail: "alertas críticos ou de alta severidade",
    overdueItems: "SLAs vencidos",
    overdueItemsDetail: "alertas ativos fora do prazo",
    recentProjections: "Projeções recentes",
    recentProjectionsDetail: "avaliações processadas no loop contínuo",
    noProjectionActivity: "nenhuma projeção observada nesta janela",
    errorTitle: "Não foi possível carregar o comando",
    errorDesc: "Tente novamente em instantes.",
    statAgents: "Total de agentes",
    platformsConnected: "plataformas conectadas",
    statPending: "Decisões pendentes",
    pendingDelta: "Aguardando o comitê",
    statAlerts: "Alertas ativos",
    alertsDelta: "Padrões ilusórios detectados",
    statHealth: "Saúde média",
    healthDelta: "Índice consolidado da frota",
    pendingCardDesc: "Vereditos propostos aguardando aprovação do comitê",
    priorityTitle: "Ações prioritárias",
    priorityDesc: "Decisões e incidentes ordenados por risco e prazo",
    incident: "Incidente",
    decision: "Decisão",
    assignedTo: "Responsável",
    detected: "detectado",
    confidence: "Confiança",
    window: "Janela:",
    review: "Revisar",
    noPendingTitle: "Nenhuma decisão pendente",
    noPendingDesc: "O comitê está em dia com os vereditos.",
    noPriorityTitle: "Nenhuma ação imediata",
    noPriorityDesc: "Não há decisões pendentes nem incidentes ativos nesta consulta.",
    recentTitle: "Decisões recentes",
    recentDesc: "Histórico de vereditos resolvidos pelo comitê",
    noDecisions: "Nenhuma decisão registrada ainda.",
    alertsTitle: "Alertas",
    alertsDesc: "Detector de Vitória Ilusória",
    viewAll: "Ver todos",
    noActiveAlerts: "Nenhum alerta ativo.",
    decisions: {
      pending: "Pendente",
      approved: "Aprovada",
      disagreed: "Discordada",
      exported: "Exportada",
    },
  },
  en: {
    breadcrumbSection: "Operations",
    breadcrumbPage: "Command",
    eyebrow: "Operations",
    title: "Command",
    subtitle:
      "Your command post: pending committee decisions, recent verdicts and the overall pulse of the fleet.",
    viewFullPanel: "View full panel",
    continuousEyebrow: "Continuous control",
    continuousTitle: "Operational state now",
    continuousDesc: "Signals consolidated from the API. Screen refresh does not replace each telemetry source and cadence.",
    activeNow: "Active agents",
    activeNowDetail: "records in operational state",
    recentCoverage: "Recent evaluation",
    recentCoverageDetail: "evaluated in the last 7 days",
    criticalIncidents: "Critical incidents",
    criticalIncidentsDetail: "critical or high severity alerts",
    overdueItems: "Overdue SLAs",
    overdueItemsDetail: "active alerts past due",
    recentProjections: "Recent projections",
    recentProjectionsDetail: "evaluations processed by the continuous loop",
    noProjectionActivity: "no projection observed in this window",
    errorTitle: "Could not load the command view",
    errorDesc: "Try again in a moment.",
    statAgents: "Total agents",
    platformsConnected: "platforms connected",
    statPending: "Pending decisions",
    pendingDelta: "Awaiting the committee",
    statAlerts: "Active alerts",
    alertsDelta: "Illusory patterns detected",
    statHealth: "Average health",
    healthDelta: "Consolidated fleet index",
    pendingCardDesc: "Proposed verdicts awaiting committee approval",
    priorityTitle: "Priority actions",
    priorityDesc: "Decisions and incidents ordered by risk and due date",
    incident: "Incident",
    decision: "Decision",
    assignedTo: "Owner",
    detected: "detected",
    confidence: "Confidence",
    window: "Window:",
    review: "Review",
    noPendingTitle: "No pending decisions",
    noPendingDesc: "The committee is up to date on verdicts.",
    noPriorityTitle: "No immediate action",
    noPriorityDesc: "There are no pending decisions or active incidents in this query.",
    recentTitle: "Recent decisions",
    recentDesc: "History of verdicts resolved by the committee",
    noDecisions: "No decisions recorded yet.",
    alertsTitle: "Alerts",
    alertsDesc: "Illusory Victory Detector",
    viewAll: "View all",
    noActiveAlerts: "No active alerts.",
    decisions: {
      pending: "Pending",
      approved: "Approved",
      disagreed: "Disagreed",
      exported: "Exported",
    },
  },
  es: {
    breadcrumbSection: "Operación",
    breadcrumbPage: "Mando",
    eyebrow: "Operación",
    title: "Mando",
    subtitle:
      "Tu puesto de mando: decisiones del comité pendientes, veredictos recientes y el pulso general de la flota.",
    viewFullPanel: "Ver panel completo",
    continuousEyebrow: "Control continuo",
    continuousTitle: "Estado operativo ahora",
    continuousDesc: "Señales consolidadas de la API. La actualización de la pantalla no sustituye el origen y la cadencia de cada telemetría.",
    activeNow: "Agentes activos",
    activeNowDetail: "registros en estado operativo",
    recentCoverage: "Evaluación reciente",
    recentCoverageDetail: "evaluados en los últimos 7 días",
    criticalIncidents: "Incidentes críticos",
    criticalIncidentsDetail: "alertas críticas o de alta severidad",
    overdueItems: "SLA vencidos",
    overdueItemsDetail: "alertas activas fuera de plazo",
    recentProjections: "Proyecciones recientes",
    recentProjectionsDetail: "evaluaciones procesadas por el ciclo continuo",
    noProjectionActivity: "ninguna proyección observada en esta ventana",
    errorTitle: "No fue posible cargar el mando",
    errorDesc: "Inténtalo de nuevo en unos instantes.",
    statAgents: "Total de agentes",
    platformsConnected: "plataformas conectadas",
    statPending: "Decisiones pendientes",
    pendingDelta: "A la espera del comité",
    statAlerts: "Alertas activas",
    alertsDelta: "Patrones ilusorios detectados",
    statHealth: "Salud media",
    healthDelta: "Índice consolidado de la flota",
    pendingCardDesc: "Veredictos propuestos a la espera de la aprobación del comité",
    priorityTitle: "Acciones prioritarias",
    priorityDesc: "Decisiones e incidentes ordenados por riesgo y plazo",
    incident: "Incidente",
    decision: "Decisión",
    assignedTo: "Responsable",
    detected: "detectado",
    confidence: "Confianza",
    window: "Ventana:",
    review: "Revisar",
    noPendingTitle: "Ninguna decisión pendiente",
    noPendingDesc: "El comité está al día con los veredictos.",
    noPriorityTitle: "Ninguna acción inmediata",
    noPriorityDesc: "No hay decisiones pendientes ni incidentes activos en esta consulta.",
    recentTitle: "Decisiones recientes",
    recentDesc: "Historial de veredictos resueltos por el comité",
    noDecisions: "Aún no hay decisiones registradas.",
    alertsTitle: "Alertas",
    alertsDesc: "Detector de Victoria Ilusoria",
    viewAll: "Ver todas",
    noActiveAlerts: "Ninguna alerta activa.",
    decisions: {
      pending: "Pendiente",
      approved: "Aprobada",
      disagreed: "En desacuerdo",
      exported: "Exportada",
    },
  },
};

const cardTitleSerif = "font-serif text-xl font-medium tracking-tight";

const DECISION_TONES: Record<string, "sage" | "ochre" | "terracotta" | "blue"> = {
  pending: "ochre",
  approved: "sage",
  disagreed: "terracotta",
  exported: "blue",
};

function DecisionBadge({ decision }: { decision: string }) {
  const { lang } = useLang();
  const t = L[lang];
  const tone = DECISION_TONES[decision] ?? ("muted" as const);
  const label = t.decisions[decision] ?? decision;
  return <Pill tone={tone}>{label}</Pill>;
}

function fmtDate(value: string | null | undefined, locale: string) {
  return value ? new Date(value).toLocaleDateString(locale) : "—";
}

export default function CommandPage() {
  const { lang } = useLang();
  const t = L[lang];
  const locale = localeOf(lang);

  const {
    data: summary,
    isLoading: loadingSummary,
    isError: errorSummary,
    isFetching: fetchingSummary,
    dataUpdatedAt: summaryUpdatedAt,
    refetch: refetchSummary,
  } = useGetFleetSummary({
    query: { queryKey: getGetFleetSummaryQueryKey(), refetchInterval: 30_000 },
  });
  const {
    data: decisions,
    isLoading: loadingDecisions,
    isError: errorDecisions,
    isFetching: fetchingDecisions,
    dataUpdatedAt: decisionsUpdatedAt,
    refetch: refetchDecisions,
  } = useListFleetDecisions({
    query: { queryKey: getListFleetDecisionsQueryKey(), refetchInterval: 30_000 },
  });
  const {
    data: alerts,
    isLoading: loadingAlerts,
    isError: errorAlerts,
    isFetching: fetchingAlerts,
    dataUpdatedAt: alertsUpdatedAt,
    refetch: refetchAlerts,
  } = useListFleetAlerts(undefined, {
    query: { queryKey: getListFleetAlertsQueryKey(), refetchInterval: 30_000 },
  });
  const {
    data: agents,
    isLoading: loadingAgents,
    isError: errorAgents,
    isFetching: fetchingAgents,
    dataUpdatedAt: agentsUpdatedAt,
    refetch: refetchAgents,
  } = useListAgents(undefined, {
    query: { queryKey: getListAgentsQueryKey(), refetchInterval: 30_000 },
  });
  const activityParams = { limit: 20 };
  const {
    data: continuousActivity,
    isLoading: loadingActivity,
    isError: errorActivity,
    isFetching: fetchingActivity,
    dataUpdatedAt: activityUpdatedAt,
    refetch: refetchActivity,
  } = useListContinuousTelemetryActivity(activityParams, {
    query: {
      queryKey: getListContinuousTelemetryActivityQueryKey(activityParams),
      refetchInterval: 2_000,
    },
  });

  const hasError =
    errorSummary || errorDecisions || errorAlerts || errorAgents || errorActivity;

  const pending = decisions?.filter((d) => d.decision === "pending") ?? [];
  const recent =
    decisions
      ?.filter((d) => d.decision !== "pending")
      .sort((a, b) => {
        const da = a.decidedAt ? Date.parse(a.decidedAt) : 0;
        const db = b.decidedAt ? Date.parse(b.decidedAt) : 0;
        return db - da;
      }) ?? [];
  const now = Date.now();
  const evaluatedRecently =
    agents?.filter((agent) => {
      const evaluatedAt = Date.parse(agent.lastEvaluatedAt);
      return Number.isFinite(evaluatedAt) && now - evaluatedAt <= 7 * 24 * 60 * 60 * 1000;
    }).length ?? 0;
  const latestEvaluationAt = Math.max(
    0,
    ...(agents ?? []).map((agent) => Date.parse(agent.lastEvaluatedAt)).filter(Number.isFinite),
  );
  const criticalIncidents =
    alerts?.filter((alert) => alert.severity === "critical" || alert.severity === "high").length ?? 0;
  const overdueAlerts = alerts?.filter((alert) => dueState(alert.dueAt, now).overdue).length ?? 0;
  const recentProjections =
    continuousActivity?.items.filter(
      (item) => item.eventType === "agent.evaluation.projected",
    ) ?? [];
  const latestProjectionAt = Math.max(
    0,
    ...recentProjections.map((item) => Date.parse(item.createdAt)).filter(Number.isFinite),
  );
  const oldestQueryUpdate = Math.min(
    ...[
      summaryUpdatedAt,
      decisionsUpdatedAt,
      alertsUpdatedAt,
      agentsUpdatedAt,
      activityUpdatedAt,
    ].filter((timestamp) => timestamp > 0),
  );
  const refreshing =
    fetchingSummary ||
    fetchingDecisions ||
    fetchingAlerts ||
    fetchingAgents ||
    fetchingActivity;
  const priorityItems = [
    ...pending.map((decision) => ({
      kind: "decision" as const,
      id: decision.id,
      score: 50 + (decision.confidence ?? 0),
      decision,
    })),
    ...(alerts ?? []).map((alert) => {
      const due = dueState(alert.dueAt, now);
      const severityScore = { critical: 400, high: 300, medium: 200, antecedent: 100 }[
        alert.severity
      ] ?? 0;
      return {
        kind: "alert" as const,
        id: alert.id,
        score: severityScore + (due.overdue ? 500 : 0),
        alert,
        due,
      };
    }),
  ]
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const refreshAll = () => {
    void Promise.all([
      refetchSummary(),
      refetchDecisions(),
      refetchAlerts(),
      refetchAgents(),
      refetchActivity(),
    ]);
  };

  return (
    <AppLayout breadcrumbs={[{ label: t.breadcrumbSection }, { label: t.breadcrumbPage }]}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
          action={
            <Button asChild variant="outline">
              <Link href="/frota">
                {t.viewFullPanel} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        />

        {hasError && (
          <ErrorState
            title={t.errorTitle}
            description={t.errorDesc}
            onRetry={() => {
              if (errorSummary) refetchSummary();
              if (errorDecisions) refetchDecisions();
              if (errorAlerts) refetchAlerts();
              if (errorAgents) refetchAgents();
              if (errorActivity) refetchActivity();
            }}
          />
        )}

        <RefreshStatusBar
          updatedAt={Number.isFinite(oldestQueryUpdate) ? oldestQueryUpdate : undefined}
          isRefreshing={refreshing}
          cadence="2s telemetria · 30s consolidação"
          onRefresh={refreshAll}
        />

        <section aria-labelledby="continuous-control-title" className="space-y-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              {t.continuousEyebrow}
            </p>
            <h2 id="continuous-control-title" className="mt-1 font-serif text-2xl font-medium tracking-tight">
              {t.continuousTitle}
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              {t.continuousDesc}
            </p>
          </div>
          {loadingAgents || loadingAlerts || loadingActivity ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <OperationalSignal
                icon={Radio}
                label={t.activeNow}
                value={summary?.byStatus.active ?? 0}
                detail={t.activeNowDetail}
                tone="stable"
              />
              <OperationalSignal
                icon={Clock3}
                label={t.recentCoverage}
                value={`${evaluatedRecently}/${agents?.length ?? 0}`}
                detail={`${t.recentCoverageDetail}${latestEvaluationAt ? ` · ${relativeAge(latestEvaluationAt, now)}` : ""}`}
                tone={agents?.length && evaluatedRecently < agents.length ? "attention" : "stable"}
              />
              <OperationalSignal
                icon={Siren}
                label={t.criticalIncidents}
                value={criticalIncidents}
                detail={t.criticalIncidentsDetail}
                tone={criticalIncidents > 0 ? "critical" : "stable"}
              />
              <OperationalSignal
                icon={AlertTriangle}
                label={t.overdueItems}
                value={overdueAlerts}
                detail={t.overdueItemsDetail}
                tone={overdueAlerts > 0 ? "critical" : "stable"}
              />
              <OperationalSignal
                icon={Activity}
                label={t.recentProjections}
                value={recentProjections.length}
                detail={
                  latestProjectionAt
                    ? `${t.recentProjectionsDetail} · ${relativeAge(latestProjectionAt, now)}`
                    : t.noProjectionActivity
                }
                tone={latestProjectionAt ? "stable" : "neutral"}
              />
            </div>
          )}
        </section>

        <RealtimeGovernancePanel />

        {/* Stat row */}
        {loadingSummary ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label={t.statAgents}
              value={summary.totalAgents}
              delta={`${summary.connectedPlatforms} ${t.platformsConnected}`}
            />
            <StatCard
              icon={Gavel}
              label={t.statPending}
              value={summary.pendingDecisions}
              delta={t.pendingDelta}
              tone={summary.pendingDecisions > 0 ? "warn" : "neutral"}
            />
            <StatCard
              icon={AlertTriangle}
              label={t.statAlerts}
              value={summary.activeAlerts}
              delta={t.alertsDelta}
              tone={summary.activeAlerts > 0 ? "down" : "neutral"}
            />
            <StatCard
              icon={Activity}
              label={t.statHealth}
              value={
                <span>
                  {summary.avgHealthScore}
                  <span className="text-xl text-muted-foreground">/100</span>
                </span>
              }
              delta={t.healthDelta}
            />
          </div>
        ) : null}

        {/* Prioritized operational queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className={`${cardTitleSerif} flex items-center gap-2`}>
                <Gavel className="h-4 w-4 text-chart-2" /> {t.priorityTitle}
              </CardTitle>
              <CardDescription>{t.priorityDesc}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDecisions || loadingAlerts ? (
              <div className="grid gap-3 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            ) : priorityItems.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {priorityItems.map((item) => {
                  if (item.kind === "decision") {
                    const decision = item.decision;
                    return (
                      <article
                        key={item.id}
                        className="flex min-w-0 flex-col gap-3 rounded-lg border border-chart-2/30 bg-chart-2/[0.035] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <AgentDisc name={decision.agentName} />
                            <div className="min-w-0">
                              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-chart-2">{t.decision}</p>
                              <Link href={`/agentes/${decision.agentId}`} className="block truncate font-medium text-foreground hover:underline">
                                {decision.agentName}
                              </Link>
                              <span className="block truncate text-xs text-muted-foreground">{decision.agentRole}</span>
                            </div>
                          </div>
                          <VerdictBadge verdict={decision.verdict} />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{platformLabel(decision.platform)}</span>
                          <span>{t.confidence} <strong className="font-mono font-medium tabular-nums text-foreground">{decision.confidence}%</strong></span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card-border/70 pt-3">
                          <span className="text-xs text-muted-foreground">{t.window} {decision.executionWindow}</span>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/agentes/${decision.agentId}`}>{t.review}</Link>
                          </Button>
                        </div>
                      </article>
                    );
                  }

                  const alert = item.alert;
                  const dueTone = item.due.tone === "critical" ? "red" : item.due.tone === "attention" ? "ochre" : item.due.tone === "stable" ? "sage" : "muted";
                  return (
                    <article
                      key={item.id}
                      className="flex min-w-0 flex-col gap-3 rounded-lg border border-chart-3/30 bg-chart-3/[0.035] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-chart-3">{t.incident}</p>
                          <h3 className="mt-1 text-sm font-medium leading-snug text-foreground">{alert.pattern}</h3>
                          <Link href={`/agentes/${alert.agentId}`} className="mt-1 block text-xs text-muted-foreground hover:text-foreground hover:underline">
                            {alert.agentName}
                          </Link>
                        </div>
                        <SeverityBadge severity={alert.severity} />
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{alert.recommendation}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card-border/70 pt-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Pill tone={dueTone}>{item.due.label}</Pill>
                          <span>{t.assignedTo}: {alert.assignedTo || "—"}</span>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href="/alertas">{t.review}</Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-card-border bg-muted/30 p-8 text-center">
                <ShieldCheck className="mb-2 h-8 w-8 text-chart-1 opacity-50" />
                <p className="text-sm font-medium">{t.noPriorityTitle}</p>
                <p className="text-xs text-muted-foreground">{t.noPriorityDesc}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent decisions + active alerts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className={cardTitleSerif}>{t.recentTitle}</CardTitle>
              <CardDescription>{t.recentDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingDecisions ? (
                [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)
              ) : recent.length > 0 ? (
                recent.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-card-border bg-card p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AgentDisc name={d.agentName} size="sm" />
                      <div className="min-w-0">
                        <Link
                          href={`/agentes/${d.agentId}`}
                          className="block truncate text-sm font-medium text-foreground hover:underline"
                        >
                          {d.agentName}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground">
                          {d.decidedBy ?? "—"} · {fmtDate(d.decidedAt, locale)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <VerdictBadge verdict={d.verdict} />
                      <DecisionBadge decision={d.decision} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                  {t.noDecisions}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className={`${cardTitleSerif} flex items-center gap-2`}>
                  <AlertTriangle className="h-4 w-4 text-chart-3" /> {t.alertsTitle}
                </CardTitle>
                <CardDescription>{t.alertsDesc}</CardDescription>
              </div>
              <Link
                href="/alertas"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t.viewAll} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingAlerts ? (
                [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
              ) : alerts && alerts.length > 0 ? (
                alerts.slice(0, 4).map((alert) => {
                  const due = dueState(alert.dueAt);
                  return (
                    <Link
                      key={alert.id}
                      href={`/agentes/${alert.agentId}`}
                      className="flex min-w-0 flex-col gap-2 rounded-lg border border-card-border bg-card p-3 hover-elevate"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 text-sm font-medium leading-snug">{alert.pattern}</span>
                        <SeverityBadge severity={alert.severity} />
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{alert.agentName}</span>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card-border/60 pt-2 text-[11px] text-muted-foreground">
                        <span>{t.detected} {relativeAge(alert.detectedAt)}</span>
                        <span className={due.overdue ? "font-medium text-chart-3" : ""}>{due.label}</span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="flex h-24 items-center justify-center text-center text-sm text-muted-foreground">
                  {t.noActiveAlerts}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
