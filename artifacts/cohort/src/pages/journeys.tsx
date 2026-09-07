import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { customFetch } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow, PageHeading, Pill } from "@/components/cohort";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ScenarioSourceBadge } from "@/components/mission-control/operational-status";
import { classifyScenarioSource } from "@/components/mission-control/presentation";
import { isActionableJourneyBottleneck } from "@/lib/journey-performance";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Ban,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock,
  Columns3,
  Cpu,
  DollarSign,
  GitBranch,
  Network,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Rows3,
  ShieldCheck,
  Sparkles,
  Timer,
  User,
  UserCheck,
  Users,
  Zap,
  XCircle,
} from "lucide-react";

type JourneyStatus = "draft" | "active" | "paused" | "archived" | string;
type StepType = "agent" | "human" | "system";
type DecisionMode = "autonomous" | "human-approval" | "committee" | string;
type FlowDirection = "horizontal" | "vertical";

type Journey = {
  id: string;
  name: string;
  description: string;
  entryCriterion: string;
  successCriterion: string;
  teamId: string;
  status: JourneyStatus;
  slaMinutes: number;
  owner: string;
  stepCount: number;
  handoffCount: number;
  agentCount: number;
  createdAt: string;
  updatedAt: string;
};

type JourneyStep = {
  id: string;
  journeyId: string;
  stepKey: string;
  name: string;
  sequence: number;
  stepType: StepType;
  agentId: string | null;
  responsibility: string;
  decisionMode: DecisionMode;
  expectedDurationMs: number;
  required: boolean;
  guardrails: unknown;
  agent?: {
    id: string;
    name: string;
    platform: string;
    role: string;
    status: string;
    healthScore: number;
    currentVerdict: string;
  };
};

type JourneyHandoff = {
  id: string;
  journeyId: string;
  fromStepId: string;
  toStepId: string;
  condition: string;
  protocol: string;
  requiredContext: unknown;
  status: string;
};

type JourneyDetail = Journey & {
  team: { id: string; name: string; slug: string };
  purpose: { id: string; name: string; outcome: string };
  steps: JourneyStep[];
  handoffs: JourneyHandoff[];
};

type JourneyMonitoring = {
  totalRuns: number;
  activeRuns: number;
  completedRuns: number;
  failedRuns: number;
  completionRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  totalCostCents: number;
  avgCostCentsPerRun: number;
  handoffSuccessRate: number;
  bottleneckStepId: string | null;
  illusoryVictory: boolean;
  warnings: string[];
  steps: Array<{
    stepId: string;
    stepName: string;
    agentId: string | null;
    agentName: string | null;
    executions: number;
    successRate: number;
    avgDurationMs: number;
    totalCostCents: number;
  }>;
  recentRuns: Array<{
    runId: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number;
    totalCostCents: number;
    currentStepId: string | null;
  }>;
};

type JourneyMonitoringPayload = Omit<
  JourneyMonitoring,
  "avgDurationMs" | "p95DurationMs" | "avgCostCentsPerRun" | "handoffSuccessRate" | "steps" | "recentRuns"
> & {
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  avgCostCentsPerRun: number | null;
  handoffSuccessRate: number | null;
  steps: Array<{
    stepId?: string;
    stepName?: string | null;
    id?: string;
    name?: string | null;
    agentId?: string | null;
    agentName?: string | null;
    executions?: number;
    successRate?: number | null;
    avgDurationMs?: number | null;
    totalCostCents?: number;
  }>;
  recentRuns: Array<{
    runId: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
    endedAt?: string | null;
    lastEventAt?: string | null;
    durationMs?: number | null;
    totalCostCents?: number;
    costCents?: number;
    currentStepId?: string | null;
  }>;
};

type Team = {
  id: string;
  name: string;
  slug: string;
  purposeId?: string;
  memberCount?: number;
  agentCount?: number;
};

type TeamDetail = Team & {
  assignments: Array<{
    agentId: string;
    status: string;
  }>;
};

type Agent = {
  id: string;
  name: string;
  platform: string;
  role: string;
  status: string;
  healthScore: number;
  currentVerdict: string;
};

type RecommendationDecision = "approved" | "rejected";
type RejectionDisposition = "revise" | "close" | "escalate";

type RecommendationAction = {
  id: string;
  sequence: number;
  actorType: string;
  agentId?: string | null;
  agentName?: string | null;
  title: string;
  instructions: string;
  capability: string;
  executionMode: string;
  controlScope: string;
  status: string;
  owner: string;
  slaMinutes: number;
  dueAt?: string | null;
  result?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

type Recommendation = {
  id: string;
  journeyId: string;
  runId?: string | null;
  stepId?: string | null;
  agentId?: string | null;
  title: string;
  rationale: string;
  expectedImpact: string;
  riskLevel: string;
  status: string;
  source: string;
  reviewSlaMinutes: number;
  reviewDueAt: string;
  decisionReason?: string | null;
  rejectionDisposition?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  nextReviewAt?: string | null;
  createdAt: string;
  updatedAt: string;
  actions: RecommendationAction[];
  autonomySummary: {
    muster: number;
    agent: number;
    human: number;
  };
};

type DecisionDraft = {
  recommendationId: string;
  decision: RecommendationDecision;
  reason: string;
  rejectionDisposition: RejectionDisposition;
};

type ActionDraft = {
  actionId: string;
  status: "blocked" | "completed";
  result: string;
};

type CreateJourneyForm = {
  name: string;
  description: string;
  entryCriterion: string;
  successCriterion: string;
  teamId: string;
  slaMinutes: string;
  owner: string;
};

type CreateStepForm = {
  name: string;
  stepKey: string;
  stepType: StepType;
  agentId: string;
  responsibility: string;
  decisionMode: DecisionMode;
  expectedDurationMinutes: string;
  required: boolean;
  guardrails: string;
};

type CreateHandoffForm = {
  fromStepId: string;
  toStepId: string;
  condition: string;
  protocol: string;
  requiredContext: string;
};

const EMPTY_JOURNEY: CreateJourneyForm = {
  name: "",
  description: "",
  entryCriterion: "",
  successCriterion: "",
  teamId: "",
  slaMinutes: "60",
  owner: "",
};

const EMPTY_STEP: CreateStepForm = {
  name: "",
  stepKey: "",
  stepType: "agent",
  agentId: "",
  responsibility: "",
  decisionMode: "autonomous",
  expectedDurationMinutes: "5",
  required: true,
  guardrails: "",
};

const EMPTY_HANDOFF: CreateHandoffForm = {
  fromStepId: "",
  toStepId: "",
  condition: "Etapa concluída com sucesso",
  protocol: "context-envelope-v1",
  requiredContext: "",
};

async function getJson<T>(url: string): Promise<T> {
  return customFetch<T>(url, { credentials: "include", responseType: "json" });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return customFetch<T>(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    responseType: "json",
  });
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return customFetch<T>(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    responseType: "json",
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function listFromText(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

function formatPercent(value: number) {
  return `${normalizePercent(value).toFixed(1).replace(".0", "")}%`;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}

function formatCost(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Em andamento";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusTone(status: string): "sage" | "ochre" | "terracotta" | "red" | "blue" | "muted" {
  if (["active", "completed", "healthy", "success"].includes(status)) return "sage";
  if (["draft", "running", "in_progress", "active_run"].includes(status)) return "blue";
  if (["paused", "attention", "warning"].includes(status)) return "ochre";
  if (["failed", "critical"].includes(status)) return "red";
  if (status === "archived") return "muted";
  return "terracotta";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Ativa",
    draft: "Rascunho",
    paused: "Pausada",
    archived: "Arquivada",
    completed: "Concluída",
    failed: "Falhou",
    running: "Em execução",
    in_progress: "Em execução",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function decisionLabel(mode: DecisionMode) {
  const labels: Record<string, string> = {
    autonomous: "Autônoma",
    "human-approval": "Aprovação humana",
    committee: "Comitê",
  };
  return labels[mode] ?? mode;
}

function recommendationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Aguardando decisão",
    proposed: "Aguardando decisão",
    approved: "Aprovada",
    rejected: "Rejeitada",
    executing: "Em execução",
    blocked: "Bloqueada",
    completed: "Concluída",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function recommendationTone(status: string): "sage" | "ochre" | "terracotta" | "red" | "blue" | "muted" {
  if (["approved", "completed"].includes(status)) return "sage";
  if (["pending", "proposed"].includes(status)) return "ochre";
  if (status === "rejected") return "red";
  if (status === "executing") return "blue";
  if (status === "blocked") return "red";
  return "muted";
}

function riskLabel(risk: string) {
  const labels: Record<string, string> = {
    low: "Risco baixo",
    medium: "Risco moderado",
    high: "Risco alto",
    critical: "Risco crítico",
  };
  return labels[risk] ?? `Risco ${risk}`;
}

function riskTone(risk: string): "sage" | "ochre" | "terracotta" | "red" | "muted" {
  if (risk === "low") return "sage";
  if (risk === "medium") return "ochre";
  if (risk === "high") return "terracotta";
  if (risk === "critical") return "red";
  return "muted";
}

function actionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ready: "Pronta",
    "in-progress": "Em execução",
    in_progress: "Em execução",
    blocked: "Bloqueada",
    completed: "Concluída",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function actionTone(status: string): "sage" | "ochre" | "red" | "blue" | "muted" {
  if (status === "completed") return "sage";
  if (["in-progress", "in_progress"].includes(status)) return "blue";
  if (status === "blocked") return "red";
  if (status === "ready") return "ochre";
  return "muted";
}

function dispositionLabel(disposition: string | null | undefined) {
  const labels: Record<string, string> = {
    revise: "Revisar recomendação",
    close: "Encerrar recomendação",
    escalate: "Escalar para governança",
  };
  return disposition ? labels[disposition] ?? disposition : "Não informada";
}

function formatSla(dueAt: string | null | undefined, slaMinutes: number) {
  if (!dueAt) return `${slaMinutes} min para decisão`;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return `${slaMinutes} min para decisão`;
  const difference = due.getTime() - Date.now();
  const absoluteMinutes = Math.max(1, Math.ceil(Math.abs(difference) / 60_000));
  if (difference < 0) return `SLA vencido há ${absoluteMinutes} min`;
  if (absoluteMinutes < 60) return `Decisão em até ${absoluteMinutes} min`;
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `Decisão em até ${hours}h${minutes ? ` ${minutes}min` : ""}`;
}

function valueList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${String(item)}`);
  }
  return typeof value === "string" && value ? [value] : [];
}

function normalizeMonitoring(payload: JourneyMonitoringPayload): JourneyMonitoring {
  return {
    ...payload,
    avgDurationMs: payload.avgDurationMs ?? 0,
    p95DurationMs: payload.p95DurationMs ?? 0,
    avgCostCentsPerRun: payload.avgCostCentsPerRun ?? 0,
    handoffSuccessRate: payload.handoffSuccessRate ?? 0,
    steps: payload.steps.map((step) => ({
      stepId: step.stepId ?? step.id ?? "",
      stepName: step.stepName ?? step.name ?? "Etapa sem nome",
      agentId: step.agentId ?? null,
      agentName: step.agentName ?? null,
      executions: step.executions ?? 0,
      successRate: step.successRate ?? 0,
      avgDurationMs: step.avgDurationMs ?? 0,
      totalCostCents: step.totalCostCents ?? 0,
    })),
    recentRuns: payload.recentRuns.map((run) => ({
      runId: run.runId,
      status: run.status,
      startedAt: run.startedAt ?? run.lastEventAt ?? "",
      completedAt: run.completedAt ?? run.endedAt ?? null,
      durationMs: run.durationMs ?? 0,
      totalCostCents: run.totalCostCents ?? run.costCents ?? 0,
      currentStepId: run.currentStepId ?? null,
    })),
  };
}

function stepIcon(type: StepType) {
  if (type === "human") return User;
  if (type === "system") return Cpu;
  return Bot;
}

function StepCard({
  step,
  monitoring,
  bottleneck,
  direction,
}: {
  step: JourneyStep;
  monitoring?: JourneyMonitoring["steps"][number];
  bottleneck: boolean;
  direction: FlowDirection;
}) {
  const Icon = stepIcon(step.stepType);
  const guardrails = valueList(step.guardrails);
  return (
    <div
      className={cn(
        "relative min-w-0 shrink-0 rounded-xl border bg-card p-4 transition-colors",
        direction === "horizontal" ? "w-[320px] sm:w-[340px]" : "w-full",
        bottleneck ? "border-chart-2/70 shadow-[0_0_0_1px_hsl(var(--chart-2)/0.15)]" : "border-card-border",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-lg border border-border bg-secondary/70 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Eyebrow>Etapa {step.sequence}</Eyebrow>
            <p className="break-words font-medium leading-snug text-foreground">{step.name}</p>
          </div>
        </div>
        {bottleneck && <Pill tone="ochre">Gargalo</Pill>}
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>Participante</Eyebrow>
            <Pill tone="muted">{step.stepType === "agent" ? "Agente" : step.stepType === "human" ? "Humano" : "Sistema"}</Pill>
          </div>
          <p className="mt-2 break-words text-sm font-medium text-foreground">
            {step.agent?.name ?? (step.stepType === "human" ? "Operação humana" : "Serviço interno")}
          </p>
          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
            {step.agent ? `${step.agent.role} · ${step.agent.platform}` : step.responsibility || "Responsabilidade não descrita"}
          </p>
        </div>

        {step.agent && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary/45 p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saúde</p>
              <p className="mt-1 font-mono text-sm text-foreground">{step.agent.healthScore}%</p>
            </div>
            <div className="rounded-lg bg-secondary/45 p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Decisão</p>
              <p className="mt-1 break-words text-xs font-medium text-foreground">{step.agent.currentVerdict}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Pill tone={step.required ? "sage" : "muted"}>{step.required ? "Obrigatória" : "Opcional"}</Pill>
          <Pill tone="blue">{decisionLabel(step.decisionMode)}</Pill>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Meta {formatDuration(step.expectedDurationMs)}</span>
          <span>{monitoring ? `${monitoring.executions} exec.` : "Sem execuções"}</span>
        </div>

        {monitoring && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Sucesso local</span>
              <span className="font-mono text-foreground">{formatPercent(monitoring.successRate)}</span>
            </div>
            <Progress value={normalizePercent(monitoring.successRate)} className="h-1.5" />
          </div>
        )}

        {guardrails.length > 0 && (
          <div className="rounded-lg border border-border/70 bg-secondary/20 p-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Guardrails
            </p>
            <p className="break-words text-xs leading-relaxed text-foreground">{guardrails.join(" · ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HandoffConnector({ handoff, direction }: { handoff?: JourneyHandoff; direction: FlowDirection }) {
  const Arrow = direction === "horizontal" ? ArrowRight : ArrowDown;
  const contextCount = handoff ? valueList(handoff.requiredContext).length : 0;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center gap-2 text-muted-foreground",
        direction === "horizontal" ? "w-52 flex-col px-3" : "min-h-28 w-full flex-col py-3 sm:flex-row",
      )}
      role="group"
      aria-label={handoff ? `Handoff ${handoff.protocol}` : "Conexão sem contrato de handoff"}
    >
      <Arrow className={cn("text-primary", direction === "horizontal" ? "h-5 w-5" : "h-6 w-6")} />
      {handoff ? (
        <div className={cn("rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-center", direction === "horizontal" ? "w-48" : "w-full max-w-xl")}>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary">Handoff · {handoff.protocol}</p>
          <p className="mt-1 break-words text-xs leading-relaxed text-foreground">{handoff.condition || "Condição não definida"}</p>
          {contextCount > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">{contextCount} campos de contexto</p>
          )}
        </div>
      ) : (
        <span className="text-[10px] uppercase tracking-wide">Sem handoff</span>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  attention = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  attention?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card/90 p-4", attention ? "border-chart-2/50" : "border-card-border/90")}>
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <Icon className={cn("h-4 w-4", attention ? "text-chart-2" : "text-muted-foreground")} />
      </div>
      <p className="font-serif text-2xl font-medium text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  decisionDraft,
  busyOperation,
  onOpenDecision,
  onChangeDecision,
  onCancelDecision,
  onSubmitDecision,
  onUpdateAction,
}: {
  recommendation: Recommendation;
  decisionDraft: DecisionDraft | null;
  busyOperation: string | null;
  onOpenDecision: (recommendationId: string, decision: RecommendationDecision) => void;
  onChangeDecision: (draft: DecisionDraft) => void;
  onCancelDecision: () => void;
  onSubmitDecision: () => void;
  onUpdateAction: (
    recommendationId: string,
    actionId: string,
    status: "in-progress" | "blocked" | "completed" | "ready",
    result?: string,
  ) => void;
}) {
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const awaitingDecision = ["pending", "proposed"].includes(recommendation.status);
  const canOperate = ["approved", "executing", "blocked"].includes(recommendation.status);
  const isDecisionOpen = decisionDraft?.recommendationId === recommendation.id;
  const decisionBusy = busyOperation === `decision:${recommendation.id}`;
  const orderedActions = [...recommendation.actions].sort((left, right) => left.sequence - right.sequence);
  const actorGroups = [
    {
      key: "muster",
      label: "Muster executa",
      description: "Ajustes dentro dos guardrails e do escopo de controle da plataforma.",
      icon: Zap,
      iconClassName: "bg-chart-1/15 text-chart-1",
      summary: recommendation.autonomySummary.muster,
    },
    {
      key: "agent",
      label: "Agente trabalha",
      description: "Tarefas delegadas aos agentes participantes da jornada.",
      icon: Bot,
      iconClassName: "bg-chart-5/15 text-chart-5",
      summary: recommendation.autonomySummary.agent,
    },
    {
      key: "human",
      label: "Humano decide/executa",
      description: "Decisões, exceções e ações que exigem responsabilidade humana.",
      icon: UserCheck,
      iconClassName: "bg-chart-2/15 text-chart-2",
      summary: recommendation.autonomySummary.human,
    },
  ];

  return (
    <Card className="overflow-hidden border-card-border/90 bg-card/90">
      <CardHeader className="border-b border-border/60 bg-secondary/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Pill tone={recommendationTone(recommendation.status)}>{recommendationStatusLabel(recommendation.status)}</Pill>
              <Pill tone={riskTone(recommendation.riskLevel)}>{riskLabel(recommendation.riskLevel)}</Pill>
              <span className={cn(
                "flex items-center gap-1.5 text-xs",
                new Date(recommendation.reviewDueAt).getTime() < Date.now() && awaitingDecision
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}>
                <Clock className="h-3.5 w-3.5" />
                {awaitingDecision
                  ? formatSla(recommendation.reviewDueAt, recommendation.reviewSlaMinutes)
                  : `SLA de revisão: ${recommendation.reviewSlaMinutes} min`}
              </span>
            </div>
            <CardTitle className="text-xl">{recommendation.title}</CardTitle>
            <CardDescription className="mt-1.5">Fonte: {recommendation.source} · criada em {formatDate(recommendation.createdAt)}</CardDescription>
          </div>
          {awaitingDecision && !isDecisionOpen && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" onClick={() => onOpenDecision(recommendation.id, "approved")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Aprovar
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenDecision(recommendation.id, "rejected")}>
                <XCircle className="mr-2 h-4 w-4" />Rejeitar
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-secondary/15 p-4">
            <Eyebrow>Por que agir</Eyebrow>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{recommendation.rationale}</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <Eyebrow>Impacto esperado</Eyebrow>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{recommendation.expectedImpact}</p>
          </div>
        </div>

        {isDecisionOpen && decisionDraft && (
          <div className={cn(
            "rounded-xl border p-4",
            decisionDraft.decision === "approved"
              ? "border-chart-1/35 bg-chart-1/5"
              : "border-destructive/30 bg-destructive/5",
          )}>
            <div className="flex items-start gap-3">
              <span className={cn(
                "rounded-lg p-2",
                decisionDraft.decision === "approved" ? "bg-chart-1/15 text-chart-1" : "bg-destructive/10 text-destructive",
              )}>
                {decisionDraft.decision === "approved" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {decisionDraft.decision === "approved" ? "Confirmar aprovação" : "Registrar rejeição e destino"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {decisionDraft.decision === "approved"
                    ? "A aprovação libera os próximos passos conforme autonomia, owner e SLA definidos."
                    : "A recomendação não será executada. Defina se ela deve ser revisada, encerrada ou escalada."}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-2">
                    <Label htmlFor={`decision-reason-${recommendation.id}`}>Motivo da decisão</Label>
                    <Textarea
                      id={`decision-reason-${recommendation.id}`}
                      value={decisionDraft.reason}
                      onChange={(event) => onChangeDecision({ ...decisionDraft, reason: event.target.value })}
                      placeholder={decisionDraft.decision === "approved" ? "Qual evidência sustenta a aprovação?" : "Por que a recomendação foi rejeitada?"}
                      className="min-h-24 bg-background/70"
                    />
                  </div>
                  {decisionDraft.decision === "rejected" && (
                    <div className="space-y-2">
                      <Label htmlFor={`rejection-disposition-${recommendation.id}`}>Próximo fluxo</Label>
                      <select
                        id={`rejection-disposition-${recommendation.id}`}
                        value={decisionDraft.rejectionDisposition}
                        onChange={(event) => onChangeDecision({
                          ...decisionDraft,
                          rejectionDisposition: event.target.value as RejectionDisposition,
                        })}
                        className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm text-foreground"
                      >
                        <option value="revise">Revisar recomendação</option>
                        <option value="close">Encerrar recomendação</option>
                        <option value="escalate">Escalar para governança</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={onCancelDecision} disabled={decisionBusy}>Cancelar</Button>
                  <Button
                    variant={decisionDraft.decision === "approved" ? "default" : "destructive"}
                    size="sm"
                    onClick={onSubmitDecision}
                    disabled={decisionBusy || !decisionDraft.reason.trim()}
                  >
                    {decisionBusy
                      ? "Registrando…"
                      : decisionDraft.decision === "approved"
                        ? "Aprovar e liberar ações"
                        : "Rejeitar recomendação"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!awaitingDecision && (
          <div className={cn(
            "grid gap-3 rounded-xl border p-4 md:grid-cols-2",
            recommendation.status === "rejected"
              ? "border-destructive/25 bg-destructive/5"
              : "border-chart-1/30 bg-chart-1/5",
          )}>
            <div>
              <Eyebrow>{recommendation.status === "rejected" ? "Motivo da rejeição" : "Decisão registrada"}</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{recommendation.decisionReason || "Decisão registrada sem justificativa adicional."}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {recommendation.decidedBy || "Responsável não informado"} · {formatDate(recommendation.decidedAt ?? null)}
              </p>
            </div>
            <div>
              <Eyebrow>{recommendation.status === "rejected" ? "Destino" : "Próximo review"}</Eyebrow>
              <p className="mt-2 text-sm font-medium text-foreground">
                {recommendation.status === "rejected"
                  ? dispositionLabel(recommendation.rejectionDisposition)
                  : recommendation.nextReviewAt
                    ? formatDate(recommendation.nextReviewAt)
                    : "Aguardando definição"}
              </p>
              {recommendation.status === "rejected" && recommendation.nextReviewAt && (
                <p className="mt-1 text-xs text-muted-foreground">Nova revisão em {formatDate(recommendation.nextReviewAt)}</p>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow>Desdobramento operacional</Eyebrow>
              <h4 className="mt-1 font-medium text-foreground">{canOperate ? "Ações liberadas pela aprovação" : "Preview dos próximos passos"}</h4>
            </div>
            <p className="text-xs text-muted-foreground">{orderedActions.length} ações · autonomia explícita por responsável</p>
          </div>

          {orderedActions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Nenhuma ação foi proposta para esta recomendação.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-3">
              {actorGroups.map((group) => {
                const GroupIcon = group.icon;
                const actions = orderedActions.filter((action) => action.actorType.toLowerCase() === group.key);
                return (
                  <div key={group.key} className="min-w-0 rounded-xl border border-border/70 bg-secondary/10 p-3.5">
                    <div className="flex items-start gap-3 border-b border-border/60 pb-3">
                      <span className={cn("rounded-lg p-2", group.iconClassName)}><GroupIcon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{group.label}</p>
                          <Pill tone="muted">{group.summary}</Pill>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{group.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {actions.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">Sem ações para este ator.</p>
                      ) : actions.map((action) => {
                        const actionBusy = busyOperation === `action:${action.id}`;
                        return (
                          <div key={action.id} className="rounded-lg border border-border/70 bg-card/80 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-start gap-2">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[10px] text-foreground">{action.sequence}</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium leading-snug text-foreground">{action.title}</p>
                                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.instructions}</p>
                                </div>
                              </div>
                              <Pill tone={actionTone(action.status)}>{actionStatusLabel(action.status)}</Pill>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                              <div><span className="block uppercase tracking-wide">Owner</span><span className="mt-0.5 block truncate font-medium text-foreground">{action.agentName || action.owner}</span></div>
                              <div><span className="block uppercase tracking-wide">SLA</span><span className="mt-0.5 block font-medium text-foreground">{action.slaMinutes} min</span></div>
                              <div><span className="block uppercase tracking-wide">Capacidade</span><span className="mt-0.5 block truncate font-medium text-foreground">{action.capability}</span></div>
                              <div><span className="block uppercase tracking-wide">Execução</span><span className="mt-0.5 block truncate font-medium text-foreground">{action.executionMode}</span></div>
                            </div>
                            <div className="mt-2 rounded-md bg-secondary/45 px-2.5 py-2 text-[11px] text-muted-foreground">
                              <ShieldCheck className="mr-1.5 inline h-3 w-3" />Escopo: {action.controlScope}
                            </div>
                            {action.dueAt && <p className="mt-2 text-[11px] text-muted-foreground"><Clock className="mr-1.5 inline h-3 w-3" />Prazo {formatDate(action.dueAt)}</p>}
                            {action.result && <p className="mt-2 rounded-md border border-chart-1/20 bg-chart-1/5 px-2.5 py-2 text-xs text-foreground"><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-chart-1" />{action.result}</p>}

                            {canOperate && action.status !== "completed" && (
                              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                                {["ready", "blocked"].includes(action.status) && (
                                  <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => onUpdateAction(recommendation.id, action.id, "in-progress")} disabled={actionBusy}>
                                    {action.status === "blocked" ? <RotateCcw className="mr-1.5 h-3 w-3" /> : <Play className="mr-1.5 h-3 w-3" />}
                                    {action.status === "blocked" ? "Retomar" : "Iniciar"}
                                  </Button>
                                )}
                                {["in-progress", "in_progress"].includes(action.status) && (
                                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setActionDraft({ actionId: action.id, status: "blocked", result: "" })} disabled={actionBusy}>
                                    <Ban className="mr-1.5 h-3 w-3" />Bloquear
                                  </Button>
                                )}
                                {["in-progress", "in_progress", "blocked"].includes(action.status) && (
                                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setActionDraft({ actionId: action.id, status: "completed", result: "" })} disabled={actionBusy}>
                                    <CheckCircle2 className="mr-1.5 h-3 w-3" />Concluir
                                  </Button>
                                )}
                              </div>
                            )}
                            {canOperate && actionDraft?.actionId === action.id && (
                              <div className="mt-3 space-y-2 rounded-lg border border-border/70 bg-background/60 p-3">
                                <Label htmlFor={`action-result-${action.id}`}>
                                  {actionDraft.status === "blocked" ? "Motivo do bloqueio" : "Evidência de conclusão"}
                                </Label>
                                <Textarea
                                  id={`action-result-${action.id}`}
                                  value={actionDraft.result}
                                  onChange={(event) => setActionDraft({ ...actionDraft, result: event.target.value })}
                                  placeholder={
                                    actionDraft.status === "blocked"
                                      ? "Descreva o impedimento, dependência e próximo passo."
                                      : "Registre o resultado e a evidência produzida."
                                  }
                                  className="min-h-20 bg-background"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="sm" onClick={() => setActionDraft(null)} disabled={actionBusy}>Cancelar</Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      onUpdateAction(
                                        recommendation.id,
                                        action.id,
                                        actionDraft.status,
                                        actionDraft.result.trim(),
                                      );
                                      setActionDraft(null);
                                    }}
                                    disabled={actionBusy || !actionDraft.result.trim()}
                                  >
                                    Confirmar
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {recommendation.nextReviewAt && recommendation.status !== "rejected" && (
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-secondary/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground"><RefreshCw className="h-4 w-4 text-primary" />Próximo ciclo de revisão</div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">{formatDate(recommendation.nextReviewAt)}<ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JourneyPageLayout({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  if (embedded) {
    return <div className="p-4 sm:p-6" data-workforce-embedded-page="true" data-operational-source="api">{children}</div>;
  }
  return <AppLayout breadcrumbs={[{ label: "Operação" }, { label: "Jornadas A2A" }]}>{children}</AppLayout>;
}

export default function JourneysPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedJourneyId, setSelectedJourneyId] = useState("");
  const [flowDirection, setFlowDirection] = useState<FlowDirection>("vertical");
  const [showJourneyForm, setShowJourneyForm] = useState(false);
  const [showStepForm, setShowStepForm] = useState(false);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [journeyForm, setJourneyForm] = useState<CreateJourneyForm>(EMPTY_JOURNEY);
  const [stepForm, setStepForm] = useState<CreateStepForm>(EMPTY_STEP);
  const [handoffForm, setHandoffForm] = useState<CreateHandoffForm>(EMPTY_HANDOFF);
  const [saving, setSaving] = useState<"journey" | "step" | "handoff" | "status" | "validation" | null>(null);
  const [recommendationOperation, setRecommendationOperation] = useState<string | null>(null);
  const [decisionDraft, setDecisionDraft] = useState<DecisionDraft | null>(null);

  const journeys = useQuery({
    queryKey: ["journeys"],
    queryFn: () => getJson<Journey[]>("/api/journeys"),
  });
  const teams = useQuery({
    queryKey: ["mixed-teams"],
    queryFn: () => getJson<Team[]>("/api/teams"),
  });
  const agents = useQuery({
    queryKey: ["agents", "journey-builder"],
    queryFn: () => getJson<Agent[]>("/api/agents"),
  });
  const detail = useQuery({
    queryKey: ["journey", selectedJourneyId],
    queryFn: () => getJson<JourneyDetail>(`/api/journeys/${selectedJourneyId}`),
    enabled: Boolean(selectedJourneyId),
  });
  const teamDetail = useQuery({
    queryKey: ["mixed-team", detail.data?.teamId],
    queryFn: () => getJson<TeamDetail>(`/api/teams/${detail.data!.teamId}`),
    enabled: Boolean(detail.data?.teamId),
  });
  const monitoring = useQuery({
    queryKey: ["journey-monitoring", selectedJourneyId],
    queryFn: async () => normalizeMonitoring(
      await getJson<JourneyMonitoringPayload>(`/api/journeys/${selectedJourneyId}/monitoring`),
    ),
    enabled: Boolean(selectedJourneyId),
    refetchInterval: selectedJourneyId ? 15_000 : false,
  });
  const recommendations = useQuery({
    queryKey: ["journey-recommendations", selectedJourneyId],
    queryFn: () => getJson<Recommendation[]>(`/api/journeys/${selectedJourneyId}/recommendations`),
    enabled: Boolean(selectedJourneyId),
    refetchInterval: selectedJourneyId ? 15_000 : false,
  });

  useEffect(() => {
    if (!selectedJourneyId && journeys.data?.length) setSelectedJourneyId(journeys.data[0].id);
  }, [journeys.data, selectedJourneyId]);

  useEffect(() => {
    if (!journeyForm.teamId && teams.data?.length) {
      setJourneyForm((current) => ({ ...current, teamId: teams.data?.[0]?.id ?? "" }));
    }
  }, [journeyForm.teamId, teams.data]);

  useEffect(() => {
    setDecisionDraft(null);
  }, [selectedJourneyId]);

  const orderedSteps = useMemo(
    () => [...(detail.data?.steps ?? [])].sort((left, right) => left.sequence - right.sequence),
    [detail.data?.steps],
  );

  const handoffByEdge = useMemo(() => {
    return new Map((detail.data?.handoffs ?? []).map((handoff) => [`${handoff.fromStepId}:${handoff.toStepId}`, handoff]));
  }, [detail.data?.handoffs]);

  const monitoringByStep = useMemo(() => {
    return new Map((monitoring.data?.steps ?? []).map((step) => [step.stepId, step]));
  }, [monitoring.data?.steps]);

  const agentNameById = useMemo(
    () => new Map((agents.data ?? []).map((agent) => [agent.id, agent.name])),
    [agents.data],
  );
  const assignedAgentIds = useMemo(
    () => new Set(
      (teamDetail.data?.assignments ?? [])
        .filter((assignment) => assignment.status === "active")
        .map((assignment) => assignment.agentId),
    ),
    [teamDetail.data?.assignments],
  );

  function resetStepForm() {
    setStepForm(EMPTY_STEP);
  }

  function resetHandoffForm() {
    const first = orderedSteps[0]?.id ?? "";
    const second = orderedSteps[1]?.id ?? "";
    setHandoffForm({ ...EMPTY_HANDOFF, fromStepId: first, toStepId: second });
  }

  async function createJourney() {
    if (!journeyForm.name.trim() || !journeyForm.teamId || !journeyForm.owner.trim()) {
      toast({ title: "Preencha nome, time e owner", variant: "destructive" });
      return;
    }
    setSaving("journey");
    try {
      const created = await postJson<Journey>("/api/journeys", {
        name: journeyForm.name.trim(),
        description: journeyForm.description.trim(),
        entryCriterion: journeyForm.entryCriterion.trim(),
        successCriterion: journeyForm.successCriterion.trim(),
        teamId: journeyForm.teamId,
        status: "draft",
        slaMinutes: Number(journeyForm.slaMinutes) || 60,
        owner: journeyForm.owner.trim(),
      });
      await journeys.refetch();
      setSelectedJourneyId(created.id);
      setJourneyForm({ ...EMPTY_JOURNEY, teamId: journeyForm.teamId });
      setShowJourneyForm(false);
      toast({ title: "Jornada criada", description: "Agora desenhe as etapas e os handoffs da frota." });
    } catch (error) {
      toast({
        title: "Não foi possível criar a jornada",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  async function createStep() {
    if (!selectedJourneyId || !stepForm.name.trim() || !stepForm.responsibility.trim()) {
      toast({ title: "Informe nome e responsabilidade da etapa", variant: "destructive" });
      return;
    }
    if (stepForm.stepType === "agent" && !stepForm.agentId) {
      toast({ title: "Selecione o agente responsável", variant: "destructive" });
      return;
    }
    setSaving("step");
    try {
      const sequence = orderedSteps.reduce((highest, step) => Math.max(highest, step.sequence), 0) + 1;
      if (
        stepForm.stepType === "agent" &&
        stepForm.agentId &&
        selectedJourney &&
        !assignedAgentIds.has(stepForm.agentId)
      ) {
        await postJson(`/api/teams/${selectedJourney.team.id}/agents`, {
          agentId: stepForm.agentId,
          assignmentRole: orderedSteps.length === 0 ? "primary" : "supporting",
          responsibility: stepForm.responsibility.trim(),
        });
      }
      await postJson<JourneyStep>(`/api/journeys/${selectedJourneyId}/steps`, {
        stepKey: stepForm.stepKey.trim() || slugify(stepForm.name),
        name: stepForm.name.trim(),
        sequence,
        stepType: stepForm.stepType,
        agentId: stepForm.stepType === "agent" ? stepForm.agentId : null,
        responsibility: stepForm.responsibility.trim(),
        decisionMode: stepForm.decisionMode,
        expectedDurationMs: (Number(stepForm.expectedDurationMinutes) || 5) * 60_000,
        required: stepForm.required,
        guardrails: listFromText(stepForm.guardrails),
      });
      await Promise.all([
        detail.refetch(),
        journeys.refetch(),
        monitoring.refetch(),
        teamDetail.refetch(),
      ]);
      resetStepForm();
      setShowStepForm(false);
      toast({ title: "Etapa adicionada", description: "A responsabilidade entrou no fluxo operacional." });
    } catch (error) {
      toast({
        title: "Não foi possível adicionar a etapa",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  async function createHandoff() {
    if (!selectedJourneyId || !handoffForm.fromStepId || !handoffForm.toStepId) {
      toast({ title: "Selecione a origem e o destino", variant: "destructive" });
      return;
    }
    if (handoffForm.fromStepId === handoffForm.toStepId) {
      toast({ title: "Origem e destino precisam ser diferentes", variant: "destructive" });
      return;
    }
    setSaving("handoff");
    try {
      await postJson<JourneyHandoff>(`/api/journeys/${selectedJourneyId}/handoffs`, {
        fromStepId: handoffForm.fromStepId,
        toStepId: handoffForm.toStepId,
        condition: handoffForm.condition.trim(),
        protocol: handoffForm.protocol.trim(),
        requiredContext: listFromText(handoffForm.requiredContext),
        status: "active",
      });
      await Promise.all([detail.refetch(), journeys.refetch(), monitoring.refetch()]);
      resetHandoffForm();
      setShowHandoffForm(false);
      toast({ title: "Handoff conectado", description: "O contrato de passagem agora faz parte da jornada." });
    } catch (error) {
      toast({
        title: "Não foi possível criar o handoff",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  const selectedJourney = detail.data;
  const selectedJourneySummary = (journeys.data ?? []).find(
    (journey) => journey.id === selectedJourneyId,
  );
  const monitor = monitoring.data;
  const actionableBottleneckStepId = monitor && selectedJourney && isActionableJourneyBottleneck({
    totalRuns: monitor.totalRuns,
    p95DurationMs: monitor.p95DurationMs,
    bottleneckStepId: monitor.bottleneckStepId,
    slaMinutes: selectedJourney.slaMinutes,
  })
    ? monitor.bottleneckStepId
    : null;
  const slowestStepName = monitor?.bottleneckStepId
    ? orderedSteps.find((step) => step.id === monitor.bottleneckStepId)?.name ?? "Etapa observada"
    : null;
  const scenarioSource = classifyScenarioSource(
    `${selectedJourney?.name ?? ""} ${selectedJourney?.description ?? ""} ${(monitoring.data?.recentRuns ?? []).map((run) => run.runId).join(" ")}`,
  );
  const refreshAll = () => Promise.all([
    journeys.refetch(),
    detail.refetch(),
    monitoring.refetch(),
    recommendations.refetch(),
  ]);

  async function changeJourneyStatus(status: "active" | "paused") {
    if (!selectedJourneyId) return;
    setSaving("status");
    try {
      await patchJson<JourneyDetail>(`/api/journeys/${selectedJourneyId}`, { status });
      await refreshAll();
      toast({
        title: status === "active" ? "Jornada ativada" : "Jornada pausada",
        description: status === "active"
          ? "A frota está pronta para receber eventos de execução."
          : "A configuração foi preservada e a operação foi sinalizada como pausada.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível alterar a jornada",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  async function generateRecommendation() {
    if (!selectedJourneyId) return;
    setRecommendationOperation("generate");
    try {
      await postJson<Recommendation>(`/api/journeys/${selectedJourneyId}/recommendations/generate`, {});
      await recommendations.refetch();
      toast({
        title: "Recomendação gerada",
        description: "O monitor atual foi transformado em uma proposta com autonomia, responsáveis e SLAs explícitos.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível gerar a recomendação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRecommendationOperation(null);
    }
  }

  async function runValidationScenario() {
    if (!selectedJourneyId || !selectedJourney || orderedSteps.length === 0) return;
    if (orderedSteps.length > 1 && selectedJourney.handoffs.length < orderedSteps.length - 1) {
      toast({
        title: "Complete os handoffs antes do teste",
        description: "O cenário de validação só executa jornadas com contratos de passagem explícitos.",
        variant: "destructive",
      });
      return;
    }

    setSaving("validation");
    const runId = `validacao-ui-${Date.now()}`;
    const startedAt = Date.now();
    let elapsedMs = 0;
    let totalCostCents = 0;
    try {
      await postJson(`/api/journeys/${selectedJourneyId}/events`, {
        externalEventId: `${runId}-inicio`,
        runId,
        kind: "journey_started",
        ts: new Date(startedAt).toISOString(),
        metadata: { source: "validation-ui", testScenario: true },
      });

      for (let index = 0; index < orderedSteps.length; index += 1) {
        const step = orderedSteps[index]!;
        const durationMs = Math.max(1_000, step.expectedDurationMs || 60_000);
        const costCents = step.stepType === "agent" ? 18 : 0;
        elapsedMs += durationMs;
        totalCostCents += costCents;
        await postJson(`/api/journeys/${selectedJourneyId}/events`, {
          externalEventId: `${runId}-etapa-${index + 1}`,
          runId,
          stepId: step.id,
          agentId: step.agentId,
          kind: "step_completed",
          ts: new Date(startedAt + elapsedMs).toISOString(),
          durationMs,
          costCents,
          success: true,
          metadata: {
            source: "validation-ui",
            testScenario: true,
            responsibility: step.responsibility,
          },
        });

        const nextStep = orderedSteps[index + 1];
        if (nextStep) {
          const handoff = handoffByEdge.get(`${step.id}:${nextStep.id}`);
          if (!handoff) throw new Error(`Handoff ausente entre ${step.name} e ${nextStep.name}.`);
          elapsedMs += 1_000;
          await postJson(`/api/journeys/${selectedJourneyId}/events`, {
            externalEventId: `${runId}-handoff-${index + 1}`,
            runId,
            agentId: step.agentId,
            fromStepId: step.id,
            toStepId: nextStep.id,
            kind: "handoff",
            ts: new Date(startedAt + elapsedMs).toISOString(),
            durationMs: 1_000,
            costCents: 0,
            success: true,
            metadata: {
              source: "validation-ui",
              testScenario: true,
              protocol: handoff.protocol,
            },
          });
        }
      }

      await postJson(`/api/journeys/${selectedJourneyId}/events`, {
        externalEventId: `${runId}-fim`,
        runId,
        kind: "journey_completed",
        ts: new Date(startedAt + elapsedMs).toISOString(),
        durationMs: elapsedMs,
        costCents: 0,
        success: true,
        metadata: {
          source: "validation-ui",
          testScenario: true,
          observedTotalCostCents: totalCostCents,
        },
      });
      await monitoring.refetch();
      toast({
        title: "Cenário de validação concluído",
        description: `${orderedSteps.length} etapas e ${Math.max(orderedSteps.length - 1, 0)} handoffs enviados como dados de teste.`,
      });
    } catch (error) {
      toast({
        title: "Falha no cenário de validação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  function openDecision(recommendationId: string, decision: RecommendationDecision) {
    setDecisionDraft({
      recommendationId,
      decision,
      reason: "",
      rejectionDisposition: "revise",
    });
  }

  async function submitRecommendationDecision() {
    if (!selectedJourneyId || !decisionDraft || !decisionDraft.reason.trim()) return;
    const operation = `decision:${decisionDraft.recommendationId}`;
    setRecommendationOperation(operation);
    try {
      await postJson<Recommendation>(
        `/api/journeys/${selectedJourneyId}/recommendations/${decisionDraft.recommendationId}/decision`,
        {
          decision: decisionDraft.decision,
          decidedBy:
            user?.fullName ??
            user?.primaryEmailAddress?.emailAddress ??
            "Operador Muster",
          reason: decisionDraft.reason.trim(),
          ...(decisionDraft.decision === "rejected"
            ? { rejectionDisposition: decisionDraft.rejectionDisposition }
            : {}),
        },
      );
      setDecisionDraft(null);
      await recommendations.refetch();
      toast({
        title: decisionDraft.decision === "approved" ? "Recomendação aprovada" : "Recomendação rejeitada",
        description: decisionDraft.decision === "approved"
          ? "As ações foram liberadas conforme autonomia, owner e SLA."
          : `Próximo fluxo: ${dispositionLabel(decisionDraft.rejectionDisposition)}.`,
      });
    } catch (error) {
      toast({
        title: "Não foi possível registrar a decisão",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRecommendationOperation(null);
    }
  }

  async function updateRecommendationAction(
    recommendationId: string,
    actionId: string,
    status: "in-progress" | "blocked" | "completed" | "ready",
    result?: string,
  ) {
    if (!selectedJourneyId) return;
    setRecommendationOperation(`action:${actionId}`);
    try {
      await patchJson<Recommendation>(
        `/api/journeys/${selectedJourneyId}/recommendations/${recommendationId}/actions/${actionId}`,
        { status, ...(result ? { result } : {}) },
      );
      await recommendations.refetch();
      toast({
        title: status === "completed"
          ? "Ação concluída"
          : status === "blocked"
            ? "Ação bloqueada"
            : "Execução atualizada",
        description: status === "blocked"
          ? "O bloqueio ficou visível para supervisão e próximo review."
          : "O plano operacional foi atualizado.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível atualizar a ação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRecommendationOperation(null);
    }
  }

  return (
    <JourneyPageLayout embedded={embedded}>
      <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PageHeading
          eyebrow="Orquestração humano-agente"
          title="Jornadas A2A"
          subtitle="Modele frotas de decisão como jornadas observáveis: quem participa, o que decide, como transfere contexto e onde o resultado se perde."
          action={
            <Button onClick={() => setShowJourneyForm((open) => !open)}>
              <Plus className="mr-2 h-4 w-4" /> Nova jornada
            </Button>
          }
        />

        {showJourneyForm && (
          <Card className="border-primary/25 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Network className="h-5 w-5 text-primary" />Nova jornada operacional</CardTitle>
              <CardDescription>Comece pelo resultado, pelo time responsável e pelo compromisso de prazo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="journey-name">Nome</Label>
                <Input id="journey-name" placeholder="Ex.: Resolução de incidente crítico" value={journeyForm.name} onChange={(event) => setJourneyForm({ ...journeyForm, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journey-team">Time responsável</Label>
                <select id="journey-team" value={journeyForm.teamId} onChange={(event) => setJourneyForm({ ...journeyForm, teamId: event.target.value })} className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground">
                  <option value="">Selecione o time</option>
                  {(teams.data ?? []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="journey-owner">Owner</Label>
                <Input id="journey-owner" placeholder="Pessoa responsável" value={journeyForm.owner} onChange={(event) => setJourneyForm({ ...journeyForm, owner: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journey-sla">SLA em minutos</Label>
                <Input id="journey-sla" type="number" min="1" value={journeyForm.slaMinutes} onChange={(event) => setJourneyForm({ ...journeyForm, slaMinutes: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-4">
                <Label htmlFor="journey-description">Descrição e resultado esperado</Label>
                <Textarea id="journey-description" placeholder="Descreva o início, o resultado e os limites da jornada." value={journeyForm.description} onChange={(event) => setJourneyForm({ ...journeyForm, description: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-1 xl:col-span-2">
                <Label htmlFor="journey-entry">Critério de entrada</Label>
                <Textarea id="journey-entry" placeholder="Quando uma execução deve entrar nesta jornada?" value={journeyForm.entryCriterion} onChange={(event) => setJourneyForm({ ...journeyForm, entryCriterion: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-1 xl:col-span-2">
                <Label htmlFor="journey-success">Critério de sucesso</Label>
                <Textarea id="journey-success" placeholder="Qual evidência confirma o outcome end-to-end?" value={journeyForm.successCriterion} onChange={(event) => setJourneyForm({ ...journeyForm, successCriterion: event.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={createJourney} disabled={saving === "journey" || teams.isLoading} className="flex-1">{saving === "journey" ? "Criando…" : "Criar jornada"}</Button>
                <Button variant="outline" onClick={() => setShowJourneyForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-card-border/90 bg-card/90">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-[180px]">
                <Eyebrow>Jornada em foco</Eyebrow>
                <p className="mt-1 text-sm text-muted-foreground">
                  {journeys.data?.length ?? 0} jornadas no portfólio
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="journey-selector" className="sr-only">Selecionar jornada</Label>
                <select
                  id="journey-selector"
                  value={selectedJourneyId}
                  disabled={journeys.isLoading || journeys.isError || (journeys.data ?? []).length === 0}
                  onChange={(event) => setSelectedJourneyId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-secondary/35 px-3 text-sm font-medium text-foreground disabled:opacity-60"
                >
                  {(journeys.data ?? []).length === 0 && <option value="">Nenhuma jornada disponível</option>}
                  {(journeys.data ?? []).map((journey) => (
                    <option key={journey.id} value={journey.id}>
                      {journey.name} · {statusLabel(journey.status)}
                    </option>
                  ))}
                </select>
              </div>
              {selectedJourneySummary && (
                <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                  <div className="rounded-lg bg-secondary/35 px-3 py-2"><span className="block font-mono text-sm text-foreground">{selectedJourneySummary.stepCount}</span>etapas</div>
                  <div className="rounded-lg bg-secondary/35 px-3 py-2"><span className="block font-mono text-sm text-foreground">{selectedJourneySummary.agentCount}</span>agentes</div>
                  <div className="rounded-lg bg-secondary/35 px-3 py-2"><span className="block font-mono text-sm text-foreground">{selectedJourneySummary.handoffCount}</span>handoffs</div>
                </div>
              )}
              <Button variant="outline" size="icon" onClick={() => journeys.refetch()} aria-label="Atualizar jornadas">
                <RefreshCw className={cn("h-4 w-4", journeys.isFetching && "animate-spin")} />
              </Button>
            </div>
            {journeys.isError && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                Não foi possível carregar o portfólio. <button type="button" className="font-medium text-foreground underline" onClick={() => journeys.refetch()}>Tentar novamente</button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-5">
            {!selectedJourneyId ? (
              <Card className="border-dashed border-card-border bg-card/60">
                <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                  <Network className="mb-4 h-10 w-10 text-muted-foreground" />
                  <h2 className="font-serif text-2xl text-foreground">Selecione ou crie uma jornada</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">A experiência conecta frota, responsabilidades, decisões, handoffs e resultado end-to-end.</p>
                </CardContent>
              </Card>
            ) : detail.isLoading ? (
              <div className="space-y-4">
                <div className="h-36 animate-pulse rounded-xl bg-card" />
                <div className="h-72 animate-pulse rounded-xl bg-card" />
              </div>
            ) : detail.isError || !selectedJourney ? (
              <Card className="border-destructive/30 bg-card">
                <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                  <XCircle className="mb-3 h-8 w-8 text-destructive" />
                  <p className="font-medium text-foreground">Não foi possível abrir esta jornada</p>
                  <Button variant="outline" className="mt-4" onClick={() => detail.refetch()}>Tentar novamente</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <nav aria-label="Seções da jornada" className="flex flex-wrap gap-2 rounded-xl border border-card-border/80 bg-card/70 p-2">
                  {[
                    ["Visão geral", "#journey-overview"],
                    ["Fluxo", "#journey-flow"],
                    ["Performance", "#journey-performance"],
                    ["Recomendações", "#journey-recommendations"],
                  ].map(([label, href]) => (
                    <a key={href} href={href} className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                      {label}
                    </a>
                  ))}
                </nav>

                <Card id="journey-overview" className="scroll-mt-24 border-card-border/90 bg-card/90">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Pill tone={statusTone(selectedJourney.status)}>{statusLabel(selectedJourney.status)}</Pill>
                          <ScenarioSourceBadge source={scenarioSource} />
                          <span className="text-xs text-muted-foreground">Atualizada em {formatDate(selectedJourney.updatedAt)}</span>
                        </div>
                        <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">{selectedJourney.name}</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{selectedJourney.description || "Sem descrição operacional."}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={selectedJourney.status === "active" ? "outline" : "default"}
                          size="sm"
                          onClick={() => changeJourneyStatus(selectedJourney.status === "active" ? "paused" : "active")}
                          disabled={saving === "status"}
                        >
                          {saving === "status"
                            ? "Atualizando…"
                            : selectedJourney.status === "active"
                              ? "Pausar jornada"
                              : "Ativar jornada"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={refreshAll}>
                          {/* Não desabilitar por isFetching: com a atualização
                              automática de 5s ele fica quase sempre verdadeiro,
                              e o botão parecia travado. O giro fica só no
                              refetch manual. */}
                          <RefreshCw className={cn("mr-2 h-4 w-4", (detail.isRefetching || monitoring.isRefetching) && "animate-spin")} />Atualizar
                        </Button>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                      <div><Eyebrow>Time</Eyebrow><p className="mt-1 text-sm font-medium text-foreground">{selectedJourney.team.name}</p></div>
                      <div><Eyebrow>Propósito</Eyebrow><p className="mt-1 text-sm font-medium text-foreground">{selectedJourney.purpose.name}</p></div>
                      <div><Eyebrow>Owner</Eyebrow><p className="mt-1 text-sm font-medium text-foreground">{selectedJourney.owner || "Não definido"}</p></div>
                      <div><Eyebrow>SLA end-to-end</Eyebrow><p className="mt-1 text-sm font-medium text-foreground">{selectedJourney.slaMinutes} minutos</p></div>
                    </div>
                    <div className="mt-4 rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Outcome:</span> {selectedJourney.purpose.outcome}</p>
                    </div>
                    {(selectedJourney.entryCriterion || selectedJourney.successCriterion) && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border/60 bg-secondary/15 px-3 py-2.5">
                          <Eyebrow>Entrada</Eyebrow>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selectedJourney.entryCriterion || "Não definida"}</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-secondary/15 px-3 py-2.5">
                          <Eyebrow>Sucesso end-to-end</Eyebrow>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selectedJourney.successCriterion || "Não definido"}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card id="journey-flow" className="scroll-mt-24 overflow-hidden border-card-border/90 bg-card/70">
                  <CardHeader className="border-b border-border/60 bg-card/80">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />Fluxo da jornada</CardTitle>
                        <CardDescription>{orderedSteps.length} etapas · {selectedJourney.handoffs.length} contratos de handoff</CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex rounded-lg border border-border bg-secondary/30 p-1">
                          <Button variant={flowDirection === "horizontal" ? "secondary" : "ghost"} size="sm" onClick={() => setFlowDirection("horizontal")} className="h-8 px-2.5" aria-pressed={flowDirection === "horizontal"}>
                            <Columns3 className="mr-1.5 h-3.5 w-3.5" />Horizontal
                          </Button>
                          <Button variant={flowDirection === "vertical" ? "secondary" : "ghost"} size="sm" onClick={() => setFlowDirection("vertical")} className="h-8 px-2.5" aria-pressed={flowDirection === "vertical"}>
                            <Rows3 className="mr-1.5 h-3.5 w-3.5" />Vertical
                          </Button>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setShowStepForm((open) => !open)}><Plus className="mr-1.5 h-3.5 w-3.5" />Etapa</Button>
                        <Button variant="outline" size="sm" disabled={orderedSteps.length < 2} onClick={() => { resetHandoffForm(); setShowHandoffForm((open) => !open); }}><Plus className="mr-1.5 h-3.5 w-3.5" />Handoff</Button>
                      </div>
                    </div>
                  </CardHeader>

                  {showStepForm && (
                    <CardContent className="border-b border-border/60 bg-secondary/10 p-5">
                      <div className="mb-4"><Eyebrow>Nova responsabilidade</Eyebrow><h3 className="mt-1 font-medium text-foreground">Adicionar etapa à frota</h3></div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2"><Label htmlFor="step-name">Nome</Label><Input id="step-name" placeholder="Ex.: Classificar solicitação" value={stepForm.name} onChange={(event) => setStepForm({ ...stepForm, name: event.target.value, stepKey: stepForm.stepKey || slugify(event.target.value) })} /></div>
                        <div className="space-y-2"><Label htmlFor="step-key">Chave</Label><Input id="step-key" value={stepForm.stepKey} onChange={(event) => setStepForm({ ...stepForm, stepKey: slugify(event.target.value) })} /></div>
                        <div className="space-y-2"><Label htmlFor="step-type">Tipo</Label><select id="step-type" value={stepForm.stepType} onChange={(event) => setStepForm({ ...stepForm, stepType: event.target.value as StepType, agentId: event.target.value === "agent" ? stepForm.agentId : "" })} className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground"><option value="agent">Agente</option><option value="human">Humana</option><option value="system">Sistema</option></select></div>
                        <div className="space-y-2"><Label htmlFor="step-agent">Agente participante</Label><select id="step-agent" value={stepForm.agentId} disabled={stepForm.stepType !== "agent"} onChange={(event) => setStepForm({ ...stepForm, agentId: event.target.value })} className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground disabled:opacity-50"><option value="">Selecione o agente</option>{(agents.data ?? []).map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}{assignedAgentIds.has(agent.id) ? " · no time" : " · será incluído no time"}</option>)}</select><p className="text-[11px] text-muted-foreground">Agentes fora do time serão vinculados ao confirmar a etapa.</p></div>
                        <div className="space-y-2 md:col-span-2"><Label htmlFor="step-responsibility">Responsabilidade</Label><Input id="step-responsibility" placeholder="O que esta etapa deve entregar" value={stepForm.responsibility} onChange={(event) => setStepForm({ ...stepForm, responsibility: event.target.value })} /></div>
                        <div className="space-y-2"><Label htmlFor="step-decision">Modo de decisão</Label><select id="step-decision" value={stepForm.decisionMode} onChange={(event) => setStepForm({ ...stepForm, decisionMode: event.target.value })} className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground"><option value="autonomous">Autônoma</option><option value="human-approval">Aprovação humana</option><option value="committee">Comitê de agentes</option></select></div>
                        <div className="space-y-2"><Label htmlFor="step-duration">Duração esperada (min)</Label><Input id="step-duration" type="number" min="1" value={stepForm.expectedDurationMinutes} onChange={(event) => setStepForm({ ...stepForm, expectedDurationMinutes: event.target.value })} /></div>
                        <div className="space-y-2 md:col-span-2 xl:col-span-3"><Label htmlFor="step-guardrails">Guardrails</Label><Input id="step-guardrails" placeholder="Separe regras por vírgula" value={stepForm.guardrails} onChange={(event) => setStepForm({ ...stepForm, guardrails: event.target.value })} /></div>
                        <label className="flex h-10 items-center gap-2 self-end rounded-md border border-border bg-secondary/30 px-3 text-sm text-foreground"><input type="checkbox" checked={stepForm.required} onChange={(event) => setStepForm({ ...stepForm, required: event.target.checked })} className="accent-primary" />Etapa obrigatória</label>
                      </div>
                      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowStepForm(false)}>Cancelar</Button><Button onClick={createStep} disabled={saving === "step"}>{saving === "step" ? "Adicionando…" : "Adicionar etapa"}</Button></div>
                    </CardContent>
                  )}

                  {showHandoffForm && (
                    <CardContent className="border-b border-border/60 bg-secondary/10 p-5">
                      <div className="mb-4"><Eyebrow>Novo contrato</Eyebrow><h3 className="mt-1 font-medium text-foreground">Conectar etapas com contexto explícito</h3></div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2"><Label htmlFor="handoff-from">Origem</Label><select id="handoff-from" value={handoffForm.fromStepId} onChange={(event) => setHandoffForm({ ...handoffForm, fromStepId: event.target.value })} className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground"><option value="">Selecione</option>{orderedSteps.map((step) => <option key={step.id} value={step.id}>{step.sequence}. {step.name}</option>)}</select></div>
                        <div className="space-y-2"><Label htmlFor="handoff-to">Destino</Label><select id="handoff-to" value={handoffForm.toStepId} onChange={(event) => setHandoffForm({ ...handoffForm, toStepId: event.target.value })} className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground"><option value="">Selecione</option>{orderedSteps.map((step) => <option key={step.id} value={step.id}>{step.sequence}. {step.name}</option>)}</select></div>
                        <div className="space-y-2"><Label htmlFor="handoff-protocol">Protocolo</Label><Input id="handoff-protocol" value={handoffForm.protocol} onChange={(event) => setHandoffForm({ ...handoffForm, protocol: event.target.value })} /></div>
                        <div className="space-y-2"><Label htmlFor="handoff-condition">Condição</Label><Input id="handoff-condition" value={handoffForm.condition} onChange={(event) => setHandoffForm({ ...handoffForm, condition: event.target.value })} /></div>
                        <div className="space-y-2 md:col-span-2"><Label htmlFor="handoff-context">Contexto obrigatório</Label><Input id="handoff-context" placeholder="ticket_id, decisão, evidências, nível de confiança" value={handoffForm.requiredContext} onChange={(event) => setHandoffForm({ ...handoffForm, requiredContext: event.target.value })} /></div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowHandoffForm(false)}>Cancelar</Button><Button onClick={createHandoff} disabled={saving === "handoff"}>{saving === "handoff" ? "Conectando…" : "Criar handoff"}</Button></div>
                    </CardContent>
                  )}

                  <CardContent className="p-5 sm:p-6">
                    {orderedSteps.length === 0 ? (
                      <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
                        <CircleDashed className="mb-3 h-8 w-8 text-muted-foreground" />
                        <p className="font-medium text-foreground">O fluxo ainda está vazio</p>
                        <p className="mt-1 max-w-md text-sm text-muted-foreground">Adicione participantes na ordem da jornada. Cada etapa explicita responsabilidade, decisão, prazo e guardrails.</p>
                        <Button className="mt-4" size="sm" onClick={() => setShowStepForm(true)}><Plus className="mr-2 h-4 w-4" />Adicionar primeira etapa</Button>
                      </div>
                    ) : flowDirection === "horizontal" ? (
                      <ScrollArea className="w-full pb-3">
                        <div className="flex min-w-max items-stretch py-2">
                          {orderedSteps.map((step, index) => {
                            const next = orderedSteps[index + 1];
                            const handoff = next ? handoffByEdge.get(`${step.id}:${next.id}`) : undefined;
                            return (
                              <div key={step.id} className="flex items-center">
                                <StepCard step={step} monitoring={monitoringByStep.get(step.id)} bottleneck={actionableBottleneckStepId === step.id} direction="horizontal" />
                                {next && <HandoffConnector handoff={handoff} direction="horizontal" />}
                              </div>
                            );
                          })}
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    ) : (
                      <div className="mx-auto flex max-w-xl flex-col items-center">
                        {orderedSteps.map((step, index) => {
                          const next = orderedSteps[index + 1];
                          const handoff = next ? handoffByEdge.get(`${step.id}:${next.id}`) : undefined;
                          return (
                            <div key={step.id} className="flex w-full flex-col items-center">
                              <StepCard step={step} monitoring={monitoringByStep.get(step.id)} bottleneck={actionableBottleneckStepId === step.id} direction="vertical" />
                              {next && <HandoffConnector handoff={handoff} direction="vertical" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <section id="journey-performance" className="scroll-mt-24 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><Eyebrow>Telemetria contínua</Eyebrow><h2 className="mt-1 font-serif text-2xl font-medium text-foreground">Performance end-to-end</h2></div>
                    <div className="flex flex-wrap items-center gap-2">
                      {import.meta.env.DEV && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={runValidationScenario}
                          disabled={saving === "validation" || orderedSteps.length === 0}
                        >
                          <Play className={cn("mr-2 h-4 w-4", saving === "validation" && "animate-pulse")} />
                          {saving === "validation" ? "Executando teste…" : "Executar cenário de teste"}
                        </Button>
                      )}
                      <ScenarioSourceBadge source={scenarioSource} />
                      <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-1 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-chart-1" /></span>Atualização automática a cada 15s</span>
                    </div>
                  </div>

                  {monitoring.isLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-card" />)}</div>
                  ) : monitoring.isError || !monitor ? (
                    <Card className="border-dashed border-card-border bg-card/60"><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="font-medium text-foreground">Telemetria indisponível</p><p className="text-sm text-muted-foreground">O fluxo pode ser desenhado, mas os dados operacionais ainda não foram carregados.</p></div><Button variant="outline" size="sm" onClick={() => monitoring.refetch()}>Tentar novamente</Button></CardContent></Card>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <KpiCard label="Conclusão" value={formatPercent(monitor.completionRate)} detail={`${monitor.completedRuns} concluídas · ${monitor.failedRuns} falharam`} icon={CheckCircle2} attention={normalizePercent(monitor.completionRate) < 80} />
                        <KpiCard label="Execuções" value={String(monitor.totalRuns)} detail={`${monitor.activeRuns} em andamento`} icon={Activity} />
                        <KpiCard label="Tempo médio" value={formatDuration(monitor.avgDurationMs)} detail={`p95 em ${formatDuration(monitor.p95DurationMs)}`} icon={Timer} attention={monitor.avgDurationMs > selectedJourney.slaMinutes * 60_000} />
                        <KpiCard label="Handoffs" value={formatPercent(monitor.handoffSuccessRate)} detail={`${selectedJourney.handoffs.length} contratos no fluxo`} icon={GitBranch} attention={normalizePercent(monitor.handoffSuccessRate) < 90} />
                        <KpiCard label="Custo médio" value={formatCost(monitor.avgCostCentsPerRun)} detail={`${formatCost(monitor.totalCostCents)} acumulado`} icon={DollarSign} />
                        <KpiCard
                          label={actionableBottleneckStepId ? "Gargalo" : "Etapa mais lenta"}
                          value={slowestStepName ?? "Sem amostra"}
                          detail={actionableBottleneckStepId
                            ? `p95 acima do SLA de ${selectedJourney.slaMinutes} min`
                            : slowestStepName
                              ? `Ainda dentro do SLA de ${selectedJourney.slaMinutes} min`
                              : "Execute a jornada para criar a baseline"}
                          icon={AlertTriangle}
                          attention={Boolean(actionableBottleneckStepId)}
                        />
                      </div>

                      {(monitor.illusoryVictory || monitor.warnings.length > 0) && (
                        <Card className={cn("border bg-card", monitor.illusoryVictory ? "border-chart-3/50" : "border-chart-2/40")}>
                          <CardContent className="p-5">
                            <div className="flex items-start gap-3">
                              <span className={cn("rounded-lg p-2", monitor.illusoryVictory ? "bg-chart-3/15 text-chart-3" : "bg-chart-2/15 text-chart-2")}><AlertTriangle className="h-5 w-5" /></span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{monitor.illusoryVictory ? "Possível vitória ilusória" : "Avisos de supervisão"}</p>{monitor.illusoryVictory && <Pill tone="terracotta">Requer decisão</Pill>}</div>
                                <p className="mt-1 text-sm text-muted-foreground">{monitor.illusoryVictory ? "Há sucesso local em etapas da frota sem confirmação equivalente no resultado end-to-end." : "A telemetria identificou condições que merecem acompanhamento."}</p>
                                {monitor.warnings.length > 0 && <ul className="mt-3 space-y-2">{monitor.warnings.map((warning, index) => <li key={`${warning}-${index}`} className="flex gap-2 text-sm text-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-chart-2" />{warning}</li>)}</ul>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <section id="journey-recommendations" className="scroll-mt-24 space-y-4 rounded-2xl border border-primary/15 bg-primary/[0.025] p-4 sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Eyebrow>Decisão orientada por evidência</Eyebrow>
                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                                </span>
                                Atualização a cada 15s
                              </span>
                            </div>
                            <h2 className="mt-1 font-serif text-2xl font-medium text-foreground">Recomendações operacionais</h2>
                            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                              Transforme sinais da jornada em decisões auditáveis e distribua os próximos passos entre Muster, agentes e pessoas.
                            </p>
                          </div>
                          <Button onClick={generateRecommendation} disabled={recommendationOperation === "generate" || recommendations.isFetching}>
                            <Sparkles className={cn("mr-2 h-4 w-4", recommendationOperation === "generate" && "animate-pulse")} />
                            {recommendationOperation === "generate" ? "Gerando…" : "Gerar recomendação"}
                          </Button>
                        </div>

                        {recommendations.isLoading ? (
                          <div className="space-y-3">
                            {[0, 1].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-card" />)}
                          </div>
                        ) : recommendations.isError ? (
                          <Card className="border-destructive/25 bg-card/80">
                            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium text-foreground">Recomendações indisponíveis</p>
                                <p className="mt-1 text-sm text-muted-foreground">A API não retornou o plano operacional desta jornada.</p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => recommendations.refetch()}>Tentar novamente</Button>
                            </CardContent>
                          </Card>
                        ) : (recommendations.data ?? []).length === 0 ? (
                          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
                            <Sparkles className="mb-3 h-7 w-7 text-muted-foreground" />
                            <p className="font-medium text-foreground">Nenhuma recomendação aberta</p>
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">Gere uma recomendação a partir da telemetria atual para revisar impacto, risco, autonomia e próximos passos.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {(recommendations.data ?? []).map((recommendation) => (
                              <RecommendationCard
                                key={recommendation.id}
                                recommendation={recommendation}
                                decisionDraft={decisionDraft}
                                busyOperation={recommendationOperation}
                                onOpenDecision={openDecision}
                                onChangeDecision={setDecisionDraft}
                                onCancelDecision={() => setDecisionDraft(null)}
                                onSubmitDecision={submitRecommendationDecision}
                                onUpdateAction={updateRecommendationAction}
                              />
                            ))}
                          </div>
                        )}
                      </section>

                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                        <Card className="border-card-border/90 bg-card/90">
                          <CardHeader><CardTitle>Desempenho por etapa</CardTitle><CardDescription>Compare sucesso, latência e custo de cada participante.</CardDescription></CardHeader>
                          <CardContent className="space-y-3">
                            {monitor.steps.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma etapa executada ainda.</p> : monitor.steps.map((step) => {
                              const bottleneck = step.stepId === actionableBottleneckStepId;
                              const journeyStep = orderedSteps.find((item) => item.id === step.stepId);
                              const participantName = step.agentName
                                ?? (step.agentId ? agentNameById.get(step.agentId) : undefined)
                                ?? (journeyStep?.stepType === "human"
                                  ? "Responsável humano"
                                  : journeyStep?.stepType === "system"
                                    ? "Serviço interno"
                                    : "Agente não atribuído");
                              return (
                                <div key={step.stepId} className={cn("rounded-xl border p-3", bottleneck ? "border-chart-2/45 bg-chart-2/5" : "border-border/70 bg-secondary/15")}>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div><div className="flex items-center gap-2"><p className="text-sm font-medium text-foreground">{step.stepName}</p>{bottleneck && <Pill tone="ochre">Gargalo</Pill>}</div><p className="mt-0.5 text-xs text-muted-foreground">{participantName} · {step.executions} execuções</p></div>
                                    <div className="grid w-full grid-cols-3 gap-2 text-left sm:w-auto sm:min-w-[260px] sm:text-right"><div><p className="font-mono text-sm text-foreground">{formatPercent(step.successRate)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">sucesso</p></div><div><p className="font-mono text-sm text-foreground">{formatDuration(step.avgDurationMs)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">latência</p></div><div><p className="font-mono text-sm text-foreground">{formatCost(step.totalCostCents)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">custo</p></div></div>
                                  </div>
                                  <Progress value={normalizePercent(step.successRate)} className="mt-3 h-1.5" />
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>

                        <Card className="border-card-border/90 bg-card/90">
                          <CardHeader><CardTitle>Execuções recentes</CardTitle><CardDescription>Runs da jornada e seu estado operacional atual.</CardDescription></CardHeader>
                          <CardContent className="space-y-2">
                            {monitor.recentRuns.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-border p-5 text-center"><CircleDashed className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">Nenhuma execução recebida.</p></div>
                            ) : monitor.recentRuns.map((run) => {
                              const currentStep = orderedSteps.find((step) => step.id === run.currentStepId);
                              const StatusIcon = run.status === "completed" ? CheckCircle2 : run.status === "failed" ? XCircle : Activity;
                              return (
                                <div key={run.runId} className="rounded-xl border border-border/70 bg-secondary/15 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-2.5"><StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", run.status === "completed" ? "text-chart-1" : run.status === "failed" ? "text-chart-3" : "text-chart-5")} /><div className="min-w-0"><p className="truncate font-mono text-xs text-foreground" title={run.runId}>{run.runId}</p><p className="mt-1 text-xs text-muted-foreground">{currentStep ? `Em ${currentStep.name}` : `${formatDate(run.startedAt)} → ${formatDate(run.completedAt)}`}</p></div></div>
                                    <Pill tone={statusTone(run.status)}>{statusLabel(run.status)}</Pill>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground"><span>{formatDuration(run.durationMs)}</span><span>{formatCost(run.totalCostCents)}</span></div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </section>

                <Card className="border-card-border/90 bg-card/70">
                  <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                    <div className="flex items-center gap-3"><span className="rounded-lg bg-chart-1/15 p-2 text-chart-1"><Users className="h-4 w-4" /></span><div><p className="text-xs text-muted-foreground">Participantes</p><p className="font-medium text-foreground">{selectedJourney.agentCount} agentes · {orderedSteps.filter((step) => step.stepType === "human").length} etapas humanas</p></div></div>
                    <div className="flex items-center gap-3"><span className="rounded-lg bg-chart-5/15 p-2 text-chart-5"><GitBranch className="h-4 w-4" /></span><div><p className="text-xs text-muted-foreground">Cobertura de handoff</p><p className="font-medium text-foreground">{selectedJourney.handoffs.length}/{Math.max(orderedSteps.length - 1, 0)} conexões sequenciais</p></div></div>
                    <div className="flex items-center gap-3"><span className="rounded-lg bg-chart-2/15 p-2 text-chart-2"><Clock className="h-4 w-4" /></span><div><p className="text-xs text-muted-foreground">Compromisso</p><p className="font-medium text-foreground">SLA de {selectedJourney.slaMinutes} min · owner {selectedJourney.owner || "pendente"}</p></div></div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
      </div>
    </JourneyPageLayout>
  );
}
