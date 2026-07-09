import { useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetAgent,
  useGetAgentMetrics,
  useDecideVerdict,
  useUpdateEvaluationMetric,
  useListFleetAlerts,
  getGetAgentQueryKey,
  getGetAgentMetricsQueryKey,
  getListFleetAlertsQueryKey,
} from "@workspace/api-client-react";
import type { EvaluationMetricUpdateLayerKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Check,
  X,
  Calendar,
  RefreshCw,
  Activity,
  ScrollText,
  Users,
  Compass,
  Sparkles,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ErrorState } from "@/components/query-state";
import {
  AgentDisc,
  Pill,
  StatusBadge,
  VerdictBadge,
} from "@/components/cohort";
import {
  type Audience,
  carteiraI18n,
  AudienceToggle,
  SectionHeader,
  Pillar,
  MetricRow,
  LAYER_ICON,
  LAYER_CAPTION,
  Eyebrow,
  detectorPresentation,
} from "@/components/carteira";

const AUTONOMY_LABEL: Record<string, string> = {
  autonomous: "Autônomo",
  escalates: "Escala quando necessário",
  restricted: "Restrito",
};

/* ── Section 03: deterministic timeline from metric series ── */
function MetricChart({ agentId }: { agentId: string }) {
  const { data: metrics, isLoading, isError, refetch } = useGetAgentMetrics(
    agentId,
    "30d",
    { query: { enabled: !!agentId, queryKey: getGetAgentMetricsQueryKey(agentId, "30d") } },
  );

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (isError)
    return <ErrorState compact title="Não foi possível carregar as métricas" onRetry={() => refetch()} />;
  if (!metrics || metrics.length === 0)
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-card-border bg-muted/20 text-sm text-muted-foreground">
        Nenhum dado de métrica disponível para os últimos 30 dias.
      </div>
    );

  const formattedData = metrics.map((m) => ({
    ...m,
    date: new Date(m.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
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

function verdictFromScore(score: number) {
  if (score >= 78) return "promote";
  if (score >= 62) return "mentor";
  if (score >= 50) return "observation";
  return "retire";
}

/* Reference design: month name in serif tinted by verdict, a one-line reading,
   metric rows, and a full-width verdict bar — "same panel, systemic reading". */
const SNAPSHOT_TONE: Record<string, { heading: string; subtitle: string; bar: string }> = {
  promote: {
    heading: "text-chart-1",
    subtitle: "Operação estável",
    bar: "bg-chart-1/20 text-chart-1",
  },
  mentor: {
    heading: "text-chart-2",
    subtitle: "Desempenho exige atenção",
    bar: "bg-chart-2/90 text-primary-foreground",
  },
  observation: {
    heading: "text-chart-5",
    subtitle: "Sob observação",
    bar: "bg-chart-5/20 text-chart-5",
  },
  retire: {
    heading: "text-chart-4",
    subtitle: "Qualidade comprometida",
    bar: "bg-primary text-primary-foreground",
  },
};

const VERDICT_BAR_LABEL: Record<string, string> = {
  promote: "Promover",
  mentor: "Mentoria",
  observation: "Observar",
  retire: "Decisão pendente •",
};

function TimelineSnapshots({ agentId, t }: { agentId: string; t: (typeof carteiraI18n)["gestor"] }) {
  const { data: metrics } = useGetAgentMetrics(agentId, "30d", {
    query: { enabled: !!agentId, queryKey: getGetAgentMetricsQueryKey(agentId, "30d") },
  });

  if (!metrics || metrics.length < 3) return null;

  const pickAt = (frac: number) => metrics[Math.round((metrics.length - 1) * frac)]!;
  const snaps = [pickAt(0), pickAt(0.5), pickAt(1)];

  const monthName = (ts: string) => {
    const m = new Date(ts).toLocaleDateString("pt-BR", { month: "long" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  };

  return (
    <div className="border-b border-card-border pb-6">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {snaps.map((s, i) => {
          const avg = Math.round((s.efficacy + s.efficiency + s.adoption + s.governance + s.value) / 5);
          const verdict = verdictFromScore(avg);
          const tone = SNAPSHOT_TONE[verdict] ?? SNAPSHOT_TONE.observation!;
          const isCurrent = i === snaps.length - 1;
          const dims = [
            { label: "Eficácia", v: s.efficacy },
            { label: "Eficiência", v: s.efficiency },
            { label: "Adoção", v: s.adoption },
            { label: "Governança", v: s.governance },
            { label: "Valor", v: s.value },
          ];
          return (
            <div key={i}>
              <div className="mb-3">
                <h3 className={`font-serif text-3xl font-medium tracking-tight ${tone.heading}`}>
                  {monthName(s.timestamp)}
                </h3>
                <p className={`mt-0.5 text-xs ${tone.heading}`}>{tone.subtitle}</p>
              </div>
              <div className="space-y-1.5 border-t border-card-border pt-3">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">{t.health}</span>
                  <span className="font-mono font-medium tabular-nums">{avg}</span>
                </div>
                {dims.map((d) => (
                  <div key={d.label} className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-mono tabular-nums">{Math.round(d.v)}</span>
                  </div>
                ))}
              </div>
              {/* Full-width verdict bar — current period reads as the open decision */}
              <div
                className={`mt-4 flex h-10 items-center justify-center rounded-md text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  isCurrent ? "bg-primary text-primary-foreground" : tone.bar
                }`}
              >
                {isCurrent ? "Decisão pendente •" : VERDICT_BAR_LABEL[verdict]}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center font-serif text-sm italic text-muted-foreground">
        O mesmo painel. A leitura sistêmica é que muda a decisão.
      </p>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const { toast } = useToast();
  const [audience, setAudience] = useState<Audience>("gestor");
  const t = carteiraI18n[audience];

  const { data: detail, isLoading, isError, refetch } = useGetAgent(agentId, {
    query: { enabled: !!agentId, queryKey: getGetAgentQueryKey(agentId) },
  });

  const { data: allAlerts, isError: alertsError } = useListFleetAlerts(undefined, {
    query: { queryKey: getListFleetAlertsQueryKey() },
  });

  const decideVerdict = useDecideVerdict();
  const updateMetric = useUpdateEvaluationMetric();

  const [editing, setEditing] = useState<{
    layerKey: EvaluationMetricUpdateLayerKey;
    metricLabel: string;
    target: string;
    rationale: string;
  } | null>(null);

  const handleSaveGoal = () => {
    if (!editing) return;
    updateMetric.mutate(
      {
        agentId,
        data: {
          layerKey: editing.layerKey,
          metricLabel: editing.metricLabel,
          target: editing.target.trim() ? editing.target.trim() : null,
          rationale: editing.rationale.trim() ? editing.rationale.trim() : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t.goalSaved });
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) });
        },
        onError: () => {
          toast({ title: "Erro", description: t.goalSaveError, variant: "destructive" });
        },
      },
    );
  };

  const handleDecision = (decision: "approved" | "disagreed" | "exported") => {
    decideVerdict.mutate(
      { agentId, data: { decision } },
      {
        onSuccess: () => {
          toast({
            title: "Decisão registrada",
            description: `Veredito ${
              decision === "approved" ? "aprovado" : decision === "disagreed" ? "discordado" : "exportado"
            } com sucesso.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) });
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível registrar a decisão.", variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Portfólio", href: "/agentes" }, { label: "Carregando…" }]}>
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout breadcrumbs={[{ label: "Portfólio", href: "/agentes" }, { label: "Erro" }]}>
        <ErrorState title="Não foi possível carregar o agente" onRetry={() => refetch()} />
      </AppLayout>
    );
  }

  if (!detail) {
    return (
      <AppLayout breadcrumbs={[{ label: "Portfólio", href: "/agentes" }, { label: "Não encontrado" }]}>
        <div className="flex h-64 items-center justify-center text-muted-foreground">Agente não encontrado.</div>
      </AppLayout>
    );
  }

  const { agent, identity, owners, latestEvaluation, currentVerdict } = detail;
  const agentAlerts = (allAlerts ?? []).filter((a) => a.agentId === agent.id && a.status === "active");
  const verdict = currentVerdict ?? undefined;

  const cardBase = "rounded-xl border border-card-border bg-card";

  return (
    <AppLayout breadcrumbs={[{ label: "Portfólio", href: "/agentes" }, { label: agent.name }]}>
      <div className="mx-auto max-w-6xl space-y-12 animate-in fade-in duration-500">
        {/* Audience toggle */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] italic text-muted-foreground">{t.audienceHint}</p>
          <AudienceToggle audience={audience} onChange={setAudience} />
        </div>

        {/* ===== 01 · Carteira de Trabalho ===== */}
        <section>
          <SectionHeader number="01" title={t.sec01.title} caption={t.sec01.caption} />
          <div className={cardBase}>
            {/* Persona header */}
            <div className="flex flex-col items-start justify-between gap-6 border-b border-card-border p-6 md:flex-row">
              <div className="flex gap-5">
                <AgentDisc name={agent.name} size="lg" />
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h1 className="font-serif text-4xl font-medium tracking-tight">{agent.name}</h1>
                    <span className="font-mono text-xs text-muted-foreground">
                      {agent.role} · v{agent.version}
                    </span>
                    <StatusBadge status={agent.status} />
                  </div>
                  {agent.tagline && (
                    <p className="mb-4 max-w-2xl font-serif text-xl italic leading-snug text-foreground/80">
                      “{agent.tagline}”
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {t.sinceLabel}{" "}
                      {new Date(agent.admittedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" />
                      {identity.version}ª {t.versionLabel}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      {(agent.monthlyVolume ?? 0).toLocaleString("pt-BR")} {t.executionsLabel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 rounded-lg border border-card-border bg-background/60 px-5 py-4">
                <Eyebrow>{t.health}</Eyebrow>
                <div className="font-serif text-5xl font-medium leading-none tabular-nums">{agent.healthScore}</div>
                <VerdictBadge verdict={agent.currentVerdict} />
              </div>
            </div>

            {/* Identity grid: 4 pillars */}
            <div className="grid grid-cols-1 divide-y divide-card-border md:grid-cols-2 md:divide-x lg:grid-cols-4 lg:divide-y-0">
              <Pillar icon={ScrollText} title={t.jobDescription}>
                <div className="space-y-3 text-sm">
                  <div>
                    <Eyebrow>{t.mustDo}</Eyebrow>
                    <ul className="mt-1.5 space-y-1.5">
                      {identity.shouldDo.map((item, i) => (
                        <li key={i} className="flex gap-2 text-foreground/90">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-1" />
                          <span className="text-[13px] leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <Eyebrow>{t.mustNotDo}</Eyebrow>
                    <ul className="mt-1.5 space-y-1.5">
                      {identity.shouldNotDo.map((item, i) => (
                        <li key={i} className="flex gap-2 text-foreground/90">
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-3" />
                          <span className="text-[13px] leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Pillar>

              <Pillar icon={Users} title={t.responsibility}>
                <div className="space-y-3.5 text-sm">
                  <div>
                    <Eyebrow>{t.businessOwner}</Eyebrow>
                    <div className="mt-0.5 font-medium text-foreground/90">{owners.businessOwner || "—"}</div>
                  </div>
                  <div>
                    <Eyebrow>{t.techOwner}</Eyebrow>
                    <div className="mt-0.5 font-medium text-foreground/90">{owners.technicalOwner || "—"}</div>
                  </div>
                  <div>
                    <Eyebrow>{t.governance}</Eyebrow>
                    <div className="mt-0.5 font-medium text-foreground/90">{owners.governanceSponsor || "—"}</div>
                  </div>
                </div>
              </Pillar>

              <Pillar icon={Compass} title={t.autonomy}>
                <div className="space-y-3 text-sm">
                  <div>
                    <Eyebrow>{t.level}</Eyebrow>
                    <div className="mt-1">
                      <Pill tone="blue">{AUTONOMY_LABEL[identity.autonomyLevel] ?? identity.autonomyLevel}</Pill>
                    </div>
                    {identity.autonomyNotes && (
                      <p className="mt-2 text-[13px] leading-snug text-foreground/80">{identity.autonomyNotes}</p>
                    )}
                  </div>
                  {identity.limits.length > 0 && (
                    <div className="border-t border-card-border pt-3">
                      <Eyebrow>{t.limits}</Eyebrow>
                      <ul className="mt-1.5 space-y-1">
                        {identity.limits.map((item, i) => (
                          <li key={i} className="text-[13px] leading-snug text-foreground/80">
                            · {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Pillar>

              <Pillar icon={Sparkles} title={t.origin}>
                <div className="space-y-3 text-sm">
                  {identity.businessCase.description && (
                    <p className="text-[13px] italic leading-snug text-foreground/80">
                      {identity.businessCase.description}
                    </p>
                  )}
                  <div className="space-y-2 border-t border-card-border pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t.baseline}</span>
                      <span className="font-mono text-foreground/90">{identity.businessCase.baseline || "—"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t.paybackTarget}</span>
                      <span className="font-mono text-foreground/90">{identity.businessCase.targetPayback || "—"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t.paybackReal}</span>
                      <span className="font-mono font-semibold text-primary">{identity.businessCase.actualPayback || "—"}</span>
                    </div>
                  </div>
                </div>
              </Pillar>
            </div>
          </div>
        </section>

        {/* ===== 02 · Avaliação de Desempenho ===== */}
        <section>
          <SectionHeader number="02" title={t.sec02.title} caption={t.sec02.caption} />
          {latestEvaluation.layers.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {latestEvaluation.layers.map((layer) => {
                const Icon = LAYER_ICON[layer.key] ?? Activity;
                return (
                  <div key={layer.key} className={`${cardBase} p-5`}>
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
                        <div>
                          <h3 className="font-serif text-lg font-medium leading-none tracking-tight">{layer.label}</h3>
                          <p className="mt-1 text-[11px] text-muted-foreground">{LAYER_CAPTION[layer.key]?.[audience]}</p>
                        </div>
                      </div>
                      <span className="font-serif text-2xl font-medium tabular-nums">{layer.score}</span>
                    </div>
                    <div>
                      {layer.metrics.map((m, idx) => (
                        <MetricRow
                          key={idx}
                          {...m}
                          targetLabel={t.target}
                          onTargetLabel={t.onTarget}
                          offTargetLabel={t.offTarget}
                          editLabel={t.editGoal}
                          onEdit={() =>
                            setEditing({
                              layerKey: layer.key as EvaluationMetricUpdateLayerKey,
                              metricLabel: m.label,
                              target: m.target ?? "",
                              rationale: m.rationale ?? "",
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${cardBase} flex h-32 items-center justify-center text-sm text-muted-foreground`}>
              Avaliação ainda não disponível para este agente.
            </div>
          )}
        </section>

        {/* ===== 03 · Histórico ===== */}
        <section>
          <SectionHeader number="03" title={t.sec03.title} caption={t.sec03.caption} />
          <div className={`${cardBase} p-6`}>
            <TimelineSnapshots agentId={agentId} t={t} />
            <div className="pt-6">
              <MetricChart agentId={agentId} />
            </div>
          </div>
        </section>

        {/* ===== 04 · Detector de Vitória Ilusória ===== */}
        <section>
          <SectionHeader number="04" title={t.sec04.title} caption={t.sec04.caption} />
          {alertsError ? (
            <div className={`${cardBase} flex items-center gap-3 p-5 text-sm text-muted-foreground`}>
              <AlertTriangle className="h-4 w-4 shrink-0 text-chart-3" />
              Não foi possível carregar o detector de padrões agora.
            </div>
          ) : agentAlerts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {agentAlerts.map((alert) => {
                const d = detectorPresentation(alert.severity, alert.patternType);
                return (
                  <div key={alert.id} className={`${cardBase} border-l-4 ${d.border} p-5`}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{alert.patternType}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] ${d.pill}`}
                      >
                        {d.pillLabel}
                      </span>
                    </div>
                    <h3 className="mb-3 font-serif text-xl font-medium leading-tight tracking-tight">{alert.pattern}</h3>
                    <div className="space-y-3 text-[13px]">
                      <div>
                        <Eyebrow>{t.hypothesis}</Eyebrow>
                        <p className="mt-1 leading-snug text-foreground/80">{alert.hypothesis}</p>
                      </div>
                      <div>
                        <Eyebrow>{t.action}</Eyebrow>
                        <p className="mt-1 font-semibold leading-snug text-foreground/90">{alert.recommendation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${cardBase} flex items-center gap-3 p-5 text-sm text-muted-foreground`}>
              <Eye className="h-4 w-4 shrink-0 text-chart-1" />
              {t.noAlerts}
            </div>
          )}
        </section>

        {/* ===== 05 · Recomendação para o Comitê ===== */}
        <section>
          <SectionHeader number="05" title={t.sec05.title} caption={t.sec05.caption} />
          <div className={`${cardBase} overflow-hidden`}>
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="border-b border-card-border bg-secondary/30 p-6 md:col-span-4 md:border-b-0 md:border-r">
                <Eyebrow>{t.recommendedRoute}</Eyebrow>
                <div className="mt-3 mb-4">
                  <VerdictBadge verdict={verdict?.verdict ?? agent.currentVerdict} />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.confidence}</span>
                    <span className="font-mono font-medium tabular-nums">
                      {Math.round(verdict?.confidence ?? agent.verdictConfidence)}%
                    </span>
                  </div>
                  {verdict?.executionWindow && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.window}</span>
                      <span className="font-mono font-medium">{verdict.executionWindow}</span>
                    </div>
                  )}
                  {verdict?.suggestedSponsor && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.sponsor}</span>
                      <span className="font-medium">{verdict.suggestedSponsor}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 md:col-span-8">
                {(verdict?.rationale || latestEvaluation.rationale) && (
                  <div className="mb-6">
                    <Eyebrow>{t.rationaleLabel}</Eyebrow>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                      {verdict?.rationale || latestEvaluation.rationale}
                    </p>
                  </div>
                )}
                {verdict && verdict.nextActions.length > 0 && (
                  <div className="border-t border-card-border pt-5">
                    <Eyebrow>{t.nextActions}</Eyebrow>
                    <div className="mt-4 space-y-4">
                      {verdict.nextActions.map((action, idx) => (
                        <div key={idx} className="grid grid-cols-12 items-start gap-3">
                          <div className="col-span-1">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-serif text-sm text-primary-foreground">
                              {idx + 1}
                            </div>
                          </div>
                          <div className="col-span-2 pt-1">
                            <Eyebrow>{t.in}</Eyebrow>
                            <div className="font-mono text-xs text-foreground/90">{action.due}</div>
                          </div>
                          <div className="col-span-6 pt-1">
                            <div className="text-sm font-medium text-foreground/90">{action.action}</div>
                          </div>
                          <div className="col-span-3 pt-1 text-right">
                            <Eyebrow>{t.owner}</Eyebrow>
                            <div className="text-xs font-medium text-foreground/90">{action.owner}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {verdict && verdict.decision === "pending" && (
              <div className="flex flex-col items-start justify-between gap-3 border-t border-card-border bg-background/60 px-6 py-4 sm:flex-row sm:items-center">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Decisão pendente · aguardando o comitê
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleDecision("exported")} disabled={decideVerdict.isPending}>
                    {t.export}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDecision("disagreed")} disabled={decideVerdict.isPending}>
                    <X className="mr-1 h-4 w-4" /> {t.disagree}
                  </Button>
                  <Button size="sm" onClick={() => handleDecision("approved")} disabled={decideVerdict.isPending}>
                    <Check className="mr-1 h-4 w-4" /> {t.approve}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <p className="mt-4 text-center font-serif text-sm italic text-muted-foreground">{t.quote}</p>
        </section>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.editGoalTitle}</DialogTitle>
            <DialogDescription>{t.editGoalDesc}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="text-sm font-medium text-foreground/90">
                {editing.metricLabel}
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-target">{t.targetField}</Label>
                <Input
                  id="metric-target"
                  value={editing.target}
                  placeholder={t.targetPlaceholder}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, target: e.target.value } : prev))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-rationale">{t.rationaleField}</Label>
                <Textarea
                  id="metric-rationale"
                  value={editing.rationale}
                  placeholder={t.rationalePlaceholder}
                  rows={3}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, rationale: e.target.value } : prev))
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={updateMetric.isPending}
            >
              {t.cancel}
            </Button>
            <Button onClick={handleSaveGoal} disabled={updateMetric.isPending}>
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
