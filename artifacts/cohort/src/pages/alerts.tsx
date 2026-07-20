import { AppLayout } from "@/components/layout";
import { useListFleetAlerts } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Eye, AlertTriangle, Activity, Lightbulb, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { ErrorState } from "@/components/query-state";
import { PageHeading, StatCard, FilterChip, Pill, Eyebrow } from "@/components/cohort";
import { detectorPresentation } from "@/components/carteira";
import { useLang, localeOf, type Lang } from "@/lib/i18n";

type AlertsDict = {
  breadcrumbGov: string;
  title: string;
  subtitle: string;
  configure: string;
  errorTitle: string;
  statActive: string;
  statActiveDelta: string;
  statCritical: string;
  statCriticalDelta: string;
  statHigh: string;
  statHighDelta: string;
  statAntecedent: string;
  statAntecedentDelta: string;
  severityEyebrow: string;
  filters: { all: string; critical: string; high: string; medium: string; antecedent: string };
  patternFallback: string;
  agentLabel: string;
  hypothesis: string;
  recommendation: string;
  detectedAt: string;
  viewAgent: string;
  emptyFiltered: string;
  emptyTitle: string;
  emptyDesc: string;
  statuses: { active: string; acknowledged: string; resolved: string };
};

const alertsI18n: Record<Lang, AlertsDict> = {
  pt: {
    breadcrumbGov: "Governança",
    title: "Detector de Vitória Ilusória",
    subtitle:
      "Monitoramento passivo que cruza as 5 camadas de KPIs em busca de contradições — ex.: adoção caindo enquanto o sucesso aparente sobe.",
    configure: "Configurar padrões",
    errorTitle: "Não foi possível carregar os alertas",
    statActive: "Alertas ativos",
    statActiveDelta: "Padrões em monitoramento",
    statCritical: "Críticos",
    statCriticalDelta: "Atenção imediata",
    statHigh: "Alta severidade",
    statHighDelta: "Sob investigação",
    statAntecedent: "Antecedentes",
    statAntecedentDelta: "Sinais precoces",
    severityEyebrow: "Severidade",
    filters: { all: "Todas", critical: "Crítica", high: "Alta", medium: "Média", antecedent: "Antecedente" },
    patternFallback: "Padrão antagônico",
    agentLabel: "Agente:",
    hypothesis: "Hipótese",
    recommendation: "Recomendação",
    detectedAt: "Detectado em",
    viewAgent: "Ver agente",
    emptyFiltered: "Nenhum alerta para os filtros atuais.",
    emptyTitle: "Nenhum alerta ativo.",
    emptyDesc: "A frota está operando sem contradições lógicas.",
    statuses: { active: "Ativo", acknowledged: "Reconhecido", resolved: "Resolvido" },
  },
  en: {
    breadcrumbGov: "Governance",
    title: "Illusory Victory Detector",
    subtitle:
      "Passive monitoring that crosses the 5 KPI layers looking for contradictions — e.g. adoption falling while apparent success rises.",
    configure: "Configure patterns",
    errorTitle: "Could not load alerts",
    statActive: "Active alerts",
    statActiveDelta: "Patterns under monitoring",
    statCritical: "Critical",
    statCriticalDelta: "Immediate attention",
    statHigh: "High severity",
    statHighDelta: "Under investigation",
    statAntecedent: "Antecedents",
    statAntecedentDelta: "Early signals",
    severityEyebrow: "Severity",
    filters: { all: "All", critical: "Critical", high: "High", medium: "Medium", antecedent: "Antecedent" },
    patternFallback: "Antagonistic pattern",
    agentLabel: "Agent:",
    hypothesis: "Hypothesis",
    recommendation: "Recommendation",
    detectedAt: "Detected on",
    viewAgent: "View agent",
    emptyFiltered: "No alerts for the current filters.",
    emptyTitle: "No active alerts.",
    emptyDesc: "The fleet is operating without logical contradictions.",
    statuses: { active: "Active", acknowledged: "Acknowledged", resolved: "Resolved" },
  },
  es: {
    breadcrumbGov: "Gobernanza",
    title: "Detector de Victoria Ilusoria",
    subtitle:
      "Monitoreo pasivo que cruza las 5 capas de KPIs en busca de contradicciones — ej.: adopción cayendo mientras el éxito aparente sube.",
    configure: "Configurar patrones",
    errorTitle: "No fue posible cargar las alertas",
    statActive: "Alertas activas",
    statActiveDelta: "Patrones en monitoreo",
    statCritical: "Críticas",
    statCriticalDelta: "Atención inmediata",
    statHigh: "Alta severidad",
    statHighDelta: "En investigación",
    statAntecedent: "Antecedentes",
    statAntecedentDelta: "Señales tempranas",
    severityEyebrow: "Severidad",
    filters: { all: "Todas", critical: "Crítica", high: "Alta", medium: "Media", antecedent: "Antecedente" },
    patternFallback: "Patrón antagónico",
    agentLabel: "Agente:",
    hypothesis: "Hipótesis",
    recommendation: "Recomendación",
    detectedAt: "Detectado el",
    viewAgent: "Ver agente",
    emptyFiltered: "Ninguna alerta para los filtros actuales.",
    emptyTitle: "Ninguna alerta activa.",
    emptyDesc: "La flota está operando sin contradicciones lógicas.",
    statuses: { active: "Activo", acknowledged: "Reconocido", resolved: "Resuelto" },
  },
};

const STATUS_TONE: Record<string, "sage" | "ochre" | "blue" | "muted"> = {
  active: "ochre",
  acknowledged: "blue",
  resolved: "sage",
};

function StatusBadge({ status, t }: { status: string; t: AlertsDict }) {
  const label =
    status === "active" || status === "acknowledged" || status === "resolved"
      ? t.statuses[status]
      : status;
  return <Pill tone={STATUS_TONE[status] ?? "muted"}>{label}</Pill>;
}

export default function AlertsPage() {
  const { lang } = useLang();
  const t = alertsI18n[lang];
  const { data: alerts, isLoading, isError, refetch } = useListFleetAlerts();
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const severityFilters: { key: string; label: string }[] = [
    { key: "all", label: t.filters.all },
    { key: "critical", label: t.filters.critical },
    { key: "high", label: t.filters.high },
    { key: "medium", label: t.filters.medium },
    { key: "antecedent", label: t.filters.antecedent },
  ];

  const filteredAlerts = alerts?.filter(
    (a) => severityFilter === "all" || a.severity === severityFilter,
  );

  const severityCount = (sev: string) => alerts?.filter((a) => a.severity === sev).length ?? 0;

  return (
    <AppLayout breadcrumbs={[{ label: t.breadcrumbGov }, { label: t.title }]}>
      <div className="space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow={t.breadcrumbGov}
          title={t.title}
          subtitle={t.subtitle}
          action={
            <Button variant="outline" disabled>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {t.configure}
            </Button>
          }
        />

        {isError ? (
          <ErrorState title={t.errorTitle} onRetry={() => refetch()} />
        ) : (
          <>
            {/* Summary cards */}
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : alerts ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={Activity}
                  label={t.statActive}
                  value={alerts.length}
                  delta={t.statActiveDelta}
                  tone={alerts.length > 0 ? "down" : "neutral"}
                />
                <StatCard
                  icon={AlertTriangle}
                  label={t.statCritical}
                  value={severityCount("critical")}
                  delta={t.statCriticalDelta}
                  tone={severityCount("critical") > 0 ? "down" : "neutral"}
                />
                <StatCard
                  icon={Eye}
                  label={t.statHigh}
                  value={severityCount("high")}
                  delta={t.statHighDelta}
                  tone={severityCount("high") > 0 ? "warn" : "neutral"}
                />
                <StatCard
                  icon={Lightbulb}
                  label={t.statAntecedent}
                  value={severityCount("antecedent")}
                  delta={t.statAntecedentDelta}
                />
              </div>
            ) : null}

            {/* Severity filter */}
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>{t.severityEyebrow}</Eyebrow>
              {severityFilters.map((f) => (
                <FilterChip
                  key={f.key}
                  active={severityFilter === f.key}
                  onClick={() => setSeverityFilter(f.key)}
                  count={f.key === "all" ? alerts?.length ?? 0 : severityCount(f.key)}
                >
                  {f.label}
                </FilterChip>
              ))}
            </div>

            {/* Alert cards */}
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-44 rounded-xl" />
                ))}
              </div>
            ) : filteredAlerts && filteredAlerts.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredAlerts.map((alert) => {
                  const d = detectorPresentation(alert.severity, alert.patternType, lang);
                  return (
                    <Card key={alert.id} className={`flex flex-col border-l-4 ${d.border}`}>
                      <CardHeader className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {alert.patternType || t.patternFallback}
                          </span>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] ${d.pill}`}
                          >
                            {d.pillLabel}
                          </span>
                        </div>
                        <CardTitle className="font-serif text-xl font-medium leading-tight tracking-tight">
                          {alert.pattern}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {t.agentLabel}{" "}
                            <Link
                              href={`/agentes/${alert.agentId}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {alert.agentName}
                            </Link>
                          </span>
                          <StatusBadge status={alert.status} t={t} />
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3">
                        <div className="space-y-1">
                          <Eyebrow>{t.hypothesis}</Eyebrow>
                          <p className="text-[13px] leading-snug text-foreground/80">{alert.hypothesis}</p>
                        </div>
                        <div className="space-y-1">
                          <Eyebrow>{t.recommendation}</Eyebrow>
                          <p className="text-[13px] font-semibold leading-snug text-foreground/90">
                            {alert.recommendation}
                          </p>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            {t.detectedAt} {new Date(alert.detectedAt).toLocaleDateString(localeOf(lang))}
                          </span>
                          <Link
                            href={`/agentes/${alert.agentId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {t.viewAgent}
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : alerts && alerts.length > 0 ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-card-border text-sm text-muted-foreground">
                {t.emptyFiltered}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-card-border bg-muted/30 p-12 text-center">
                <ShieldCheck className="mb-3 h-10 w-10 text-chart-1 opacity-50" />
                <p className="text-sm font-medium text-foreground">{t.emptyTitle}</p>
                <p className="text-xs text-muted-foreground">{t.emptyDesc}</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
