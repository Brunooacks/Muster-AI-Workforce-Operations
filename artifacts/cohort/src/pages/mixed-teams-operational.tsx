import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Network,
  Plus,
  Target,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { PlatformBadge } from "@/components/platform-badge";
import { cn } from "@/lib/utils";

type Purpose = {
  id: string;
  name: string;
  description: string;
  domain: string;
  outcome: string;
  riskTier: string;
};

type TeamSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  purposeId: string;
  status: string;
  memberCount: number;
  agentCount: number;
};

type TeamDetail = TeamSummary & {
  purpose: Purpose;
  members: Array<{
    id: string;
    memberName: string;
    role: string;
    decisionRights: string[];
  }>;
  assignments: Array<{
    id: string;
    agentId: string;
    assignmentRole: string;
    responsibility: string;
    status: string;
  }>;
};

type Agent = {
  id: string;
  name: string;
  role: string;
  platform: string;
  status: string;
  healthScore: number;
  monthlyVolume?: number;
  activeAlerts?: number;
  headlineKpis?: Array<{
    label: string;
    value: number;
    unit: string;
  }>;
};

type Journey = {
  id: string;
  teamId: string;
  name: string;
  status: string;
  owner: string;
  slaMinutes: number;
  stepCount: number;
  handoffCount: number;
};

type NewTeamDraft = {
  teamName: string;
  teamDescription: string;
  purposeName: string;
  purposeOutcome: string;
  domain: string;
};

type NewMemberDraft = {
  memberId: string;
  memberName: string;
  role: "owner" | "supervisor" | "operator" | "observer";
  decisionRights: string;
};

type NewAssignmentDraft = {
  agentId: string;
  assignmentRole: "primary" | "supporting" | "reviewer";
  responsibility: string;
};

const EMPTY_TEAM: NewTeamDraft = {
  teamName: "",
  teamDescription: "",
  purposeName: "",
  purposeOutcome: "",
  domain: "operations",
};

const EMPTY_MEMBER: NewMemberDraft = {
  memberId: "",
  memberName: "",
  role: "operator",
  decisionRights: "",
};

const EMPTY_ASSIGNMENT: NewAssignmentDraft = {
  agentId: "",
  assignmentRole: "supporting",
  responsibility: "",
};

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)]", className)}>{children}</section>;
}

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "watch" | "primary" | "neutral" }) {
  const tones = {
    good: "bg-[color-mix(in_srgb,var(--wo-accent)_16%,transparent)] text-[var(--wo-accent)]",
    watch: "bg-[color-mix(in_srgb,var(--wo-warning)_16%,transparent)] text-[var(--wo-warning)]",
    primary: "bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]",
    neutral: "bg-[var(--wo-card-2)] text-[var(--wo-muted)]",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em]", tones[tone])}>{children}</span>;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function getJson<T>(path: string): Promise<T> {
  return customFetch<T>(path, { credentials: "include", responseType: "json" });
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return customFetch<T>(path, {
    method: "POST",
    credentials: "include",
    responseType: "json",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function deleteJson(path: string): Promise<void> {
  await customFetch(path, {
    method: "DELETE",
    credentials: "include",
    responseType: "text",
  });
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function productivitySnapshot(assignedAgents: Agent[]): { value: string; detail: string } {
  const metrics = assignedAgents.flatMap((agent) =>
    (agent.headlineKpis ?? []).filter((metric) =>
      /(produt|throughput|conclus|tarefas|execu)/i.test(metric.label),
    ),
  );
  if (metrics.length === 0) {
    return { value: "Sem KPI", detail: "Contrate uma métrica de produtividade" };
  }
  const unit = metrics[0]!.unit;
  if (metrics.some((metric) => metric.unit !== unit)) {
    return { value: `${metrics.length} sinais`, detail: "Unidades distintas por responsabilidade" };
  }
  const average = metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length;
  return {
    value: `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(average)}${unit === "%" ? "%" : ` ${unit}`}`,
    detail: metrics.length === 1 ? metrics[0]!.label : `Média de ${metrics.length} métricas comparáveis`,
  };
}

function LoadingPanel() {
  return <Panel className="grid min-h-64 place-items-center p-8"><Activity className="h-6 w-6 animate-pulse text-[var(--wo-primary)]" aria-label="Carregando equipes" /></Panel>;
}

export function OperationalMixedTeamsScreen() {
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [showCreate, setShowCreate] = useState(
    () => new URLSearchParams(window.location.search).get("create") === "1",
  );
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAssignAgent, setShowAssignAgent] = useState(false);
  const [draft, setDraft] = useState<NewTeamDraft>(EMPTY_TEAM);
  const [memberDraft, setMemberDraft] = useState<NewMemberDraft>(EMPTY_MEMBER);
  const [assignmentDraft, setAssignmentDraft] = useState<NewAssignmentDraft>(EMPTY_ASSIGNMENT);
  const [formError, setFormError] = useState("");
  const [operationError, setOperationError] = useState("");

  const teams = useQuery({ queryKey: ["operational-teams"], queryFn: () => getJson<TeamSummary[]>("/api/teams") });
  const agents = useQuery({ queryKey: ["operational-team-agents"], queryFn: () => getJson<Agent[]>("/api/agents") });
  const journeys = useQuery({ queryKey: ["operational-team-journeys"], queryFn: () => getJson<Journey[]>("/api/journeys") });
  const detail = useQuery({
    queryKey: ["operational-team", selectedTeamId],
    queryFn: () => getJson<TeamDetail>(`/api/teams/${selectedTeamId}`),
    enabled: Boolean(selectedTeamId),
  });

  useEffect(() => {
    if (!selectedTeamId && teams.data?.[0]) setSelectedTeamId(teams.data[0].id);
    if (selectedTeamId && teams.data && !teams.data.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(teams.data[0]?.id ?? "");
    }
  }, [selectedTeamId, teams.data]);

  const agentById = useMemo(() => new Map((agents.data ?? []).map((agent) => [agent.id, agent])), [agents.data]);
  const teamJourneys = useMemo(
    () => (journeys.data ?? []).filter((journey) => journey.teamId === selectedTeamId),
    [journeys.data, selectedTeamId],
  );
  const assignedAgents = useMemo(
    () => (detail.data?.assignments ?? [])
      .filter((assignment) => assignment.status === "active")
      .flatMap((assignment) => {
        const agent = agentById.get(assignment.agentId);
        return agent ? [agent] : [];
      }),
    [agentById, detail.data?.assignments],
  );
  const performance = useMemo(() => {
    const health = assignedAgents.length > 0
      ? Math.round(assignedAgents.reduce((sum, agent) => sum + agent.healthScore, 0) / assignedAgents.length)
      : null;
    return {
      health,
      volume: assignedAgents.reduce((sum, agent) => sum + (agent.monthlyVolume ?? 0), 0),
      alerts: assignedAgents.reduce((sum, agent) => sum + (agent.activeAlerts ?? 0), 0),
      productivity: productivitySnapshot(assignedAgents),
    };
  }, [assignedAgents]);
  const availableAgents = useMemo(
    () => (agents.data ?? []).filter((agent) => !detail.data?.assignments.some((assignment) => assignment.agentId === agent.id)),
    [agents.data, detail.data?.assignments],
  );

  const createTeam = useMutation({
    mutationFn: async () => {
      if (!draft.teamName.trim() || !draft.purposeName.trim() || !draft.purposeOutcome.trim()) {
        throw new Error("Informe equipe, propósito e resultado contratado.");
      }
      const suffix = Date.now().toString(36);
      const purpose = await postJson<Purpose>("/api/purposes", {
        key: `${slugify(draft.purposeName) || "purpose"}-${suffix}`,
        name: draft.purposeName.trim(),
        description: draft.teamDescription.trim(),
        domain: draft.domain.trim() || "operations",
        outcome: draft.purposeOutcome.trim(),
        riskTier: "medium",
      });
      return postJson<TeamSummary>("/api/teams", {
        name: draft.teamName.trim(),
        description: draft.teamDescription.trim(),
        purposeId: purpose.id,
      });
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["operational-teams"] });
      setSelectedTeamId(created.id);
      setDraft(EMPTY_TEAM);
      setFormError("");
      setShowCreate(false);
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Não foi possível criar a equipe."),
  });

  const refreshSelectedTeam = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["operational-teams"] }),
      queryClient.invalidateQueries({ queryKey: ["operational-team", selectedTeamId] }),
    ]);
  };

  const addMember = useMutation({
    mutationFn: async () => {
      if (!selectedTeamId || !memberDraft.memberId.trim() || !memberDraft.memberName.trim()) {
        throw new Error("Informe nome e identificador da pessoa.");
      }
      return postJson(`/api/teams/${selectedTeamId}/members`, {
        memberId: memberDraft.memberId.trim(),
        memberName: memberDraft.memberName.trim(),
        role: memberDraft.role,
        decisionRights: memberDraft.decisionRights
          .split(/[\n,]/)
          .map((right) => right.trim())
          .filter(Boolean),
      });
    },
    onSuccess: async () => {
      await refreshSelectedTeam();
      setMemberDraft(EMPTY_MEMBER);
      setShowAddMember(false);
      setOperationError("");
    },
    onError: (error) => setOperationError(error instanceof Error ? error.message : "Não foi possível adicionar a pessoa."),
  });

  const assignAgent = useMutation({
    mutationFn: async () => {
      if (!selectedTeamId || !assignmentDraft.agentId || !assignmentDraft.responsibility.trim()) {
        throw new Error("Selecione o agente e descreva sua responsabilidade.");
      }
      return postJson(`/api/teams/${selectedTeamId}/agents`, {
        agentId: assignmentDraft.agentId,
        assignmentRole: assignmentDraft.assignmentRole,
        responsibility: assignmentDraft.responsibility.trim(),
      });
    },
    onSuccess: async () => {
      await refreshSelectedTeam();
      setAssignmentDraft(EMPTY_ASSIGNMENT);
      setShowAssignAgent(false);
      setOperationError("");
    },
    onError: (error) => setOperationError(error instanceof Error ? error.message : "Não foi possível atribuir o agente."),
  });

  const removeMember = useMutation({
    mutationFn: (membershipId: string) => deleteJson(`/api/teams/${selectedTeamId}/members/${membershipId}`),
    onSuccess: refreshSelectedTeam,
    onError: (error) => setOperationError(error instanceof Error ? error.message : "Não foi possível remover a pessoa."),
  });

  const removeAssignment = useMutation({
    mutationFn: (assignmentId: string) => deleteJson(`/api/teams/${selectedTeamId}/agents/${assignmentId}`),
    onSuccess: refreshSelectedTeam,
    onError: (error) => setOperationError(error instanceof Error ? error.message : "Não foi possível remover o agente."),
  });

  const isLoading = teams.isLoading || agents.isLoading || journeys.isLoading;
  const hasError = teams.isError || agents.isError || journeys.isError;

  return (
    <div className="space-y-4 p-4 sm:p-6" data-operational-source="api" data-testid="operational-teams-screen">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--wo-primary)]">Operação persistida</span>
          <h1 className="mt-2 max-w-5xl text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-4xl">Equipes mistas com propósito, autoridade e execução verificáveis.</h1>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--wo-muted)]">Esta visão usa exclusivamente dados da organização autenticada. Cenários sintéticos permanecem disponíveis apenas no laboratório de protótipos.</p>
        </div>
        <button type="button" onClick={() => { setFormError(""); setShowCreate((current) => !current); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><Plus className="h-4 w-4" />Nova equipe</button>
      </div>

      {showCreate && (
        <Panel className="p-5" data-testid="create-operational-team">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Novo contrato de equipe</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">A equipe e seu propósito serão persistidos no tenant ativo.</p></div><button type="button" onClick={() => setShowCreate(false)} aria-label="Fechar criação de equipe" className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)]"><X className="h-4 w-4" /></button></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="xl:col-span-2"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Nome da equipe</span><input value={draft.teamName} onChange={(event) => setDraft({ ...draft, teamName: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
            <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Domínio</span><input value={draft.domain} onChange={(event) => setDraft({ ...draft, domain: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
            <label className="xl:col-span-2"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Propósito</span><input value={draft.purposeName} onChange={(event) => setDraft({ ...draft, purposeName: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
            <label className="md:col-span-2 xl:col-span-3"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Resultado final contratado</span><textarea rows={3} value={draft.purposeOutcome} onChange={(event) => setDraft({ ...draft, purposeOutcome: event.target.value })} className="mt-2 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
            <label className="md:col-span-2 xl:col-span-2"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Contexto operacional</span><textarea rows={3} value={draft.teamDescription} onChange={(event) => setDraft({ ...draft, teamDescription: event.target.value })} className="mt-2 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></label>
          </div>
          {formError && <p role="alert" className="mt-3 text-xs text-[var(--wo-danger)]">{formError}</p>}
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)]">Cancelar</button><button type="button" onClick={() => createTeam.mutate()} disabled={createTeam.isPending} className="rounded-xl bg-[var(--wo-primary)] px-4 py-2.5 text-xs font-medium text-[var(--wo-bg)] disabled:opacity-50">{createTeam.isPending ? "Criando…" : "Criar equipe"}</button></div>
        </Panel>
      )}

      {isLoading ? <LoadingPanel /> : hasError ? (
        <Panel className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><AlertTriangle className="h-7 w-7 text-[var(--wo-danger)]" /><h2 className="mt-4 text-lg font-medium text-[var(--wo-text)]">Não foi possível carregar a operação</h2><p className="mt-2 max-w-lg text-xs text-[var(--wo-muted)]">Confirme API, sessão e organização ativa antes de operar equipes.</p><button type="button" onClick={() => Promise.all([teams.refetch(), agents.refetch(), journeys.refetch()])} className="mt-5 rounded-xl border border-[var(--wo-line)] px-4 py-2 text-xs text-[var(--wo-text)]">Tentar novamente</button></Panel>
      ) : (teams.data ?? []).length === 0 ? (
        <Panel className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><Users className="h-8 w-8 text-[var(--wo-primary)]" /><h2 className="mt-4 text-xl font-medium text-[var(--wo-text)]">Nenhuma equipe persistida</h2><p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--wo-muted)]">Crie o primeiro contrato de equipe para relacionar pessoas, agentes, propósito e jornadas.</p><button type="button" onClick={() => setShowCreate(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><Plus className="h-4 w-4" />Criar primeira equipe</button></Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Panel className="h-fit overflow-hidden">
            <div className="border-b border-[var(--wo-line)] p-4"><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">Portfólio de equipes</span><strong className="mt-1 block text-sm text-[var(--wo-text)]">{teams.data?.length ?? 0} contratos ativos</strong></div>
            <div className="space-y-1.5 p-2">{(teams.data ?? []).map((team) => <button key={team.id} type="button" onClick={() => setSelectedTeamId(team.id)} aria-pressed={team.id === selectedTeamId} className={cn("w-full rounded-xl border p-3 text-left transition-colors", team.id === selectedTeamId ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)]" : "border-transparent hover:bg-[var(--wo-card-2)]")}><div className="flex items-center justify-between gap-2"><strong className="text-xs text-[var(--wo-text)]">{team.name}</strong><Chip tone={team.status === "active" ? "good" : "neutral"}>{team.status}</Chip></div><p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-[var(--wo-muted)]">{team.description || "Sem contexto operacional descrito."}</p><div className="mt-3 flex gap-3 text-[9px] text-[var(--wo-muted)]"><span>{team.memberCount} pessoas</span><span>{team.agentCount} agentes</span></div></button>)}</div>
          </Panel>

          {detail.isLoading || !detail.data ? <LoadingPanel /> : (
            <div className="space-y-4">
              <Panel className="overflow-hidden">
                <div className="grid gap-px bg-[var(--wo-line)] lg:grid-cols-[1.35fr_.65fr]">
                  <div className="bg-[var(--wo-card)] p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Chip tone="good">tenant real</Chip><Chip>{detail.data.purpose.domain}</Chip></div><h2 className="mt-4 text-2xl font-medium text-[var(--wo-text)]">{detail.data.name}</h2><p className="mt-2 text-xs leading-relaxed text-[var(--wo-muted)]">{detail.data.description || detail.data.purpose.description || "Contexto operacional ainda não descrito."}</p><div className="mt-6 rounded-xl bg-[var(--wo-card-2)] p-4"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Propósito coletivo</span><strong className="mt-2 block text-sm text-[var(--wo-text)]">{detail.data.purpose.name}</strong><p className="mt-2 text-xs leading-relaxed text-[var(--wo-muted)]">{detail.data.purpose.outcome}</p></div></div>
                  <div className="grid grid-cols-2 gap-px bg-[var(--wo-line)]"><TeamStat icon={UserCheck} label="Pessoas" value={String(detail.data.members.length)} /><TeamStat icon={Bot} label="Agentes" value={String(detail.data.assignments.filter((item) => item.status === "active").length)} /><TeamStat icon={Network} label="Jornadas" value={String(teamJourneys.length)} /><TeamStat icon={Activity} label="Ativas" value={String(teamJourneys.filter((item) => item.status === "active").length)} /></div>
                </div>
              </Panel>

              <Panel className="overflow-hidden" data-testid="team-performance-control">
                <div className="border-b border-[var(--wo-line)] p-4">
                  <div className="flex items-center gap-2"><Target className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Controle de propósito e produtividade</h3></div>
                  <p className="mt-1 text-[10px] text-[var(--wo-muted)]">Somente sinais observados dos agentes atribuídos; ausência de KPI permanece explícita.</p>
                </div>
                <div className="grid gap-px bg-[var(--wo-line)] sm:grid-cols-2 xl:grid-cols-4">
                  <PerformanceMetric label="Saúde média" value={performance.health === null ? "Sem dados" : `${performance.health}%`} detail={`${assignedAgents.length} agentes observados`} />
                  <PerformanceMetric label="Carga mensal" value={formatCompact(performance.volume)} detail="Execuções declaradas no portfólio" />
                  <PerformanceMetric label="Produtividade" value={performance.productivity.value} detail={performance.productivity.detail} />
                  <PerformanceMetric label="Alertas ativos" value={String(performance.alerts)} detail={performance.alerts > 0 ? "Requer supervisão" : "Sem desvio aberto"} tone={performance.alerts > 0 ? "watch" : "good"} />
                </div>
                <div className="bg-[var(--wo-card)] p-4 text-[10px] leading-relaxed text-[var(--wo-muted)]">
                  {assignedAgents.length === 0
                    ? "A equipe ainda não é operável: atribua agentes e responsáveis para iniciar a medição."
                    : teamJourneys.length === 0
                      ? "Os agentes estão atribuídos, mas o trabalho end-to-end ainda não foi contratado em uma jornada."
                      : performance.productivity.value === "Sem KPI"
                        ? "A jornada existe, porém produtividade ainda não tem evidência comparável. Cadastre um KPI ligado ao compromisso da equipe."
                        : "A equipe possui propósito, responsáveis, jornada e sinais de produtividade observáveis no mesmo contexto."}
                </div>
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel className="p-4" data-testid="team-responsibility-matrix">
                  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Pessoas e direitos de decisão</h3></div><button type="button" onClick={() => { setOperationError(""); setShowAddMember((current) => !current); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wo-line)] px-2.5 py-1.5 text-[9px] text-[var(--wo-text)]"><Plus className="h-3 w-3" />Pessoa</button></div>
                  {showAddMember && <div className="mt-4 space-y-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3" data-testid="add-team-member-form"><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Nome da pessoa" placeholder="Nome da pessoa" value={memberDraft.memberName} onChange={(event) => setMemberDraft({ ...memberDraft, memberName: event.target.value })} className="h-9 rounded-lg border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-[10px] text-[var(--wo-text)]" /><input aria-label="Identificador da pessoa" placeholder="E-mail ou ID corporativo" value={memberDraft.memberId} onChange={(event) => setMemberDraft({ ...memberDraft, memberId: event.target.value })} className="h-9 rounded-lg border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-[10px] text-[var(--wo-text)]" /><select aria-label="Papel da pessoa" value={memberDraft.role} onChange={(event) => setMemberDraft({ ...memberDraft, role: event.target.value as NewMemberDraft["role"] })} className="h-9 rounded-lg border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-[10px] text-[var(--wo-text)]"><option value="owner">Owner</option><option value="supervisor">Supervisor</option><option value="operator">Operador</option><option value="observer">Observador</option></select><input aria-label="Direitos de decisão" placeholder="Direitos, separados por vírgula" value={memberDraft.decisionRights} onChange={(event) => setMemberDraft({ ...memberDraft, decisionRights: event.target.value })} className="h-9 rounded-lg border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-[10px] text-[var(--wo-text)]" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowAddMember(false)} className="px-2.5 py-1.5 text-[9px] text-[var(--wo-muted)]">Cancelar</button><button type="button" onClick={() => addMember.mutate()} disabled={addMember.isPending} className="rounded-lg bg-[var(--wo-primary)] px-3 py-1.5 text-[9px] font-medium text-[var(--wo-bg)] disabled:opacity-50">{addMember.isPending ? "Adicionando…" : "Adicionar pessoa"}</button></div></div>}
                  <div className="mt-4 space-y-2">{detail.data.members.length === 0 ? <EmptyLine text="Nenhuma pessoa atribuída." /> : detail.data.members.map((member) => <div key={member.id} className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-start justify-between gap-2"><span><strong className="block text-xs text-[var(--wo-text)]">{member.memberName}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{member.role}</span></span><span className="flex items-center gap-1"><Chip tone="primary">humano</Chip><button type="button" aria-label={`Remover ${member.memberName}`} onClick={() => removeMember.mutate(member.id)} className="rounded-lg p-1.5 text-[var(--wo-muted)] hover:bg-[var(--wo-card)] hover:text-[var(--wo-danger)]"><Trash2 className="h-3.5 w-3.5" /></button></span></div><p className="mt-3 text-[9px] leading-relaxed text-[var(--wo-muted)]">{member.decisionRights.length > 0 ? member.decisionRights.join(" · ") : "Sem direitos adicionais registrados."}</p></div>)}</div>
                </Panel>
                <Panel className="p-4">
                  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Agentes e responsabilidades</h3></div><button type="button" onClick={() => { setOperationError(""); setShowAssignAgent((current) => !current); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wo-line)] px-2.5 py-1.5 text-[9px] text-[var(--wo-text)]"><Plus className="h-3 w-3" />Agente</button></div>
                  {showAssignAgent && <div className="mt-4 space-y-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3" data-testid="assign-team-agent-form"><select aria-label="Agente" value={assignmentDraft.agentId} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, agentId: event.target.value })} className="h-9 w-full rounded-lg border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-[10px] text-[var(--wo-text)]"><option value="">Selecione um agente</option>{availableAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.platform}</option>)}</select><select aria-label="Papel do agente" value={assignmentDraft.assignmentRole} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, assignmentRole: event.target.value as NewAssignmentDraft["assignmentRole"] })} className="h-9 w-full rounded-lg border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-[10px] text-[var(--wo-text)]"><option value="primary">Principal</option><option value="supporting">Apoio</option><option value="reviewer">Revisor</option></select><textarea aria-label="Responsabilidade do agente" rows={2} placeholder="Responsabilidade verificável deste agente" value={assignmentDraft.responsibility} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, responsibility: event.target.value })} className="w-full rounded-lg border border-[var(--wo-line)] bg-[var(--wo-card)] p-3 text-[10px] text-[var(--wo-text)]" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowAssignAgent(false)} className="px-2.5 py-1.5 text-[9px] text-[var(--wo-muted)]">Cancelar</button><button type="button" onClick={() => assignAgent.mutate()} disabled={assignAgent.isPending || availableAgents.length === 0} className="rounded-lg bg-[var(--wo-primary)] px-3 py-1.5 text-[9px] font-medium text-[var(--wo-bg)] disabled:opacity-50">{assignAgent.isPending ? "Atribuindo…" : "Atribuir agente"}</button></div></div>}
                  <div className="mt-4 space-y-2">{detail.data.assignments.length === 0 ? <EmptyLine text="Nenhum agente atribuído." /> : detail.data.assignments.map((assignment) => { const agent = agentById.get(assignment.agentId); return <div key={assignment.id} className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-start justify-between gap-2"><span><strong className="block text-xs text-[var(--wo-text)]">{agent?.name ?? assignment.agentId}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{agent?.role ?? assignment.assignmentRole}</span></span><span className="flex items-center gap-1">{agent ? <PlatformBadge platform={agent.platform} surface="workforce" /> : <Chip>{assignment.status}</Chip>}<button type="button" aria-label={`Remover ${agent?.name ?? "agente"}`} onClick={() => removeAssignment.mutate(assignment.id)} className="rounded-lg p-1.5 text-[var(--wo-muted)] hover:bg-[var(--wo-card)] hover:text-[var(--wo-danger)]"><Trash2 className="h-3.5 w-3.5" /></button></span></div><p className="mt-3 text-[9px] leading-relaxed text-[var(--wo-muted)]">{assignment.responsibility || "Responsabilidade ainda não contratada."}</p></div>; })}</div>
                </Panel>
              </div>

              {operationError && <p role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--wo-danger)_35%,var(--wo-line))] bg-[color-mix(in_srgb,var(--wo-danger)_8%,var(--wo-card))] p-3 text-xs text-[var(--wo-danger)]">{operationError}</p>}

              <Panel className="overflow-hidden" data-testid="team-operational-backlog"><div className="flex flex-col gap-3 border-b border-[var(--wo-line)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)]">Compromissos operacionais</h3></div><p className="mt-1 text-[10px] text-[var(--wo-muted)]">As jornadas abaixo são persistidas e ligadas ao contrato desta equipe.</p></div><Link href="/jornadas" className="inline-flex items-center gap-2 text-xs text-[var(--wo-primary)]">Modelar jornada <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="divide-y divide-[var(--wo-line)]">{teamJourneys.length === 0 ? <div className="p-5"><EmptyLine text="Nenhuma jornada ligada a esta equipe." /></div> : teamJourneys.map((journey) => <div key={journey.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_repeat(4,auto)] sm:items-center"><div><strong className="text-xs text-[var(--wo-text)]">{journey.name}</strong><p className="mt-1 text-[9px] text-[var(--wo-muted)]">Owner {journey.owner || "pendente"}</p></div><Metric label="Etapas" value={String(journey.stepCount)} /><Metric label="Handoffs" value={String(journey.handoffCount)} /><Metric label="SLA" value={`${journey.slaMinutes}min`} /><Chip tone={journey.status === "active" ? "good" : journey.status === "paused" ? "watch" : "neutral"}>{journey.status}</Chip></div>)}</div></Panel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamStat({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="bg-[var(--wo-card-2)] p-4"><Icon className="h-4 w-4 text-[var(--wo-primary)]" /><strong className="mt-3 block font-mono text-2xl text-[var(--wo-text)]">{value}</strong><span className="mt-1 block text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <span><span className="block text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span><strong className="mt-1 block font-mono text-[10px] text-[var(--wo-text)]">{value}</strong></span>;
}

function PerformanceMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "good" | "watch" }) {
  const valueTone = tone === "good" ? "text-[var(--wo-accent)]" : tone === "watch" ? "text-[var(--wo-warning)]" : "text-[var(--wo-text)]";
  return <div className="bg-[var(--wo-card)] p-4"><span className="text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span><strong className={cn("mt-2 block font-mono text-xl", valueTone)}>{value}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{detail}</span></div>;
}

function EmptyLine({ text }: { text: string }) {
  return <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--wo-line)] p-4 text-[10px] text-[var(--wo-muted)]"><CheckCircle2 className="h-4 w-4" />{text}</div>;
}
