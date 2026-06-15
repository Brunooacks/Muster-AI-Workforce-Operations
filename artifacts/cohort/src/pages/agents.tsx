import { AppLayout } from "@/components/layout";
import { useListAgents } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Plus, ChevronRight, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { ErrorState } from "@/components/query-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const { data: agents, isLoading, isError, refetch } = useListAgents({ search: search || undefined });

  const filteredAgents = agents?.filter(
    (a) => verdictFilter === "all" || a.currentVerdict === verdictFilter,
  );

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

  return (
    <AppLayout title="Agentes">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Agentes</h2>
            <p className="text-muted-foreground text-sm">
              Carteira de trabalho e performance de todos os agentes da frota.
            </p>
          </div>
          <Button asChild>
            <Link href="/admissao">
              <Plus className="mr-2 h-4 w-4" />
              Admissão
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome, papel ou plataforma..."
              className="pl-9 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={verdictFilter} onValueChange={setVerdictFilter}>
            <SelectTrigger className="w-[190px] bg-card">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Veredito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vereditos</SelectItem>
              <SelectItem value="promote">Promover</SelectItem>
              <SelectItem value="mentor">Mentorar</SelectItem>
              <SelectItem value="retire">Aposentar</SelectItem>
              <SelectItem value="observation">Observação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isError ? (
          <ErrorState
            title="Não foi possível carregar os agentes"
            onRetry={() => refetch()}
          />
        ) : (
        <Card className="overflow-hidden border border-border shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Identidade</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Veredito Atual</TableHead>
                <TableHead className="text-right">Saúde</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[40px] ml-auto" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredAgents && filteredAgents.length > 0 ? (
                filteredAgents.map((agent) => (
                  <TableRow key={agent.id} className="hover:bg-muted/50 cursor-pointer group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {agent.name?.charAt(0) ?? "?"}
                        </div>
                        <div>
                          <Link href={`/agentes/${agent.id}`} className="font-medium hover:underline text-foreground block">
                            {agent.name}
                          </Link>
                          <span className="text-xs text-muted-foreground">{agent.slug}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{agent.role}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-xs">{agent.platform}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getVerdictColor(agent.currentVerdict)} font-medium`}>
                        {getVerdictLabel(agent.currentVerdict)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {agent.activeAlerts ? (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        ) : null}
                        {agent.healthScore}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/agentes/${agent.id}`}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : agents && agents.length > 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhum agente para os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhum agente encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
        )}
      </div>
    </AppLayout>
  );
}
