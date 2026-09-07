import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  Columns3,
  Gauge,
  GitBranch,
  ListTodo,
  LockKeyhole,
  Network,
  Plus,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { PlatformBadge, PlatformIcon } from "@/components/platform-badge";
import { cn } from "@/lib/utils";
import {
  accountableForWorkItem,
  participantForWorkItem,
  summarizeOperatingScenario,
  teamOperatingScenarios,
  workAllocationForParticipant,
  type AutomationMode,
  type MetricStatus,
  type TeamOperatingScenario,
  type TeamScenarioId,
  type TeamWorkItem,
  type WorkPriority,
  type WorkStatus,
} from "@/lib/team-operating-model";

type Tone = "good" | "watch" | "risk" | "primary" | "neutral";

const scenarioIcons = {
  development: Code2,
  professional: BriefcaseBusiness,
  service: Users,
} satisfies Record<TeamScenarioId, typeof Code2>;

const modeLabels: Record<AutomationMode, string> = {
  autonomous: "Agente autônomo",
  assisted: "Trabalho assistido",
  human: "Decisão humana",
};

const statusLabels: Record<WorkStatus, string> = {
  planned: "Planejado",
  in_progress: "Em execução",
  review: "Em validação",
  blocked: "Bloqueado",
  done: "Concluído",
};

const priorityLabels: Record<WorkPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const boardColumns: Array<{ id: WorkStatus; label: string }> = [
  { id: "planned", label: "Backlog" },
  { id: "in_progress", label: "Em execução" },
  { id: "review", label: "Em validação" },
  { id: "blocked", label: "Bloqueado" },
  { id: "done", label: "Concluído" },
];

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)]", className)}>{children}</section>;
}

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    good: "bg-[color-mix(in_srgb,var(--wo-accent)_16%,transparent)] text-[var(--wo-accent)]",
    watch: "bg-[color-mix(in_srgb,var(--wo-warning)_16%,transparent)] text-[var(--wo-warning)]",
    risk: "bg-[color-mix(in_srgb,var(--wo-danger)_16%,transparent)] text-[var(--wo-danger)]",
    primary: "bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]",
    neutral: "bg-[var(--wo-card-2)] text-[var(--wo-muted)]",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em]", tones[tone])}>{children}</span>;
}

function metricTone(status: MetricStatus): Tone {
  if (status === "healthy") return "good";
  if (status === "critical") return "risk";
  return "watch";
}

function statusTone(status: WorkStatus): Tone {
  if (status === "done") return "good";
  if (status === "blocked") return "risk";
  if (status === "review") return "primary";
  if (status === "in_progress") return "watch";
  return "neutral";
}

function priorityTone(priority: WorkPriority): Tone {
  if (priority === "critical") return "risk";
  if (priority === "high") return "watch";
  if (priority === "medium") return "primary";
  return "neutral";
}

function modeTone(mode: AutomationMode): Tone {
  if (mode === "autonomous") return "primary";
  if (mode === "assisted") return "watch";
  return "good";
}

function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "accent" | "warning" }) {
  const color = tone === "accent" ? "bg-[var(--wo-accent)]" : tone === "warning" ? "bg-[var(--wo-warning)]" : "bg-[var(--wo-primary)]";
  return <div className="h-1.5 overflow-hidden rounded-full bg-[var(--wo-line)]"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function ScreenHeader({ action }: { action: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--wo-primary)]">Workforce operating model</span>
        <h1 className="mt-2 max-w-5xl text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-4xl">Equipes mistas com trabalho, autoridade e resultado explícitos.</h1>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--wo-muted)]">Veja quem faz o quê, qual entrega encerra o compromisso, onde agentes têm autonomia e quais decisões permanecem humanas.</p>
      </div>
      {action}
    </div>
  );
}

export function MixedTeamsScreen() {
  const [scenarioId, setScenarioId] = useState<TeamScenarioId>("development");
  const [stage, setStage] = useState("all");
  const [workStatus, setWorkStatus] = useState<WorkStatus | "all">("all");
  const [workView, setWorkView] = useState<"backlog" | "board">("backlog");
  const [showSetup, setShowSetup] = useState(false);
  const scenario = teamOperatingScenarios.find((item) => item.id === scenarioId) ?? teamOperatingScenarios[0]!;
  const summary = useMemo(() => summarizeOperatingScenario(scenario), [scenario]);
  const workItems = scenario.workItems.filter((item) =>
    (stage === "all" || item.stage === stage)
    && (workStatus === "all" || item.status === workStatus),
  );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ScreenHeader action={<button type="button" onClick={() => setShowSetup((current) => !current)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><Plus className="h-4 w-4" /> Nova equipe</button>} />

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--wo-primary)]/30 bg-[var(--wo-primary-soft)] p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3"><Zap className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wo-primary)]" /><div><strong className="text-xs font-medium text-[var(--wo-text)]">Contrato operacional, não apenas organograma</strong><p className="mt-1 text-[10px] leading-relaxed text-[var(--wo-muted)]">Os cenários são demonstrativos. Telemetria real só aparece depois de conectar trabalho, execução e evidência do tenant.</p></div></div>
        <div className="flex shrink-0 gap-2"><Chip tone="primary">modelo navegável</Chip><Chip tone="good">supervisão contínua</Chip></div>
      </div>

      {showSetup && (
        <Panel className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Nome da equipe</span><input defaultValue="Squad Produto Híbrido" className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
          <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Resultado final contratado</span><input defaultValue={scenario.finalOutcome} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
          <button type="button" onClick={() => setShowSetup(false)} className="h-10 rounded-xl bg-[var(--wo-primary)] px-4 text-xs font-medium text-[var(--wo-bg)]">Continuar configuração</button>
        </Panel>
      )}

      <div className="grid gap-2 md:grid-cols-3">
        {teamOperatingScenarios.map((item) => {
          const Icon = scenarioIcons[item.id];
          const active = item.id === scenario.id;
          return (
            <button key={item.id} type="button" onClick={() => { setScenarioId(item.id); setStage("all"); setWorkStatus("all"); }} className={cn("rounded-2xl border p-4 text-left transition-all", active ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)]" : "border-[var(--wo-line)] bg-[var(--wo-card)] hover:-translate-y-0.5 hover:bg-[var(--wo-card-2)]")}>
              <div className="flex items-start gap-3"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", active ? "bg-[var(--wo-primary)] text-[var(--wo-bg)]" : "bg-[var(--wo-card-2)] text-[var(--wo-muted)]")}><Icon className="h-4 w-4" /></span><div><strong className="text-xs font-medium text-[var(--wo-text)]">{item.label}</strong><p className="mt-1 text-[10px] leading-relaxed text-[var(--wo-muted)]">{item.description}</p></div></div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Pulso operacional da equipe">
        <MiniStat icon={Target} label="Sucesso end-to-end" value={`${scenario.journey.successRate}%`} />
        <MiniStat icon={ListTodo} label="Backlog total" value={String(summary.totalItems - summary.completedItems)} />
        <MiniStat icon={Activity} label="WIP atual" value={String(summary.activeItems + summary.blockedItems)} />
        <MiniStat icon={Gauge} label="Carga média" value={`${summary.averageWorkload}%`} risk={summary.overloadedParticipants > 0} />
        <MiniStat icon={AlertTriangle} label="Bloqueios" value={String(summary.blockedItems)} risk={summary.blockedItems > 0} />
      </div>

      <Panel className="overflow-hidden">
        <div className="grid xl:grid-cols-[1.45fr_.55fr]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2"><Chip tone="good">{scenario.shortLabel}</Chip><Chip>{scenario.cadence}</Chip></div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">Propósito coletivo</span><h2 className="mt-2 text-xl font-medium leading-snug text-[var(--wo-text)]">{scenario.purpose}</h2></div>
              <div className="border-l border-[var(--wo-line)] pl-5"><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">Resultado final contratado</span><p className="mt-2 text-xs leading-relaxed text-[var(--wo-text)]">{scenario.finalOutcome}</p></div>
            </div>
            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl bg-[var(--wo-card-2)] p-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--wo-accent)]" /><strong className="text-xs text-[var(--wo-text)]">Definition of Done</strong></div><div className="mt-3 space-y-2">{scenario.definitionOfDone.map((item) => <p key={item} className="flex gap-2 text-[10px] leading-relaxed text-[var(--wo-muted)]"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--wo-accent)]" />{item}</p>)}</div></div>
              <div className="rounded-xl bg-[var(--wo-card-2)] p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--wo-warning)]" /><strong className="text-xs text-[var(--wo-text)]">Limites de autonomia</strong></div><div className="mt-3 space-y-2">{scenario.guardrails.map((item) => <p key={item} className="flex gap-2 text-[10px] leading-relaxed text-[var(--wo-muted)]"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--wo-warning)]" />{item}</p>)}</div></div>
            </div>
          </div>
          <div className="border-t border-[var(--wo-line)] bg-[var(--wo-card-2)] p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between"><div><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">Execução do compromisso</span><strong className="mt-2 block font-mono text-4xl font-medium text-[var(--wo-text)]">{summary.progress}%</strong></div><Gauge className="h-8 w-8 text-[var(--wo-primary)]" strokeWidth={1.4} /></div>
            <div className="mt-4"><ProgressBar value={summary.progress} /></div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <MiniStat icon={Bot} label="Cobertura agente" value={`${summary.automationCoverage}%`} />
              <MiniStat icon={UserCheck} label="Gates humanos" value={String(summary.humanDecisionGates)} />
              <MiniStat icon={Activity} label="Em movimento" value={String(summary.activeItems)} />
              <MiniStat icon={AlertTriangle} label="Bloqueios" value={String(summary.blockedItems)} risk={summary.blockedItems > 0} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden" data-testid="team-operational-backlog">
        <div className="flex flex-col gap-4 border-b border-[var(--wo-line)] px-4 py-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-[var(--wo-primary)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Backlog operacional</h2></div>
            <p className="mt-1 text-[10px] text-[var(--wo-muted)]">Épico, prioridade, executor, accountable, próximo passo, prazo e evidência no mesmo contrato.</p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-1.5">
              <Filter active={workStatus === "all"} onClick={() => setWorkStatus("all")}>Todos</Filter>
              {boardColumns.map((item) => <Filter key={item.id} active={workStatus === item.id} onClick={() => setWorkStatus(item.id)}>{item.label}</Filter>)}
            </div>
            <div className="flex rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-1">
              <button type="button" aria-pressed={workView === "backlog"} onClick={() => setWorkView("backlog")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px]", workView === "backlog" ? "bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "text-[var(--wo-muted)]")}><ListTodo className="h-3.5 w-3.5" /> Lista</button>
              <button type="button" aria-pressed={workView === "board"} onClick={() => setWorkView("board")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px]", workView === "board" ? "bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "text-[var(--wo-muted)]")}><Columns3 className="h-3.5 w-3.5" /> Quadro</button>
            </div>
          </div>
        </div>
        <div className="grid border-b border-[var(--wo-line)] md:grid-cols-5">
          {scenario.stages.map((item, index) => {
            const stageItems = scenario.workItems.filter((work) => work.stage === item.id);
            const stageWip = stageItems.filter((work) => work.status === "in_progress" || work.status === "review" || work.status === "blocked").length;
            return <button key={item.id} type="button" onClick={() => setStage(stage === item.id ? "all" : item.id)} className={cn("border-b border-[var(--wo-line)] p-4 text-left last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0", stage === item.id ? "bg-[var(--wo-primary-soft)]" : "hover:bg-[var(--wo-card-2)]")}><div className="flex items-center justify-between"><span className="font-mono text-[9px] text-[var(--wo-primary)]">0{index + 1}</span><span className="text-[9px] text-[var(--wo-muted)]">WIP {stageWip}/{item.wipLimit}</span></div><strong className="mt-3 block text-xs text-[var(--wo-text)]">{item.label}</strong><p className="mt-1 text-[9px] leading-relaxed text-[var(--wo-muted)]">{item.exitCriteria}</p><div className="mt-3"><ProgressBar value={(stageWip / Math.max(1, item.wipLimit)) * 100} tone={stageWip >= item.wipLimit ? "warning" : "accent"} /></div></button>;
          })}
        </div>
        {workView === "backlog" ? <BacklogTable scenario={scenario} workItems={workItems} /> : <WorkBoard scenario={scenario} workItems={workItems} />}
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
        <ResponsibilityPanel scenario={scenario} />
        <Panel className="p-4"><div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-[var(--wo-warning)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Contrato de decisão</h2></div><div className="mt-4 space-y-2"><Decision icon={Bot} title="Agente executa" detail="Baixo risco, política conhecida, evidência e rollback disponíveis." tone="primary" /><Decision icon={Zap} title="Agente propõe" detail="Humano valida ambiguidade, impacto ou mudança relevante." tone="watch" /><Decision icon={UserCheck} title="Humano decide" detail="Prioridade, exceção, compromisso externo ou ação irreversível." tone="good" /><Decision icon={ShieldCheck} title="Guardrail bloqueia" detail="Segurança, qualidade ou conformidade interrompem o fluxo." tone="risk" /></div></Panel>
      </div>

      <Panel className="overflow-hidden"><div className="border-b border-[var(--wo-line)] px-4 py-3"><div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-[var(--wo-primary)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Scorecard do contrato</h2></div><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Resultado, qualidade, fluxo, automação, governança e adoção — sem reduzir performance a dinheiro.</p></div><div className="grid gap-px bg-[var(--wo-line)] sm:grid-cols-2 xl:grid-cols-4">{scenario.metrics.map((metric) => <div key={metric.key} className="bg-[var(--wo-card)] p-4"><div className="flex items-start justify-between gap-3"><span><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{metric.category}</span><strong className="mt-1 block text-xs text-[var(--wo-text)]">{metric.label}</strong></span><Chip tone={metricTone(metric.status)}>{metric.status === "healthy" ? "saudável" : "atenção"}</Chip></div><div className="mt-4 flex items-end justify-between"><strong className="font-mono text-2xl font-medium text-[var(--wo-text)]">{metric.value}</strong><span className="text-[9px] text-[var(--wo-accent)]">{metric.trend}</span></div><p className="mt-2 text-[9px] text-[var(--wo-muted)]">Alvo {metric.target}</p><p className="mt-3 border-t border-[var(--wo-line)] pt-3 text-[9px] leading-relaxed text-[var(--wo-muted)]">{metric.description}</p></div>)}</div></Panel>

      <Panel className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Target className="h-4 w-4 text-[var(--wo-primary)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Sistemas de trabalho e evidência</h2></div><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Jira e Confluence entram como contratos prontos; coleta nativa ainda não é declarada como ativa.</p></div><Link href="/conectores" className="inline-flex items-center gap-2 text-xs text-[var(--wo-text)]">Gerenciar conectores <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{scenario.integrations.map((integration) => <div key={integration.platform} className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-start justify-between gap-2"><PlatformBadge platform={integration.platform} surface="workforce" /><Chip tone={integration.status === "live" ? "good" : integration.status === "contract_ready" ? "primary" : "neutral"}>{integration.status === "live" ? "ativa" : "contrato"}</Chip></div><strong className="mt-3 block text-xs text-[var(--wo-text)]">{integration.role}</strong><p className="mt-2 text-[9px] leading-relaxed text-[var(--wo-muted)]">{integration.contract.join(" · ")}</p></div>)}</div></Panel>
    </div>
  );
}

function ActorIdentity({ participant, label }: { participant: TeamOperatingScenario["participants"][number] | undefined; label: string }) {
  if (!participant) return <span className="text-[9px] text-[var(--wo-danger)]">Sem responsável</span>;
  return (
    <div className="flex items-center gap-2">
      {participant.platform ? <PlatformIcon platform={participant.platform} size="sm" /> : <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><UserCheck className="h-3 w-3" /></span>}
      <span>
        <span className="block text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span>
        <strong className="mt-0.5 block text-[10px] font-medium text-[var(--wo-text)]">{participant.name}</strong>
      </span>
    </div>
  );
}

function BacklogTable({ scenario, workItems }: { scenario: TeamOperatingScenario; workItems: TeamWorkItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1240px] text-xs">
        <thead><tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><th className="px-4 py-3 font-normal">Prioridade</th><th className="px-3 py-3 font-normal">Épico · entrega</th><th className="px-3 py-3 font-normal">Execução</th><th className="px-3 py-3 font-normal">Accountability</th><th className="px-3 py-3 font-normal">Próximo passo</th><th className="px-3 py-3 font-normal">Progresso</th><th className="px-4 py-3 font-normal">Prazo · status</th></tr></thead>
        <tbody>{workItems.map((workItem) => {
          const owner = participantForWorkItem(scenario, workItem);
          const accountable = accountableForWorkItem(scenario, workItem);
          return (
            <tr key={workItem.id} className="border-t border-[var(--wo-line)] align-top hover:bg-[var(--wo-card-2)]">
              <td className="px-4 py-3"><Chip tone={priorityTone(workItem.priority)}>{priorityLabels[workItem.priority]}</Chip></td>
              <td className="max-w-[280px] px-3 py-3"><span className="font-mono text-[9px] text-[var(--wo-primary)]">{workItem.id}</span><strong className="mt-1 block font-medium text-[var(--wo-text)]">{workItem.title}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{workItem.epic}</span><span className="mt-2 block text-[9px] text-[var(--wo-muted)]">Evidência: {workItem.evidence}</span></td>
              <td className="px-3 py-3"><ActorIdentity participant={owner} label="Executa" /><div className="mt-2"><Chip tone={modeTone(workItem.mode)}>{modeLabels[workItem.mode]}</Chip></div></td>
              <td className="px-3 py-3"><ActorIdentity participant={accountable} label="Responde pelo resultado" /><span className="mt-2 block text-[9px] text-[var(--wo-muted)]">{workItem.contributorIds.length} apoio(s)</span></td>
              <td className="max-w-[220px] px-3 py-3"><p className="text-[10px] leading-relaxed text-[var(--wo-text)]">{workItem.nextStep}</p>{workItem.blockedReason && <p className="mt-2 rounded-lg bg-[color-mix(in_srgb,var(--wo-danger)_10%,transparent)] px-2 py-1.5 text-[9px] leading-relaxed text-[var(--wo-danger)]">{workItem.blockedReason}</p>}<span className="mt-2 block text-[9px] text-[var(--wo-muted)]">Atualizado {workItem.lastActivity}</span></td>
              <td className="px-3 py-3"><div className="w-28"><div className="mb-1.5 flex justify-between font-mono text-[9px] text-[var(--wo-muted)]"><span>{workItem.points} pts</span><span>{workItem.progress}%</span></div><ProgressBar value={workItem.progress} /></div></td>
              <td className="px-4 py-3"><Chip tone={statusTone(workItem.status)}>{statusLabels[workItem.status]}</Chip><span className="mt-2 block text-[9px] text-[var(--wo-text)]">{workItem.due}</span></td>
            </tr>
          );
        })}</tbody>
      </table>
      {workItems.length === 0 && <p className="px-4 py-8 text-center text-xs text-[var(--wo-muted)]">Nenhum item corresponde aos filtros selecionados.</p>}
    </div>
  );
}

function WorkBoard({ scenario, workItems }: { scenario: TeamOperatingScenario; workItems: TeamWorkItem[] }) {
  return (
    <div className="grid min-w-[1120px] grid-cols-5 gap-px overflow-x-auto bg-[var(--wo-line)]">
      {boardColumns.map((column) => {
        const items = workItems.filter((item) => item.status === column.id);
        return (
          <div key={column.id} className="min-h-[250px] bg-[var(--wo-card)] p-3">
            <div className="flex items-center justify-between"><strong className="text-[10px] font-medium text-[var(--wo-text)]">{column.label}</strong><Chip tone={statusTone(column.id)}>{items.length}</Chip></div>
            <div className="mt-3 space-y-2">{items.map((workItem) => {
              const owner = participantForWorkItem(scenario, workItem);
              return <article key={workItem.id} className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] text-[var(--wo-primary)]">{workItem.id}</span><Chip tone={priorityTone(workItem.priority)}>{priorityLabels[workItem.priority]}</Chip></div><strong className="mt-2 block text-[11px] leading-snug text-[var(--wo-text)]">{workItem.title}</strong><p className="mt-2 text-[9px] leading-relaxed text-[var(--wo-muted)]">{workItem.nextStep}</p><div className="mt-3 flex items-center justify-between border-t border-[var(--wo-line)] pt-2"><span className="text-[9px] text-[var(--wo-text)]">{owner?.name}</span><span className="text-[9px] text-[var(--wo-muted)]">{workItem.due}</span></div></article>;
            })}</div>
          </div>
        );
      })}
    </div>
  );
}

function ResponsibilityPanel({ scenario }: { scenario: TeamOperatingScenario }) {
  return (
    <Panel className="overflow-hidden" data-testid="team-responsibility-matrix">
      <div className="border-b border-[var(--wo-line)] px-4 py-3"><div className="flex items-center gap-2"><Network className="h-4 w-4 text-[var(--wo-primary)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Responsabilidade e capacidade</h2></div><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Executor, accountability, apoio, foco atual, alçada e pressão de carga.</p></div>
      <div className="divide-y divide-[var(--wo-line)]">{scenario.participants.map((participant) => {
        const allocation = workAllocationForParticipant(scenario, participant.id);
        return (
          <div key={participant.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1.15fr_.75fr] lg:items-center">
            <div className="flex items-center gap-3">{participant.platform ? <PlatformIcon platform={participant.platform} /> : <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><UserCheck className="h-4 w-4" /></span>}<span><strong className="block text-xs text-[var(--wo-text)]">{participant.name}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{participant.role}</span><span className="mt-2 block text-[9px] text-[var(--wo-accent)]">Agora: {participant.currentFocus}</span></span></div>
            <div><p className="text-[10px] text-[var(--wo-text)]">{participant.scope}</p><p className="mt-1 flex items-start gap-1.5 text-[9px] text-[var(--wo-muted)]"><LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" />{participant.decisionRights}</p><div className="mt-2 flex flex-wrap gap-1.5"><Chip tone="primary">Executa {allocation.executing.length}</Chip><Chip tone="good">Accountable {allocation.accountable.length}</Chip><Chip>Apoia {allocation.contributing.length}</Chip></div></div>
            <div><div className="mb-1.5 flex justify-between font-mono text-[9px] text-[var(--wo-muted)]"><span>Carga · {allocation.active.length} ativos</span><span>{participant.workload}%</span></div><ProgressBar value={participant.workload} tone={participant.workload > 85 ? "warning" : "accent"} />{participant.workload > 85 && <span className="mt-2 block text-[9px] text-[var(--wo-warning)]">Acima do limiar de atenção</span>}</div>
          </div>
        );
      })}</div>
    </Panel>
  );
}

function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("rounded-lg border px-2.5 py-1.5 text-[9px] transition-colors", active ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "border-[var(--wo-line)] bg-[var(--wo-card-2)] text-[var(--wo-muted)]")}>{children}</button>;
}

function MiniStat({ icon: Icon, label, value, risk = false }: { icon: typeof Bot; label: string; value: string; risk?: boolean }) {
  return <div className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-3"><div className="flex items-center justify-between"><span className="text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span><Icon className={cn("h-3.5 w-3.5", risk ? "text-[var(--wo-danger)]" : "text-[var(--wo-primary)]")} /></div><strong className={cn("mt-2 block font-mono text-lg", risk ? "text-[var(--wo-danger)]" : "text-[var(--wo-text)]")}>{value}</strong></div>;
}

function Decision({ icon: Icon, title, detail, tone }: { icon: typeof Bot; title: string; detail: string; tone: Tone }) {
  return <div className="flex gap-3 rounded-xl bg-[var(--wo-card-2)] p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Icon className="h-4 w-4" /></span><div><div className="flex flex-wrap items-center gap-2"><strong className="text-xs text-[var(--wo-text)]">{title}</strong><Chip tone={tone}>{tone}</Chip></div><p className="mt-1 text-[9px] leading-relaxed text-[var(--wo-muted)]">{detail}</p></div></div>;
}
