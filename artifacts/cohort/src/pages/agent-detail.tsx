import { AppLayout } from "@/components/layout";
import { useGetAgent, useListAgentEvaluations, useListAgentVerdicts, useGetAgentMetrics, useDecideVerdict } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ShieldCheck, Check, X, ArrowUpRight, ArrowDownRight, Minus, ExternalLink } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { getGetAgentQueryKey, getGetAgentMetricsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

function MetricChart({ agentId }: { agentId: string }) {
  const { data: metrics } = useGetAgentMetrics(agentId, "30d", {
    query: { enabled: !!agentId, queryKey: getGetAgentMetricsQueryKey(agentId, "30d") }
  });

  if (!metrics || metrics.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed rounded-lg bg-muted/20 text-muted-foreground text-sm">
        Nenhum dado de métrica disponível para os últimos 30 dias.
      </div>
    );
  }

  const formattedData = metrics.map(m => ({
    ...m,
    date: new Date(m.timestamp).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
          <Line type="monotone" dataKey="value" name="Valor" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="efficacy" name="Eficácia" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="efficiency" name="Eficiência" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="adoption" name="Adoção" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="governance" name="Governança" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const { toast } = useToast();

  const { data: detail, isLoading } = useGetAgent(agentId, {
    query: { enabled: !!agentId, queryKey: getGetAgentQueryKey(agentId) }
  });

  const decideVerdict = useDecideVerdict();

  const handleDecision = (decision: "approved" | "disagreed" | "exported") => {
    decideVerdict.mutate(
      { agentId, data: { decision } },
      {
        onSuccess: () => {
          toast({
            title: "Decisão registrada",
            description: `Veredito ${decision === 'approved' ? 'aprovado' : decision === 'disagreed' ? 'discordado' : 'exportado'} com sucesso.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível registrar a decisão.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'promote': return 'bg-chart-1/10 text-chart-1 border-chart-1/20';
      case 'mentor': return 'bg-chart-2/10 text-chart-2 border-chart-2/20';
      case 'retire': return 'bg-chart-3/10 text-chart-3 border-chart-3/20';
      case 'observation': return 'bg-chart-5/10 text-chart-5 border-chart-5/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getVerdictLabel = (verdict: string) => {
    switch (verdict) {
      case 'promote': return 'Promover';
      case 'mentor': return 'Mentorar';
      case 'retire': return 'Aposentar';
      case 'observation': return 'Observação';
      default: return verdict;
    }
  };

  const getDirectionIcon = (direction?: string) => {
    if (direction === 'up') return <ArrowUpRight className="h-3 w-3 text-chart-1" />;
    if (direction === 'down') return <ArrowDownRight className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <AppLayout title="Carteira de Trabalho">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!detail) {
    return (
      <AppLayout title="Agente não encontrado">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Agente não encontrado.
        </div>
      </AppLayout>
    );
  }

  const { agent, identity, owners, latestEvaluation, currentVerdict } = detail;

  return (
    <AppLayout 
      breadcrumbs={[
        { label: "Agentes", href: "/agentes" },
        { label: agent.name }
      ]}
    >
      <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
        
        {/* Header Profile */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 p-6 bg-card border rounded-xl shadow-sm">
          <div className="flex gap-5">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-2xl text-primary shrink-0">
              {agent.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold tracking-tight">{agent.name}</h2>
                <Badge variant="outline" className="font-mono text-xs">{agent.version}</Badge>
                <Badge variant="secondary" className="font-normal text-xs">{agent.platform}</Badge>
              </div>
              <p className="text-muted-foreground text-sm max-w-xl">{agent.bio}</p>
              
              <div className="flex gap-4 mt-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs block mb-0.5">Dono de Negócio</span>
                  <span className="font-medium">{owners.businessOwner}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block mb-0.5">Dono Técnico</span>
                  <span className="font-medium">{owners.technicalOwner}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3 shrink-0 bg-muted/30 p-4 rounded-lg border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saúde Geral</div>
            <div className="text-4xl font-bold">{agent.healthScore}</div>
            <Badge variant="outline" className={`${getVerdictColor(agent.currentVerdict)} font-medium border-0`}>
              Veredito: {getVerdictLabel(agent.currentVerdict)}
            </Badge>
          </div>
        </div>

        {/* Current Verdict Banner */}
        {currentVerdict && currentVerdict.decision === 'pending' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getVerdictColor(currentVerdict.verdict)}>{getVerdictLabel(currentVerdict.verdict)}</Badge>
                  <span className="text-sm font-medium text-primary">Confiança: {currentVerdict.confidence}%</span>
                </div>
                <p className="text-sm text-foreground/90 font-medium mb-1">{currentVerdict.rationale}</p>
                <div className="text-xs text-muted-foreground flex gap-4">
                  <span>Sponsor: {currentVerdict.suggestedSponsor}</span>
                  <span>Janela: {currentVerdict.executionWindow}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => handleDecision('disagreed')}>
                  <X className="h-4 w-4 mr-1" /> Discordar
                </Button>
                <Button size="sm" onClick={() => handleDecision('approved')}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar Veredito
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="evaluation" className="w-full">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 space-x-6">
            <TabsTrigger value="evaluation" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 font-medium">Avaliação KPI</TabsTrigger>
            <TabsTrigger value="identity" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 font-medium">Carteira de Trabalho</TabsTrigger>
            <TabsTrigger value="actions" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 font-medium">Plano de Ação</TabsTrigger>
          </TabsList>
          
          <TabsContent value="evaluation" className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {latestEvaluation?.layers.map((layer) => (
                <Card key={layer.key} className="bg-card">
                  <CardHeader className="p-4 pb-2 border-b bg-muted/10">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{layer.label}</CardTitle>
                      <span className={`text-sm font-bold ${
                        layer.severity === 'critical' ? 'text-destructive' : 
                        layer.severity === 'high' ? 'text-chart-3' : 
                        layer.severity === 'medium' ? 'text-chart-2' : 'text-chart-1'
                      }`}>{layer.score}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {layer.metrics.map((metric, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{metric.label}</span>
                            {getDirectionIcon(metric.direction)}
                          </div>
                          <div className="font-medium text-sm">
                            {metric.value} <span className="text-xs font-normal text-muted-foreground">{metric.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* KPI Time Series would go here in a real implementation (Recharts) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Histórico de Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border border-dashed rounded-lg bg-muted/20 text-muted-foreground text-sm">
                  Gráfico de série temporal (Eficácia, Eficiência, Adoção, Governança, Valor)
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="identity" className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Diretrizes de Autonomia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Nível</h4>
                    <Badge variant="outline" className="text-sm">{identity.autonomyLevel}</Badge>
                    <p className="text-sm mt-2">{identity.autonomyNotes}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-chart-1 mb-2">Should Do</h4>
                      <ul className="space-y-1 text-sm">
                        {identity.shouldDo.map((item, i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-chart-1 shrink-0"/> <span>{item}</span></li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-destructive mb-2">Should Not Do</h4>
                      <ul className="space-y-1 text-sm">
                        {identity.shouldNotDo.map((item, i) => <li key={i} className="flex gap-2"><X className="h-4 w-4 text-destructive shrink-0"/> <span>{item}</span></li>)}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Caso de Negócio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{identity.businessCase.description}</p>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Baseline</span>
                      <span className="font-medium text-sm">{identity.businessCase.baseline}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Target</span>
                      <span className="font-medium text-sm">{identity.businessCase.targetPayback}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Atual</span>
                      <span className="font-medium text-sm text-primary">{identity.businessCase.actualPayback}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="pt-6">
             <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Próximas Ações Sugeridas</CardTitle>
                  <CardDescription>Geradas pelo comitê para o veredito atual</CardDescription>
                </CardHeader>
                <CardContent>
                  {currentVerdict && currentVerdict.nextActions.length > 0 ? (
                    <div className="space-y-4">
                      {currentVerdict.nextActions.map((action, idx) => (
                        <div key={idx} className="flex items-start justify-between p-3 border rounded-lg bg-card">
                          <div>
                            <p className="font-medium text-sm">{action.action}</p>
                            <p className="text-xs text-muted-foreground mt-1">Responsável: {action.owner}</p>
                          </div>
                          <Badge variant="outline">{action.due}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">Nenhuma ação pendente.</div>
                  )}
                </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
