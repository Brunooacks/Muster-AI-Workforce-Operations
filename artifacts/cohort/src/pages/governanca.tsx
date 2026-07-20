import { AppLayout } from "@/components/layout";
import { useGetFleetGovernance } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ShieldCheck, Scale, Eye, AlertTriangle, UserCheck } from "lucide-react";
import { ErrorState } from "@/components/query-state";
import { PageHeading, StatCard, StatusBadge, VerdictBadge, Pill, AgentDisc, Eyebrow } from "@/components/cohort";
import { platformLabel } from "@/lib/platforms";
import { useLang, localeOf, type Lang } from "@/lib/i18n";

const cardTitleSerif = "font-serif text-xl font-medium tracking-tight";

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  bcGov: "Governança",
  eyebrow: "Governança",
  title: "Governança da Frota",
  subtitle:
    "Conformidade, cadeia de responsabilidade por dono de negócio e trilha de auditoria dos vereditos do comitê.",
  errTitle: "Não foi possível carregar a governança",
  errDesc: "Tente novamente em instantes.",
  decisions: {
    pending: "Pendente",
    approved: "Aprovada",
    disagreed: "Discordada",
    exported: "Exportada",
  } as Record<string, string>,
  statCompliant: "Conformes",
  statCompliantDelta: "Agentes em conformidade",
  statScore: "Score de governança",
  statScoreDelta: "Média da frota",
  statReview: "Em revisão",
  statReviewDelta: "Sob observação do comitê",
  statAlerts: "Alertas abertos",
  statAlertsDelta: "Pendências de governança",
  statOwned: "Totalmente atribuídos",
  statOwnedDelta: "Com comitê completo",
  chainTitle: "Cadeia de responsabilidade",
  agentCount: (n: number) => `${n} agente${n === 1 ? "" : "s"}`,
  chainDesc: "Dono de negócio responsável",
  technicalPrefix: "Técnico:",
  sponsorPrefix: "Sponsor:",
  chainEmpty: "Nenhuma cadeia de responsabilidade definida.",
  auditTitle: "Trilha de auditoria",
  auditDesc: "Vereditos do comitê e suas resoluções",
  auditEmpty: "Nenhum registro de auditoria ainda.",
};

type Dict = typeof PT;

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    bcGov: "Governance",
    eyebrow: "Governance",
    title: "Fleet Governance",
    subtitle:
      "Compliance, chain of responsibility by business owner and audit trail of the committee's verdicts.",
    errTitle: "Could not load governance",
    errDesc: "Try again in a moment.",
    decisions: {
      pending: "Pending",
      approved: "Approved",
      disagreed: "Disagreed",
      exported: "Exported",
    },
    statCompliant: "Compliant",
    statCompliantDelta: "Agents in compliance",
    statScore: "Governance score",
    statScoreDelta: "Fleet average",
    statReview: "In review",
    statReviewDelta: "Under committee observation",
    statAlerts: "Open alerts",
    statAlertsDelta: "Governance pending items",
    statOwned: "Fully assigned",
    statOwnedDelta: "With a complete committee",
    chainTitle: "Chain of responsibility",
    agentCount: (n: number) => `${n} agent${n === 1 ? "" : "s"}`,
    chainDesc: "Responsible business owner",
    technicalPrefix: "Technical:",
    sponsorPrefix: "Sponsor:",
    chainEmpty: "No chain of responsibility defined.",
    auditTitle: "Audit trail",
    auditDesc: "Committee verdicts and their resolutions",
    auditEmpty: "No audit records yet.",
  },
  es: {
    bcGov: "Gobernanza",
    eyebrow: "Gobernanza",
    title: "Gobernanza de la Flota",
    subtitle:
      "Conformidad, cadena de responsabilidad por dueño de negocio y registro de auditoría de los veredictos del comité.",
    errTitle: "No fue posible cargar la gobernanza",
    errDesc: "Inténtalo de nuevo en unos instantes.",
    decisions: {
      pending: "Pendiente",
      approved: "Aprobada",
      disagreed: "En desacuerdo",
      exported: "Exportada",
    },
    statCompliant: "Conformes",
    statCompliantDelta: "Agentes en conformidad",
    statScore: "Score de gobernanza",
    statScoreDelta: "Promedio de la flota",
    statReview: "En revisión",
    statReviewDelta: "Bajo observación del comité",
    statAlerts: "Alertas abiertas",
    statAlertsDelta: "Pendientes de gobernanza",
    statOwned: "Totalmente asignados",
    statOwnedDelta: "Con comité completo",
    chainTitle: "Cadena de responsabilidad",
    agentCount: (n: number) => `${n} agente${n === 1 ? "" : "s"}`,
    chainDesc: "Dueño de negocio responsable",
    technicalPrefix: "Técnico:",
    sponsorPrefix: "Sponsor:",
    chainEmpty: "Ninguna cadena de responsabilidad definida.",
    auditTitle: "Registro de auditoría",
    auditDesc: "Veredictos del comité y sus resoluciones",
    auditEmpty: "Aún no hay registros de auditoría.",
  },
};

const DECISION_TONE: Record<string, "sage" | "ochre" | "terracotta" | "blue" | "muted"> = {
  pending: "ochre",
  approved: "sage",
  disagreed: "terracotta",
  exported: "blue",
};

function DecisionBadge({ decision, t }: { decision: string; t: Dict }) {
  const tone = DECISION_TONE[decision] ?? "muted";
  const label = t.decisions[decision] ?? decision;
  return <Pill tone={tone}>{label}</Pill>;
}

function fmtDate(value: string | null | undefined, locale: string) {
  return value ? new Date(value).toLocaleDateString(locale) : "—";
}

export default function GovernancePage() {
  const { data, isLoading, isError, refetch } = useGetFleetGovernance();
  const { lang } = useLang();
  const t = L[lang];
  const locale = localeOf(lang);
  const summary = data?.summary;

  return (
    <AppLayout breadcrumbs={[{ label: t.bcGov }, { label: t.bcGov }]}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
        />

        {isError ? (
          <ErrorState
            title={t.errTitle}
            description={t.errDesc}
            onRetry={() => refetch()}
          />
        ) : (
          <>
            {/* Stat row */}
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : summary ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard
                  icon={ShieldCheck}
                  label={t.statCompliant}
                  value={
                    <span>
                      {summary.compliantAgents}
                      <span className="text-xl text-muted-foreground">/{summary.totalAgents}</span>
                    </span>
                  }
                  delta={t.statCompliantDelta}
                  tone="up"
                />
                <StatCard
                  icon={Scale}
                  label={t.statScore}
                  value={
                    <span>
                      {summary.avgGovernanceScore}
                      <span className="text-xl text-muted-foreground">/100</span>
                    </span>
                  }
                  delta={t.statScoreDelta}
                />
                <StatCard
                  icon={Eye}
                  label={t.statReview}
                  value={summary.agentsInReview}
                  delta={t.statReviewDelta}
                  tone={summary.agentsInReview > 0 ? "warn" : "neutral"}
                />
                <StatCard
                  icon={AlertTriangle}
                  label={t.statAlerts}
                  value={summary.openAlerts}
                  delta={t.statAlertsDelta}
                  tone={summary.openAlerts > 0 ? "down" : "neutral"}
                />
                <StatCard
                  icon={UserCheck}
                  label={t.statOwned}
                  value={
                    <span>
                      {summary.fullyOwnedAgents}
                      <span className="text-xl text-muted-foreground">/{summary.totalAgents}</span>
                    </span>
                  }
                  delta={t.statOwnedDelta}
                />
              </div>
            ) : null}

            {/* Responsibility chain */}
            <div className="space-y-4">
              <Eyebrow>{t.chainTitle}</Eyebrow>
              {isLoading ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-56 rounded-xl" />
                  ))}
                </div>
              ) : data && data.responsibilityChain.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.responsibilityChain.map((group) => (
                    <Card key={group.businessOwner}>
                      <CardHeader>
                        <CardTitle className={`${cardTitleSerif} flex items-center justify-between`}>
                          <span className="truncate">{group.businessOwner}</span>
                          <span className="shrink-0 font-mono text-sm font-normal tabular-nums text-muted-foreground">
                            {t.agentCount(group.agentCount)}
                          </span>
                        </CardTitle>
                        <CardDescription>{t.chainDesc}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {group.agents.map((a) => (
                          <div
                            key={a.id}
                            className="flex flex-col gap-2 rounded-lg border border-card-border bg-card p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <AgentDisc name={a.name} size="sm" />
                                <div className="min-w-0">
                                  <Link
                                    href={`/agentes/${a.id}`}
                                    className="block truncate text-sm font-medium text-foreground hover:underline"
                                  >
                                    {a.name}
                                  </Link>
                                  <span className="truncate text-xs text-muted-foreground">{a.role}</span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <StatusBadge status={a.status} />
                                <span className="font-mono text-sm tabular-nums">{a.governanceScore}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="truncate">
                                {t.technicalPrefix} <span className="text-foreground">{a.technicalOwner}</span>
                              </span>
                              <span className="truncate">
                                {t.sponsorPrefix} <span className="text-foreground">{a.governanceSponsor}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-card-border text-sm text-muted-foreground">
                  {t.chainEmpty}
                </div>
              )}
            </div>

            {/* Audit trail */}
            <Card>
              <CardHeader>
                <CardTitle className={cardTitleSerif}>{t.auditTitle}</CardTitle>
                <CardDescription>{t.auditDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)
                ) : data && data.auditTrail.length > 0 ? (
                  data.auditTrail.map((d) => (
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
                            {platformLabel(d.platform)} · {d.decidedBy ?? "—"} · {fmtDate(d.decidedAt, locale)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <VerdictBadge verdict={d.verdict} />
                        <DecisionBadge decision={d.decision} t={t} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    {t.auditEmpty}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
