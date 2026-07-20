import { AppLayout } from "@/components/layout";
import {
  useGetFleetSummary,
  useListFleetDecisions,
  useListFleetAlerts,
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
import { Users, Gavel, AlertTriangle, Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { ErrorState } from "@/components/query-state";
import { PageHeading, StatCard, VerdictBadge, Pill, AgentDisc } from "@/components/cohort";
import { platformLabel } from "@/lib/platforms";
import { useLang, localeOf, type Lang } from "@/lib/i18n";

/* ── Dicionário do Comando (pt canônico · en · es) ─────────── */

interface ComandoDict {
  breadcrumbSection: string;
  breadcrumbPage: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  viewFullPanel: string;
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
  confidence: string;
  window: string;
  review: string;
  noPendingTitle: string;
  noPendingDesc: string;
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
    confidence: "Confiança",
    window: "Janela:",
    review: "Revisar",
    noPendingTitle: "Nenhuma decisão pendente",
    noPendingDesc: "O comitê está em dia com os vereditos.",
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
    confidence: "Confidence",
    window: "Window:",
    review: "Review",
    noPendingTitle: "No pending decisions",
    noPendingDesc: "The committee is up to date on verdicts.",
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
    confidence: "Confianza",
    window: "Ventana:",
    review: "Revisar",
    noPendingTitle: "Ninguna decisión pendiente",
    noPendingDesc: "El comité está al día con los veredictos.",
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
    refetch: refetchSummary,
  } = useGetFleetSummary();
  const {
    data: decisions,
    isLoading: loadingDecisions,
    isError: errorDecisions,
    refetch: refetchDecisions,
  } = useListFleetDecisions();
  const {
    data: alerts,
    isLoading: loadingAlerts,
    isError: errorAlerts,
    refetch: refetchAlerts,
  } = useListFleetAlerts();

  const hasError = errorSummary || errorDecisions || errorAlerts;

  const pending = decisions?.filter((d) => d.decision === "pending") ?? [];
  const recent =
    decisions
      ?.filter((d) => d.decision !== "pending")
      .sort((a, b) => {
        const da = a.decidedAt ? Date.parse(a.decidedAt) : 0;
        const db = b.decidedAt ? Date.parse(b.decidedAt) : 0;
        return db - da;
      }) ?? [];

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
            }}
          />
        )}

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

        {/* Pending decisions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className={`${cardTitleSerif} flex items-center gap-2`}>
                <Gavel className="h-4 w-4 text-chart-2" /> {t.statPending}
              </CardTitle>
              <CardDescription>{t.pendingCardDesc}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDecisions ? (
              <div className="grid gap-3 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            ) : pending.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {pending.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col gap-3 rounded-lg border border-card-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AgentDisc name={d.agentName} />
                        <div className="min-w-0">
                          <Link
                            href={`/agentes/${d.agentId}`}
                            className="block truncate font-medium text-foreground hover:underline"
                          >
                            {d.agentName}
                          </Link>
                          <span className="truncate text-xs text-muted-foreground">{d.agentRole}</span>
                        </div>
                      </div>
                      <VerdictBadge verdict={d.verdict} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{platformLabel(d.platform)}</span>
                      <span>
                        {t.confidence}{" "}
                        <span className="font-mono tabular-nums text-foreground">{d.confidence}%</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t.window} {d.executionWindow}</span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/agentes/${d.agentId}`}>{t.review}</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-card-border bg-muted/30 p-8 text-center">
                <ShieldCheck className="mb-2 h-8 w-8 text-chart-1 opacity-50" />
                <p className="text-sm font-medium">{t.noPendingTitle}</p>
                <p className="text-xs text-muted-foreground">{t.noPendingDesc}</p>
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
                alerts.slice(0, 4).map((a) => (
                  <Link
                    key={a.id}
                    href={`/agentes/${a.agentId}`}
                    className="flex flex-col gap-1 rounded-lg border border-card-border bg-card p-3 hover-elevate"
                  >
                    <span className="truncate text-sm font-medium">{a.pattern}</span>
                    <span className="truncate text-xs text-muted-foreground">{a.agentName}</span>
                  </Link>
                ))
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
