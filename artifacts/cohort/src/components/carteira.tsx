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
  AlertTriangle,
  Pencil,
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
  editGoal: string;
  editGoalTitle: string;
  editGoalDesc: string;
  targetField: string;
  targetPlaceholder: string;
  rationaleField: string;
  rationalePlaceholder: string;
  save: string;
  cancel: string;
  goalSaved: string;
  goalSaveError: string;
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
    editGoal: "Editar meta",
    editGoalTitle: "Editar meta da métrica",
    editGoalDesc:
      "Revise a meta e a justificativa. A mudança vale a partir da avaliação atual.",
    targetField: "Meta",
    targetPlaceholder: "ex.: ≥ 85%",
    rationaleField: "Justificativa",
    rationalePlaceholder: "Por que esta é a meta certa?",
    save: "Salvar meta",
    cancel: "Cancelar",
    goalSaved: "Meta atualizada",
    goalSaveError: "Não foi possível salvar a meta.",
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
    editGoal: "Editar target",
    editGoalTitle: "Editar target da métrica",
    editGoalDesc:
      "Ajuste o target e a justificativa. Aplica-se à avaliação atual do agente.",
    targetField: "Target",
    targetPlaceholder: "ex.: ≥ 85%",
    rationaleField: "Justificativa",
    rationalePlaceholder: "Por que este é o target correto?",
    save: "Salvar target",
    cancel: "Cancelar",
    goalSaved: "Target atualizado",
    goalSaveError: "Não foi possível salvar o target.",
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

/* ── Per-metric status pill (reference: CRÍTICA/ALTA/MÉDIA/ESTÁVEL) ── */
export type MetricPillStatus = "stable" | "medium" | "high" | "critical";

const METRIC_PILL: Record<MetricPillStatus, { label: string; className: string }> = {
  stable: { label: "Estável", className: "bg-chart-1/15 text-chart-1" },
  medium: { label: "Média", className: "bg-chart-2/20 text-chart-2" },
  high: { label: "Alta", className: "bg-chart-3/18 text-chart-3" },
  critical: { label: "Crítica", className: "bg-chart-4/15 text-chart-4" },
};

/**
 * Reference-design status per metric row: on-target → Estável; off-target →
 * Alta, escalating to Crítica when the miss is ≥15% of the goal; a target we
 * can't compare (e.g. "baseline ±20%") → Média (needs human reading).
 */
export function metricPillStatus(
  value: number,
  target: string | undefined,
): MetricPillStatus | null {
  if (!target || target === "—" || target === "-") return null;
  const status = metricTargetStatus(value, target);
  if (status === null) return "medium";
  if (status === "on") return "stable";
  const num = parseFloat(target.replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/)?.[0] ?? "");
  if (!Number.isFinite(num) || num === 0) return "high";
  return Math.abs(value - num) / Math.abs(num) >= 0.15 ? "critical" : "high";
}

/** Trend delta in the reference notation: percentage metrics move in "pp". */
export function formatTrendDelta(trend: number, unit: string): string {
  const sign = trend > 0 ? "+" : "";
  const n = NUM_FMT.format(trend);
  return unit === "%" ? `${sign}${n}pp` : `${sign}${n}`;
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
  onEdit,
  editLabel,
}: {
  label: string;
  value: number;
  unit: string;
  trend: number;
  direction?: "up" | "down" | "flat";
  target?: string;
  rationale?: string;
  targetLabel?: string;
  onTargetLabel?: string;
  offTargetLabel?: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const target = targetProp ?? METRIC_TARGETS[label];
  const pill = metricPillStatus(value, target);
  const offTarget = pill === "high" || pill === "critical";
  const TrendIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <div className="border-b border-card-border/60 py-2.5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        {/* Label with the goal right below it, in quiet mono — reference layout */}
        <div className="min-w-0">
          <div className="text-[13px] leading-tight text-foreground/90">{label}</div>
          {target && (
            <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
              {target}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {/* Value in prominent mono + trend arrow + delta, all quiet ink */}
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[15px] font-medium tabular-nums text-foreground">
              {formatMetric(value, unit)}
            </span>
            {trend !== 0 && (
              <span className="flex items-center gap-0.5 font-mono text-[10.5px] text-foreground/60">
                <TrendIcon className="h-3 w-3" strokeWidth={1.75} />
                {formatTrendDelta(trend, unit)}
              </span>
            )}
          </div>
          {pill && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em]",
                METRIC_PILL[pill].className,
              )}
            >
              {METRIC_PILL[pill].label}
            </span>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={editLabel ?? "Editar meta"}
              title={editLabel ?? "Editar meta"}
              className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {/* Context annotation (reference: "⚠ Valor inflado por queda em qualidade") */}
      {rationale && (
        <div className="mt-1 flex items-start gap-1.5 text-[11px] italic text-muted-foreground">
          {offTarget && (
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-chart-3" strokeWidth={1.75} />
          )}
          <span className="leading-snug">{rationale}</span>
        </div>
      )}
    </div>
  );
}

/* ── Detector de Vitória Ilusória — reference presentation ── */
/** Left-border tone + pill wording per severity, matching the reference
 *  screens: VITÓRIA ILUSÓRIA CRÍTICA / ALERTA ANTAGÔNICO / SINAL ANTECEDENTE. */
export function detectorPresentation(severity: string, patternType?: string) {
  switch (severity) {
    case "critical":
      return {
        border: "border-l-chart-4",
        pill: "bg-chart-4/15 text-chart-4",
        pillLabel: patternType?.toLowerCase().includes("vitória")
          ? "Vitória ilusória crítica"
          : "Crítica",
      };
    case "antecedent":
      return {
        border: "border-l-chart-2",
        pill: "bg-chart-2/20 text-chart-2",
        pillLabel: "Sinal antecedente",
      };
    case "medium":
      return {
        border: "border-l-chart-2",
        pill: "bg-chart-2/20 text-chart-2",
        pillLabel: "Alerta antagônico",
      };
    default:
      return {
        border: "border-l-chart-3",
        pill: "bg-chart-3/18 text-chart-3",
        pillLabel: "Alerta antagônico",
      };
  }
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
