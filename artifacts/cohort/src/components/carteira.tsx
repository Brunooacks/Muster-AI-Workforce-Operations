import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Target,
  Zap,
  TrendingUp,
  Shield,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Briefcase,
  Terminal,
  Check,
  AlertTriangle,
} from "lucide-react";
import { metricTargetStatus } from "@workspace/metrics";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/cohort";

export { metricTargetStatus };

/* ── Audience (dual view) ─────────────────────────────────── */
export type Audience = "gestor" | "platform";

type Dict = {
  audienceLabel: string;
  audienceHint: string;
  sec01: { title: string; caption: string };
  sec02: { title: string; caption: string };
  sec03: { title: string; caption: string };
  sec04: { title: string; caption: string };
  sec05: { title: string; caption: string };
  jobDescription: string;
  mustDo: string;
  mustNotDo: string;
  goodWork: string;
  responsibility: string;
  businessOwner: string;
  techOwner: string;
  governance: string;
  autonomy: string;
  level: string;
  escalates: string;
  limits: string;
  origin: string;
  baseline: string;
  paybackTarget: string;
  paybackReal: string;
  sinceLabel: string;
  versionLabel: string;
  executionsLabel: string;
  target: string;
  health: string;
  recommendedRoute: string;
  confidence: string;
  window: string;
  sponsor: string;
  rationaleLabel: string;
  nextActions: string;
  owner: string;
  in: string;
  detected: string;
  hypothesis: string;
  action: string;
  approve: string;
  disagree: string;
  export: string;
  noAlerts: string;
  quote: string;
  state: string;
  onTarget: string;
  offTarget: string;
};

export const carteiraI18n: Record<Audience, Dict> = {
  gestor: {
    audienceLabel: "Gestor",
    audienceHint: "Vista de gestor — linguagem de pessoas, decisões e ROI",
    sec01: {
      title: "Carteira de Trabalho",
      caption: "Identidade, papel e cadeia de responsabilidade do agente",
    },
    sec02: {
      title: "Avaliação de Desempenho",
      caption: "Cinco camadas de desempenho · janela atual",
    },
    sec03: {
      title: "Histórico de Avaliações",
      caption: "Trajetória de desempenho ao longo do tempo",
    },
    sec04: {
      title: "Detector de Vitória Ilusória",
      caption: "Padrões antagônicos que dashboards isolados não enxergam",
    },
    sec05: {
      title: "Recomendação para o Comitê",
      caption: "Síntese para a reunião de portfólio",
    },
    jobDescription: "Job Description",
    mustDo: "Deve fazer",
    mustNotDo: "Não deve fazer",
    goodWork: "Critério de bom trabalho",
    responsibility: "Responsabilidade",
    businessOwner: "Dono de negócio",
    techOwner: "Dono técnico",
    governance: "Governança",
    autonomy: "Autonomia",
    level: "Fronteira de decisão",
    escalates: "Escala para humano",
    limits: "Limites operacionais",
    origin: "Origem (Business Case)",
    baseline: "Baseline pré-agente",
    paybackTarget: "Meta de payback",
    paybackReal: "Payback real",
    sinceLabel: "Em produção desde",
    versionLabel: "geração",
    executionsLabel: "execuções no mês",
    target: "Meta",
    health: "Saúde geral",
    recommendedRoute: "Decisão recomendada",
    confidence: "Confiança do modelo",
    window: "Janela de execução",
    sponsor: "Sponsor da ação",
    rationaleLabel: "Leitura do sistema",
    nextActions: "Próximas ações",
    owner: "Responsável",
    in: "Em",
    detected: "Detectado",
    hypothesis: "Hipótese",
    action: "Recomendação",
    approve: "Aprovar plano",
    disagree: "Discordar do sistema",
    export: "Exportar para comitê",
    noAlerts:
      "Nenhum padrão antagônico detectado nas últimas semanas. Seguimos monitorando.",
    quote: "Quem lê só um indicador, comemora. Quem lê o sistema, intervém.",
    state: "Estado",
    onTarget: "Na meta",
    offTarget: "Fora da meta",
  },
  platform: {
    audienceLabel: "Platform",
    audienceHint: "Visão técnica — vocabulário de engenharia, métricas e traces",
    sec01: {
      title: "Registro do Agente",
      caption: "ID, cadeia de propriedade e fronteiras de autonomia",
    },
    sec02: {
      title: "Dashboard de Métricas",
      caption: "Framework de KPI em 5 camadas · janela atual",
    },
    sec03: {
      title: "Trajetória de Desempenho",
      caption: "Mesmo agente, snapshots temporais",
    },
    sec04: {
      title: "Detector de Padrões Antagônicos",
      caption: "Anomalias cruzadas invisíveis a dashboards de métrica única",
    },
    sec05: {
      title: "Recomendação do Sistema",
      caption: "Decisão de roteamento auto-gerada com evidências",
    },
    jobDescription: "Spec / Boundaries",
    mustDo: "Escopo positivo",
    mustNotDo: "Escopo negativo",
    goodWork: "Definição de pronto",
    responsibility: "Ownership",
    businessOwner: "Business owner",
    techOwner: "Tech owner",
    governance: "Governança",
    autonomy: "Config. de autonomia",
    level: "Decisões autônomas",
    escalates: "Gatilhos de escalonamento",
    limits: "Limites operacionais",
    origin: "Business case",
    baseline: "Baseline pré-deploy",
    paybackTarget: "Payback alvo",
    paybackReal: "Payback real",
    sinceLabel: "Em produção desde",
    versionLabel: "versão",
    executionsLabel: "execuções / mês",
    target: "Target",
    health: "Health score",
    recommendedRoute: "Rota recomendada",
    confidence: "Confiança do modelo",
    window: "Janela de execução",
    sponsor: "Sponsor",
    rationaleLabel: "Leitura do sistema",
    nextActions: "Próximas ações",
    owner: "Owner",
    in: "Em",
    detected: "Detected",
    hypothesis: "Hypothesis",
    action: "Action",
    approve: "Aprovar plano",
    disagree: "Override do sistema",
    export: "Exportar traces",
    noAlerts:
      "Nenhum padrão antagônico nas últimas semanas. Monitorando continuamente.",
    quote: "Read one metric, celebrate. Read the system, intervene.",
    state: "Estado",
    onTarget: "Na meta",
    offTarget: "Fora da meta",
  },
};

/* ── Layer presentation metadata ──────────────────────────── */
export const LAYER_ICON: Record<string, LucideIcon> = {
  efficacy: Target,
  efficiency: Zap,
  adoption: TrendingUp,
  governance: Shield,
  value: Award,
};

export const LAYER_CAPTION: Record<string, Record<Audience, string>> = {
  efficacy: { gestor: "O agente resolve mesmo?", platform: "Resolve de verdade?" },
  efficiency: { gestor: "O agente é viável?", platform: "Unit economics viável?" },
  adoption: { gestor: "A organização usa?", platform: "A org está usando?" },
  governance: {
    gestor: "É seguro deixar rodando?",
    platform: "Seguro em produção?",
  },
  value: { gestor: "Vale o investimento?", platform: "Vale o investimento?" },
};

/* ── Domain-default targets per metric (spec Parte 2) ─────── */
export const METRIC_TARGETS: Record<string, string> = {
  "Taxa de resolução": "≥ 85%",
  "Acurácia de roteamento": "≥ 90%",
  "Ganho de win rate": "≥ +5pp",
  "Ganho de renovação": "≥ +5pp",
  "Conversão de leads": "≥ 25%",
  "Cobertura de revisão": "≥ 90%",
  "Defeitos capturados": "≥ 80%",
  "Tempo de atendimento": "< 180 s",
  "Tempo de 1ª resposta": "< 60 s",
  "Tokens por tarefa": "baseline ±20%",
  "Velocidade ao lead": "< 5 min",
  "Tempo de CI poupado": "≥ 20%",
  "Custo por execução": "R$ 0,10–0,40",
  "Taxa de adoção": "≥ 70%",
  "Taxa de deflexão": "≥ 60%",
  "Adoção pelo time": "≥ 70%",
  "Aceite por devs": "≥ 70%",
  "Uso de licenças": "≥ 80%",
  "Volume tratado": "↑ ≥ 5% m/m",
  "Pipeline tocado": "—",
  "Violações de política": "0",
  "Sinais de alucinação": "≤ 2%",
  "Taxa de escalonamento": "≥ 80% apropr.",
  "Checagens de conformidade": "≥ 99%",
  "Cobertura de auditoria": "≥ 99%",
  "Falsos positivos": "≤ 5%",
  "Falsos alarmes": "≤ 5%",
  CSAT: "≥ 4,2/5",
  "Valor gerado": "—",
  "Win rate": "—",
};

const NUM_FMT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/**
 * Counts how many metrics are currently below their goal, reusing the same
 * on/off-target logic as the agent detail page. Metrics without a comparable
 * target (returns `null`) are ignored. Falls back to the domain-default
 * `METRIC_TARGETS` when a metric carries no explicit target, matching `MetricRow`.
 */
export function countMissedGoals(
  metrics: Array<{ label: string; value: number; target?: string }>,
): number {
  return metrics.reduce((count, m) => {
    const target = m.target ?? METRIC_TARGETS[m.label];
    return metricTargetStatus(m.value, target) === "off" ? count + 1 : count;
  }, 0);
}

export function formatMetric(value: number, unit: string): string {
  if (unit === "R$") return `R$ ${NUM_FMT.format(value)}`;
  if (unit === "R$ mil") return `R$ ${NUM_FMT.format(value)} mil`;
  if (unit === "%") return `${NUM_FMT.format(value)}%`;
  if (unit === "/5") return `${NUM_FMT.format(value)}/5`;
  return `${NUM_FMT.format(value)}${unit ? ` ${unit}` : ""}`;
}

/* ── SectionHeader: numbered editorial section title ───────── */
export function SectionHeader({
  number,
  title,
  caption,
}: {
  number: string;
  title: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-baseline gap-4">
      <span className="font-serif text-2xl italic text-muted-foreground/45 tabular-nums">
        {number}
      </span>
      <div>
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          {title}
        </h2>
        {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
      </div>
    </div>
  );
}

/* ── Pillar: one column of the Carteira identity grid ─────── */
export function Pillar({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <h3 className="font-serif text-base font-medium tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ── MetricRow: one KPI line inside a layer card ──────────── */
export function MetricRow({
  label,
  value,
  unit,
  trend,
  direction,
  target: targetProp,
  rationale,
  targetLabel,
  onTargetLabel = "Na meta",
  offTargetLabel = "Fora da meta",
}: {
  label: string;
  value: number;
  unit: string;
  trend: number;
  direction?: "up" | "down" | "flat";
  target?: string;
  rationale?: string;
  targetLabel: string;
  onTargetLabel?: string;
  offTargetLabel?: string;
}) {
  const target = targetProp ?? METRIC_TARGETS[label];
  const status = metricTargetStatus(value, target);
  const StatusIcon = status === "on" ? Check : AlertTriangle;
  const TrendIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const trendTone =
    direction === "up"
      ? "text-chart-1"
      : direction === "down"
        ? "text-chart-3"
        : "text-muted-foreground";

  return (
    <div className="flex items-start justify-between gap-2 border-b border-card-border/60 py-2 last:border-0">
      <div className="min-w-0">
        <div
          className="text-[13px] leading-tight text-foreground/90"
          title={rationale}
        >
          {label}
        </div>
        {target && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span>
              {targetLabel}: {target}
            </span>
            {status && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-medium",
                  status === "on"
                    ? "bg-chart-1/15 text-chart-1"
                    : "bg-chart-3/15 text-chart-3",
                )}
              >
                <StatusIcon className="h-2.5 w-2.5" strokeWidth={2.25} />
                {status === "on" ? onTargetLabel : offTargetLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-baseline gap-1.5">
        <span className="font-mono text-sm tabular-nums text-foreground">
          {formatMetric(value, unit)}
        </span>
        {trend !== 0 && (
          <span className={cn("flex items-center font-mono text-[10px]", trendTone)}>
            <TrendIcon className="h-3 w-3" />
            {trend > 0 ? "+" : ""}
            {NUM_FMT.format(trend)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── AudienceToggle: Gestor ↔ Platform pill switch ────────── */
export function AudienceToggle({
  audience,
  onChange,
}: {
  audience: Audience;
  onChange: (a: Audience) => void;
}) {
  const opt = (value: Audience, label: string, Icon: LucideIcon) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        audience === value
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-card-border bg-card p-1">
      {opt("gestor", "Gestor", Briefcase)}
      {opt("platform", "Platform", Terminal)}
    </div>
  );
}

export { Eyebrow };
