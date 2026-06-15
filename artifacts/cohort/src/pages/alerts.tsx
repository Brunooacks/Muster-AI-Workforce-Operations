import { AppLayout } from "@/components/layout";
import { useListFleetAlerts } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldCheck, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function AlertsPage() {
  const { data: alerts, isLoading } = useListFleetAlerts();

  return (
    <AppLayout title="Detector de Vitória Ilusória">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Detector de Vitória Ilusória</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Monitoramento passivo que cruza as 5 camadas de KPIs em busca de contradições (ex: adoção caindo enquanto sucesso sobe).
          </p>
        </div>

        <Card className="overflow-hidden border border-border shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Padrão Detectado</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Agente Afetado</TableHead>
                <TableHead>Hipótese do Comitê</TableHead>
                <TableHead>Detectado em</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : alerts && alerts.length > 0 ? (
                alerts.map((alert) => (
                  <TableRow key={alert.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${alert.severity === 'critical' ? 'text-destructive' : 'text-chart-2'}`} />
                        {alert.pattern}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="capitalize">
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/agentes/${alert.agentId}`} className="hover:underline text-primary font-medium">
                        {alert.agentName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={alert.hypothesis}>
                      {alert.hypothesis}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(alert.detectedAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Link href={`/agentes/${alert.agentId}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <ShieldCheck className="h-8 w-8 mb-2 opacity-50" />
                      <p>Nenhum alerta ativo.</p>
                      <p className="text-xs">A frota está operando sem contradições lógicas.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
}
