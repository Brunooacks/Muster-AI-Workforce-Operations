import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  DatabaseZap,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link } from "wouter";
import { AgentDisc, Eyebrow, Pill } from "@/components/cohort";
import { OperationalSignal } from "@/components/mission-control/operational-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { localeOf, useLang, type Lang } from "@/lib/i18n";
import { platformLabel } from "@/lib/platforms";
import { cn } from "@/lib/utils";

type GovernanceStatus = "healthy" | "attention" | "critical" | "insufficient_data" | "not_assessed";
type HallucinationStatus = "healthy" | "warning" | "critical" | "not_measured";
type RegressionStatus = "insufficient_data" | "stable" | "drift" | "warning" | "regression";

interface RealtimeGovernanceItem {
  agentId: string;
  agentName: string;
  platform: string;
  version: string;
  agentStatus: string;
  healthScore: number;
  governanceStatus: GovernanceStatus;
  directionScore: number | null;
  protectionScore: number | null;
  proofScore: number | null;
  contextHealthScore: number | null;
  hallucinationStatus: HallucinationStatus;
  groundedOutputRate: number | null;
  hallucinationFlags: number;
  auditedOutputs: number;
  regressionStatus: RegressionStatus;
  regressionAttributable: boolean;
  inputDrift: number | null;
  baselineReleaseId: string | null;
  currentReleaseId: string | null;
  signals: unknown[];
  recommendations: string[];
  evidenceCount: number;
  sourceEventCount: number;
  assessedAt: string | null;
}

interface RealtimeGovernanceResponse {
  summary: {
    totalAgents: number;
    assessedAgents: number;
    critical: number;
    attention: number;
    insufficientData: number;
    hallucinationRisk: number;
    regressions: number;
    latestAssessment: string | null;
  };
  freshness: {
    serverTime: string;
    pollingRecommendedMs: number;
    projectionTargetSeconds: number;
  };
  items: RealtimeGovernanceItem[];
}

interface GovernanceDict {
  eyebrow: string;
  title: string;
  description: string;
  critical: string;
  criticalDetail: string;
  hallucinationRisk: string;
  hallucinationRiskDetail: string;
  regressions: string;
  regressionsDetail: string;
  coverage: string;
  coverageDetail: string;
  priorityTitle: string;
  priorityDescription: string;
  noAgentsTitle: string;
  noAgentsDescription: string;
  noPriorityTitle: string;
  noPriorityDescription: string;
  errorTitle: string;
  errorDescription: string;
  retry: string;
  openAgent: string;
  direction: string;
  protection: string;
  proof: string;
  context: string;
  notMeasured: string;
  health: string;
  grounding: string;
  groundingMeasured: string;
  groundingNotMeasured: string;
  hallucinationEvidenceUnavailable: string;
  auditedOutputs: string;
  hallucination: string;
  regression: string;
  evidence: string;
  sourceEvents: string;
  recommendation: string;
  noRecommendation: string;
  collectEvidence: string;
  attributable: string;
  inputDrift: string;
  baseline: string;
  currentRelease: string;
  latestAssessment: string;
  noAssessment: string;
  polling: string;
  projectionTarget: string;
  governanceLabels: Record<GovernanceStatus, string>;
  hallucinationLabels: Record<HallucinationStatus, string>;
  regressionLabels: Record<RegressionStatus, string>;
}

const L: Record<Lang, GovernanceDict> = {
  pt: {
    eyebrow: "Supervisão contínua",
    title: "Governança em tempo real",
    description:
      "Prioriza agentes a partir das avaliações projetadas. Ausência de medição é exibida como ausência de evidência, nunca como resultado saudável.",
    critical: "Críticos",
    criticalDetail: "avaliações em estado crítico",
    hallucinationRisk: "Risco de alucinação",
    hallucinationRiskDetail: "avaliações classificadas com risco",
    regressions: "Regressões",
    regressionsDetail: "quedas de desempenho classificadas",
    coverage: "Cobertura",
    coverageDetail: "agentes com avaliação disponível",
    priorityTitle: "Agentes prioritários",
    priorityDescription: "Até cinco agentes ordenados por criticidade, risco, regressão e falta de evidência.",
    noAgentsTitle: "Nenhum agente recebido",
    noAgentsDescription: "A API ainda não retornou agentes para a projeção de governança.",
    noPriorityTitle: "Nenhuma prioridade nas avaliações disponíveis",
    noPriorityDescription: "Os agentes avaliados não apresentam estados de atenção ou críticos nesta leitura.",
    errorTitle: "Não foi possível carregar a governança em tempo real",
    errorDescription: "A visão permanece sem classificação até a API responder com evidências.",
    retry: "Tentar novamente",
    openAgent: "Abrir agente",
    direction: "Direction",
    protection: "Protection",
    proof: "Proof",
    context: "Contexto",
    notMeasured: "Não medido",
    health: "Saúde",
    grounding: "Fundamentação",
    groundingMeasured: "saídas fundamentadas",
    groundingNotMeasured: "fundamentação não medida",
    hallucinationEvidenceUnavailable: "sem classificação conclusiva",
    auditedOutputs: "outputs auditados",
    hallucination: "Alucinação",
    regression: "Regressão",
    evidence: "evidências",
    sourceEvents: "eventos-fonte",
    recommendation: "Próxima ação",
    noRecommendation: "Nenhuma ação sugerida nas evidências atuais.",
    collectEvidence: "Coletar mais execuções antes de concluir ou intervir.",
    attributable: "Atribuível à mudança de versão",
    inputDrift: "Drift de entrada",
    baseline: "Baseline",
    currentRelease: "Versão atual",
    latestAssessment: "Última avaliação",
    noAssessment: "ainda não realizada",
    polling: "consulta",
    projectionTarget: "projeção alvo",
    governanceLabels: {
      healthy: "Saudável",
      attention: "Atenção",
      critical: "Crítico",
      insufficient_data: "Dados insuficientes",
      not_assessed: "Não avaliado",
    },
    hallucinationLabels: {
      healthy: "Saudável",
      warning: "Sinal de atenção",
      critical: "Risco crítico",
      not_measured: "Não medido",
    },
    regressionLabels: {
      insufficient_data: "Dados insuficientes",
      stable: "Estável",
      drift: "Drift observado",
      warning: "Atenção",
      regression: "Regressão",
    },
  },
  en: {
    eyebrow: "Continuous supervision",
    title: "Real-time governance",
    description:
      "Prioritizes agents from projected assessments. Missing measurements are shown as missing evidence, never as a healthy result.",
    critical: "Critical",
    criticalDetail: "assessments in critical state",
    hallucinationRisk: "Hallucination risk",
    hallucinationRiskDetail: "assessments classified at risk",
    regressions: "Regressions",
    regressionsDetail: "classified performance drops",
    coverage: "Coverage",
    coverageDetail: "agents with an available assessment",
    priorityTitle: "Priority agents",
    priorityDescription: "Up to five agents ordered by criticality, risk, regression and missing evidence.",
    noAgentsTitle: "No agents received",
    noAgentsDescription: "The API has not returned agents for governance projection yet.",
    noPriorityTitle: "No priority in available assessments",
    noPriorityDescription: "Assessed agents show no attention or critical states in this reading.",
    errorTitle: "Real-time governance could not be loaded",
    errorDescription: "The view remains unclassified until the API responds with evidence.",
    retry: "Try again",
    openAgent: "Open agent",
    direction: "Direction",
    protection: "Protection",
    proof: "Proof",
    context: "Context",
    notMeasured: "Not measured",
    health: "Health",
    grounding: "Grounding",
    groundingMeasured: "grounded outputs",
    groundingNotMeasured: "grounding not measured",
    hallucinationEvidenceUnavailable: "no conclusive classification",
    auditedOutputs: "audited outputs",
    hallucination: "Hallucination",
    regression: "Regression",
    evidence: "evidence items",
    sourceEvents: "source events",
    recommendation: "Next action",
    noRecommendation: "No action suggested by the current evidence.",
    collectEvidence: "Collect more executions before concluding or intervening.",
    attributable: "Attributable to the version change",
    inputDrift: "Input drift",
    baseline: "Baseline",
    currentRelease: "Current version",
    latestAssessment: "Latest assessment",
    noAssessment: "not performed yet",
    polling: "polling",
    projectionTarget: "projection target",
    governanceLabels: {
      healthy: "Healthy",
      attention: "Attention",
      critical: "Critical",
      insufficient_data: "Insufficient data",
      not_assessed: "Not assessed",
    },
    hallucinationLabels: {
      healthy: "Healthy",
      warning: "Warning signal",
      critical: "Critical risk",
      not_measured: "Not measured",
    },
    regressionLabels: {
      insufficient_data: "Insufficient data",
      stable: "Stable",
      drift: "Drift observed",
      warning: "Attention",
      regression: "Regression",
    },
  },
  es: {
    eyebrow: "Supervisión continua",
    title: "Gobernanza en tiempo real",
    description:
      "Prioriza agentes a partir de evaluaciones proyectadas. La falta de medición se muestra como falta de evidencia, nunca como un resultado saludable.",
    critical: "Críticos",
    criticalDetail: "evaluaciones en estado crítico",
    hallucinationRisk: "Riesgo de alucinación",
    hallucinationRiskDetail: "evaluaciones clasificadas con riesgo",
    regressions: "Regresiones",
    regressionsDetail: "caídas de rendimiento clasificadas",
    coverage: "Cobertura",
    coverageDetail: "agentes con evaluación disponible",
    priorityTitle: "Agentes prioritarios",
    priorityDescription: "Hasta cinco agentes ordenados por criticidad, riesgo, regresión y falta de evidencia.",
    noAgentsTitle: "Ningún agente recibido",
    noAgentsDescription: "La API todavía no devolvió agentes para la proyección de gobernanza.",
    noPriorityTitle: "Ninguna prioridad en las evaluaciones disponibles",
    noPriorityDescription: "Los agentes evaluados no presentan estados de atención o críticos en esta lectura.",
    errorTitle: "No fue posible cargar la gobernanza en tiempo real",
    errorDescription: "La vista permanece sin clasificación hasta que la API responda con evidencias.",
    retry: "Intentar de nuevo",
    openAgent: "Abrir agente",
    direction: "Direction",
    protection: "Protection",
    proof: "Proof",
    context: "Contexto",
    notMeasured: "No medido",
    health: "Salud",
    grounding: "Fundamentación",
    groundingMeasured: "salidas fundamentadas",
    groundingNotMeasured: "fundamentación no medida",
    hallucinationEvidenceUnavailable: "sin clasificación concluyente",
    auditedOutputs: "outputs auditados",
    hallucination: "Alucinación",
    regression: "Regresión",
    evidence: "evidencias",
    sourceEvents: "eventos fuente",
    recommendation: "Próxima acción",
    noRecommendation: "Ninguna acción sugerida por las evidencias actuales.",
    collectEvidence: "Recopilar más ejecuciones antes de concluir o intervenir.",
    attributable: "Atribuible al cambio de versión",
    inputDrift: "Drift de entrada",
    baseline: "Baseline",
    currentRelease: "Versión actual",
    latestAssessment: "Última evaluación",
    noAssessment: "aún no realizada",
    polling: "consulta",
    projectionTarget: "proyección objetivo",
    governanceLabels: {
      healthy: "Saludable",
      attention: "Atención",
      critical: "Crítico",
      insufficient_data: "Datos insuficientes",
      not_assessed: "No evaluado",
    },
    hallucinationLabels: {
      healthy: "Saludable",
      warning: "Señal de atención",
      critical: "Riesgo crítico",
      not_measured: "No medido",
    },
    regressionLabels: {
      insufficient_data: "Datos insuficientes",
      stable: "Estable",
      drift: "Drift observado",
      warning: "Atención",
      regression: "Regresión",
    },
  },
};

const GOVERNANCE_TONE: Record<GovernanceStatus, "sage" | "ochre" | "red" | "muted"> = {
  healthy: "sage",
  attention: "ochre",
  critical: "red",
  insufficient_data: "muted",
  not_assessed: "muted",
};

const HALLUCINATION_TONE: Record<HallucinationStatus, "sage" | "ochre" | "red" | "muted"> = {
  healthy: "sage",
  warning: "ochre",
  critical: "red",
  not_measured: "muted",
};

const REGRESSION_TONE: Record<RegressionStatus, "sage" | "ochre" | "red" | "blue" | "muted"> = {
  insufficient_data: "muted",
  stable: "sage",
  drift: "blue",
  warning: "ochre",
  regression: "red",
};

function priorityScore(item: RealtimeGovernanceItem): number {
  const governance = {
    critical: 600,
    attention: 420,
    insufficient_data: 120,
    not_assessed: 110,
    healthy: 0,
  }[item.governanceStatus];
  const hallucination = {
    critical: 360,
    warning: 220,
    not_measured: 40,
    healthy: 0,
  }[item.hallucinationStatus];
  const regression = {
    regression: 320,
    warning: 190,
    drift: 110,
    insufficient_data: 35,
    stable: 0,
  }[item.regressionStatus];
  return governance + hallucination + regression + (item.regressionAttributable ? 80 : 0);
}

function formatPercent(value: number): string {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function formatScore(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}`;
}

function formatDateTime(value: string | null, locale: string): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function ScoreCell({ label, value, notMeasured }: { label: string; value: number | null; notMeasured: string }) {
  const measured = value !== null;
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        measured ? "border-card-border bg-secondary/25" : "border-dashed border-card-border bg-muted/20",
      )}
    >
      <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className={cn("mt-1 block font-mono text-sm font-medium", measured ? "text-foreground" : "text-muted-foreground")}>
        {measured ? formatScore(value) : notMeasured}
      </span>
    </div>
  );
}

function requestRealtimeGovernance(): Promise<RealtimeGovernanceResponse> {
  return customFetch<RealtimeGovernanceResponse>("/api/governance/realtime", {
    credentials: "include",
    responseType: "json",
  });
}

export function RealtimeGovernancePanel() {
  const { lang } = useLang();
  const t = L[lang];
  const locale = localeOf(lang);
  const governanceQuery = useQuery({
    queryKey: ["governance", "realtime"],
    queryFn: requestRealtimeGovernance,
    refetchInterval: 5_000,
    retry: false,
  });

  const priorityItems = useMemo(
    () =>
      (governanceQuery.data?.items ?? [])
        .map((item) => ({ item, score: priorityScore(item) }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 5)
        .map(({ item }) => item),
    [governanceQuery.data?.items],
  );

  const data = governanceQuery.data;
  const coverage = data?.summary.totalAgents
    ? Math.round((data.summary.assessedAgents / data.summary.totalAgents) * 100)
    : 0;
  const latestAssessment = formatDateTime(data?.summary.latestAssessment ?? null, locale);
  const serverTime = formatDateTime(data?.freshness.serverTime ?? null, locale);

  return (
    <section aria-labelledby="realtime-governance-title" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow className="text-primary">{t.eyebrow}</Eyebrow>
          <h2 id="realtime-governance-title" className="mt-1 font-serif text-2xl font-medium tracking-tight">
            {t.title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {t.description}
          </p>
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{t.latestAssessment}: {latestAssessment ?? t.noAssessment}</span>
            <span>{t.polling} {Math.round(data.freshness.pollingRecommendedMs / 1_000)}s</span>
            <span>{t.projectionTarget} ≤ {data.freshness.projectionTargetSeconds}s</span>
            {serverTime && <span>server {serverTime}</span>}
          </div>
        )}
      </div>

      {governanceQuery.isLoading ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}
          </div>
          <Card>
            <CardContent className="space-y-3 p-5">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-36 rounded-xl" />)}
            </CardContent>
          </Card>
        </>
      ) : governanceQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t.errorTitle}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{t.errorDescription}</span>
            <Button size="sm" variant="outline" onClick={() => governanceQuery.refetch()}>
              <RefreshCw className={governanceQuery.isFetching ? "animate-spin" : undefined} />
              {t.retry}
            </Button>
          </AlertDescription>
        </Alert>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OperationalSignal
              icon={TriangleAlert}
              label={t.critical}
              value={data.summary.critical}
              detail={t.criticalDetail}
              tone={data.summary.critical > 0 ? "critical" : "neutral"}
            />
            <OperationalSignal
              icon={BrainCircuit}
              label={t.hallucinationRisk}
              value={data.summary.hallucinationRisk}
              detail={t.hallucinationRiskDetail}
              tone={data.summary.hallucinationRisk > 0 ? "attention" : "neutral"}
            />
            <OperationalSignal
              icon={ScanSearch}
              label={t.regressions}
              value={data.summary.regressions}
              detail={t.regressionsDetail}
              tone={data.summary.regressions > 0 ? "critical" : "neutral"}
            />
            <OperationalSignal
              icon={DatabaseZap}
              label={t.coverage}
              value={`${coverage}%`}
              detail={`${data.summary.assessedAgents}/${data.summary.totalAgents} ${t.coverageDetail}`}
              tone={coverage === 100 ? "stable" : coverage > 0 ? "attention" : "neutral"}
            />
          </div>

          <Card>
            <CardHeader className="border-b border-card-border">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-serif text-xl font-medium tracking-tight">{t.priorityTitle}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{t.priorityDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  {data.summary.attention > 0 && <Pill tone="ochre">{data.summary.attention} {t.governanceLabels.attention.toLowerCase()}</Pill>}
                  {data.summary.insufficientData > 0 && <Pill tone="muted">{data.summary.insufficientData} {t.governanceLabels.insufficient_data.toLowerCase()}</Pill>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.items.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <DatabaseZap className="h-9 w-9 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium text-foreground">{t.noAgentsTitle}</p>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">{t.noAgentsDescription}</p>
                </div>
              ) : priorityItems.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <CheckCircle2 className="h-9 w-9 text-chart-1" />
                  <p className="mt-3 text-sm font-medium text-foreground">{t.noPriorityTitle}</p>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">{t.noPriorityDescription}</p>
                </div>
              ) : (
                <div className="divide-y divide-card-border">
                  {priorityItems.map((item) => {
                    const measurementMissing =
                      item.governanceStatus === "not_assessed" ||
                      item.governanceStatus === "insufficient_data" ||
                      item.evidenceCount === 0;
                    const recommendation =
                      item.recommendations[0] ?? (measurementMissing ? t.collectEvidence : t.noRecommendation);
                    return (
                      <article key={item.agentId} className="p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <AgentDisc name={item.agentName} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link href={`/agentes/${item.agentId}`} className="font-medium text-foreground hover:underline">
                                  {item.agentName}
                                </Link>
                                <Pill tone={GOVERNANCE_TONE[item.governanceStatus]}>
                                  {t.governanceLabels[item.governanceStatus]}
                                </Pill>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span>{platformLabel(item.platform)}</span>
                                <span>·</span>
                                <span className="font-mono">{item.version}</span>
                                <span>·</span>
                                <span>{item.agentStatus}</span>
                                <span>·</span>
                                <span>{t.health} {Math.round(item.healthScore)}/100</span>
                              </div>
                            </div>
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/agentes/${item.agentId}`}>
                              {t.openAgent} <ArrowRight />
                            </Link>
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <ScoreCell label={t.direction} value={item.directionScore} notMeasured={t.notMeasured} />
                          <ScoreCell label={t.protection} value={item.protectionScore} notMeasured={t.notMeasured} />
                          <ScoreCell label={t.proof} value={item.proofScore} notMeasured={t.notMeasured} />
                          <ScoreCell label={t.context} value={item.contextHealthScore} notMeasured={t.notMeasured} />
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-3">
                          <div className="rounded-lg border border-card-border bg-card p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Eyebrow>{t.hallucination}</Eyebrow>
                              <Pill tone={HALLUCINATION_TONE[item.hallucinationStatus]}>
                                {t.hallucinationLabels[item.hallucinationStatus]}
                              </Pill>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {item.groundedOutputRate === null
                                ? t.groundingNotMeasured
                                : `${formatPercent(item.groundedOutputRate)} ${t.groundingMeasured}`}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {item.hallucinationStatus === "not_measured"
                                ? `${t.hallucinationEvidenceUnavailable} · ${item.auditedOutputs} ${t.auditedOutputs}`
                                : `${item.hallucinationFlags} flags · ${item.auditedOutputs} ${t.auditedOutputs}`}
                            </p>
                          </div>

                          <div className="rounded-lg border border-card-border bg-card p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Eyebrow>{t.regression}</Eyebrow>
                              <Pill tone={REGRESSION_TONE[item.regressionStatus]}>
                                {t.regressionLabels[item.regressionStatus]}
                              </Pill>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {item.inputDrift === null ? `${t.inputDrift}: ${t.notMeasured}` : `${t.inputDrift}: ${formatPercent(item.inputDrift)}`}
                            </p>
                            {item.regressionAttributable && (
                              <p className="mt-1 text-[11px] font-medium text-chart-3">{t.attributable}</p>
                            )}
                            {(item.baselineReleaseId || item.currentReleaseId) && (
                              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                                {t.baseline}: {item.baselineReleaseId ?? "—"} · {t.currentRelease}: {item.currentReleaseId ?? "—"}
                              </p>
                            )}
                          </div>

                          <div className="rounded-lg border border-card-border bg-card p-3">
                            <Eyebrow>{t.grounding}</Eyebrow>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {item.evidenceCount} {t.evidence} · {item.sourceEventCount} {t.sourceEvents}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatDateTime(item.assessedAt, locale) ?? t.noAssessment}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            <span className="font-medium text-foreground">{t.recommendation}: </span>
                            {recommendation}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
