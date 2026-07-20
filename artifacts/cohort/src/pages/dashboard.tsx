import { AppLayout } from "@/components/layout";
import {
  useGetFleetSummary,
  useGetFleetKpis,
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  ArrowRight,
  Eye,
} from "lucide-react";
import { Link } from "wouter";
import { ErrorState } from "@/components/query-state";
import { PageHeading, StatCard, VerdictBadge, SeverityBadge } from "@/components/cohort";
import { useLang, localeOf, type Lang } from "@/lib/i18n";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ── Dicionário da Frota (pt canônico · en · es) ───────────── */

interface FrotaDict {
  breadcrumbSection: string;
  breadcrumbPage: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  errorTitle: string;
  errorDesc: string;
  statAgents: string;
  platformsConnected: string;
  statHealth: string;
  healthDelta: string;
  statRoi: string;
  roiDelta: (profitable: number, total: number) => string;
  statNetValue: string;
  valueWord: string;
  costWord: string;
  statAlerts: string;
  alertsDelta: string;
  perfTitle: string;
  perfDesc: string;
  fleet: string;
  layersTitle: string;
  layersDesc: string;
  atRisk: string;
  evolutionTitle: string;
  evolutionDesc: string;
  series: {
    health: string;
    efficacy: string;
    efficiency: string;
    adoption: string;
    governance: string;
    value: string;
  };
  noTrend: string;
  topTitle: string;
  topDesc: string;
  attentionTitle: string;
  attentionDesc: string;
  verdictsTitle: string;
  verdictsDesc: string;
  verdictLabels: Record<string, string>;
  detectorTitle: string;
  detectorDesc: string;
  viewAll: string;
  agentLabel: string;
  noCriticalTitle: string;
  noCriticalDesc: string;
  months: string[];
}

const L: Record<Lang, FrotaDict> = {
  pt: {
    breadcrumbSection: "Operação",
    breadcrumbPage: "Frota",
    eyebrow: "Operação",
    title: "Painel da Frota",
    subtitle:
      "Desempenho consolidado em 5 camadas, retorno sobre investimento e alertas do Detector de Vitória Ilusória.",
    errorTitle: "Não foi possível carregar a frota",
    errorDesc: "Tente novamente em instantes.",
    statAgents: "Total de agentes",
    platformsConnected: "plataformas conectadas",
    statHealth: "Saúde média",
    healthDelta: "Índice consolidado da frota",
    statRoi: "ROI da frota",
    roiDelta: (profitable, total) => `${profitable} de ${total} no azul`,
    statNetValue: "Valor líquido",
    valueWord: "valor",
    costWord: "custo",
    statAlerts: "Alertas ativos",
    alertsDelta: "Padrões ilusórios detectados",
    perfTitle: "Perfil de Desempenho",
    perfDesc: "Média da frota nas 5 camadas de avaliação",
    fleet: "Frota",
    layersTitle: "Camadas de Avaliação",
    layersDesc: "Pontuação, variação no período e agentes em risco",
    atRisk: "em risco",
    evolutionTitle: "Evolução das Camadas",
    evolutionDesc: "Tendência mensal da frota por camada de desempenho",
    series: {
      health: "Saúde",
      efficacy: "Eficácia",
      efficiency: "Eficiência",
      adoption: "Adoção",
      governance: "Governança",
      value: "Valor",
    },
    noTrend: "Sem histórico suficiente para exibir tendências.",
    topTitle: "Destaques",
    topDesc: "Maior saúde consolidada",
    attentionTitle: "Em Atenção",
    attentionDesc: "Menor saúde — candidatos a mentoria",
    verdictsTitle: "Vereditos do Comitê",
    verdictsDesc: "Distribuição da última avaliação",
    verdictLabels: {
      promote: "Promover",
      mentor: "Mentorar",
      retire: "Aposentar",
      observation: "Observação",
    },
    detectorTitle: "Detector de Vitória Ilusória",
    detectorDesc: "Padrões enganosos de sucesso na frota",
    viewAll: "Ver todos",
    agentLabel: "Agente:",
    noCriticalTitle: "Nenhum alerta crítico",
    noCriticalDesc: "A frota está operando de forma consistente.",
    months: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  },
  en: {
    breadcrumbSection: "Operations",
    breadcrumbPage: "Fleet",
    eyebrow: "Operations",
    title: "Fleet Panel",
    subtitle:
      "Consolidated performance across 5 layers, return on investment and Illusory Victory Detector alerts.",
    errorTitle: "Could not load the fleet",
    errorDesc: "Try again in a moment.",
    statAgents: "Total agents",
    platformsConnected: "platforms connected",
    statHealth: "Average health",
    healthDelta: "Consolidated fleet index",
    statRoi: "Fleet ROI",
    roiDelta: (profitable, total) => `${profitable} of ${total} in the black`,
    statNetValue: "Net value",
    valueWord: "value",
    costWord: "cost",
    statAlerts: "Active alerts",
    alertsDelta: "Illusory patterns detected",
    perfTitle: "Performance Profile",
    perfDesc: "Fleet average across the 5 evaluation layers",
    fleet: "Fleet",
    layersTitle: "Evaluation Layers",
    layersDesc: "Score, change over the period and agents at risk",
    atRisk: "at risk",
    evolutionTitle: "Layer Evolution",
    evolutionDesc: "Monthly fleet trend by performance layer",
    series: {
      health: "Health",
      efficacy: "Efficacy",
      efficiency: "Efficiency",
      adoption: "Adoption",
      governance: "Governance",
      value: "Value",
    },
    noTrend: "Not enough history to display trends.",
    topTitle: "Top Performers",
    topDesc: "Highest consolidated health",
    attentionTitle: "Needs Attention",
    attentionDesc: "Lowest health — mentoring candidates",
    verdictsTitle: "Committee Verdicts",
    verdictsDesc: "Distribution of the latest evaluation",
    verdictLabels: {
      promote: "Promote",
      mentor: "Mentor",
      retire: "Retire",
      observation: "Observation",
    },
    detectorTitle: "Illusory Victory Detector",
    detectorDesc: "Deceptive success patterns in the fleet",
    viewAll: "View all",
    agentLabel: "Agent:",
    noCriticalTitle: "No critical alerts",
    noCriticalDesc: "The fleet is operating consistently.",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  es: {
    breadcrumbSection: "Operación",
    breadcrumbPage: "Flota",
    eyebrow: "Operación",
    title: "Panel de la Flota",
    subtitle:
      "Desempeño consolidado en 5 capas, retorno sobre la inversión y alertas del Detector de Victoria Ilusoria.",
    errorTitle: "No fue posible cargar la flota",
    errorDesc: "Inténtalo de nuevo en unos instantes.",
    statAgents: "Total de agentes",
    platformsConnected: "plataformas conectadas",
    statHealth: "Salud media",
    healthDelta: "Índice consolidado de la flota",
    statRoi: "ROI de la flota",
    roiDelta: (profitable, total) => `${profitable} de ${total} en positivo`,
    statNetValue: "Valor neto",
    valueWord: "valor",
    costWord: "coste",
    statAlerts: "Alertas activas",
    alertsDelta: "Patrones ilusorios detectados",
    perfTitle: "Perfil de Desempeño",
    perfDesc: "Media de la flota en las 5 capas de evaluación",
    fleet: "Flota",
    layersTitle: "Capas de Evaluación",
    layersDesc: "Puntuación, variación en el período y agentes en riesgo",
    atRisk: "en riesgo",
    evolutionTitle: "Evolución de las Capas",
    evolutionDesc: "Tendencia mensual de la flota por capa de desempeño",
    series: {
      health: "Salud",
      efficacy: "Eficacia",
      efficiency: "Eficiencia",
      adoption: "Adopción",
      governance: "Gobernanza",
      value: "Valor",
    },
    noTrend: "Sin historial suficiente para mostrar tendencias.",
    topTitle: "Destacados",
    topDesc: "Mayor salud consolidada",
    attentionTitle: "En Atención",
    attentionDesc: "Menor salud — candidatos a mentoría",
    verdictsTitle: "Veredictos del Comité",
    verdictsDesc: "Distribución de la última evaluación",
    verdictLabels: {
      promote: "Ascender",
      mentor: "Mentoría",
      retire: "Retirar",
      observation: "Observación",
    },
    detectorTitle: "Detector de Victoria Ilusoria",
    detectorDesc: "Patrones engañosos de éxito en la flota",
    viewAll: "Ver todas",
    agentLabel: "Agente:",
    noCriticalTitle: "Ninguna alerta crítica",
    noCriticalDesc: "La flota está operando de forma consistente.",
    months: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  },
};

const LAYER_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const verdictDot: Record<string, string> = {
  promote: "bg-chart-1",
  mentor: "bg-chart-2",
  retire: "bg-chart-3",
  observation: "bg-chart-5",
};

function formatMonth(period: string, months: string[]) {
  const [y, m] = period.split("-");
  return `${months[Number(m) - 1] ?? m ?? ""}/${y?.slice(2) ?? ""}`;
}

function TrendPill({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-chart-1">
        <TrendingUp className="h-3 w-3" /> +{value}
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-chart-3">
        <TrendingDown className="h-3 w-3" /> {value}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
      <Minus className="h-3 w-3" /> 0
    </span>
  );
}

const cardTitleSerif = "font-serif text-xl font-medium tracking-tight";

export default function DashboardPage() {
  const { lang } = useLang();
  const t = L[lang];
  const locale = localeOf(lang);
  const fmtMonth = (period: string) => formatMonth(period, t.months);

  const {
    data: summary,
    isLoading: loadingSummary,
    isError: errorSummary,
    refetch: refetchSummary,
  } = useGetFleetSummary();
  const {
    data: kpis,
    isLoading: loadingKpis,
    isError: errorKpis,
    refetch: refetchKpis,
  } = useGetFleetKpis();
  const {
    data: alerts,
    isLoading: loadingAlerts,
    isError: errorAlerts,
    refetch: refetchAlerts,
  } = useListFleetAlerts();

  const hasError = errorSummary || errorKpis || errorAlerts;
  const radarData = kpis?.layers.map((l) => ({ layer: l.label, score: l.score })) ?? [];

  return (
    <AppLayout breadcrumbs={[{ label: t.breadcrumbSection }, { label: t.breadcrumbPage }]}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
        />

        {hasError && (
          <ErrorState
            title={t.errorTitle}
            description={t.errorDesc}
            onRetry={() => {
              if (errorSummary) refetchSummary();
              if (errorKpis) refetchKpis();
              if (errorAlerts) refetchAlerts();
            }}
          />
        )}

        {/* Top stat row */}
        {loadingSummary || loadingKpis ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : summary && kpis ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
              icon={Users}
              label={t.statAgents}
              value={summary.totalAgents}
              delta={`${summary.connectedPlatforms} ${t.platformsConnected}`}
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
            <StatCard
              icon={TrendingUp}
              label={t.statRoi}
              value={`${kpis.roi.roiPercent > 0 ? "+" : ""}${kpis.roi.roiPercent}%`}
              delta={t.roiDelta(kpis.roi.profitableAgents, summary.totalAgents)}
              tone="up"
            />
            <StatCard
              icon={Zap}
              label={t.statNetValue}
              value={`R$ ${(kpis.roi.netValue / 1000).toFixed(1)}k`}
              delta={`R$ ${(kpis.roi.monthlyValue / 1000).toFixed(1)}k ${t.valueWord} · R$ ${(kpis.roi.monthlyCost / 1000).toFixed(1)}k ${t.costWord}`}
            />
            <StatCard
              icon={AlertTriangle}
              label={t.statAlerts}
              value={summary.activeAlerts}
              delta={t.alertsDelta}
              tone={summary.activeAlerts > 0 ? "down" : "neutral"}
            />
          </div>
        ) : null}

        {/* 5-layer radar + breakdown */}
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className={cardTitleSerif}>{t.perfTitle}</CardTitle>
              <CardDescription>{t.perfDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingKpis ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="layer"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <PolarRadiusAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                    />
                    <Radar
                      name={t.fleet}
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className={cardTitleSerif}>{t.layersTitle}</CardTitle>
              <CardDescription>{t.layersDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingKpis
                ? [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
                : kpis?.layers.map((l, idx) => (
                    <div key={l.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: LAYER_COLORS[idx] }}
                          />
                          <span className="font-medium">{l.label}</span>
                          {l.agentsAtRisk > 0 && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                              {l.agentsAtRisk} {t.atRisk}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <TrendPill value={l.trend} />
                          <span className="w-10 text-right font-mono text-sm tabular-nums">
                            {l.score}
                          </span>
                        </div>
                      </div>
                      <Progress value={l.score} className="h-1.5" />
                    </div>
                  ))}
            </CardContent>
          </Card>
        </div>

        {/* Trend area chart */}
        <Card>
          <CardHeader>
            <CardTitle className={cardTitleSerif}>{t.evolutionTitle}</CardTitle>
            <CardDescription>{t.evolutionDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingKpis ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : kpis && kpis.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={kpis.trend} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={fmtMonth}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(v) => fmtMonth(String(v))}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area type="monotone" dataKey="health" name={t.series.health} stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gHealth)" />
                  <Area type="monotone" dataKey="efficacy" name={t.series.efficacy} stroke="hsl(var(--chart-1))" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="efficiency" name={t.series.efficiency} stroke="hsl(var(--chart-2))" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="adoption" name={t.series.adoption} stroke="hsl(var(--chart-3))" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="governance" name={t.series.governance} stroke="hsl(var(--chart-4))" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="value" name={t.series.value} stroke="hsl(var(--chart-5))" strokeWidth={1.5} fill="transparent" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                {t.noTrend}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rankings + verdicts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className={`${cardTitleSerif} flex items-center gap-2`}>
                <Trophy className="h-4 w-4 text-chart-1" /> {t.topTitle}
              </CardTitle>
              <CardDescription>{t.topDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingKpis
                ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
                : kpis?.topPerformers.map((a) => (
                    <Link
                      key={a.id}
                      href={`/agentes/${a.id}`}
                      className="flex items-center justify-between rounded-lg border border-card-border bg-card p-2.5 hover-elevate"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="truncate text-xs capitalize text-muted-foreground">{a.platform}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm tabular-nums">{a.healthScore}</span>
                        <VerdictBadge verdict={a.currentVerdict} />
                      </div>
                    </Link>
                  ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className={`${cardTitleSerif} flex items-center gap-2`}>
                <AlertTriangle className="h-4 w-4 text-chart-2" /> {t.attentionTitle}
              </CardTitle>
              <CardDescription>{t.attentionDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingKpis
                ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
                : kpis?.atRisk.map((a) => (
                    <Link
                      key={a.id}
                      href={`/agentes/${a.id}`}
                      className="flex items-center justify-between rounded-lg border border-card-border bg-card p-2.5 hover-elevate"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="truncate text-xs capitalize text-muted-foreground">{a.platform}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm tabular-nums">{a.healthScore}</span>
                        <VerdictBadge verdict={a.currentVerdict} />
                      </div>
                    </Link>
                  ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className={cardTitleSerif}>{t.verdictsTitle}</CardTitle>
              <CardDescription>{t.verdictsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingSummary
                ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)
                : summary &&
                  (["promote", "mentor", "retire", "observation"] as const).map((k) => (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-lg border border-card-border bg-card p-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${verdictDot[k]}`} />
                        <span className="text-sm font-medium">{t.verdictLabels[k]}</span>
                      </div>
                      <span className="font-serif text-xl font-medium tabular-nums">
                        {summary.byVerdict[k]}
                      </span>
                    </div>
                  ))}
            </CardContent>
          </Card>
        </div>

        {/* Illusory victory detector */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className={`${cardTitleSerif} flex items-center gap-2`}>
                <Eye className="h-4 w-4 text-chart-3" /> {t.detectorTitle}
              </CardTitle>
              <CardDescription>{t.detectorDesc}</CardDescription>
            </div>
            <Link
              href="/alertas"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t.viewAll} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? (
              <div className="grid gap-3 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-md" />
                ))}
              </div>
            ) : alerts && alerts.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-col gap-2 rounded-lg border border-card-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Eye
                          className={`h-4 w-4 ${
                            alert.severity === "critical" ? "text-chart-4" : "text-chart-3"
                          }`}
                        />
                        <span className="text-sm font-medium">{alert.pattern}</span>
                      </div>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t.agentLabel}{" "}
                        <Link
                          href={`/agentes/${alert.agentId}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {alert.agentName}
                        </Link>
                      </span>
                      <span>{new Date(alert.detectedAt).toLocaleDateString(locale)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-card-border bg-muted/30 p-8 text-center">
                <ShieldCheck className="mb-2 h-8 w-8 text-chart-1 opacity-50" />
                <p className="text-sm font-medium">{t.noCriticalTitle}</p>
                <p className="text-xs text-muted-foreground">{t.noCriticalDesc}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
