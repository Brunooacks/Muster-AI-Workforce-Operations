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
} from "lucide-react";
import { Link } from "wouter";
import { ErrorState } from "@/components/query-state";
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

const LAYER_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const verdictMeta: Record<
  string,
  { label: string; color: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  promote: { label: "Promover", color: "bg-chart-1", badge: "default" },
  mentor: { label: "Mentorar", color: "bg-chart-2", badge: "secondary" },
  retire: { label: "Aposentar", color: "bg-destructive", badge: "destructive" },
  observation: { label: "Observação", color: "bg-chart-5", badge: "outline" },
};

function formatMonth(period: string) {
  const [y, m] = period.split("-");
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${months[Number(m) - 1] ?? m ?? ""}/${y?.slice(2) ?? ""}`;
}

function TrendPill({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-chart-1 text-xs font-medium">
        <TrendingUp className="h-3 w-3" /> +{value}
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-destructive text-xs font-medium">
        <TrendingDown className="h-3 w-3" /> {value}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground text-xs font-medium">
      <Minus className="h-3 w-3" /> 0
    </span>
  );
}

export default function DashboardPage() {
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

  const radarData =
    kpis?.layers.map((l) => ({ layer: l.label, score: l.score })) ?? [];

  return (
    <AppLayout title="Frota">
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">
            Comando da Frota
          </h2>
          <p className="text-muted-foreground text-sm">
            Desempenho consolidado em 5 camadas, retorno sobre investimento e
            alertas do Detector de Vitória Ilusória.
          </p>
        </div>

        {hasError && (
          <ErrorState
            title="Não foi possível carregar a frota"
            description="Tente novamente em instantes."
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
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : summary && kpis ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Agentes
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary.totalAgents}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.connectedPlatforms} plataformas conectadas
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saúde Média</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {summary.avgHealthScore}
                  <span className="text-lg text-muted-foreground font-normal">
                    /100
                  </span>
                </div>
                <Progress value={summary.avgHealthScore} className="h-1.5 mt-2" />
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROI da Frota</CardTitle>
                <TrendingUp className="h-4 w-4 text-chart-1" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-chart-1">
                  {kpis.roi.roiPercent > 0 ? "+" : ""}
                  {kpis.roi.roiPercent}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis.roi.profitableAgents} de {summary.totalAgents} no azul
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Valor Líquido
                </CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  R$ {(kpis.roi.netValue / 1000).toFixed(1)}k
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {(kpis.roi.monthlyValue / 1000).toFixed(1)}k valor • R${" "}
                  {(kpis.roi.monthlyCost / 1000).toFixed(1)}k custo
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border-destructive/20 bg-destructive/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-destructive">
                  Alertas Ativos
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {summary.activeAlerts}
                </div>
                <p className="text-xs text-destructive/80 mt-1">
                  Padrões ilusórios detectados
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* 5-layer radar + breakdown */}
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Perfil de Desempenho</CardTitle>
              <CardDescription>
                Média da frota nas 5 camadas de avaliação
              </CardDescription>
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
                      name="Frota"
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
              <CardTitle>Camadas de Avaliação</CardTitle>
              <CardDescription>
                Pontuação, variação no período e agentes em risco
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingKpis
                ? [1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))
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
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              {l.agentsAtRisk} em risco
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <TrendPill value={l.trend} />
                          <span className="font-semibold tabular-nums w-10 text-right">
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
            <CardTitle>Evolução das Camadas</CardTitle>
            <CardDescription>
              Tendência mensal da frota por camada de desempenho
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingKpis ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : kpis && kpis.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={kpis.trend}
                  margin={{ top: 5, right: 8, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={formatMonth}
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
                    labelFormatter={(v) => formatMonth(String(v))}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="health"
                    name="Saúde"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#gHealth)"
                  />
                  <Area type="monotone" dataKey="efficacy" name="Eficácia" stroke="hsl(var(--chart-1))" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="efficiency" name="Eficiência" stroke="hsl(var(--chart-2))" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="adoption" name="Adoção" stroke="hsl(var(--chart-3))" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="governance" name="Governança" stroke="hsl(var(--chart-4))" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="value" name="Valor" stroke="hsl(var(--chart-5))" strokeWidth={1.5} fill="transparent" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                Sem histórico suficiente para exibir tendências.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rankings + verdicts + alerts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-chart-1" /> Destaques
              </CardTitle>
              <CardDescription>Maior saúde consolidada</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingKpis
                ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
                : kpis?.topPerformers.map((a) => (
                    <Link
                      key={a.id}
                      href={`/agentes/${a.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover-elevate"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.platform}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-sm tabular-nums">{a.healthScore}</span>
                        <Badge variant={verdictMeta[a.currentVerdict]?.badge ?? "outline"} className="text-[10px]">
                          {verdictMeta[a.currentVerdict]?.label ?? a.currentVerdict}
                        </Badge>
                      </div>
                    </Link>
                  ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-chart-2" /> Em Atenção
              </CardTitle>
              <CardDescription>Menor saúde — candidatos a mentoria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingKpis
                ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
                : kpis?.atRisk.map((a) => (
                    <Link
                      key={a.id}
                      href={`/agentes/${a.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover-elevate"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.platform}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-sm tabular-nums">{a.healthScore}</span>
                        <Badge variant={verdictMeta[a.currentVerdict]?.badge ?? "outline"} className="text-[10px]">
                          {verdictMeta[a.currentVerdict]?.label ?? a.currentVerdict}
                        </Badge>
                      </div>
                    </Link>
                  ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vereditos do Comitê</CardTitle>
              <CardDescription>Distribuição da última avaliação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingSummary
                ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)
                : summary &&
                  (["promote", "mentor", "retire", "observation"] as const).map((k) => (
                    <div
                      key={k}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${verdictMeta[k].color}`} />
                        <span className="font-medium text-sm">{verdictMeta[k].label}</span>
                      </div>
                      <span className="text-lg font-semibold tabular-nums">
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
              <CardTitle>Detector de Vitória Ilusória</CardTitle>
              <CardDescription>
                Padrões enganosos de sucesso na frota
              </CardDescription>
            </div>
            <Link
              href="/alertas"
              className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
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
                    className="p-3 rounded-lg border bg-card flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          className={`h-4 w-4 ${
                            alert.severity === "critical"
                              ? "text-destructive"
                              : "text-chart-2"
                          }`}
                        />
                        <span className="font-medium text-sm">{alert.pattern}</span>
                      </div>
                      <Badge
                        variant={alert.severity === "critical" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>
                        Agente:{" "}
                        <Link
                          href={`/agentes/${alert.agentId}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {alert.agentName}
                        </Link>
                      </span>
                      <span>
                        {new Date(alert.detectedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed bg-muted/30">
                <ShieldCheck className="h-8 w-8 text-chart-1 mb-2 opacity-50" />
                <p className="text-sm font-medium">Nenhum alerta crítico</p>
                <p className="text-xs text-muted-foreground">
                  A frota está operando de forma consistente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
