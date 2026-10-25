import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useIdentidadeSegura } from "@/lib/clerk-safe";
import { useLocation } from "wouter";
import {
  getGetFleetKpisQueryKey,
  getGetFleetSummaryQueryKey,
  getListFleetAlertsQueryKey,
  useGetFleetKpis,
  useGetFleetSummary,
  useListFleetAlerts,
} from "@workspace/api-client-react";
import {
  Activity,
  ArrowRight,
  BellRing,
  Bot,
  BookOpenCheck,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Cloud,
  Code2,
  Database,
  ExternalLink,
  Gauge,
  GitCompareArrows,
  Laptop,
  Link2,
  ListTodo,
  LockKeyhole,
  Network,
  PlugZap,
  Plus,
  RefreshCw,
  Route,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  UserCheck,
  Users,
  Waypoints,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { readAdoptionProgress, saveAdoptionProgress } from "@/lib/onboarding";
import { PlatformIcon, PlatformStack, platformIdsFromSource } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { classeSelo, type Selo } from "@/lib/shell-nav";
import {
  PERIODOS,
  leituraIlustrativa,
  leituraOperacional,
  type Periodo,
  type StatusEntrega as StatusEntregaVisao,
} from "@/lib/visao-geral";
import {
  ComoCalculamos,
  GraficoCustoResultado,
  GraficoGastoOrcamento,
  GraficoTarefaResultado,
  MatrizCustoResultado,
} from "@/components/shell/visao-geral-graficos";
import { formatBRL, formatNumero } from "@/lib/calculadora";
import type { WorkforceProfessionalAgent } from "@/lib/workforce-agent-adapter";
import {
  accountableForWorkItem,
  participantForWorkItem,
  summarizeOperatingScenario,
  summarizeStageOperation,
  teamOperatingScenarios,
  workAllocationForParticipant,
  type TeamOperatingScenario,
  type TeamWorkItem,
  type WorkPriority,
  type WorkStatus,
} from "@/lib/team-operating-model";

type Tone = "good" | "watch" | "risk" | "neutral" | "primary";

const toneClass: Record<Tone, string> = {
  good: "bg-[color-mix(in_srgb,var(--wo-accent)_18%,var(--wo-card))] text-[var(--wo-accent)]",
  watch: "bg-[color-mix(in_srgb,var(--wo-warning)_16%,var(--wo-card))] text-[var(--wo-warning-text)]",
  risk: "bg-[color-mix(in_srgb,var(--wo-danger)_16%,var(--wo-card))] text-[var(--wo-danger-text)]",
  neutral: "bg-[var(--wo-card-2)] text-[var(--wo-muted)]",
  primary: "bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]",
};

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)]", className)}>{children}</section>;
}

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em]", toneClass[tone])}>{children}</span>;
}

function ScreenHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent)]">{eyebrow}</div>
        <h1 className="mt-2 max-w-5xl text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--wo-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SummaryCard({ label, value, note, icon: Icon, tone = "primary" }: { label: string; value: string; note: string; icon: typeof Gauge; tone?: Tone }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl", toneClass[tone])}><Icon className="h-4 w-4" /></span>
        <span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span>
      </div>
      <strong className="mt-4 block font-mono text-2xl font-medium text-[var(--wo-text)]">{value}</strong>
      <span className="mt-1 block text-[10px] text-[var(--wo-muted)]">{note}</span>
    </Panel>
  );
}

type TrendSeries = { label: string; values: number[]; color: string; dashed?: boolean };

function TrendChart({ months, series, min = 50, max = 100 }: { months: string[]; series: TrendSeries[]; min?: number; max?: number }) {
  const chartWidth = 680;
  const chartHeight = 220;
  const left = 38;
  const right = 14;
  const top = 16;
  const bottom = 34;
  const innerWidth = chartWidth - left - right;
  const innerHeight = chartHeight - top - bottom;
  const x = (index: number) => left + (index * innerWidth) / Math.max(1, months.length - 1);
  const y = (value: number) => top + ((max - value) * innerHeight) / Math.max(1, max - min);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        {series.map((item) => <span key={item.label} className="flex items-center gap-2 text-[9px] text-[var(--wo-muted)]"><span className="h-0.5 w-5 rounded-full" style={{ background: item.color }} />{item.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-auto w-full overflow-visible" role="img" aria-label="Evolução histórica mês a mês">
        {[min, min + (max - min) / 2, max].map((value) => <g key={value}><line x1={left} x2={chartWidth - right} y1={y(value)} y2={y(value)} stroke="var(--wo-line)" strokeWidth="1" /><text x={left - 7} y={y(value) + 3} textAnchor="end" fill="var(--wo-muted)" fontSize="9">{Math.round(value)}</text></g>)}
        {months.map((month, index) => <text key={month} x={x(index)} y={chartHeight - 8} textAnchor="middle" fill="var(--wo-muted)" fontSize="9">{month}</text>)}
        {series.map((item) => {
          const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
          return <g key={item.label}><polyline points={points} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={item.dashed ? "6 5" : undefined} vectorEffect="non-scaling-stroke" />{item.values.map((value, index) => <circle key={`${item.label}-${index}`} cx={x(index)} cy={y(value)} r={index === item.values.length - 1 ? 4 : 2.5} fill="var(--wo-card)" stroke={item.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}</g>;
        })}
      </svg>
    </div>
  );
}

type StatusEntrega = StatusEntregaVisao;

const statusEntregaClass: Record<StatusEntrega, string> = {
  Aceita: "border-[var(--wo-primary)]/50 text-[var(--wo-primary)]",
  Rejeitada: "border-[var(--wo-danger)]/50 text-[var(--wo-danger-text)]",
  Aguardando: "border-[var(--wo-line)] text-[var(--wo-muted)]",
};

function Bloco({
  numero,
  titulo,
  selo,
  pergunta,
  children,
  rodape,
  className,
}: {
  numero: number;
  titulo: string;
  selo: Selo;
  pergunta: string;
  children: ReactNode;
  rodape?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--wo-primary-soft)] font-mono text-[11px] text-[var(--wo-primary)]">{numero}</span>
        <h2 className="text-sm font-medium text-[var(--wo-text)]">{titulo}</h2>
        <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]", classeSelo(selo))}>{selo}</span>
      </div>
      <p className="mt-1 text-[11px] text-[var(--wo-muted)]">{pergunta}</p>
      <div className="mt-3 flex-1 space-y-3">{children}</div>
      {rodape}
    </section>
  );
}

function SerieCusto({ serie }: { serie: Array<{ periodo: string; valor: number }> }) {
  if (serie.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--wo-line)] px-3 py-4 text-[11px] leading-relaxed text-[var(--wo-muted)]">A série histórica de custo aparece após o primeiro ciclo fechado no período.</p>;
  }
  const maximo = Math.max(...serie.map((ponto) => ponto.valor));
  return (
    <div>
      <div className="flex h-24 items-end gap-2 border-b border-[var(--wo-line)] px-1">
        {serie.map((ponto, index) => (
          <div key={ponto.periodo} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="font-mono text-[9px] text-[var(--wo-muted)]">{ponto.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span
              className="w-full max-w-8 rounded-t"
              style={{ height: `${(ponto.valor / maximo) * 72}px`, background: "var(--wo-primary)", opacity: 0.45 + index * 0.09 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 px-1">
        {serie.map((ponto) => <span key={ponto.periodo} className="flex-1 text-center text-[9px] text-[var(--wo-muted)]">{ponto.periodo}</span>)}
      </div>
    </div>
  );
}

export function ManagerScreen({
  selectAgent,
  navigate,
  agents = [],
  operational = false,
}: {
  selectAgent: (agentId: string) => void;
  navigate: (screen: "portfolio" | "teams" | "journeys" | "alerts" | "entregas" | "metrics" | "admission") => void;
  agents?: WorkforceProfessionalAgent[];
  operational?: boolean;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("Este mês");
  const summaryQuery = useGetFleetSummary({
    query: {
      queryKey: getGetFleetSummaryQueryKey(),
      enabled: operational,
      refetchInterval: 60_000,
    },
  });
  const kpisQuery = useGetFleetKpis({
    query: {
      queryKey: getGetFleetKpisQueryKey(),
      enabled: operational,
      refetchInterval: 60_000,
    },
  });
  const alertsQuery = useListFleetAlerts(undefined, {
    query: {
      queryKey: getListFleetAlertsQueryKey(),
      enabled: operational,
      refetchInterval: 60_000,
    },
  });
  const summary = summaryQuery.data;
  const kpis = kpisQuery.data;
  const alerts = alertsQuery.data ?? [];
  const leitura = operational
    ? leituraOperacional({
        periodo,
        agents,
        alertas: alerts,
        totalAgents: summary?.totalAgents,
        saudeMedia: summary?.avgHealthScore,
        alertasAtivos: summary?.activeAlerts,
      })
    : leituraIlustrativa(periodo);
  const semEntregas = operational && agents.length === 0;
  const idDoAgente = (rotulo: string) => {
    const nome = rotulo.split(" · ")[0]!.trim().toLowerCase();
    return agents.find((agente) => agente.name.toLowerCase() === nome)?.id ?? nome;
  };
  const rotuloDetalhes = operational && kpis
    ? `Ver qualidade, governança e outros indicadores (${formatNumero(kpis.totalEvaluations)} avaliações) →`
    : "Ver qualidade, governança e outros indicadores →";

  return (
    <div
      className="space-y-4 p-4 sm:p-6"
      data-workforce-embedded-page={operational ? "true" : undefined}
      data-operational-source={operational ? "api" : "scenario"}
    >
      <section
        data-testid="visao-geral-abertura"
        className="rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent)]">Visão geral</span>
          {!operational && <Badge variant="illustrative">Dados ilustrativos</Badge>}
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">{leitura.rotuloPeriodo}</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--wo-muted)]">
          Saiba o que seus agentes entregaram, com prova, e quanto isso custou.
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-linha de base gap-x-3 gap-y-1">
              <strong className="font-mono text-5xl font-medium leading-none tracking-tight tabular-nums sm:text-6xl">
                {leitura.numero.valor}
              </strong>
              <span className="text-sm text-[var(--wo-muted)]">{leitura.numero.rotulo}</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--wo-text)]">{leitura.frase}</p>
          </div>
          <div role="tablist" aria-label="Período da visão geral" className="inline-flex shrink-0 gap-1 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-1">
            {PERIODOS.map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="tab"
                aria-selected={periodo === opcao}
                onClick={() => setPeriodo(opcao)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] transition-colors",
                  periodo === opcao
                    ? "bg-[var(--wo-card)] text-[var(--wo-text)] shadow-sm"
                    : "text-[var(--wo-muted)] hover:text-[var(--wo-text)]",
                )}
              >
                {opcao}
              </button>
            ))}
          </div>
        </div>
      </section>

      {semEntregas ? (
        <section className="rounded-2xl border border-dashed border-[var(--wo-line)] bg-[var(--wo-card)] p-8 text-center">
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-[var(--wo-muted)]">
            Ainda não há entregas registradas. Conecte um agente para começar. Os primeiros dados aparecem após a primeira execução.
          </p>
          <button
            type="button"
            onClick={() => navigate("admission")}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"
          >
            Conectar agente <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      ) : (
        <>
          <div data-testid="visao-geral-blocos" className="grid gap-3 xl:grid-cols-2">
            <Bloco numero={1} titulo="Entregas do período" selo="NOVO" pergunta="O que foi feito?">
              {leitura.entregas.total == null ? (
                <p className="rounded-xl border border-dashed border-[var(--wo-line)] px-3 py-4 text-[11px] leading-relaxed text-[var(--wo-muted)]">
                  {leitura.entregas.vazio}
                </p>
              ) : (
                <>
                  <p className="flex flex-wrap items-linha de base gap-x-3">
                    <strong className="font-mono text-3xl font-medium tabular-nums text-[var(--wo-text)]">{formatNumero(leitura.entregas.total)}</strong>
                    <span className="text-xs text-[var(--wo-muted)]">entregas no período · {leitura.entregas.aceitas != null ? `${formatNumero(leitura.entregas.aceitas)} aceitas` : "aceitas sem dado"}</span>
                  </p>
                  <ul className="space-y-2">
                    {leitura.entregas.ultimas.map((entrega) => (
                      <li key={entrega.id} className="flex items-start justify-between gap-3 border-b border-[var(--wo-line)] pb-2 last:border-0 last:pb-0">
                        <button type="button" onClick={() => selectAgent(idDoAgente(entrega.agente))} className="min-w-0 text-left">
                          <span className="block truncate text-xs text-[var(--wo-text)]">{entrega.descricao}</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--wo-muted)]">{entrega.agente} · {entrega.data}</span>
                        </button>
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]", statusEntregaClass[entrega.status])}>
                          {entrega.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => navigate("entregas")}
                    className="inline-flex items-center gap-2 text-xs text-[var(--wo-primary)]"
                  >
                    Ver todas as entregas <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <ComoCalculamos>
                Entrega é trabalho concluído e verificável (ticket resolvido, PR revisado). Aceita é a entrega confirmada pela regra combinada ou por uma pessoa. O total sai do período selecionado.
              </ComoCalculamos>
            </Bloco>

            <Bloco numero={2} titulo="Prova" selo="SUBSTITUI" pergunta="Como eu sei que é verdade?">
              {leitura.prova.comProva != null && leitura.prova.aceitas != null ? (
                <>
                  <p className="flex flex-wrap items-linha de base gap-x-3">
                    <strong className="font-mono text-3xl font-medium tabular-nums text-[var(--wo-text)]">{formatNumero(leitura.prova.comProva)}</strong>
                    <span className="text-xs text-[var(--wo-muted)]">de {formatNumero(leitura.prova.aceitas)} entregas aceitas com prova verificável</span>
                  </p>
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--wo-card-2)]">
                    <span
                      className="block h-full rounded-full bg-[var(--wo-primary)]"
                      style={{ width: `${leitura.prova.percentual ?? 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] leading-relaxed text-[var(--wo-muted)]">{leitura.prova.nota}</p>
                  <button
                    type="button"
                    onClick={() => navigate("entregas")}
                    className="inline-flex items-center gap-2 text-xs text-[var(--wo-primary)]"
                  >
                    Ver a prova de cada entrega <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <p className="rounded-xl border border-dashed border-[var(--wo-line)] px-3 py-4 text-[11px] leading-relaxed text-[var(--wo-muted)]">
                    {leitura.prova.vazio}
                  </p>
                  <p className="text-xs text-[var(--wo-text)]">{leitura.prova.nota}</p>
                </>
              )}
              <ComoCalculamos>
                Prova é o registro que permite conferir a entrega: origem (ticket, PR ou execução), fonte do dado e horário. Contamos entregas aceitas com os três campos preenchidos.
              </ComoCalculamos>
            </Bloco>

            <Bloco
              numero={3}
              titulo="Custo"
              selo="EVOLUI"
              pergunta="Quanto custou, e está dentro do combinado?"
              className="xl:col-span-2"
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-4">
                  <h3 className="text-xs font-medium text-[var(--wo-text)]">Gasto do mês vs. orçamento</h3>
                  <div className="mt-3">
                    <GraficoGastoOrcamento
                      gasto={leitura.custo.gasto}
                      orcamento={leitura.custo.orcamento}
                      percentual={leitura.custo.percentual}
                      periodo={leitura.rotuloPeriodo}
                      aviso={leitura.custo.aviso}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-4">
                  <h3 className="text-xs font-medium text-[var(--wo-text)]">Custo por entrega aceita</h3>
                  {leitura.custo.porEntrega == null ? (
                    <p className="mt-3 rounded-xl border border-dashed border-[var(--wo-line)] px-3 py-4 text-[11px] leading-relaxed text-[var(--wo-muted)]">
                      Sem custo por entrega aceita neste período: faltam entregas aceitas para dividir o gasto.
                    </p>
                  ) : (
                    <div className="mt-3">
                      <div className="flex flex-wrap items-linha de base gap-x-3">
                        <strong className="font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{formatBRL(leitura.custo.porEntrega)}</strong>
                        <span className="text-xs text-[var(--wo-muted)]">por entrega aceita</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--wo-muted)]">
                        {leitura.custo.meta != null
                          ? `meta combinada ${formatBRL(leitura.custo.meta)} · ${leitura.custo.porEntrega <= leitura.custo.meta ? "dentro do combinado" : "acima do combinado"}`
                          : "Sem meta definida. Defina a meta para medir o combinado."}
                      </p>
                    </div>
                  )}
                  <div className="mt-4">
                    <GraficoCustoResultado
                      muster={leitura.custo.porEntrega}
                      humano={leitura.custo.custoHumano}
                      periodo={leitura.rotuloPeriodo}
                      aviso="Sem custo por resultado no período."
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-4">
                  <h3 className="text-xs font-medium text-[var(--wo-text)]">Custo por entrega · 6 meses</h3>
                  <div className="mt-3">
                    <SerieCusto serie={leitura.custo.serie} />
                  </div>
                </div>
              </div>
              <ComoCalculamos>
                Custo por entrega aceita = gasto do período ÷ entregas aceitas. Orçamento é quanto o agente pode gastar no período. A referência humana usa o custo-hora configurado em Configurações → Custos.
              </ComoCalculamos>
            </Bloco>

            <Bloco numero={4} titulo="O que quem usa achou" selo="NOVO" pergunta="Quem recebeu a entrega ficou satisfeito?">
              {leitura.percepcao.nota == null ? (
                <p className="rounded-xl border border-dashed border-[var(--wo-line)] px-3 py-4 text-[11px] leading-relaxed text-[var(--wo-muted)]">
                  {leitura.percepcao.vazio}
                </p>
              ) : (
                <>
                  <p className="flex flex-wrap items-linha de base gap-x-3">
                    <strong className="font-mono text-3xl font-medium tabular-nums text-[var(--wo-text)]">{leitura.percepcao.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                    <span className="text-xs text-[var(--wo-muted)]">de 5 · {leitura.percepcao.respostas} respostas · {leitura.percepcao.desgostos} 👎 no período</span>
                  </p>
                  <ul className="space-y-2">
                    {leitura.percepcao.comentarios.map((comentario) => (
                      <li key={comentario.autor} className="border-b border-[var(--wo-line)] pb-2 text-[11px] last:border-0 last:pb-0">
                        <span className="text-[var(--wo-muted)]">{comentario.autor} · {comentario.nota}/5</span>
                        <p className="text-[var(--wo-text)]">{comentario.texto}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <ComoCalculamos>
                Percepção é a nota de 1 a 5 e o 👍👎 de quem recebe a entrega, com o comentário mais recente. Cobre o caso "entregue, mas não atendeu".
              </ComoCalculamos>
            </Bloco>

            <Bloco numero={5} titulo="O que fazer agora" selo="EVOLUI" pergunta="O que eu faço agora?">
              {leitura.acoes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--wo-line)] px-3 py-4 text-[11px] leading-relaxed text-[var(--wo-muted)]">
                  Sem ação recomendada neste período. As pendências são geradas quando um bloco acima sai do combinado.
                </p>
              ) : (
                <ul className="space-y-3">
                  {leitura.acoes.map((acao) => (
                    <li key={acao.id} className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3">
                      <p className="text-xs leading-relaxed text-[var(--wo-text)]">
                        <strong className="font-medium">{acao.agente}:</strong> {acao.motivo}. Sugerimos {acao.acao}.
                      </p>
                      <p className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] text-[var(--wo-muted)]">
                        <span>{acao.responsavel}</span>
                        <span aria-hidden="true">·</span>
                        <span>até {acao.prazo}</span>
                        <span aria-hidden="true">·</span>
                        <span>ligado ao {acao.bloco}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => navigate("alerts")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-4 py-2.5 text-xs font-medium text-[var(--wo-text)]"
              >
                Abrir Pendências ({leitura.acoes.length}) <ArrowRight className="h-4 w-4" />
              </button>
              <ComoCalculamos>
                Cada ação vem de um bloco acima (reabertura, custo ou percepção) ou de um alerta aberto. Decidir nas Pendências exige justificativa e fica registrado.
              </ComoCalculamos>
            </Bloco>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.1fr_.9fr]">
            <Panel className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-[var(--wo-text)]">Tarefa no prazo × resultado aceito</h2>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--wo-muted)]">
                    O combinado são duas coisas: entregar no prazo e entregar algo que quem recebe aceita.
                  </p>
                </div>
                <span className="rounded-full border border-[var(--wo-line)] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">
                  {leitura.rotuloPeriodo}
                </span>
              </div>
              <div className="mt-4">
                <GraficoTarefaResultado
                  noPrazo={leitura.tarefaResultado.noPrazo}
                  metaPrazo={leitura.tarefaResultado.metaPrazo}
                  resultado={leitura.tarefaResultado.resultado}
                  metaResultado={leitura.tarefaResultado.metaResultado}
                  periodo={leitura.rotuloPeriodo}
                  vazio={leitura.tarefaResultado.vazio}
                />
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-[var(--wo-text)]">Custo × resultado por agente</h2>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--wo-muted)]">
                    Onde cada agente está: o que ampliar, o que corrigir, o que observar e o que desligar.
                  </p>
                </div>
                <span className="rounded-full border border-[var(--wo-line)] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">
                  {leitura.rotuloPeriodo}
                </span>
              </div>
              <div className="mt-4">
                <MatrizCustoResultado
                  pontos={leitura.matriz}
                  eixoCusto={leitura.eixoCusto}
                  eixoResultado={leitura.eixoResultado}
                  vazio={leitura.matrizVazia}
                />
              </div>
            </Panel>
          </div>

          <button
            type="button"
            onClick={() => navigate("metrics")}
            className="inline-flex items-center gap-2 self-start text-xs text-[var(--wo-primary)]"
          >
            {rotuloDetalhes}
          </button>
        </>
      )}
    </div>
  );
}

type OnboardingTarget = "professional" | "connectors" | "metrics" | "portfolio" | "teams" | "journeys";

const onboardingClips: Array<{
  id: string;
  phase: string;
  title: string;
  description: string;
  duration: number;
  target: OnboardingTarget;
  icon: typeof Target;
  outcomes: string[];
}> = [
  { id: "build", phase: "Construção", title: "Construir o contrato profissional", description: "Defina propósito, deveres, responsabilidades, responsáveis e limites de autonomia antes de avaliar desempenho.", duration: 18, target: "professional", icon: Target, outcomes: ["Função explícita", "Accountability", "Autonomia segura"] },
  { id: "connect", phase: "Conexão", title: "Conectar origem e runtime", description: "Vincule cloud, SaaS, Docker, Kubernetes ou ambiente local e preserve a identidade tecnológica do agente.", duration: 18, target: "connectors", icon: Link2, outcomes: ["Credencial", "Descoberta", "Telemetria"] },
  { id: "metrics", phase: "Construção", title: "Criar o contrato de métricas", description: "Escolha acurácia, eficácia, eficiência, adoção, custo e indicadores específicos da função.", duration: 18, target: "metrics", icon: Gauge, outcomes: ["Antes do agente", "Meta", "Fonte"] },
  { id: "evaluate", phase: "Avaliação", title: "Avaliar desempenho e prova", description: "Compare histórico, meta, coorte e qualidade da prova antes de recomendar qualquer mudança.", duration: 18, target: "portfolio", icon: Activity, outcomes: ["Diagnóstico", "Confiança", "Decisão"] },
  { id: "teams", phase: "Operação", title: "Compor uma equipe mista", description: "Distribua execução, recomendação, aprovação e accountability entre pessoas e agentes.", duration: 18, target: "teams", icon: Users, outcomes: ["Papéis", "Carga", "Passagens"] },
  { id: "journey", phase: "Operação", title: "Operar uma jornada entre agentes", description: "Monitore etapas, acordos de passagem, gargalos e o resultado de ponta a ponta.", duration: 18, target: "journeys", icon: Route, outcomes: ["Etapas", "SLA", "Ações"] },
];

export function OnboardingScreen({ navigate }: { navigate: (screen: OnboardingTarget) => void }) {
  const { userId, orgId } = useIdentidadeSegura();
  const [location, setLocation] = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [watched, setWatched] = useState<string[]>([]);
  const activeClip = onboardingClips[activeIndex]!;
  const section = useMemo(() => {
    if (location === "/guia/novidades") return "updates";
    if (location === "/guia/radar") return "ecosystem";
    return "onboarding";
  }, [location]);

  useEffect(() => {
    setWatched(readAdoptionProgress(userId, orgId));
  }, [orgId, userId]);

  function markWatched(clipId: string) {
    setWatched((items) => {
      const next = items.includes(clipId) ? items : [...items, clipId];
      saveAdoptionProgress(next, userId, orgId);
      return next;
    });
  }

  const platformUpdates = [
    { date: "03 set 2026", category: "Adoção", title: "Central de adoção separada da operação", description: "Aprendizado e comunicação de produto deixam o menu recorrente e ganham acesso utilitário próprio.", target: "portfolio" as OnboardingTarget },
    { date: "03 set 2026", category: "Operação", title: "Equipes mistas ganham backlog e responsabilidade", description: "Objetivo, resultado, trabalho humano, automação, responsáveis e capacidade passam a compartilhar a mesma leitura.", target: "teams" as OnboardingTarget },
    { date: "02 set 2026", category: "Governança", title: "Decisões exigem justificativa e próximo passo", description: "Aprovar, ajustar ou rejeitar uma recomendação preserva ator, prazo, ação e trilha de auditoria.", target: "professional" as OnboardingTarget },
  ];
  const ecosystemSignals = [
    { source: "NIST", date: "14 ago 2026", title: "Identidade e autorização tornam-se fundamentos para agentes enterprise", implication: "O Muster deve tratar identidade, autoridade delegada e não repúdio como contrato operacional, não como metadado opcional.", href: "https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative" },
    { source: "OpenTelemetry", date: "03 set 2026", title: "Convenções GenAI avançam a interoperabilidade da telemetria", implication: "O contrato universal deve mapear agente, operação, conversa, modelo e fonte sem copiar conteúdo sensível por padrão.", href: "https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/" },
    { source: "Linux Foundation", date: "23 jun 2025", title: "Protocolo aberto consolida uma linguagem comum para colaboração entre agentes", implication: "Jornadas precisam observar passagens, identidade, contexto e resultado entre fornecedores, não apenas etapas internas do Muster.", href: "https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents" },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ScreenHeader eyebrow="Central de adoção" title="Aprenda, acompanhe mudanças e conecte tendências à operação." description="Este espaço apoia adoção e evolução do produto. A navegação principal permanece dedicada ao trabalho recorrente do gestor." action={<Chip tone="good">{watched.length}/{onboardingClips.length} guias concluídos</Chip>} />

      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-1" role="tablist" aria-label="Conteúdo da central de adoção">
        {[
          { id: "onboarding", label: "Começar", icon: BookOpenCheck },
          { id: "updates", label: "Novidades do Muster", icon: BellRing },
          { id: "ecosystem", label: "Radar de agentes", icon: Sparkles },
        ].map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setLocation(id === "updates" ? "/guia/novidades" : id === "ecosystem" ? "/guia/radar" : "/guia")} className={cn("inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs transition-colors", section === id ? "bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]" : "text-[var(--wo-muted)] hover:text-[var(--wo-text)]")}><Icon className="h-4 w-4" />{label}</button>)}
      </div>

      {section === "onboarding" && <div className="grid gap-3 xl:grid-cols-[300px_1fr]">
        <Panel className="p-3">
          <div className="px-2 py-2"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Trilha operacional</span><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">Seis guias visuais para orientar a prática na funcionalidade real.</p></div>
          <div className="mt-2 space-y-2">{onboardingClips.map((clip, index) => <button key={clip.id} type="button" onClick={() => setActiveIndex(index)} aria-pressed={activeIndex === index} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors", activeIndex === index ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)]" : "border-transparent bg-[var(--wo-card-2)] hover:border-[var(--wo-line)]")}><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", watched.includes(clip.id) ? toneClass.good : toneClass.primary)}>{watched.includes(clip.id) ? <Check className="h-4 w-4" /> : <clip.icon className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{clip.phase} · guia visual</span><strong className="mt-1 block text-[10px] font-medium text-[var(--wo-text)]">{clip.title}</strong></span></button>)}</div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--wo-line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-primary)]">{activeClip.phase}</span><h2 className="mt-1 text-base font-medium text-[var(--wo-text)]">{activeClip.title}</h2></div><Chip tone={watched.includes(activeClip.id) ? "good" : "neutral"}>{watched.includes(activeClip.id) ? "Concluído" : "Não assistido"}</Chip></div>
          <div className="bg-[var(--wo-bg)] p-3 sm:p-4">
            <div role="img" className="relative aspect-video overflow-hidden rounded-xl border border-[var(--wo-line)] bg-[#13231d] shadow-lg" aria-label={`Guia visual: ${activeClip.title}`}>
              <img src={`/onboarding/${activeClip.id}.png`} alt={`Tela de referência para ${activeClip.title}`} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12"><span className="text-xs font-medium text-white">Guia visual</span><p className="mt-1 text-[11px] text-white/80">Use esta referência e avance para praticar no produto.</p></div>
            </div>
          </div>
          <div className="border-t border-[var(--wo-line)] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="max-w-2xl text-[11px] leading-relaxed text-[var(--wo-muted)]">{activeClip.description}</p><div className="mt-3 flex flex-wrap gap-2">{activeClip.outcomes.map((outcome) => <Chip key={outcome} tone="neutral">{outcome}</Chip>)}</div></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => markWatched(activeClip.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs font-medium text-[var(--wo-text)]">{watched.includes(activeClip.id) ? "Guia concluído" : "Marcar como concluído"}</button><button type="button" onClick={() => navigate(activeClip.target)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">Praticar na funcionalidade <ArrowRight className="h-4 w-4" /></button></div></div></div>
        </Panel>
      </div>}

      {section === "updates" && <div className="grid gap-3 lg:grid-cols-3">{platformUpdates.map((update) => <Panel key={update.title} className="flex min-h-56 flex-col p-5"><div className="flex items-center justify-between gap-3"><Chip tone="primary">{update.category}</Chip><span className="font-mono text-[9px] text-[var(--wo-muted)]">{update.date}</span></div><h2 className="mt-5 text-lg font-medium tracking-[-0.02em] text-[var(--wo-text)]">{update.title}</h2><p className="mt-3 text-xs leading-relaxed text-[var(--wo-muted)]">{update.description}</p><button type="button" onClick={() => navigate(update.target)} className="mt-auto inline-flex items-center gap-2 pt-5 text-xs font-medium text-[var(--wo-primary)]">Ver mudança no produto <ArrowRight className="h-4 w-4" /></button></Panel>)}</div>}

      {section === "ecosystem" && <div className="space-y-3"><Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--wo-primary)]">Curadoria editorial</div><p className="mt-1 text-xs text-[var(--wo-muted)]">Sinais selecionados com fonte e implicação para o Muster. Não é um feed em tempo real.</p></div><Chip tone="watch">Atualização automática pendente</Chip></Panel><div className="grid gap-3 lg:grid-cols-3">{ecosystemSignals.map((signal) => <Panel key={signal.title} className="flex min-h-72 flex-col p-5"><div className="flex items-center justify-between gap-3"><strong className="text-xs text-[var(--wo-primary)]">{signal.source}</strong><span className="font-mono text-[9px] text-[var(--wo-muted)]">{signal.date}</span></div><h2 className="mt-5 text-lg font-medium tracking-[-0.02em] text-[var(--wo-text)]">{signal.title}</h2><div className="mt-4 rounded-xl bg-[var(--wo-card-2)] p-3"><span className="text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Implicação para o produto</span><p className="mt-2 text-[11px] leading-relaxed text-[var(--wo-text)]">{signal.implication}</p></div><a href={signal.href} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-2 pt-5 text-xs font-medium text-[var(--wo-primary)]">Abrir fonte oficial <ExternalLink className="h-3.5 w-3.5" /></a></Panel>)}</div></div>}
    </div>
  );
}

const metricDomains = [
  {
    id: "engineering",
    label: "Engenharia",
    coverage: 88,
    confidence: 94,
    freshness: "18 s",
    reviewQueue: 3,
    history: {
      purpose: [74, 78, 81, 85, 88, 91],
      quality: [79, 82, 84, 88, 93, 96],
      evidence: [83, 87, 90, 92, 95, 97],
      responsibility: [76, 79, 82, 84, 87, 89],
    },
    metrics: [
      { name: "Escopo técnico cumprido", layer: "Propósito", current: "91%", target: "≥ 90%", source: "GitHub + Linear", status: "good" as Tone },
      { name: "Defeitos escapados", layer: "Qualidade", current: "4,8%", target: "≤ 5%", source: "Sentry + incidentes", status: "good" as Tone },
      { name: "Cobertura de revisão", layer: "Responsabilidade", current: "86%", target: "≥ 92%", source: "GitHub", status: "watch" as Tone },
      { name: "Prova completa por entrega", layer: "Prova", current: "97%", target: "≥ 99%", source: "OpenTelemetry", status: "watch" as Tone },
      { name: "Mudança fora do limite combinado", layer: "Governança", current: "0,7%", target: "≤ 0,5%", source: "Motor de políticas", status: "risk" as Tone },
      { name: "Cobertura de testes da mudança", layer: "Qualidade", current: "94%", target: "≥ 90%", source: "CI/CD", status: "good" as Tone },
      { name: "Aceite humano da recomendação", layer: "Colaboração", current: "82%", target: "≥ 80%", source: "Revisões registradas", status: "good" as Tone },
      { name: "Recuperação de falha p95", layer: "Confiabilidade", current: "8 min", target: "≤ 10 min", source: "Sentry + deploy", status: "good" as Tone },
    ],
  },
  {
    id: "service",
    label: "Atendimento",
    coverage: 79,
    confidence: 91,
    freshness: "32 s",
    reviewQueue: 7,
    history: {
      purpose: [69, 73, 77, 76, 72, 74],
      quality: [75, 79, 82, 80, 76, 78],
      evidence: [81, 84, 88, 89, 90, 91],
      responsibility: [78, 82, 87, 89, 91, 93],
    },
    metrics: [
      { name: "Resolução sustentável", layer: "Propósito", current: "74%", target: "≥ 80%", source: "Zendesk + reabertura", status: "watch" as Tone },
      { name: "Escalonamento apropriado", layer: "Responsabilidade", current: "93%", target: "≥ 90%", source: "Auditoria amostral", status: "good" as Tone },
      { name: "Aderência à política", layer: "Governança", current: "98%", target: "≥ 98%", source: "Motor de políticas", status: "good" as Tone },
      { name: "Experiência pós-atendimento", layer: "Experiência", current: "4,3/5", target: "≥ 4,2", source: "Pesquisa + conversa", status: "good" as Tone },
      { name: "Reabertura em 72 horas", layer: "Qualidade", current: "18%", target: "≤ 15%", source: "Zendesk · eventos", status: "risk" as Tone },
      { name: "Transferência com contexto", layer: "Passagem", current: "88%", target: "≥ 92%", source: "Journey telemetry", status: "watch" as Tone },
      { name: "Tempo até primeira resposta", layer: "Eficiência", current: "2,8 min", target: "≤ 3 min", source: "Zendesk", status: "good" as Tone },
    ],
  },
  {
    id: "operations",
    label: "Operações",
    coverage: 71,
    confidence: 82,
    freshness: "1,4 min",
    reviewQueue: 11,
    history: {
      purpose: [81, 84, 86, 88, 86, 84],
      quality: [91, 93, 95, 97, 96, 97],
      evidence: [68, 72, 75, 79, 81, 82],
      responsibility: [70, 72, 74, 76, 75, 76],
    },
    metrics: [
      { name: "Exceções tratadas no SLA", layer: "Propósito", current: "84%", target: "≥ 92%", source: "ERP + workflow", status: "risk" as Tone },
      { name: "Precisão auditada", layer: "Qualidade", current: "96,8%", target: "≥ 98%", source: "Amostra humana", status: "watch" as Tone },
      { name: "Prova por decisão", layer: "Prova", current: "89%", target: "≥ 95%", source: "Muster telemetry", status: "watch" as Tone },
      { name: "Intervenções humanas úteis", layer: "Colaboração", current: "76%", target: "≥ 80%", source: "Revisões registradas", status: "watch" as Tone },
      { name: "Exceções reincidentes", layer: "Qualidade", current: "7,2%", target: "≤ 5%", source: "ERP + cohorts", status: "risk" as Tone },
      { name: "Decisões dentro da autonomia", layer: "Governança", current: "99,2%", target: "≥ 99%", source: "Motor de políticas", status: "good" as Tone },
      { name: "Passagem aceita sem devolução", layer: "Passagem", current: "81%", target: "≥ 90%", source: "Journey telemetry", status: "watch" as Tone },
    ],
  },
];

type MetricItem = (typeof metricDomains)[number]["metrics"][number];

const emptyMetricForm = {
  name: "",
  layer: "Propósito",
  current: "—",
  target: "≥ 80%",
  source: "Muster API",
};

export function MetricsScreen() {
  const [domainId, setDomainId] = useState("engineering");
  const [showBuilder, setShowBuilder] = useState(false);
  const [customMetrics, setCustomMetrics] = useState<Record<string, MetricItem[]>>({});
  const [metricForm, setMetricForm] = useState(emptyMetricForm);
  const [metricMessage, setMetricMessage] = useState("");
  const domain = metricDomains.find((item) => item.id === domainId) ?? metricDomains[0]!;
  const displayedMetrics = [...domain.metrics, ...(customMetrics[domain.id] ?? [])];
  const healthyMetrics = displayedMetrics.filter((metric) => metric.status === "good").length;
  const months = ["mar", "abr", "mai", "jun", "jul", "ago"];
  const historySeries: TrendSeries[] = [
    { label: "Propósito", values: domain.history.purpose, color: "var(--wo-accent)" },
    { label: "Qualidade", values: domain.history.quality, color: "var(--wo-primary)" },
    { label: "Responsabilidades", values: domain.history.responsibility, color: "var(--wo-warning)" },
    { label: "Prova", values: domain.history.evidence, color: "var(--wo-muted)", dashed: true },
  ];
  const purposeDelta = domain.history.purpose.at(-1)! - domain.history.purpose.at(-2)!;
  const qualityDelta = domain.history.quality.at(-1)! - domain.history.quality.at(-2)!;

  function addMetric() {
    if (!metricForm.name.trim()) {
      setMetricMessage("Informe o nome da métrica antes de adicionar.");
      return;
    }
    const newMetric: MetricItem = {
      name: metricForm.name.trim(),
      layer: metricForm.layer,
      current: metricForm.current.trim() || "—",
      target: metricForm.target.trim() || "—",
      source: metricForm.source,
      status: "watch",
    };
    setCustomMetrics((current) => ({ ...current, [domain.id]: [...(current[domain.id] ?? []), newMetric] }));
    setMetricForm(emptyMetricForm);
    setMetricMessage(`Métrica adicionada ao contrato de ${domain.label}.`);
    setShowBuilder(false);
  }

  function removeMetric(metricName: string) {
    setCustomMetrics((current) => ({ ...current, [domain.id]: (current[domain.id] ?? []).filter((metric) => metric.name !== metricName) }));
    setMetricMessage("Métrica personalizada removida.");
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ScreenHeader
        eyebrow="Contratos de desempenho"
        title="Métricas ligadas à função, não a um placar genérico."
        description="Cada domínio combina propósito, qualidade, responsabilidade, governança e prova. Indicadores financeiros entram somente quando fazem parte do contrato daquela função."
        action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setMetricForm({ ...emptyMetricForm, name: "Qualidade do resultado sugerida", source: "Muster API" }); setShowBuilder(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] px-4 py-2.5 text-xs text-[var(--wo-text)]"><Sparkles className="h-4 w-4" /> Sugerir contrato</button><button type="button" onClick={() => setShowBuilder((current) => !current)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><Plus className="h-4 w-4" /> Nova métrica</button></div>}
      />

      <div className="flex flex-wrap gap-2">
        {metricDomains.map((item) => (
          <button key={item.id} type="button" aria-pressed={domainId === item.id} onClick={() => setDomainId(item.id)} className={cn("rounded-xl border px-3 py-2 text-xs transition-colors", domainId === item.id ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "border-[var(--wo-line)] bg-[var(--wo-card)] text-[var(--wo-muted)]")}>{item.label}</button>
        ))}
      </div>

      {showBuilder && (
        <Panel className="border-[var(--wo-primary)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-[var(--wo-primary)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Adicionar métrica · {domain.label}</h2></div><p className="mt-2 text-[10px] text-[var(--wo-muted)]">A métrica entra no protótipo imediatamente e preserva camada, alvo e proveniência.</p></div><button type="button" onClick={() => setShowBuilder(false)} className="text-xs text-[var(--wo-muted)]">Fechar</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="xl:col-span-2"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Nome da métrica</span><input value={metricForm.name} onChange={(event) => setMetricForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Qualidade do código gerado" className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
            <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Camada</span><select value={metricForm.layer} onChange={(event) => setMetricForm((current) => ({ ...current, layer: event.target.value }))} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]">{["Propósito", "Qualidade", "Eficácia", "Eficiência", "Adoção", "Governança", "Prova", "Economia"].map((layer) => <option key={layer}>{layer}</option>)}</select></label>
            <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Resultado inicial</span><input value={metricForm.current} onChange={(event) => setMetricForm((current) => ({ ...current, current: event.target.value }))} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
            <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Meta</span><input value={metricForm.target} onChange={(event) => setMetricForm((current) => ({ ...current, target: event.target.value }))} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
            <label className="md:col-span-2 xl:col-span-2"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Fonte da prova</span><select value={metricForm.source} onChange={(event) => setMetricForm((current) => ({ ...current, source: event.target.value }))} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]">{["Muster API", "GitHub", "OpenTelemetry", "Sentry", "Zendesk", "Salesforce", "ERP", "Auditoria humana"].map((source) => <option key={source}>{source}</option>)}</select></label>
            <div className="flex items-end xl:col-span-3"><button type="button" onClick={addMetric} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 text-xs font-medium text-[var(--wo-accent-ink)]"><Plus className="h-4 w-4" /> Adicionar ao contrato</button></div>
          </div>
        </Panel>
      )}

      {metricMessage && <div role="status" className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-4 py-3 text-[11px] text-[var(--wo-accent)]">{metricMessage}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard label="Cobertura do contrato" value={`${domain.coverage}%`} note="deveres com indicador válido" icon={Target} tone="primary" />
        <SummaryCard label="Confiança da prova" value={`${domain.confidence}%`} note="fonte, janela e amostra verificadas" icon={ShieldCheck} tone="good" />
        <SummaryCard label="Dentro do combinado" value={`${healthyMetrics}/${displayedMetrics.length}`} note="métricas dentro do alvo" icon={CircleCheck} tone={healthyMetrics >= displayedMetrics.length / 2 ? "good" : "watch"} />
        <SummaryCard label="Atualização" value={domain.freshness} note="último ciclo consolidado" icon={RefreshCw} tone="neutral" />
        <SummaryCard label="Revisões pendentes" value={`${domain.reviewQueue}`} note="decisões aguardando responsável" icon={UserCheck} tone={domain.reviewQueue > 8 ? "risk" : "watch"} />
        <SummaryCard label="Variação mensal" value={`${purposeDelta >= 0 ? "+" : ""}${purposeDelta} pontos percentuais`} note="cumprimento do propósito" icon={Activity} tone={purposeDelta >= 0 ? "good" : "risk"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.45fr_.55fr]">
        <Panel className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Evolução do contrato · 6 meses</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Histórico normalizado por função, com troca de linha de base registrada.</p></div><Chip tone="primary">mensal + tempo real</Chip></div>
          <TrendChart months={months} series={historySeries} min={50} max={100} />
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-[var(--wo-primary)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Leitura mês a mês</h2></div>
          <div className="mt-4 space-y-2">{[
            ["Propósito", domain.history.purpose.at(-1), purposeDelta, "good"],
            ["Qualidade", domain.history.quality.at(-1), qualityDelta, qualityDelta >= 0 ? "good" : "risk"],
            ["Responsabilidades", domain.history.responsibility.at(-1), domain.history.responsibility.at(-1)! - domain.history.responsibility.at(-2)!, "watch"],
            ["Prova", domain.history.evidence.at(-1), domain.history.evidence.at(-1)! - domain.history.evidence.at(-2)!, "primary"],
          ].map(([label, value, delta, tone]) => <div key={label as string} className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-center justify-between"><span className="text-[10px] text-[var(--wo-muted)]">{label as string}</span><Chip tone={tone as Tone}>{(delta as number) >= 0 ? "+" : ""}{delta as number} pontos percentuais</Chip></div><div className="mt-2 flex items-end justify-between"><strong className="font-mono text-lg font-medium text-[var(--wo-text)]">{value as number}%</strong><span className="text-[9px] text-[var(--wo-muted)]">vs. jul</span></div></div>)}</div>
          <div className="mt-3 rounded-xl border border-[var(--wo-warning)] bg-[color-mix(in_srgb,var(--wo-warning)_8%,var(--wo-card))] p-3 text-[10px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-warning-text)]">Correlação:</strong> cobertura de revisão caiu antes do aumento de mudanças fora do limite combinado.</div>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_.6fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--wo-line)] px-4 py-3">
            <div><h2 className="text-sm font-medium text-[var(--wo-text)]">Contrato · {domain.label}</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Antes do agente, meta, resultado, fonte e camada profissional.</p></div>
            <Chip tone="good">instrumentado</Chip>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead><tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><th className="px-4 py-3 font-normal">Indicador</th><th className="px-3 py-3 font-normal">Camada</th><th className="px-3 py-3 font-normal">Fonte</th><th className="px-3 py-3 text-right font-normal">Atual</th><th className="px-4 py-3 text-right font-normal">Combinado</th></tr></thead>
              <tbody>{displayedMetrics.map((metric) => { const isCustom = (customMetrics[domain.id] ?? []).some((item) => item.name === metric.name); return <tr key={metric.name} className="border-t border-[var(--wo-line)]"><td className="px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="font-medium text-[var(--wo-text)]">{metric.name}</span>{isCustom && <button type="button" onClick={() => removeMetric(metric.name)} title="Remover métrica" className="rounded-lg p-1.5 text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)] hover:text-[var(--wo-danger-text)]"><Trash2 className="h-3.5 w-3.5" /></button>}</div></td><td className="px-3 py-3"><Chip tone={isCustom ? "primary" : "neutral"}>{metric.layer}</Chip></td><td className="px-3 py-3 text-[var(--wo-muted)]"><div className="flex items-center gap-2"><PlatformStack platforms={platformIdsFromSource(metric.source)} compact /><span>{metric.source}</span></div></td><td className={cn("px-3 py-3 text-right font-mono", metric.status === "good" ? "text-[var(--wo-accent)]" : metric.status === "watch" ? "text-[var(--wo-warning-text)]" : "text-[var(--wo-danger-text)]")}>{metric.current}</td><td className="px-4 py-3 text-right font-mono text-[var(--wo-muted)]">{metric.target}</td></tr>; })}</tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--wo-text)]"><Gauge className="h-4 w-4 text-[var(--wo-primary)]" /> Qualidade do contrato</div>
            <div className="mt-4 space-y-3">{[
              ["Propósito coberto", 100],
              ["Responsabilidades", domain.coverage],
              ["Fontes confiáveis", domain.confidence],
              ["Antes do agente definido", 83],
              ["Responsável e cadência", 100],
            ].map(([label, value]) => <div key={label as string}><div className="mb-1 flex justify-between text-[10px]"><span className="text-[var(--wo-muted)]">{label as string}</span><span className="font-mono text-[var(--wo-text)]">{value as number}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--wo-line)]"><div className="h-full rounded-full bg-[var(--wo-primary)]" style={{ width: `${value}%` }} /></div></div>)}</div>
          </Panel>
          <Panel className="border-[var(--wo-warning)] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--wo-warning-text)]"><TriangleAlert className="h-4 w-4" /> Lacuna sugerida</div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--wo-muted)]">Falta medir se as recomendações técnicas reduzem retrabalho após dois ciclos. O Muster sugere uma coorte com revisão humana.</p>
            <button type="button" onClick={() => { setMetricForm({ ...emptyMetricForm, name: "Efetividade da recomendação técnica", layer: "Eficácia", source: "Auditoria humana" }); setShowBuilder(true); }} className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[var(--wo-text)]">Configurar indicador <ArrowRight className="h-3.5 w-3.5" /></button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

const mixedTeams = [
  {
    id: "engineering",
    name: "Engenharia assistida",
    purpose: "Entregar mudanças confiáveis dentro do escopo técnico aprovado.",
    humans: 7,
    agents: 4,
    contract: 89,
    health: 92,
    owner: "Marina Costa",
    handoff: 94,
    evidence: 97,
    humanReview: 21,
    autonomy: 64,
    throughput: "+18%",
    risks: 1,
    history: { purpose: [78, 81, 83, 86, 88, 89], health: [84, 86, 89, 90, 91, 92], handoff: [86, 88, 91, 92, 93, 94], review: [34, 31, 29, 26, 23, 21] },
    members: [
      { name: "Marina", role: "Humana · accountable", purpose: 94, quality: 92, load: 78, interventions: 43, status: "good" as Tone },
      { name: "Vega", role: "Agente · execução", purpose: 91, quality: 96, load: 84, interventions: 6, status: "good" as Tone },
      { name: "Revisor PR", role: "Agente · especialista", purpose: 76, quality: 81, load: 93, interventions: 18, status: "watch" as Tone },
      { name: "Atlas", role: "Agente · planejamento", purpose: 87, quality: 90, load: 71, interventions: 11, status: "good" as Tone },
      { name: "SRE on-call", role: "Humano · autoridade", purpose: 92, quality: 95, load: 61, interventions: 22, status: "primary" as Tone },
    ],
  },
  {
    id: "service",
    name: "Atendimento híbrido",
    purpose: "Resolver demandas elegíveis com qualidade e baixa reincidência.",
    humans: 12,
    agents: 6,
    contract: 78,
    health: 81,
    owner: "Patrícia Lima",
    handoff: 82,
    evidence: 91,
    humanReview: 34,
    autonomy: 48,
    throughput: "+9%",
    risks: 3,
    history: { purpose: [72, 75, 79, 81, 77, 78], health: [76, 78, 80, 82, 80, 81], handoff: [75, 78, 80, 84, 83, 82], review: [42, 40, 37, 35, 33, 34] },
    members: [
      { name: "Patrícia", role: "Humana · accountable", purpose: 91, quality: 90, load: 88, interventions: 57, status: "watch" as Tone },
      { name: "Sofia", role: "Agente · resolução", purpose: 61, quality: 68, load: 96, interventions: 32, status: "risk" as Tone },
      { name: "Lia", role: "Agente · triagem", purpose: 84, quality: 86, load: 79, interventions: 12, status: "good" as Tone },
      { name: "Monitor", role: "Agente · resultado", purpose: 74, quality: 82, load: 66, interventions: 8, status: "watch" as Tone },
      { name: "Especialista N2", role: "Humano · decisão", purpose: 88, quality: 93, load: 91, interventions: 49, status: "watch" as Tone },
    ],
  },
  {
    id: "operations",
    name: "Operações críticas",
    purpose: "Tratar exceções com precisão, prova e decisão responsável.",
    humans: 5,
    agents: 3,
    contract: 73,
    health: 76,
    owner: "Lucas Prado",
    handoff: 81,
    evidence: 82,
    humanReview: 46,
    autonomy: 39,
    throughput: "+4%",
    risks: 5,
    history: { purpose: [69, 72, 76, 79, 75, 73], health: [70, 73, 75, 78, 77, 76], handoff: [76, 78, 80, 84, 82, 81], review: [51, 49, 47, 45, 44, 46] },
    members: [
      { name: "Lucas", role: "Humano · accountable", purpose: 87, quality: 91, load: 94, interventions: 68, status: "risk" as Tone },
      { name: "Dora", role: "Agente · conciliação", purpose: 48, quality: 63, load: 72, interventions: 41, status: "risk" as Tone },
      { name: "Auditor", role: "Agente · prova", purpose: 82, quality: 88, load: 64, interventions: 9, status: "good" as Tone },
      { name: "Analista sênior", role: "Humano · exceção", purpose: 91, quality: 96, load: 97, interventions: 73, status: "risk" as Tone },
      { name: "ERP bridge", role: "Agente · passagem", purpose: 79, quality: 84, load: 59, interventions: 7, status: "watch" as Tone },
    ],
  },
];

export function MixedTeamsScreen() {
  const [teamId, setTeamId] = useState("engineering");
  const [showTeamBuilder, setShowTeamBuilder] = useState(false);
  const team = mixedTeams.find((item) => item.id === teamId) ?? mixedTeams[0]!;
  const months = ["mar", "abr", "mai", "jun", "jul", "ago"];
  const teamHistorySeries: TrendSeries[] = [
    { label: "Propósito", values: team.history.purpose, color: "var(--wo-accent)" },
    { label: "Saúde", values: team.history.health, color: "var(--wo-primary)" },
    { label: "Passagens", values: team.history.handoff, color: "var(--wo-warning)" },
    { label: "Intervenção humana", values: team.history.review, color: "var(--wo-danger)", dashed: true },
  ];
  const sharedWork = 100 - team.autonomy - team.humanReview;
  const decisions = team.id === "engineering"
    ? [["Executar mudança de baixo risco", "Vega", "Autônoma", "good"], ["Recomendar bloqueio técnico", "Revisor PR", "Autônoma", "good"], ["Aceitar risco residual", "Marina", "Humana", "primary"], ["Alterar limite combinado de produção", "Comitê", "Humana", "risk"]]
    : team.id === "service"
      ? [["Resolver solicitação elegível", "Sofia", "Supervisionada", "watch"], ["Transferir com contexto", "Lia", "Autônoma", "good"], ["Aplicar exceção de política", "Patrícia", "Humana", "primary"], ["Encerrar caso crítico", "Especialista N2", "Humana", "risk"]]
      : [["Conciliar item aderente", "Dora", "Supervisionada", "watch"], ["Validar prova", "Auditor", "Autônoma", "good"], ["Resolver exceção financeira", "Lucas", "Humana", "primary"], ["Alterar regra contábil", "Comitê", "Humana", "risk"]];
  const insight = team.risks >= 4
    ? "A equipe depende de pessoas sobrecarregadas para compensar agentes com baixo cumprimento. Reduza o escopo autônomo antes de ampliar volume."
    : team.humanReview > 30
      ? "A intervenção humana permanece alta e está concentrada em poucos especialistas. Separe revisão de risco de revisão rotineira."
      : "Reviews humanos ainda concentram trabalho de baixo risco. Há espaço para ampliar autonomia sem remover accountability.";

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ScreenHeader eyebrow="Modelo operacional" title="Equipes mistas analisadas como sistemas de trabalho." description="Além da composição, o Muster correlaciona propósito, capacidade, carga, qualidade, autonomia, intervenção humana, passagens e resultado coletivo ao longo do tempo." action={<button type="button" aria-expanded={showTeamBuilder} onClick={() => setShowTeamBuilder((current) => !current)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><Users className="h-4 w-4" /> {showTeamBuilder ? "Fechar criação" : "Nova equipe"}</button>} />

      {showTeamBuilder && <Panel className="border-[var(--wo-primary)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Novo modelo de equipe</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Comece pelo propósito coletivo e depois distribua execução, recomendação e aprovação.</p></div><button type="button" onClick={() => setShowTeamBuilder(false)} className="rounded-xl border border-[var(--wo-line)] px-4 py-2 text-xs text-[var(--wo-text)]">Usar equipe selecionada como modelo</button></div></Panel>}

      <div className="grid gap-3 xl:grid-cols-[280px_1fr]">
        <Panel className="p-3">
          <div className="px-2 py-2"><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">Portfólio de equipes</span><h2 className="mt-2 text-base font-medium text-[var(--wo-text)]">Companhia · 3 squads</h2></div>
          <div className="mt-2 space-y-2">{mixedTeams.map((item) => <button key={item.id} type="button" onClick={() => setTeamId(item.id)} className={cn("w-full rounded-xl border p-3 text-left transition-colors", teamId === item.id ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)]" : "border-transparent bg-[var(--wo-card-2)] hover:border-[var(--wo-line)]")}><div className="flex items-center justify-between gap-2"><strong className="text-xs font-medium text-[var(--wo-text)]">{item.name}</strong><ChevronRight className="h-3.5 w-3.5 text-[var(--wo-muted)]" /></div><p className="mt-2 text-[10px] text-[var(--wo-muted)]">{item.humans} pessoas · {item.agents} agentes</p><div className="mt-3 flex items-center justify-between text-[9px]"><span className="text-[var(--wo-muted)]">Passagem {item.handoff}%</span><span className={item.risks > 3 ? "text-[var(--wo-danger-text)]" : "text-[var(--wo-accent)]"}>{item.risks} riscos</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--wo-line)]"><div className="h-full rounded-full bg-[var(--wo-accent)]" style={{ width: `${item.contract}%` }} /></div></button>)}</div>
        </Panel>

        <div className="space-y-3">
          <Panel className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><Chip tone="good">ativa</Chip><span className="text-[10px] text-[var(--wo-muted)]">responsável {team.owner}</span><span className="text-[10px] text-[var(--wo-muted)]">· atualizada há 18 s</span></div><h2 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-[var(--wo-text)]">{team.name}</h2><p className="mt-2 max-w-3xl text-xs leading-relaxed text-[var(--wo-muted)]">{team.purpose}</p></div><div className="flex items-center gap-2"><Chip tone={team.risks > 3 ? "risk" : team.risks > 1 ? "watch" : "good"}>{team.risks} riscos ativos</Chip></div></div>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <SummaryCard label="Propósito coletivo" value={`${team.contract}%`} note="+1 ponto percentual no mês" icon={Target} tone="good" />
            <SummaryCard label="Saúde operacional" value={`${team.health}%`} note="confiabilidade da execução" icon={Gauge} tone={team.health >= 85 ? "good" : "watch"} />
            <SummaryCard label="Passagens íntegros" value={`${team.handoff}%`} note="aceitos sem devolução" icon={Waypoints} tone={team.handoff >= 90 ? "good" : "watch"} />
            <SummaryCard label="Prova confiável" value={`${team.evidence}%`} note="traces e decisões correlacionados" icon={ShieldCheck} tone={team.evidence >= 90 ? "good" : "watch"} />
            <SummaryCard label="Autonomia efetiva" value={`${team.autonomy}%`} note="trabalho executado por agentes" icon={Bot} tone="primary" />
            <SummaryCard label="Intervenção humana" value={`${team.humanReview}%`} note="tarefas que exigiram revisão" icon={UserCheck} tone={team.humanReview > 40 ? "risk" : "neutral"} />
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.45fr_.55fr]">
            <Panel className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium text-[var(--wo-text)]">Evolução da equipe · 6 meses</h3><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Propósito, saúde, passagens e dependência de intervenção humana.</p></div><Chip tone="primary">histórico mensal</Chip></div>
              <TrendChart months={months} series={teamHistorySeries} min={0} max={100} />
            </Panel>
            <Panel className="p-4">
              <div className="flex items-center gap-2"><Network className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Composição e capacidade</h3></div>
              <div className="mt-4 grid grid-cols-2 gap-2">{[["Pessoas", team.humans], ["Agentes", team.agents], ["Throughput", team.throughput], ["Riscos", team.risks]].map(([label, value]) => <div key={label as string} className="rounded-xl bg-[var(--wo-card-2)] p-3"><span className="text-[9px] text-[var(--wo-muted)]">{label as string}</span><strong className="mt-1 block font-mono text-lg text-[var(--wo-text)]">{value as string | number}</strong></div>)}</div>
              <div className="mt-3 rounded-xl bg-[var(--wo-primary-soft)] p-3 text-[10px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-primary)]">Diagnóstico:</strong> {insight}</div>
            </Panel>
          </div>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--wo-line)] px-4 py-3"><div><h3 className="text-sm font-medium text-[var(--wo-text)]">Desempenho dos participantes</h3><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Leitura conjunta de pessoas e agentes, respeitando função e autoridade.</p></div><span className="text-[9px] text-[var(--wo-muted)]">{team.members.length} de {team.humans + team.agents} exibidos</span></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><th className="px-4 py-3 font-normal">Participante · papel</th><th className="px-3 py-3 text-right font-normal">Propósito</th><th className="px-3 py-3 text-right font-normal">Qualidade</th><th className="px-3 py-3 text-right font-normal">Carga</th><th className="px-3 py-3 text-right font-normal">Intervenções</th><th className="px-4 py-3 font-normal">Leitura</th></tr></thead><tbody>{team.members.map((member) => { const isHuman = member.role.startsWith("Hum"); return <tr key={member.name} className="border-t border-[var(--wo-line)]"><td className="px-4 py-3"><div className="flex items-center gap-3"><span className={cn("grid h-8 w-8 place-items-center rounded-lg", isHuman ? toneClass.primary : toneClass.good)}>{isHuman ? <UserCheck className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}</span><span><strong className="block font-medium text-[var(--wo-text)]">{member.name}</strong><span className="mt-1 block text-[10px] text-[var(--wo-muted)]">{member.role}</span></span></div></td><td className="px-3 py-3 text-right font-mono text-[var(--wo-text)]">{member.purpose}%</td><td className="px-3 py-3 text-right font-mono text-[var(--wo-text)]">{member.quality}%</td><td className={cn("px-3 py-3 text-right font-mono", member.load >= 90 ? "text-[var(--wo-danger-text)]" : "text-[var(--wo-text)]")}>{member.load}%</td><td className="px-3 py-3 text-right font-mono text-[var(--wo-muted)]">{member.interventions}</td><td className="px-4 py-3"><Chip tone={member.status}>{member.status === "good" ? "saudável" : member.status === "risk" ? "risco" : member.status === "watch" ? "atenção" : "autoridade"}</Chip></td></tr>; })}</tbody></table></div>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
            <Panel className="overflow-hidden">
              <div className="border-b border-[var(--wo-line)] px-4 py-3"><h3 className="text-sm font-medium text-[var(--wo-text)]">Direitos de decisão</h3><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Autoridade derivada do contrato da equipe.</p></div>
              <div className="divide-y divide-[var(--wo-line)]">{decisions.map(([decision, owner, authority, tone]) => <div key={decision} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3"><div><strong className="text-xs font-medium text-[var(--wo-text)]">{decision}</strong><span className="mt-1 block text-[10px] text-[var(--wo-muted)]">Responsável: {owner}</span></div><Chip tone={tone as Tone}>{authority}</Chip></div>)}</div>
            </Panel>
            <Panel className="p-4">
              <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Carga e colaboração</h3></div>
              <div className="mt-4 space-y-4">{[
                ["Execução por agentes", team.autonomy, `${team.autonomy}% do trabalho`],
                ["Decisão humana", team.humanReview, `${team.humanReview}% das tarefas`],
                ["Trabalho compartilhado", sharedWork, `${sharedWork}% com handoff`],
              ].map(([label, value, detail]) => <div key={label as string}><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-[var(--wo-muted)]">{label as string}</span><span className="font-mono text-[var(--wo-text)]">{detail as string}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--wo-line)]"><div className="h-full rounded-full bg-[var(--wo-primary)]" style={{ width: `${value}%` }} /></div></div>)}</div>
              <div className="mt-4 rounded-xl bg-[var(--wo-primary-soft)] p-3 text-[10px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-primary)]">Insight:</strong> {insight}</div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

const journeyStatusLabels: Record<WorkStatus, string> = {
  planned: "Backlog",
  in_progress: "Em execução",
  review: "Em validação",
  blocked: "Bloqueado",
  done: "Concluído",
};

const journeyPriorityLabels: Record<WorkPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

function journeyStatusTone(status: WorkStatus): Tone {
  if (status === "done") return "good";
  if (status === "blocked") return "risk";
  if (status === "review") return "primary";
  if (status === "in_progress") return "watch";
  return "neutral";
}

function journeyPriorityTone(priority: WorkPriority): Tone {
  if (priority === "critical") return "risk";
  if (priority === "high") return "watch";
  if (priority === "medium") return "primary";
  return "neutral";
}

export function JourneysScreen() {
  const [journeyId, setJourneyId] = useState(teamOperatingScenarios[0]!.id);
  const [stageId, setStageId] = useState("all");
  const [showJourneyBuilder, setShowJourneyBuilder] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [journeyDrafted, setJourneyDrafted] = useState(false);
  const scenario = teamOperatingScenarios.find((item) => item.id === journeyId) ?? teamOperatingScenarios[0]!;
  const summary = useMemo(() => summarizeOperatingScenario(scenario), [scenario]);
  const stages = useMemo(() => scenario.stages.map((stage) => summarizeStageOperation(scenario, stage.id)), [scenario]);
  const visibleWorkItems = scenario.workItems.filter((item) => stageId === "all" || item.stage === stageId);
  const bottleneck = [...stages].sort((left, right) => {
    const leftRisk = left.blockedItems * 100 + left.utilization + (100 - left.successRate);
    const rightRisk = right.blockedItems * 100 + right.utilization + (100 - right.successRate);
    return rightRisk - leftRisk;
  })[0]!;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ScreenHeader eyebrow="Jornadas end-to-end" title="Veja o trabalho em movimento, com dono em cada decisão." description="A jornada conecta backlog, responsáveis, WIP, contratos de passagem, decisões e resultado final. O desempenho local só conta quando sustenta o sucesso end-to-end." action={<button type="button" aria-expanded={showJourneyBuilder} onClick={() => setShowJourneyBuilder((current) => !current)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><Route className="h-4 w-4" /> {showJourneyBuilder ? "Fechar modelagem" : "Modelar jornada"}</button>} />

      {showJourneyBuilder && <Panel className="border-[var(--wo-primary)] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Rascunho baseado em {scenario.journey.name}</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">O modelo preserva propósito, backlog, participantes, limites de WIP, passagens, SLA e critérios de sucesso.</p></div><button type="button" onClick={() => setJourneyDrafted(true)} className="rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">Criar rascunho</button></div>{journeyDrafted && <p role="status" className="mt-3 text-[10px] text-[var(--wo-accent)]">Rascunho criado com todas as responsabilidades e contratos da jornada.</p>}</Panel>}

      <div className="grid gap-2 md:grid-cols-3">{teamOperatingScenarios.map((item) => <button key={item.id} type="button" onClick={() => { setJourneyId(item.id); setStageId("all"); setDiagnosisOpen(false); }} className={cn("rounded-2xl border p-4 text-left transition-colors", journeyId === item.id ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)]" : "border-[var(--wo-line)] bg-[var(--wo-card)] hover:bg-[var(--wo-card-2)]")}><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{item.shortLabel}</span><strong className="mt-2 block text-sm font-medium text-[var(--wo-text)]">{item.journey.name}</strong><span className="mt-2 block text-[10px] leading-relaxed text-[var(--wo-muted)]">{item.finalOutcome}</span></button>)}</div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6" aria-label="Pulso da jornada">
        <JourneyStat icon={Target} label="Sucesso E2E" value={`${scenario.journey.successRate}%`} note={`meta ${scenario.metrics.find((metric) => metric.category === "outcome")?.target ?? "contratada"}`} tone="good" />
        <JourneyStat icon={Clock3} label="Lead time p95" value={scenario.journey.p95} note="fim a fim" />
        <JourneyStat icon={Activity} label="Execuções ativas" value={String(scenario.journey.activeRuns)} note={`${scenario.journey.eventsPerMinute.toLocaleString("pt-BR")} eventos/min`} />
        <JourneyStat icon={ListTodo} label="Backlog" value={String(summary.totalItems - summary.completedItems)} note={`${summary.activeItems} em movimento`} />
        <JourneyStat icon={TriangleAlert} label="Bloqueios" value={String(summary.blockedItems)} note={summary.blockedItems > 0 ? "ação requerida" : "fluxo livre"} tone={summary.blockedItems > 0 ? "risk" : "good"} />
        <JourneyStat icon={Bot} label="Cobertura agente" value={`${summary.automationCoverage}%`} note={`${summary.humanDecisionGates} gates humanos`} tone="primary" />
      </div>

      <JourneyFlow scenario={scenario} stages={stages} selectedStageId={stageId} onSelectStage={setStageId} />

      <div className="grid gap-3 xl:grid-cols-[1.45fr_.55fr]">
        <JourneyBacklog scenario={scenario} workItems={visibleWorkItems} selectedStageId={stageId} onClearStage={() => setStageId("all")} />
        <div className="space-y-3">
          <Panel className="p-4"><div className="flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-[var(--wo-warning-text)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Gargalo atual</h3></div><div className="mt-4 flex items-start justify-between gap-3"><div><strong className="text-base font-medium text-[var(--wo-text)]">{bottleneck.label}</strong><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Responsável: {bottleneck.owner.name} · SLA {bottleneck.sla}</p></div><Chip tone={bottleneck.blockedItems > 0 ? "risk" : "watch"}>{bottleneck.utilization}% WIP</Chip></div><p className="mt-4 text-xs leading-relaxed text-[var(--wo-muted)]">A etapa combina {bottleneck.activeItems} item(ns) ativo(s), {bottleneck.blockedItems} bloqueio(s) e {bottleneck.successRate}% de sucesso. Recalibre capacidade ou critérios sem remover o controle.</p><button type="button" aria-expanded={diagnosisOpen} onClick={() => setDiagnosisOpen((current) => !current)} className="mt-4 inline-flex items-center gap-2 text-xs text-[var(--wo-text)]">{diagnosisOpen ? "Fechar diagnóstico" : "Abrir diagnóstico"} <ArrowRight className="h-3.5 w-3.5" /></button></Panel>
          <JourneyPulsePanel scenario={scenario} />
        </div>
      </div>

      <JourneyResponsibilityMatrix scenario={scenario} />
      {diagnosisOpen && <Panel className="border-[var(--wo-warning)] p-4" data-testid="journey-diagnosis"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-medium text-[var(--wo-text)]">Diagnóstico do gargalo · {bottleneck.label}</h3><p className="mt-2 max-w-4xl text-[11px] leading-relaxed text-[var(--wo-muted)]">Redistribua itens acima do limite de WIP, preserve o gate responsável por risco e confirme que a passagem entrega contexto, prova e aceite do próximo responsável. Rode a mudança por dois ciclos antes de ampliar autonomia.</p></div><Chip tone="watch">ação recomendada</Chip></div></Panel>}
    </div>
  );
}

function JourneyStat({ icon: Icon, label, value, note, tone = "neutral" }: { icon: typeof Gauge; label: string; value: string; note: string; tone?: Tone }) {
  return <Panel className="p-3"><div className="flex items-center justify-between"><span className="text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span><span className={cn("grid h-7 w-7 place-items-center rounded-lg", toneClass[tone])}><Icon className="h-3.5 w-3.5" /></span></div><strong className="mt-3 block font-mono text-xl font-medium text-[var(--wo-text)]">{value}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{note}</span></Panel>;
}

function JourneyFlow({ scenario, stages, selectedStageId, onSelectStage }: { scenario: TeamOperatingScenario; stages: ReturnType<typeof summarizeStageOperation>[]; selectedStageId: string; onSelectStage: (stageId: string) => void }) {
  return (
    <Panel className="overflow-hidden" data-testid="journey-operational-flow">
      <div className="flex flex-col gap-4 border-b border-[var(--wo-line)] p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex items-center gap-2"><Chip tone="good">monitorada</Chip><span className="text-[10px] text-[var(--wo-muted)]">{scenario.shortLabel}</span></div><h2 className="mt-3 text-2xl font-medium text-[var(--wo-text)]">{scenario.journey.name}</h2><p className="mt-2 max-w-3xl text-xs leading-relaxed text-[var(--wo-muted)]">{scenario.purpose}</p></div>
        <div className="max-w-md rounded-xl bg-[var(--wo-card-2)] p-3"><span className="text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Resultado final contratado</span><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-text)]">{scenario.finalOutcome}</p></div>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="flex min-w-max items-stretch gap-2">
          {stages.map((stage, index) => {
            const selected = selectedStageId === stage.id;
            const isRisk = stage.blockedItems > 0 || stage.utilization >= 100 || stage.successRate < 85;
            return (
              <div key={stage.id} className="flex items-center gap-2">
                <button type="button" aria-pressed={selected} onClick={() => onSelectStage(selected ? "all" : stage.id)} className={cn("w-[238px] rounded-xl border p-3 text-left transition-colors", selected ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)]" : isRisk ? "border-[var(--wo-warning)] bg-[color-mix(in_srgb,var(--wo-warning)_7%,var(--wo-card-2))]" : "border-[var(--wo-line)] bg-[var(--wo-card-2)] hover:border-[var(--wo-primary)]")}>
                  <div className="flex items-center justify-between gap-3"><span className="font-mono text-[9px] text-[var(--wo-primary)]">ETAPA {String(index + 1).padStart(2, "0")}</span><Chip tone={isRisk ? "watch" : "good"}>{stage.successRate}% sucesso</Chip></div>
                  <div className="mt-3 flex items-center gap-2">{stage.owner.platform ? <PlatformIcon platform={stage.owner.platform} size="sm" /> : <span className={cn("grid h-7 w-7 place-items-center rounded-lg", toneClass.primary)}><UserCheck className="h-3.5 w-3.5" /></span>}<span><strong className="block text-xs font-medium text-[var(--wo-text)]">{stage.label}</strong><span className="mt-0.5 block text-[9px] text-[var(--wo-muted)]">{stage.owner.name} · responsável</span></span></div>
                  <p className="mt-3 min-h-8 text-[9px] leading-relaxed text-[var(--wo-muted)]">Saída: {stage.exitCriteria}</p>
                  <div className="mt-3 grid grid-cols-3 gap-1.5"><span className="rounded-lg bg-[var(--wo-card)] p-2"><span className="block text-[8px] text-[var(--wo-muted)]">WIP</span><strong className="mt-1 block font-mono text-[10px] text-[var(--wo-text)]">{stage.activeItems + stage.blockedItems}/{stage.wipLimit}</strong></span><span className="rounded-lg bg-[var(--wo-card)] p-2"><span className="block text-[8px] text-[var(--wo-muted)]">Fila</span><strong className="mt-1 block font-mono text-[10px] text-[var(--wo-text)]">{stage.queuedItems}</strong></span><span className="rounded-lg bg-[var(--wo-card)] p-2"><span className="block text-[8px] text-[var(--wo-muted)]">SLA</span><strong className="mt-1 block font-mono text-[10px] text-[var(--wo-text)]">{stage.sla}</strong></span></div>
                </button>
                {index < stages.length - 1 && <div className="w-28 shrink-0 px-1 text-center"><ArrowRight className="mx-auto h-4 w-4 text-[var(--wo-primary)]" /><span className="mt-1 block text-[8px] uppercase tracking-[0.06em] text-[var(--wo-muted)]">passagem</span><span className="mt-1 block text-[8px] leading-tight text-[var(--wo-text)]">{stage.handoffContract}</span></div>}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function JourneyBacklog({ scenario, workItems, selectedStageId, onClearStage }: { scenario: TeamOperatingScenario; workItems: TeamWorkItem[]; selectedStageId: string; onClearStage: () => void }) {
  return (
    <Panel className="overflow-hidden" data-testid="journey-operational-backlog">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--wo-line)] px-4 py-3"><div><div className="flex items-center gap-2"><ListTodo className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Backlog dentro da jornada</h3></div><p className="mt-1 text-[10px] text-[var(--wo-muted)]">O que está em curso, quem executa, quem responde e qual é o próximo movimento.</p></div>{selectedStageId !== "all" && <button type="button" onClick={onClearStage} className="rounded-lg border border-[var(--wo-line)] px-2.5 py-1.5 text-[9px] text-[var(--wo-muted)]">Limpar etapa</button>}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><th className="px-4 py-3 font-normal">Item · prioridade</th><th className="px-3 py-3 font-normal">Executa</th><th className="px-3 py-3 font-normal">Accountable</th><th className="px-3 py-3 font-normal">Próximo passo</th><th className="px-3 py-3 font-normal">Prova</th><th className="px-4 py-3 font-normal">Status · prazo</th></tr></thead><tbody>{workItems.map((workItem) => {
        const owner = participantForWorkItem(scenario, workItem);
        const accountable = accountableForWorkItem(scenario, workItem);
        return <tr key={workItem.id} className="border-t border-[var(--wo-line)] align-top hover:bg-[var(--wo-card-2)]"><td className="max-w-[250px] px-4 py-3"><div className="flex items-center gap-2"><span className="font-mono text-[9px] text-[var(--wo-primary)]">{workItem.id}</span><Chip tone={journeyPriorityTone(workItem.priority)}>{journeyPriorityLabels[workItem.priority]}</Chip></div><strong className="mt-2 block font-medium text-[var(--wo-text)]">{workItem.title}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{workItem.epic}</span></td><td className="px-3 py-3"><JourneyActor participant={owner} /><span className="mt-2 block text-[9px] text-[var(--wo-muted)]">{workItem.mode === "autonomous" ? "autônomo" : workItem.mode === "assisted" ? "assistido" : "humano"}</span></td><td className="px-3 py-3"><JourneyActor participant={accountable} /><span className="mt-2 block text-[9px] text-[var(--wo-muted)]">{workItem.contributorIds.length} apoio(s)</span></td><td className="max-w-[210px] px-3 py-3"><span className="text-[10px] leading-relaxed text-[var(--wo-text)]">{workItem.nextStep}</span>{workItem.blockedReason && <span className="mt-2 block text-[9px] leading-relaxed text-[var(--wo-danger-text)]">{workItem.blockedReason}</span>}<span className="mt-2 block text-[9px] text-[var(--wo-muted)]">Atualizado {workItem.lastActivity}</span></td><td className="max-w-[180px] px-3 py-3 text-[10px] leading-relaxed text-[var(--wo-muted)]">{workItem.evidence}<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--wo-line)]"><div className="h-full rounded-full bg-[var(--wo-primary)]" style={{ width: `${workItem.progress}%` }} /></div></td><td className="px-4 py-3"><Chip tone={journeyStatusTone(workItem.status)}>{journeyStatusLabels[workItem.status]}</Chip><span className="mt-2 block text-[9px] text-[var(--wo-text)]">{workItem.due}</span></td></tr>;
      })}</tbody></table></div>
      {workItems.length === 0 && <p className="px-4 py-8 text-center text-xs text-[var(--wo-muted)]">Nenhum item nesta etapa.</p>}
    </Panel>
  );
}

function JourneyActor({ participant }: { participant: TeamOperatingScenario["participants"][number] | undefined }) {
  if (!participant) return <span className="text-[9px] text-[var(--wo-danger-text)]">Sem responsável</span>;
  return <div className="flex items-center gap-2">{participant.platform ? <PlatformIcon platform={participant.platform} size="sm" /> : <span className={cn("grid h-6 w-6 place-items-center rounded-md", toneClass.primary)}><UserCheck className="h-3 w-3" /></span>}<span><strong className="block text-[10px] font-medium text-[var(--wo-text)]">{participant.name}</strong><span className="text-[8px] text-[var(--wo-muted)]">{participant.actorType === "agent" ? "Agente" : "Pessoa"}</span></span></div>;
}

function JourneyPulsePanel({ scenario }: { scenario: TeamOperatingScenario }) {
  const operationalItems = [...scenario.workItems]
    .filter((item) => item.status !== "done")
    .sort((left, right) => Number(right.status === "blocked") - Number(left.status === "blocked"))
    .slice(0, 4);
  return <Panel className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[var(--wo-accent)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Operação agora</h3></div><Chip tone="good">{scenario.journey.freshnessSeconds}s de atualização</Chip></div><div className="mt-4 space-y-2">{operationalItems.map((item) => <div key={item.id} className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] text-[var(--wo-primary)]">{item.id}</span><Chip tone={journeyStatusTone(item.status)}>{journeyStatusLabels[item.status]}</Chip></div><strong className="mt-2 block text-[10px] text-[var(--wo-text)]">{item.nextStep}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{item.lastActivity} · {item.due}</span></div>)}</div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-[var(--wo-line)] p-3"><span className="text-[8px] text-[var(--wo-muted)]">Cobertura</span><strong className="mt-1 block font-mono text-sm text-[var(--wo-text)]">{scenario.journey.telemetryCoverage}%</strong></div><div className="rounded-xl border border-[var(--wo-line)] p-3"><span className="text-[8px] text-[var(--wo-muted)]">Eventos/min</span><strong className="mt-1 block font-mono text-sm text-[var(--wo-text)]">{scenario.journey.eventsPerMinute.toLocaleString("pt-BR")}</strong></div></div></Panel>;
}

function JourneyResponsibilityMatrix({ scenario }: { scenario: TeamOperatingScenario }) {
  return (
    <Panel className="overflow-hidden" data-testid="journey-responsibility-matrix">
      <div className="border-b border-[var(--wo-line)] px-4 py-3"><div className="flex items-center gap-2"><Waypoints className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Mapa de responsabilidade da jornada</h3></div><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Quem executa, quem responde pelo resultado, quem apoia e qual autoridade cada participante possui.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><th className="px-4 py-3 font-normal">Participante · função</th><th className="px-3 py-3 font-normal">Responsabilidade</th><th className="px-3 py-3 font-normal">Foco atual</th><th className="px-3 py-3 text-center font-normal">Executa</th><th className="px-3 py-3 text-center font-normal">Accountable</th><th className="px-3 py-3 text-center font-normal">Apoia</th><th className="px-4 py-3 font-normal">Carga</th></tr></thead><tbody>{scenario.participants.map((participant) => {
        const allocation = workAllocationForParticipant(scenario, participant.id);
        return <tr key={participant.id} className="border-t border-[var(--wo-line)] align-top"><td className="px-4 py-3"><JourneyActor participant={participant} /><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{participant.role}</span></td><td className="max-w-[250px] px-3 py-3"><span className="text-[10px] leading-relaxed text-[var(--wo-text)]">{participant.scope}</span><span className="mt-1 block text-[9px] leading-relaxed text-[var(--wo-muted)]">Alçada: {participant.decisionRights}</span></td><td className="max-w-[220px] px-3 py-3 text-[10px] leading-relaxed text-[var(--wo-text)]">{participant.currentFocus}</td><td className="px-3 py-3 text-center font-mono text-[var(--wo-text)]">{allocation.executing.length}</td><td className="px-3 py-3 text-center font-mono text-[var(--wo-text)]">{allocation.accountable.length}</td><td className="px-3 py-3 text-center font-mono text-[var(--wo-muted)]">{allocation.contributing.length}</td><td className="w-32 px-4 py-3"><div className="flex justify-between font-mono text-[9px] text-[var(--wo-muted)]"><span>{allocation.active.length} ativos</span><span>{participant.workload}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--wo-line)]"><div className={cn("h-full rounded-full", participant.workload > 85 ? "bg-[var(--wo-warning)]" : "bg-[var(--wo-accent)]")} style={{ width: `${participant.workload}%` }} /></div></td></tr>;
      })}</tbody></table></div>
    </Panel>
  );
}

const benchmarks = {
  engineering: {
    label: "Agentes de engenharia",
    sample: "38 agentes · 9 equipes",
    rows: [
      { name: "Vega", role: "Entrega contínua", purpose: 91, quality: 96, evidence: 97, autonomy: "Autônoma", cohort: "top 15%" },
      { name: "Revisor PR", role: "Code review", purpose: 76, quality: 81, evidence: 88, autonomy: "Supervisionada", cohort: "mediana" },
      { name: "Atlas", role: "Planejamento técnico", purpose: 87, quality: 90, evidence: 92, autonomy: "Supervisionada", cohort: "top 30%" },
    ],
  },
  service: {
    label: "Agentes de atendimento",
    sample: "72 agentes · 14 equipes",
    rows: [
      { name: "Sofia", role: "Suporte N1", purpose: 61, quality: 68, evidence: 91, autonomy: "Supervisionada", cohort: "bottom 20%" },
      { name: "Lia", role: "Suporte N1", purpose: 84, quality: 86, evidence: 94, autonomy: "Autônoma", cohort: "top 25%" },
      { name: "Nora", role: "Triagem", purpose: 79, quality: 83, evidence: 89, autonomy: "Supervisionada", cohort: "mediana" },
    ],
  },
};

export function BenchmarksScreen() {
  const [cohortId, setCohortId] = useState<keyof typeof benchmarks>("engineering");
  const [showCohortConfiguration, setShowCohortConfiguration] = useState(false);
  const [cohortDimensions, setCohortDimensions] = useState(["Função", "Maturidade", "Autonomia"]);
  const cohort = benchmarks[cohortId];
  const median = useMemo(() => ({ purpose: Math.round(cohort.rows.reduce((sum, row) => sum + row.purpose, 0) / cohort.rows.length), quality: Math.round(cohort.rows.reduce((sum, row) => sum + row.quality, 0) / cohort.rows.length), evidence: Math.round(cohort.rows.reduce((sum, row) => sum + row.evidence, 0) / cohort.rows.length) }), [cohort]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ScreenHeader eyebrow="Benchmark contextual" title="Compare pares pela função, maturidade e ambiente operacional." description="O benchmark normaliza escopo, risco, volume e autonomia. Ele não cria ranking universal: mostra onde o contrato está forte, frágil ou incomparável." action={<button type="button" aria-expanded={showCohortConfiguration} onClick={() => setShowCohortConfiguration((current) => !current)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] px-4 py-2.5 text-xs text-[var(--wo-text)]"><Settings2 className="h-4 w-4" /> {showCohortConfiguration ? "Fechar configuração" : "Configurar coorte"}</button>} />
      {showCohortConfiguration && <Panel className="border-[var(--wo-primary)] p-4"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Dimensões de comparabilidade</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">O benchmark só compara profissionais equivalentes nas dimensões ativas.</p></div><div className="mt-3 flex flex-wrap gap-2">{["Função", "Maturidade", "Autonomia", "Risco", "Volume", "Ambiente"].map((dimension) => { const active = cohortDimensions.includes(dimension); return <button key={dimension} type="button" aria-pressed={active} onClick={() => setCohortDimensions((current) => active ? current.filter((item) => item !== dimension) : [...current, dimension])} className={cn("rounded-xl border px-3 py-2 text-xs", active ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "border-[var(--wo-line)] text-[var(--wo-muted)]")}>{dimension}</button>; })}</div></Panel>}
      <div className="flex gap-2">{Object.entries(benchmarks).map(([id, item]) => <button key={id} type="button" onClick={() => setCohortId(id as keyof typeof benchmarks)} className={cn("rounded-xl border px-3 py-2 text-xs", cohortId === id ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "border-[var(--wo-line)] bg-[var(--wo-card)] text-[var(--wo-muted)]")}>{item.label}</button>)}</div>

      <div className="grid gap-3 xl:grid-cols-[.7fr_1.3fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between"><div><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Coorte selecionada</span><h2 className="mt-2 text-lg font-medium text-[var(--wo-text)]">{cohort.label}</h2></div><Chip tone="primary">{cohort.sample}</Chip></div>
          <div className="mt-6 space-y-5">{[
            ["Cumprimento do propósito", median.purpose, 82],
            ["Qualidade do resultado", median.quality, 88],
            ["Confiabilidade da prova", median.evidence, 93],
            ["Uso responsável da autonomia", 86, 90],
          ].map(([label, current, top]) => <div key={label as string}><div className="flex justify-between text-[10px]"><span className="text-[var(--wo-muted)]">{label as string}</span><span className="font-mono text-[var(--wo-text)]">mediana {current as number}</span></div><div className="relative mt-2 h-2 rounded-full bg-[var(--wo-line)]"><div className="h-full rounded-full bg-[var(--wo-primary)]" style={{ width: `${current}%` }} /><span className="absolute top-[-3px] h-4 w-px bg-[var(--wo-accent)]" style={{ left: `${top}%` }} /></div><div className="mt-1 text-right text-[8px] text-[var(--wo-muted)]">top quartil {top as number}</div></div>)}</div>
          <div className="mt-5 rounded-xl bg-[var(--wo-primary-soft)] p-3 text-[10px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-primary)]">Normalização:</strong> risco técnico, complexidade, cobertura de testes, volume e grau de supervisão.</div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--wo-line)] px-4 py-3"><h2 className="text-sm font-medium text-[var(--wo-text)]">Comparação entre profissionais equivalentes</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Percentis só aparecem quando há amostra comparável e prova suficiente.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><th className="px-4 py-3 font-normal">Profissional</th><th className="px-3 py-3 text-right font-normal">Propósito</th><th className="px-3 py-3 text-right font-normal">Qualidade</th><th className="px-3 py-3 text-right font-normal">Prova</th><th className="px-3 py-3 font-normal">Autonomia</th><th className="px-4 py-3 font-normal">Coorte</th></tr></thead><tbody>{cohort.rows.map((row) => <tr key={row.name} className="border-t border-[var(--wo-line)]"><td className="px-4 py-3"><strong className="block font-medium text-[var(--wo-text)]">{row.name}</strong><span className="mt-1 block text-[10px] text-[var(--wo-muted)]">{row.role}</span></td><td className="px-3 py-3 text-right font-mono text-[var(--wo-text)]">{row.purpose}</td><td className="px-3 py-3 text-right font-mono text-[var(--wo-text)]">{row.quality}</td><td className="px-3 py-3 text-right font-mono text-[var(--wo-text)]">{row.evidence}</td><td className="px-3 py-3 text-[var(--wo-muted)]">{row.autonomy}</td><td className="px-4 py-3"><Chip tone={row.cohort.includes("bottom") ? "risk" : row.cohort.includes("top") ? "good" : "neutral"}>{row.cohort}</Chip></td></tr>)}</tbody></table></div>
        </Panel>
      </div>
    </div>
  );
}

const connectorCatalog = [
  { name: "GitHub", platform: "github", category: "Código e execução", environment: "cloud", status: "connected", detail: "4 agentes · 12 workflows", icon: Code2 },
  { name: "OpenTelemetry", platform: "opentelemetry", category: "Telemetria", environment: "hybrid", status: "connected", detail: "18 s de atualização", icon: Activity },
  { name: "AWS Bedrock", platform: "aws-bedrock", category: "Cloud agents", environment: "cloud", status: "ready", detail: "template disponível", icon: Cloud },
  { name: "Azure AI Foundry", platform: "azure-ai-foundry", category: "Cloud agents", environment: "cloud", status: "ready", detail: "template disponível", icon: Cloud },
  { name: "Google Vertex AI", platform: "google-vertex-ai", category: "Cloud agents", environment: "cloud", status: "ready", detail: "template disponível", icon: Cloud },
  { name: "Salesforce Agentforce", platform: "salesforce-agentforce", category: "Agentes externos", environment: "cloud", status: "contract", detail: "contrato de eventos", icon: PlugZap },
  { name: "Zendesk AI", platform: "zendesk-ai", category: "Agentes externos", environment: "cloud", status: "contract", detail: "contrato de tickets", icon: PlugZap },
  { name: "Kubernetes", platform: "kubernetes", category: "Runtime", environment: "hybrid", status: "ready", detail: "collector + operator", icon: Boxes },
  { name: "Docker local", platform: "docker", category: "Runtime", environment: "local", status: "ready", detail: "runner sidecar", icon: Laptop },
  { name: "vLLM", platform: "vllm", category: "Model serving", environment: "local", status: "ready", detail: "gateway compatível", icon: Server },
  { name: "LangGraph", platform: "langgraph", category: "Orquestração", environment: "hybrid", status: "contract", detail: "traces + subagentes", icon: Workflow },
  { name: "API Muster", platform: "muster-api", category: "Contrato universal", environment: "hybrid", status: "connected", detail: "collect · measure · act", icon: Database },
];

export function ConnectorsScreen() {
  const [environment, setEnvironment] = useState("all");
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const visibleConnectors = connectorCatalog.filter((item) => environment === "all" || item.environment === environment);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ScreenHeader eyebrow="Ecossistema plug-and-play" title="Um contrato comum para cloud, on-premise e execução local." description="O Muster mantém o plano de controle centralizado ou privado, enquanto collectors próximos ao runtime leem código, logs, registros de execução, decisões, custos e resultados sem exigir um único provedor." action={<button type="button" onClick={() => setSelectedConnector("Nova conexão")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><PlugZap className="h-4 w-4" /> Adicionar conexão</button>} />

      {selectedConnector && <Panel className="border-[var(--wo-primary)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">{selectedConnector}</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Selecione credencial, ambiente e contrato de coleta antes de ativar.</p></div><button type="button" onClick={() => setSelectedConnector(null)} className="rounded-xl border border-[var(--wo-line)] px-4 py-2 text-xs text-[var(--wo-text)]">Fechar configuração</button></div></Panel>}

      <div className="grid gap-3 lg:grid-cols-3">
        {[
          ["Cloud gerenciada", "AWS · Azure · GCP · SaaS", "Painel de controle do Muster e coleta via APIs/eventos.", Cloud, "primary"],
          ["Arquitetura híbrida", "Cloud + runtime privado", "Collectors locais; governança e fallback por política.", Network, "good"],
          ["On-premise / local", "GPU · vLLM · Docker · Kubernetes", "Dados e execução permanecem na infraestrutura do cliente.", Server, "watch"],
        ].map(([title, subtitle, description, Icon, tone]) => <Panel key={title as string} className="p-4"><span className={cn("grid h-10 w-10 place-items-center rounded-xl", toneClass[tone as Tone])}><Icon className="h-4 w-4" /></span><h2 className="mt-4 text-sm font-medium text-[var(--wo-text)]">{title as string}</h2><span className="mt-1 block text-[10px] text-[var(--wo-accent)]">{subtitle as string}</span><p className="mt-3 text-[11px] leading-relaxed text-[var(--wo-muted)]">{description as string}</p></Panel>)}
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--wo-line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Catálogo de conexões</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Templates de descoberta, telemetria, identidade e ação.</p></div><div className="flex gap-1 rounded-xl bg-[var(--wo-card-2)] p-1">{[["all", "Todos"], ["cloud", "Cloud"], ["hybrid", "Híbrido"], ["local", "Local"]].map(([id, label]) => <button key={id} type="button" onClick={() => setEnvironment(id)} className={cn("rounded-lg px-3 py-1.5 text-[10px]", environment === id ? "bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "text-[var(--wo-muted)]")}>{label}</button>)}</div></div>
        <div className="grid gap-px bg-[var(--wo-line)] sm:grid-cols-2 xl:grid-cols-3">{visibleConnectors.map((connector) => <button key={connector.name} type="button" onClick={() => setSelectedConnector(connector.name)} className="flex min-h-28 items-start gap-3 bg-[var(--wo-card)] p-4 text-left transition-colors hover:bg-[var(--wo-card-2)]"><PlatformIcon platform={connector.platform} size="lg" /><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><strong className="text-xs font-medium text-[var(--wo-text)]">{connector.name}</strong><Chip tone={connector.status === "connected" ? "good" : connector.status === "contract" ? "watch" : "neutral"}>{connector.status === "connected" ? "conectado" : connector.status === "contract" ? "contrato" : "template"}</Chip></span><span className="mt-1 block text-[9px] uppercase tracking-[0.06em] text-[var(--wo-muted)]">{connector.category}</span><span className="mt-3 block text-[10px] text-[var(--wo-muted)]">{connector.detail}</span></span></button>)}</div>
      </Panel>

      <Panel className="p-4">
        <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
          <div><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[var(--wo-accent)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Contrato universal do agente</h2></div><p className="mt-3 text-[11px] leading-relaxed text-[var(--wo-muted)]">Identidade, organização, propósito, execução, decisão, prova, custo opcional, feedback e ação corretiva seguem o mesmo formato, independentemente do runtime.</p></div>
          <div className="grid gap-2 sm:grid-cols-5">{["Descobrir", "Coletar", "Medir", "Decidir", "Ajustar"].map((step, index) => <div key={step} className="rounded-xl bg-[var(--wo-card-2)] p-3"><span className="text-[9px] text-[var(--wo-primary)]">0{index + 1}</span><strong className="mt-2 block text-xs font-medium text-[var(--wo-text)]">{step}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">com prova</span></div>)}</div>
        </div>
      </Panel>
    </div>
  );
}

export function SettingsScreen() {
  const [policies, setPolicies] = useState<Record<string, boolean>>({ realtime: true, requireEvidence: true, cloudFallback: false, humanCritical: true });
  const [publishedVersion, setPublishedVersion] = useState(12);
  const [publishMessage, setPublishMessage] = useState("");
  const toggle = (id: string) => setPolicies((current) => ({ ...current, [id]: !current[id] }));
  const publishPolicies = () => {
    setPublishedVersion((current) => current + 1);
    setPublishMessage("Nova versão publicada com trilha de auditoria.");
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ScreenHeader eyebrow="Governança operacional" title="Configuração herdável, da companhia ao agente." description="Companhia, unidade, squad, grupo de trabalho, pessoa e agente compartilham políticas com escopo e exceções auditáveis. Nenhum cliente é obrigado a operar localmente ou na nuvem." action={<button type="button" onClick={publishPolicies} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] px-4 py-2.5 text-xs text-[var(--wo-text)]"><Check className="h-4 w-4" /> Publicar versão {publishedVersion + 1}</button>} />

      {publishMessage && <div role="status" className="rounded-xl border border-[var(--wo-accent)] bg-[color-mix(in_srgb,var(--wo-accent)_10%,var(--wo-card))] px-4 py-3 text-[11px] text-[var(--wo-accent)]">{publishMessage} Versão ativa: {publishedVersion}.</div>}

      <div className="grid gap-3 xl:grid-cols-[.75fr_1.25fr]">
        <Panel className="p-4">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[var(--wo-primary)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Hierarquia de governança</h2></div>
          <div className="mt-4 space-y-2">{[
            ["Companhia", "Muster Labs", "1 organização", Building2],
            ["Unidade", "Tecnologia", "3 squads", Boxes],
            ["Squad", "Engenharia assistida", "11 profissionais", Users],
            ["Grupo de trabalho", "Entrega contínua", "5 profissionais", Network],
            ["Responsável", "Marina Costa", "pessoa", UserCheck],
            ["Agentes vinculados", "Vega · Revisor PR · Atlas", "3 identidades", Bot],
          ].map(([level, value, detail, Icon], index) => <div key={level as string} className="relative ml-3 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3"><span className="absolute -left-3 top-1/2 h-px w-3 bg-[var(--wo-line)]" /><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><span className="block text-[9px] uppercase tracking-[0.06em] text-[var(--wo-muted)]">{level as string}</span><strong className="mt-1 block truncate text-xs font-medium text-[var(--wo-text)]">{value as string}</strong></div><span className="text-[9px] text-[var(--wo-muted)]">{detail as string}</span></div>{index < 5 && <span className="absolute -bottom-3 left-5 h-3 w-px bg-[var(--wo-line)]" />}</div>)}</div>
        </Panel>

        <div className="space-y-3">
          <Panel className="overflow-hidden">
            <div className="border-b border-[var(--wo-line)] px-4 py-3"><h2 className="text-sm font-medium text-[var(--wo-text)]">Políticas da engenharia assistida</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Herda da companhia · versão 12 · 2 exceções locais.</p></div>
            <div className="divide-y divide-[var(--wo-line)]">{[
              ["realtime", "Supervisão contínua", "Coletar e recalcular sinais a cada 15 segundos.", Activity],
              ["prova", "Prova obrigatória", "Bloquear decisão sem prova, fonte e contexto mínimo.", ShieldCheck],
              ["humanCritical", "Aprovação humana em alto risco", "Toda ação crítica exige autoridade humana explícita.", UserCheck],
              ["cloudFallback", "Fallback para cloud", "Usar provedor aprovado quando o runtime local estiver indisponível.", Cloud],
            ].map(([id, title, description, Icon]) => <div key={id as string} className="flex items-center gap-3 px-4 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--wo-card-2)] text-[var(--wo-primary)]"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="text-xs font-medium text-[var(--wo-text)]">{title as string}</strong><p className="mt-1 text-[10px] text-[var(--wo-muted)]">{description as string}</p></div><button type="button" role="switch" aria-checked={policies[id as string]} onClick={() => toggle(id as string)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", policies[id as string] ? "bg-[var(--wo-accent)]" : "bg-[var(--wo-line)]")}><span className={cn("absolute top-1 h-4 w-4 rounded-full bg-[var(--wo-shell)] transition-all", policies[id as string] ? "left-6" : "left-1")} /></button></div>)}</div>
          </Panel>

          <div className="grid gap-3 md:grid-cols-3">
            <Panel className="p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Activity className="h-4 w-4" /></span><h3 className="mt-3 text-xs font-medium text-[var(--wo-text)]">Telemetria</h3><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">15 s · buffer 24 h · retenção 90 dias · 97% cobertura.</p></Panel>
            <Panel className="p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--wo-accent)_18%,var(--wo-card))] text-[var(--wo-accent)]"><ShieldCheck className="h-4 w-4" /></span><h3 className="mt-3 text-xs font-medium text-[var(--wo-text)]">Prova</h3><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">Redação de dados pessoais · assinatura · origem · auditoria amostral.</p></Panel>
            <Panel className="p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--wo-warning)_16%,var(--wo-card))] text-[var(--wo-warning-text)]"><Server className="h-4 w-4" /></span><h3 className="mt-3 text-xs font-medium text-[var(--wo-text)]">Execução</h3><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">Local preferido · cloud permitido · fallback desativado.</p></Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
