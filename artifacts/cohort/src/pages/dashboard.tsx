import { AppLayout } from "@/components/layout";
import { useGetFleetSummary, useListFleetAlerts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Activity, Users, Box, Zap, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Link } from "wouter";

export default function DashboardPage() {
  const { data: summary, isLoading: isLoadingSummary } = useGetFleetSummary();
  const { data: alerts, isLoading: isLoadingAlerts } = useListFleetAlerts();

  return (
    <AppLayout title="Frota">
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Comando da Frota</h2>
          <p className="text-muted-foreground text-sm">
            Visão geral da governança e alertas ativos do Detector de Vitória Ilusória.
          </p>
        </div>
        
        {isLoadingSummary ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-elevate transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Agentes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary.totalAgents}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ativos no comitê
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saúde Média</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary.avgHealthScore}<span className="text-lg text-muted-foreground font-normal">/100</span></div>
                <p className="text-xs text-muted-foreground mt-1">
                  Métrica consolidada
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate transition-shadow border-destructive/20 bg-destructive/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Alertas Ativos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{summary.activeAlerts}</div>
                <p className="text-xs text-destructive/80 mt-1">
                  Padrões ilusórios detectados
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Gerado Estimado</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">R$ {(summary.estimatedMonthlyValue / 1000).toFixed(1)}k</div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs R$ {(summary.estimatedMonthlyCost / 1000).toFixed(1)}k de custo
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle>Vereditos Recomendados</CardTitle>
                <CardDescription>Ações sugeridas pelo comitê na última avaliação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-chart-1" />
                    <span className="font-medium">Promover</span>
                  </div>
                  <span className="text-lg font-semibold">{summary.byVerdict.promote}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-chart-2" />
                    <span className="font-medium">Mentorar</span>
                  </div>
                  <span className="text-lg font-semibold">{summary.byVerdict.mentor}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-chart-3" />
                    <span className="font-medium">Aposentar</span>
                  </div>
                  <span className="text-lg font-semibold">{summary.byVerdict.retire}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-chart-5" />
                    <span className="font-medium">Observação</span>
                  </div>
                  <span className="text-lg font-semibold">{summary.byVerdict.observation}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Detector de Vitória Ilusória</CardTitle>
                <CardDescription>Alertas críticos da frota</CardDescription>
              </div>
              <Link href="/alertas" className="text-sm text-primary hover:underline font-medium">
                Ver todos
              </Link>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              ) : alerts && alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.slice(0, 4).map((alert) => (
                    <div key={alert.id} className="p-3 rounded-lg border bg-card flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${alert.severity === 'critical' ? 'text-destructive' : 'text-chart-2'}`} />
                          <span className="font-medium text-sm">{alert.pattern}</span>
                        </div>
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {alert.severity}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>Agente: <Link href={`/agentes/${alert.agentId}`} className="font-medium text-foreground hover:underline">{alert.agentName}</Link></span>
                        <span>{new Date(alert.detectedAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed bg-muted/30">
                  <ShieldCheck className="h-8 w-8 text-chart-1 mb-2 opacity-50" />
                  <p className="text-sm font-medium">Nenhum alerta crítico</p>
                  <p className="text-xs text-muted-foreground">A frota está operando de forma consistente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
