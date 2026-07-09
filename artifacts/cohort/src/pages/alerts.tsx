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

const SEVERITY_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "critical", label: "Crítica" },
  { key: "high", label: "Alta" },
  { key: "medium", label: "Média" },
  { key: "antecedent", label: "Antecedente" },
];

const STATUS_MAP: Record<string, { label: string; tone: "sage" | "ochre" | "blue" | "muted" }> = {
  active: { label: "Ativo", tone: "ochre" },
  acknowledged: { label: "Reconhecido", tone: "blue" },
  resolved: { label: "Resolvido", tone: "sage" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, tone: "muted" as const };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export default function AlertsPage() {
  const { data: alerts, isLoading, isError, refetch } = useListFleetAlerts();
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const filteredAlerts = alerts?.filter(
    (a) => severityFilter === "all" || a.severity === severityFilter,
  );

  const severityCount = (sev: string) => alerts?.filter((a) => a.severity === sev).length ?? 0;

  return (
    <AppLayout breadcrumbs={[{ label: "Governança" }, { label: "Detector de Vitória Ilusória" }]}>
      <div className="space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow="Governança"
          title="Detector de Vitória Ilusória"
          subtitle="Monitoramento passivo que cruza as 5 camadas de KPIs em busca de contradições — ex.: adoção caindo enquanto o sucesso aparente sobe."
          action={
            <Button variant="outline" disabled>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Configurar padrões
            </Button>
          }
        />

        {isError ? (
          <ErrorState title="Não foi possível carregar os alertas" onRetry={() => refetch()} />
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
                  label="Alertas ativos"
                  value={alerts.length}
                  delta="Padrões em monitoramento"
                  tone={alerts.length > 0 ? "down" : "neutral"}
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Críticos"
                  value={severityCount("critical")}
                  delta="Atenção imediata"
                  tone={severityCount("critical") > 0 ? "down" : "neutral"}
                />
                <StatCard
                  icon={Eye}
                  label="Alta severidade"
                  value={severityCount("high")}
                  delta="Sob investigação"
                  tone={severityCount("high") > 0 ? "warn" : "neutral"}
                />
                <StatCard
                  icon={Lightbulb}
                  label="Antecedentes"
                  value={severityCount("antecedent")}
                  delta="Sinais precoces"
                />
              </div>
            ) : null}

            {/* Severity filter */}
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>Severidade</Eyebrow>
              {SEVERITY_FILTERS.map((f) => (
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
                  const d = detectorPresentation(alert.severity, alert.patternType);
                  return (
                    <Card key={alert.id} className={`flex flex-col border-l-4 ${d.border}`}>
                      <CardHeader className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {alert.patternType || "Padrão antagônico"}
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
                            Agente:{" "}
                            <Link
                              href={`/agentes/${alert.agentId}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {alert.agentName}
                            </Link>
                          </span>
                          <StatusBadge status={alert.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3">
                        <div className="space-y-1">
                          <Eyebrow>Hipótese</Eyebrow>
                          <p className="text-[13px] leading-snug text-foreground/80">{alert.hypothesis}</p>
                        </div>
                        <div className="space-y-1">
                          <Eyebrow>Recomendação</Eyebrow>
                          <p className="text-[13px] font-semibold leading-snug text-foreground/90">
                            {alert.recommendation}
                          </p>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            Detectado em {new Date(alert.detectedAt).toLocaleDateString("pt-BR")}
                          </span>
                          <Link
                            href={`/agentes/${alert.agentId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            Ver agente
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : alerts && alerts.length > 0 ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-card-border text-sm text-muted-foreground">
                Nenhum alerta para os filtros atuais.
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-card-border bg-muted/30 p-12 text-center">
                <ShieldCheck className="mb-3 h-10 w-10 text-chart-1 opacity-50" />
                <p className="text-sm font-medium text-foreground">Nenhum alerta ativo.</p>
                <p className="text-xs text-muted-foreground">
                  A frota está operando sem contradições lógicas.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
