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
import { useLang, type Lang } from "@/lib/i18n";

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

const carteiraPt: Record<Audience, Dict> = {
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

const carteiraEn: Record<Audience, Dict> = {
  gestor: {
    audienceLabel: "Manager",
    audienceHint: "Manager view — language of people, decisions and ROI",
    sec01: {
      title: "Work Record",
      caption: "Identity, role and chain of responsibility of the agent",
    },
    sec02: {
      title: "Performance Review",
      caption: "Five performance layers · current window",
    },
    sec03: {
      title: "Review History",
      caption: "Performance trajectory over time",
    },
    sec04: {
      title: "Illusory Victory Detector",
      caption: "Antagonistic patterns isolated dashboards can't see",
    },
    sec05: {
      title: "Committee Recommendation",
      caption: "Synthesis for the portfolio meeting",
    },
    jobDescription: "Job Description",
    mustDo: "Must do",
    mustNotDo: "Must not do",
    goodWork: "Definition of good work",
    responsibility: "Responsibility",
    businessOwner: "Business owner",
    techOwner: "Technical owner",
    governance: "Governance",
    autonomy: "Autonomy",
    level: "Decision boundary",
    escalates: "Escalates to human",
    limits: "Operational limits",
    origin: "Origin (Business Case)",
    baseline: "Pre-agent baseline",
    paybackTarget: "Payback target",
    paybackReal: "Actual payback",
    sinceLabel: "In production since",
    versionLabel: "generation",
    executionsLabel: "runs this month",
    target: "Goal",
    health: "Overall health",
    recommendedRoute: "Recommended decision",
    confidence: "Model confidence",
    window: "Execution window",
    sponsor: "Action sponsor",
    rationaleLabel: "System reading",
    nextActions: "Next actions",
    owner: "Owner",
    in: "In",
    detected: "Detected",
    hypothesis: "Hypothesis",
    action: "Recommendation",
    approve: "Approve plan",
    disagree: "Disagree with the system",
    export: "Export for committee",
    noAlerts:
      "No antagonistic pattern detected in recent weeks. We keep monitoring.",
    quote: "Read one indicator only, and you celebrate. Read the system, and you intervene.",
    state: "State",
    onTarget: "On target",
    offTarget: "Off target",
    editGoal: "Edit goal",
    editGoalTitle: "Edit metric goal",
    editGoalDesc:
      "Review the goal and the rationale. The change applies from the current review onward.",
    targetField: "Goal",
    targetPlaceholder: "e.g. ≥ 85%",
    rationaleField: "Rationale",
    rationalePlaceholder: "Why is this the right goal?",
    save: "Save goal",
    cancel: "Cancel",
    goalSaved: "Goal updated",
    goalSaveError: "Could not save the goal.",
  },
  platform: {
    audienceLabel: "Platform",
    audienceHint: "Technical view — engineering vocabulary, metrics and traces",
    sec01: {
      title: "Agent Registry",
      caption: "ID, ownership chain and autonomy boundaries",
    },
    sec02: {
      title: "Metrics Dashboard",
      caption: "5-layer KPI framework · current window",
    },
    sec03: {
      title: "Performance Trajectory",
      caption: "Same agent, temporal snapshots",
    },
    sec04: {
      title: "Antagonistic Pattern Detector",
      caption: "Cross-metric anomalies invisible to single-metric dashboards",
    },
    sec05: {
      title: "System Recommendation",
      caption: "Auto-generated routing decision with evidence",
    },
    jobDescription: "Spec / Boundaries",
    mustDo: "Positive scope",
    mustNotDo: "Negative scope",
    goodWork: "Definition of done",
    responsibility: "Ownership",
    businessOwner: "Business owner",
    techOwner: "Tech owner",
    governance: "Governance",
    autonomy: "Autonomy config",
    level: "Autonomous decisions",
    escalates: "Escalation triggers",
    limits: "Operational limits",
    origin: "Business case",
    baseline: "Pre-deploy baseline",
    paybackTarget: "Target payback",
    paybackReal: "Actual payback",
    sinceLabel: "In production since",
    versionLabel: "version",
    executionsLabel: "runs / month",
    target: "Target",
    health: "Health score",
    recommendedRoute: "Recommended route",
    confidence: "Model confidence",
    window: "Execution window",
    sponsor: "Sponsor",
    rationaleLabel: "System reading",
    nextActions: "Next actions",
    owner: "Owner",
    in: "In",
    detected: "Detected",
    hypothesis: "Hypothesis",
    action: "Action",
    approve: "Approve plan",
    disagree: "System override",
    export: "Export traces",
    noAlerts:
      "No antagonistic pattern in recent weeks. Monitoring continuously.",
    quote: "Read one metric, celebrate. Read the system, intervene.",
    state: "State",
    onTarget: "On target",
    offTarget: "Off target",
    editGoal: "Edit target",
    editGoalTitle: "Edit metric target",
    editGoalDesc:
      "Adjust the target and the rationale. Applies to the agent's current review.",
    targetField: "Target",
    targetPlaceholder: "e.g. ≥ 85%",
    rationaleField: "Rationale",
    rationalePlaceholder: "Why is this the right target?",
    save: "Save target",
    cancel: "Cancel",
    goalSaved: "Target updated",
    goalSaveError: "Could not save the target.",
  },
};

const carteiraEs: Record<Audience, Dict> = {
  gestor: {
    audienceLabel: "Gestor",
    audienceHint: "Vista de gestor — lenguaje de personas, decisiones y ROI",
    sec01: {
      title: "Expediente Laboral",
      caption: "Identidad, rol y cadena de responsabilidad del agente",
    },
    sec02: {
      title: "Evaluación de Desempeño",
      caption: "Cinco capas de desempeño · ventana actual",
    },
    sec03: {
      title: "Historial de Evaluaciones",
      caption: "Trayectoria de desempeño a lo largo del tiempo",
    },
    sec04: {
      title: "Detector de Victoria Ilusoria",
      caption: "Patrones antagónicos que los dashboards aislados no ven",
    },
    sec05: {
      title: "Recomendación para el Comité",
      caption: "Síntesis para la reunión de portafolio",
    },
    jobDescription: "Job Description",
    mustDo: "Debe hacer",
    mustNotDo: "No debe hacer",
    goodWork: "Criterio de buen trabajo",
    responsibility: "Responsabilidad",
    businessOwner: "Dueño de negocio",
    techOwner: "Dueño técnico",
    governance: "Gobernanza",
    autonomy: "Autonomía",
    level: "Frontera de decisión",
    escalates: "Escala a humano",
    limits: "Límites operativos",
    origin: "Origen (Business Case)",
    baseline: "Baseline pre-agente",
    paybackTarget: "Meta de payback",
    paybackReal: "Payback real",
    sinceLabel: "En producción desde",
    versionLabel: "generación",
    executionsLabel: "ejecuciones en el mes",
    target: "Meta",
    health: "Salud general",
    recommendedRoute: "Decisión recomendada",
    confidence: "Confianza del modelo",
    window: "Ventana de ejecución",
    sponsor: "Sponsor de la acción",
    rationaleLabel: "Lectura del sistema",
    nextActions: "Próximas acciones",
    owner: "Responsable",
    in: "En",
    detected: "Detectado",
    hypothesis: "Hipótesis",
    action: "Recomendación",
    approve: "Aprobar plan",
    disagree: "Discrepar del sistema",
    export: "Exportar para el comité",
    noAlerts:
      "Ningún patrón antagónico detectado en las últimas semanas. Seguimos monitoreando.",
    quote: "Quien lee solo un indicador, celebra. Quien lee el sistema, interviene.",
    state: "Estado",
    onTarget: "En la meta",
    offTarget: "Fuera de la meta",
    editGoal: "Editar meta",
    editGoalTitle: "Editar meta de la métrica",
    editGoalDesc:
      "Revise la meta y la justificación. El cambio aplica desde la evaluación actual.",
    targetField: "Meta",
    targetPlaceholder: "ej.: ≥ 85%",
    rationaleField: "Justificación",
    rationalePlaceholder: "¿Por qué es esta la meta correcta?",
    save: "Guardar meta",
    cancel: "Cancelar",
    goalSaved: "Meta actualizada",
    goalSaveError: "No fue posible guardar la meta.",
  },
  platform: {
    audienceLabel: "Platform",
    audienceHint: "Vista técnica — vocabulario de ingeniería, métricas y traces",
    sec01: {
      title: "Registro del Agente",
      caption: "ID, cadena de propiedad y fronteras de autonomía",
    },
    sec02: {
      title: "Dashboard de Métricas",
      caption: "Framework de KPI en 5 capas · ventana actual",
    },
    sec03: {
      title: "Trayectoria de Desempeño",
      caption: "Mismo agente, snapshots temporales",
    },
    sec04: {
      title: "Detector de Patrones Antagónicos",
      caption: "Anomalías cruzadas invisibles para dashboards de métrica única",
    },
    sec05: {
      title: "Recomendación del Sistema",
      caption: "Decisión de ruteo autogenerada con evidencias",
    },
    jobDescription: "Spec / Boundaries",
    mustDo: "Alcance positivo",
    mustNotDo: "Alcance negativo",
    goodWork: "Definición de listo",
    responsibility: "Ownership",
    businessOwner: "Business owner",
    techOwner: "Tech owner",
    governance: "Gobernanza",
    autonomy: "Config. de autonomía",
    level: "Decisiones autónomas",
    escalates: "Disparadores de escalamiento",
    limits: "Límites operativos",
    origin: "Business case",
    baseline: "Baseline pre-deploy",
    paybackTarget: "Payback objetivo",
    paybackReal: "Payback real",
    sinceLabel: "En producción desde",
    versionLabel: "versión",
    executionsLabel: "ejecuciones / mes",
    target: "Target",
    health: "Health score",
    recommendedRoute: "Ruta recomendada",
    confidence: "Confianza del modelo",
    window: "Ventana de ejecución",
    sponsor: "Sponsor",
    rationaleLabel: "Lectura del sistema",
    nextActions: "Próximas acciones",
    owner: "Owner",
    in: "En",
    detected: "Detected",
    hypothesis: "Hypothesis",
    action: "Action",
    approve: "Aprobar plan",
    disagree: "Override del sistema",
    export: "Exportar traces",
    noAlerts:
      "Ningún patrón antagónico en las últimas semanas. Monitoreando continuamente.",
    quote: "Read one metric, celebrate. Read the system, intervene.",
    state: "Estado",
    onTarget: "En la meta",
    offTarget: "Fuera de la meta",
    editGoal: "Editar target",
    editGoalTitle: "Editar target de la métrica",
    editGoalDesc:
      "Ajuste el target y la justificación. Aplica a la evaluación actual del agente.",
    targetField: "Target",
    targetPlaceholder: "ej.: ≥ 85%",
    rationaleField: "Justificación",
    rationalePlaceholder: "¿Por qué es este el target correcto?",
    save: "Guardar target",
    cancel: "Cancelar",
    goalSaved: "Target actualizado",
    goalSaveError: "No fue posible guardar el target.",
  },
};

export const carteiraI18n: Record<Lang, Record<Audience, Dict>> = {
  pt: carteiraPt,
  en: carteiraEn,
  es: carteiraEs,
};

/* ── Layer presentation metadata ──────────────────────────── */
export const LAYER_ICON: Record<string, LucideIcon> = {
  efficacy: Target,
  efficiency: Zap,
  adoption: TrendingUp,
  governance: Shield,
  value: Award,
};

export const LAYER_CAPTION: Record<Lang, Record<string, Record<Audience, string>>> = {
  pt: {
    efficacy: { gestor: "O agente resolve mesmo?", platform: "Resolve de verdade?" },
    efficiency: { gestor: "O agente é viável?", platform: "Unit economics viável?" },
    adoption: { gestor: "A organização usa?", platform: "A org está usando?" },
    governance: {
      gestor: "É seguro deixar rodando?",
      platform: "Seguro em produção?",
    },
    value: { gestor: "Vale o investimento?", platform: "Vale o investimento?" },
  },
  en: {
    efficacy: { gestor: "Does the agent actually solve it?", platform: "Does it truly solve?" },
    efficiency: { gestor: "Is the agent viable?", platform: "Viable unit economics?" },
    adoption: { gestor: "Does the organization use it?", platform: "Is the org using it?" },
    governance: {
      gestor: "Is it safe to keep it running?",
      platform: "Safe in production?",
    },
    value: { gestor: "Worth the investment?", platform: "Worth the investment?" },
  },
  es: {
    efficacy: { gestor: "¿El agente realmente resuelve?", platform: "¿Resuelve de verdad?" },
    efficiency: { gestor: "¿El agente es viable?", platform: "¿Unit economics viable?" },
    adoption: { gestor: "¿La organización lo usa?", platform: "¿La org lo está usando?" },
    governance: {
      gestor: "¿Es seguro dejarlo corriendo?",
      platform: "¿Seguro en producción?",
    },
    value: { gestor: "¿Vale la inversión?", platform: "¿Vale la inversión?" },
  },
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

const METRIC_PILL_CLASS: Record<MetricPillStatus, string> = {
  stable: "bg-chart-1/15 text-chart-1",
  medium: "bg-chart-2/20 text-chart-2",
  high: "bg-chart-3/18 text-chart-3",
  critical: "bg-chart-4/15 text-chart-4",
};

const METRIC_PILL_LABEL: Record<Lang, Record<MetricPillStatus, string>> = {
  pt: { stable: "Estável", medium: "Média", high: "Alta", critical: "Crítica" },
  en: { stable: "Stable", medium: "Medium", high: "High", critical: "Critical" },
  es: { stable: "Estable", medium: "Media", high: "Alta", critical: "Crítica" },
};

/** Lang-aware label for the per-metric status pill. */
export function metricPillLabel(status: MetricPillStatus, lang: Lang): string {
  return METRIC_PILL_LABEL[lang][status];
}

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
  const { lang } = useLang();
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
                METRIC_PILL_CLASS[pill],
              )}
            >
              {metricPillLabel(pill, lang)}
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
const DETECTOR_PILL_LABEL: Record<
  Lang,
  { criticalIllusory: string; critical: string; antecedent: string; antagonistic: string }
> = {
  pt: {
    criticalIllusory: "Vitória ilusória crítica",
    critical: "Crítica",
    antecedent: "Sinal antecedente",
    antagonistic: "Alerta antagônico",
  },
  en: {
    criticalIllusory: "Critical illusory victory",
    critical: "Critical",
    antecedent: "Antecedent signal",
    antagonistic: "Antagonistic alert",
  },
  es: {
    criticalIllusory: "Victoria ilusoria crítica",
    critical: "Crítica",
    antecedent: "Señal antecedente",
    antagonistic: "Alerta antagónica",
  },
};

/** Left-border tone + pill wording per severity, matching the reference
 *  screens: VITÓRIA ILUSÓRIA CRÍTICA / ALERTA ANTAGÔNICO / SINAL ANTECEDENTE. */
export function detectorPresentation(
  severity: string,
  patternType?: string,
  lang: Lang = "pt",
) {
  const labels = DETECTOR_PILL_LABEL[lang];
  switch (severity) {
    case "critical":
      return {
        border: "border-l-chart-4",
        pill: "bg-chart-4/15 text-chart-4",
        pillLabel: patternType?.toLowerCase().includes("vitória")
          ? labels.criticalIllusory
          : labels.critical,
      };
    case "antecedent":
      return {
        border: "border-l-chart-2",
        pill: "bg-chart-2/20 text-chart-2",
        pillLabel: labels.antecedent,
      };
    case "medium":
      return {
        border: "border-l-chart-2",
        pill: "bg-chart-2/20 text-chart-2",
        pillLabel: labels.antagonistic,
      };
    default:
      return {
        border: "border-l-chart-3",
        pill: "bg-chart-3/18 text-chart-3",
        pillLabel: labels.antagonistic,
      };
  }
}

/* ── AudienceToggle: Gestor ↔ Platform pill switch ────────── */
const AUDIENCE_TOGGLE_LABEL: Record<Lang, Record<Audience, string>> = {
  pt: { gestor: "Gestor", platform: "Platform" },
  en: { gestor: "Manager", platform: "Platform" },
  es: { gestor: "Gestor", platform: "Platform" },
};

export function AudienceToggle({
  audience,
  onChange,
}: {
  audience: Audience;
  onChange: (a: Audience) => void;
}) {
  const { lang } = useLang();
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
      {opt("gestor", AUDIENCE_TOGGLE_LABEL[lang].gestor, Briefcase)}
      {opt("platform", AUDIENCE_TOGGLE_LABEL[lang].platform, Terminal)}
    </div>
  );
}

export { Eyebrow };
