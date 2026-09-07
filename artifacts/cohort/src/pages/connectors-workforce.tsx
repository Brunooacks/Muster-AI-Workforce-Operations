import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CircleCheck,
  Code2,
  Copy,
  Gauge,
  Github,
  KeyRound,
  Link2,
  Loader2,
  Network,
  PlugZap,
  Radio,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Target,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  getListConnectorsQueryKey,
  useConnectPlatform,
  useDiscoverAgents,
  useListConnectorCapabilities,
  useListConnectors,
  usePreAssessAgentSource,
  useRegisterConnector,
  useTestConnector,
  type Connector,
  type ConnectorCapability,
  type DiscoveredAgent,
  type DiscoveryResult,
  type PreAssessResult,
} from "@workspace/api-client-react";
import { PlatformIcon } from "@/components/platform-badge";
import { useToast } from "@/hooks/use-toast";
import {
  summarizeFastAssessment,
  type FastAssessmentSummary,
} from "@/lib/fast-assessment";
import {
  connectorEnvironment,
  findConnectorForCapability,
  type ConnectorEnvironment,
} from "@/lib/connector-operating-model";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { storeAdmissionHandoff } from "@/lib/admission-handoff";

type Tone = "good" | "watch" | "risk" | "primary" | "neutral";
type ConnectionKind = "github" | "universal" | "runtime";

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    good: "bg-[color-mix(in_srgb,var(--wo-accent)_16%,transparent)] text-[var(--wo-accent)]",
    watch: "bg-[color-mix(in_srgb,var(--wo-warning)_16%,transparent)] text-[var(--wo-warning)]",
    risk: "bg-[color-mix(in_srgb,var(--wo-danger)_16%,transparent)] text-[var(--wo-danger)]",
    primary: "bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]",
    neutral: "bg-[var(--wo-card-2)] text-[var(--wo-muted)]",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function capabilityTone(mode: ConnectorCapability["mode"]): Tone {
  if (mode === "live") return "good";
  if (mode === "contract-ready") return "primary";
  return "neutral";
}

function capabilityLabel(mode: ConnectorCapability["mode"]): string {
  if (mode === "live") return "operacional";
  if (mode === "contract-ready") return "via contrato";
  return "planejado";
}

function statusTone(status: Connector["status"]): Tone {
  if (status === "connected") return "good";
  if (status === "configured" || status === "syncing") return "watch";
  if (status === "degraded" || status === "error") return "risk";
  return "neutral";
}

function statusLabel(status: Connector["status"]): string {
  const labels: Record<Connector["status"], string> = {
    available: "disponível",
    configured: "aguardando evento",
    connected: "comprovado",
    syncing: "sincronizando",
    degraded: "degradado",
    error: "erro",
  };
  return labels[status];
}

function publicApiBase(): string {
  const declared = (import.meta.env.VITE_PUBLIC_API_URL as string | undefined)?.trim();
  if (declared) return declared.replace(/\/+$/, "");
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${window.location.protocol}//${window.location.hostname}:8087`;
  }
  return window.location.origin;
}

function connectorPayload(
  connector: Connector,
  agentContext?: { externalId?: string; name?: string },
): string {
  return JSON.stringify(
    {
      contractVersion: "muster.agent-ingestion.v1",
      eventId: "exec-001",
      source: {
        platform: connector.platform,
        connectorId: connector.id,
        environment: connector.mode === "runtime" ? "local" : "production",
      },
      agent: {
        externalId: agentContext?.externalId || "meu-agente-prod",
        name: agentContext?.name || "Meu agente",
        version: "1.0.0",
      },
      execution: {
        status: "success",
        durationMs: 820,
        costCents: 4,
        tokensIn: 640,
        tokensOut: 180,
      },
      observations: [
        {
          metricKey: "task-success-rate",
          label: "Taxa de sucesso",
          value: 96,
          unit: "%",
          kind: "observed",
          confidence: 100,
          capturedAt: new Date().toISOString(),
        },
      ],
    },
    null,
    2,
  );
}

export function ConnectorsScreen() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const connectorsQuery = useListConnectors();
  const capabilitiesQuery = useListConnectorCapabilities();
  const connectPlatform = useConnectPlatform();
  const registerConnector = useRegisterConnector();
  const testConnector = useTestConnector();
  const discoverAgents = useDiscoverAgents();
  const preAssess = usePreAssessAgentSource();

  const [environment, setEnvironment] = useState<ConnectorEnvironment>("all");
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [connectionKind, setConnectionKind] = useState<ConnectionKind>("universal");
  const [configurationForm, setConfigurationForm] = useState({
    platform: "webhook",
    name: "Integração universal",
    token: "",
  });
  const [setupConnector, setSetupConnector] = useState<Connector | null>(null);
  const [setupAgentContext, setSetupAgentContext] = useState<{
    agentId?: string;
    externalId?: string;
    name?: string;
  } | null>(null);
  const [setupQueryConsumed, setSetupQueryConsumed] = useState(false);
  const [busyConnectorId, setBusyConnectorId] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [assessmentForm, setAssessmentForm] = useState({ url: "", nameHint: "" });
  const [assessment, setAssessment] = useState<{
    result: PreAssessResult;
    summary: FastAssessmentSummary;
  } | null>(null);

  const connectors = connectorsQuery.data ?? [];
  const capabilities = capabilitiesQuery.data ?? [];
  const tenantConnectors = connectors.filter(
    (connector) => !connector.id.startsWith("catalog_"),
  );
  const universalOptions = capabilities.filter(
    (capability) =>
      capability.platform !== "github" &&
      capability.platform !== "kubernetes-otel" &&
      capability.mode !== "planned" &&
      (capability.capabilities.collectTelemetry || capability.capabilities.collectMetrics),
  );
  const visibleCapabilities = useMemo(
    () =>
      capabilities.filter(
        (capability) =>
          environment === "all" ||
          connectorEnvironment(capability.platform) === environment,
      ),
    [capabilities, environment],
  );
  const connectedCount = tenantConnectors.filter(
    (connector) => connector.status === "connected",
  ).length;
  const configuredCount = tenantConnectors.filter(
    (connector) => connector.status === "configured",
  ).length;
  const eventCount = tenantConnectors.filter((connector) => connector.lastEventAt).length;

  useEffect(() => {
    if (setupQueryConsumed || connectors.length === 0) return;
    const query = new URLSearchParams(window.location.search);
    const connectorId = query.get("connectorId");
    if (!connectorId) return;
    const connector = connectors.find((item) => item.id === connectorId);
    if (!connector) return;
    setSetupConnector(connector);
    setSetupAgentContext({
      agentId: query.get("agentId") || undefined,
      externalId: query.get("externalId") || undefined,
      name: query.get("agentName") || undefined,
    });
    setSetupQueryConsumed(true);
  }, [connectors, setupQueryConsumed]);

  function refreshConnectors() {
    queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
  }

  function openConfiguration(kind: ConnectionKind, platform?: string, name?: string) {
    const selectedPlatform =
      kind === "github"
        ? "github"
        : kind === "runtime"
          ? "kubernetes-otel"
          : platform ?? "webhook";
    const label = name ?? capabilities.find((entry) => entry.platform === selectedPlatform)?.label;
    setConnectionKind(kind);
    setConfigurationForm({
      platform: selectedPlatform,
      name:
        label ??
        (kind === "github"
          ? "GitHub principal"
          : kind === "runtime"
            ? "Runtime local"
            : "Integração universal"),
      token: "",
    });
    setConfigurationOpen(true);
  }

  function handleRegisterGitHub() {
    if (!configurationForm.name.trim()) return;
    registerConnector.mutate(
      {
        data: {
          platform: "github",
          name: configurationForm.name.trim(),
          token: configurationForm.token.trim() || null,
        },
      },
      {
        onSuccess: (result) => {
          setOperationMessage(result.test.message);
          toast({
            title: result.test.ok ? "GitHub conectado" : "Credencial recusada",
            description: result.test.message,
            variant: result.test.ok ? undefined : "destructive",
          });
          setConfigurationOpen(false);
          refreshConnectors();
        },
        onError: (error) =>
          toast({
            title: "Falha ao registrar GitHub",
            description: error instanceof Error ? error.message : "Revise a credencial.",
            variant: "destructive",
          }),
      },
    );
  }

  function handleConfigureUniversal(
    platform = configurationForm.platform,
    name = configurationForm.name,
  ) {
    setBusyConnectorId(platform);
    connectPlatform.mutate(
      { data: { platform, name: name.trim() || undefined } },
      {
        onSuccess: (connector) => {
          setBusyConnectorId(null);
          setConfigurationOpen(false);
          setSetupAgentContext(null);
          setSetupConnector(connector);
          setOperationMessage(
            `${connector.name}: configuração criada. Aguardando o primeiro evento real.`,
          );
          refreshConnectors();
        },
        onError: (error) => {
          setBusyConnectorId(null);
          toast({
            title: "Falha ao configurar integração",
            description: error instanceof Error ? error.message : "Tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleTest(connector: Connector) {
    setBusyConnectorId(connector.id);
    testConnector.mutate(
      { connectorId: connector.id },
      {
        onSuccess: (result) => {
          setBusyConnectorId(null);
          setOperationMessage(`${connector.name}: ${result.message}`);
          toast({ title: result.ok ? "Teste concluído" : "Teste falhou", description: result.message });
          refreshConnectors();
        },
        onError: (error) => {
          setBusyConnectorId(null);
          toast({
            title: "Falha no teste",
            description: error instanceof Error ? error.message : "Tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleDiscover(connector: Connector) {
    setBusyConnectorId(connector.id);
    discoverAgents.mutate(
      { connectorId: connector.id },
      {
        onSuccess: (result) => {
          setBusyConnectorId(null);
          setDiscovery(result);
          setOperationMessage(`${result.agentsFound} agentes encontrados em ${connector.name}.`);
          refreshConnectors();
        },
        onError: (error) => {
          setBusyConnectorId(null);
          toast({
            title: "Discovery não concluído",
            description: error instanceof Error ? error.message : "Revise o adapter.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function beginAdmission(connector: Connector, candidate?: DiscoveredAgent) {
    storeAdmissionHandoff({
      source: candidate ? "discovery" : "connector",
      connector,
      candidate,
      sourceUrl: candidate?.sourceUrl,
    });
    setLocation(`/admissao?source=${candidate ? "discovery" : "connector"}`);
  }

  function handleAssessment() {
    const url = assessmentForm.url.trim();
    if (!url) return;
    preAssess.mutate(
      { data: { url, nameHint: assessmentForm.nameHint.trim() || undefined } },
      {
        onSuccess: (result) => {
          setAssessment({ result, summary: summarizeFastAssessment(result) });
          setOperationMessage(`Assessment concluído para ${result.draft.name}.`);
        },
        onError: (error) =>
          toast({
            title: "Assessment não concluído",
            description: error instanceof Error ? error.message : "Verifique a URL.",
            variant: "destructive",
          }),
      },
    );
  }

  function continueAdmission() {
    if (!assessment) return;
    storeAdmissionHandoff({
      source: "fast-assessment",
      sourceUrl: assessmentForm.url.trim(),
      result: assessment.result,
    });
    setLocation("/admissao?assessment=fast");
  }

  function openSetup(connector: Connector) {
    setSetupAgentContext(null);
    setSetupConnector(connector);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado` });
    } catch {
      toast({
        title: `Não foi possível copiar ${label.toLowerCase()}`,
        description: "Selecione o conteúdo e copie manualmente.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--wo-primary)]">
            Control plane de integrações
          </span>
          <h1 className="mt-2 max-w-5xl text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-4xl">
            Da credencial ao primeiro evento, sem estados fictícios.
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--wo-muted)]">
            Configure a origem, prove a conexão com dados reais e acompanhe exatamente o que falta para cada agente entrar em operação.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openConfiguration("universal")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"
        >
          <PlugZap className="h-4 w-4" /> Nova integração
        </button>
      </div>

      {operationMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--wo-primary)] bg-[var(--wo-primary-soft)] px-4 py-3 text-[10px] text-[var(--wo-text)]"
        >
          <span className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-[var(--wo-accent)]" />
            {operationMessage}
          </span>
          <button type="button" onClick={() => setOperationMessage("")}>
            <X className="h-3.5 w-3.5 text-[var(--wo-muted)]" />
          </button>
        </div>
      )}

      <IntegrationLifecycle />

      <div className="grid gap-3 lg:grid-cols-3">
        <ConnectionPath icon={Github} eyebrow="Nativo" title="GitHub" description="Testa a credencial, lê repositórios, detecta stacks agentic e importa candidatos reais." action="Configurar GitHub" onClick={() => openConfiguration("github")} />
        <ConnectionPath icon={Network} eyebrow="Contrato universal" title="SaaS e cloud" description="Gera uma chave tenant-scoped para Zendesk, Agentforce, AWS, Azure, GCP e frameworks." action="Escolher plataforma" onClick={() => openConfiguration("universal")} />
        <ConnectionPath icon={Server} eyebrow="Runtime próprio" title="Local, Docker e Kubernetes" description="Recebe a mesma telemetria de workloads on-premise, vLLM, GPU local ou edge." action="Configurar runtime" onClick={() => openConfiguration("runtime")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Conexões comprovadas" value={String(connectedCount)} icon={CircleCheck} />
        <Summary label="Aguardando evento" value={String(configuredCount)} icon={Radio} />
        <Summary label="Origens com telemetria" value={String(eventCount)} icon={Activity} />
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--wo-line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-[var(--wo-text)]">Conexões desta organização</h2>
            <p className="mt-1 text-[10px] text-[var(--wo-muted)]">“Comprovado” exige teste nativo válido ou pelo menos um envelope real autenticado.</p>
          </div>
          <button type="button" onClick={() => connectorsQuery.refetch()} className="inline-flex items-center gap-2 text-xs text-[var(--wo-text)]">
            <RefreshCw className={cn("h-3.5 w-3.5", connectorsQuery.isFetching && "animate-spin")} /> Atualizar
          </button>
        </div>
        {connectorsQuery.isLoading ? (
          <Loading label="Carregando conexões..." />
        ) : connectorsQuery.isError ? (
          <ErrorPanel onRetry={() => connectorsQuery.refetch()} />
        ) : tenantConnectors.length === 0 ? (
          <div className="grid min-h-48 place-items-center px-6 text-center"><div><PlugZap className="mx-auto h-7 w-7 text-[var(--wo-muted)]" /><strong className="mt-3 block text-sm text-[var(--wo-text)]">Nenhuma origem configurada</strong><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Escolha um dos três caminhos acima para iniciar.</p></div></div>
        ) : (
          <div className="grid gap-px bg-[var(--wo-line)] md:grid-cols-2 xl:grid-cols-3">
            {tenantConnectors.map((connector) => {
              const capability = capabilities.find((entry) => entry.platform === connector.platform);
              const canDiscover = Boolean(capability?.capabilities.discoverAgents);
              const busy = busyConnectorId === connector.id || busyConnectorId === connector.platform;
              return (
                <article key={connector.id} className="flex min-h-56 flex-col bg-[var(--wo-card)] p-4">
                  <div className="flex items-start gap-3">
                    <PlatformIcon platform={connector.platform} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2"><strong className="text-xs font-medium text-[var(--wo-text)]">{connector.name}</strong><Chip tone={statusTone(connector.status)}>{statusLabel(connector.status)}</Chip></div>
                      <span className="mt-1 block text-[9px] uppercase tracking-[0.06em] text-[var(--wo-muted)]">{connector.mode} · {connector.health}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[9px]"><ConnectorFact label="Último teste" value={formatMoment(connector.lastTestedAt)} /><ConnectorFact label="Último evento" value={formatMoment(connector.lastEventAt)} /></div>
                  <p className="mt-3 rounded-xl bg-[var(--wo-card-2)] p-3 text-[10px] leading-relaxed text-[var(--wo-muted)]">{connector.nextAction}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <button type="button" onClick={() => handleTest(connector)} disabled={busy} className="rounded-lg border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 py-2 text-[10px] text-[var(--wo-text)] disabled:opacity-50">{busy ? "Processando..." : "Testar"}</button>
                    {canDiscover ? (
                      <button type="button" onClick={() => handleDiscover(connector)} disabled={busy || connector.status !== "connected"} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wo-primary)] px-3 py-2 text-[10px] font-medium text-[var(--wo-bg)] disabled:opacity-40"><Search className="h-3 w-3" /> Discovery</button>
                    ) : (
                      <button type="button" onClick={() => openSetup(connector)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wo-primary)] px-3 py-2 text-[10px] font-medium text-[var(--wo-bg)]"><KeyRound className="h-3 w-3" /> Ver integração</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {discovery && (
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--wo-line)] px-4 py-3"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Discovery · {discovery.platform}</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">{discovery.coverageNote}</p></div><Chip tone="primary">{discovery.agentsFound} encontrados</Chip></div>
          <div className="divide-y divide-[var(--wo-line)]">
            {discovery.agents.map((agent) => (
              <div key={agent.externalId} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
                <div className="flex items-center gap-3"><PlatformIcon platform={agent.platform} /><span><strong className="block text-xs text-[var(--wo-text)]">{agent.name}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{agent.role}</span></span></div>
                <div><span className="text-[9px] text-[var(--wo-muted)]">{agent.proposedMetrics.length} métricas · confiança {agent.confidence}%</span><div className="mt-2 flex flex-wrap gap-1">{agent.signals.slice(0, 4).map((signal) => <span key={signal} className="rounded bg-[var(--wo-card-2)] px-2 py-1 font-mono text-[8px] text-[var(--wo-muted)]">{signal}</span>)}</div></div>
                {agent.alreadyImported ? <Chip tone="good">já admitido</Chip> : <button type="button" onClick={() => { const connector = tenantConnectors.find((item) => item.id === discovery.connectorId); if (connector) beginAdmission(connector, agent); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wo-accent)] px-3 py-2 text-[10px] font-medium text-[var(--wo-accent-ink)]"><UserPlus className="h-3 w-3" /> Revisar e admitir</button>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <div className="grid xl:grid-cols-[.72fr_1.28fr]">
          <div className="border-b border-[var(--wo-line)] p-4 xl:border-b-0 xl:border-r">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--wo-primary)]" /><h2 className="text-sm font-medium text-[var(--wo-text)]">Fast assessment de código</h2></div>
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--wo-muted)]">Leia um repositório antes da admissão para detectar stack, runtime, guardrails e lacunas de instrumentação.</p>
            <div className="mt-4 space-y-3">
              <Field label="URL do repositório"><input value={assessmentForm.url} onChange={(event) => setAssessmentForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://github.com/empresa/agente" className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></Field>
              <Field label="Nome sugerido"><input value={assessmentForm.nameHint} onChange={(event) => setAssessmentForm((current) => ({ ...current, nameHint: event.target.value }))} placeholder="Opcional" className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></Field>
              <button type="button" onClick={handleAssessment} disabled={!assessmentForm.url.trim() || preAssess.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--wo-primary)] px-4 py-2.5 text-xs font-medium text-[var(--wo-bg)] disabled:opacity-50">{preAssess.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />} Analisar agente</button>
            </div>
          </div>
          <div className="p-4">
            {assessment ? (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Pré-qualificação estática</span><h3 className="mt-2 text-lg font-medium text-[var(--wo-text)]">{assessment.result.draft.name}</h3><p className="mt-1 text-[10px] text-[var(--wo-muted)]">{assessment.result.draft.role} · {assessment.result.platform ?? "stack não identificada"}</p></div><Chip tone={assessment.summary.status === "ready" ? "good" : assessment.summary.status === "review" ? "watch" : "risk"}>{assessment.summary.status} · {assessment.summary.score}/100</Chip></div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><AssessmentStat label="Código" value={assessment.summary.codeConfidence} icon={Code2} /><AssessmentStat label="Propósito" value={assessment.summary.purposeConfidence} icon={Target} /><AssessmentStat label="Telemetria" value={assessment.summary.telemetryReadiness} icon={Activity} /><AssessmentStat label="Métricas" value={assessment.summary.metricReadiness} icon={Gauge} /></div>
                <div className="mt-4 flex flex-wrap gap-1.5">{assessment.result.signals.map((signal) => <span key={signal} className="rounded bg-[var(--wo-card-2)] px-2 py-1 font-mono text-[8px] text-[var(--wo-muted)]">{signal}</span>)}</div>
                <div className="mt-4 flex justify-end"><button type="button" onClick={continueAdmission} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">Continuar para admissão <ArrowRight className="h-4 w-4" /></button></div>
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center text-center"><div><Code2 className="mx-auto h-8 w-8 text-[var(--wo-muted)]" /><strong className="mt-3 block text-sm text-[var(--wo-text)]">Nenhum assessment executado</strong><p className="mt-1 max-w-sm text-[10px] text-[var(--wo-muted)]">O resultado mede prontidão técnica; performance só nasce de execuções reais.</p></div></div>
            )}
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--wo-line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-medium text-[var(--wo-text)]">Cobertura de plataformas</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">“Via contrato” coleta dados hoje, mas não promete adapter nativo, discovery ou ação remota.</p></div>
          <div className="flex gap-1 rounded-xl bg-[var(--wo-card-2)] p-1">{(["all", "cloud", "hybrid", "local"] as ConnectorEnvironment[]).map((item) => <button key={item} type="button" onClick={() => setEnvironment(item)} className={cn("rounded-lg px-3 py-1.5 text-[10px]", environment === item ? "bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "text-[var(--wo-muted)]")}>{item === "all" ? "Todos" : item === "cloud" ? "Cloud" : item === "hybrid" ? "Híbrido" : "Local"}</button>)}</div>
        </div>
        {capabilitiesQuery.isLoading ? <Loading label="Carregando capacidades..." /> : (
          <div className="grid gap-px bg-[var(--wo-line)] md:grid-cols-2 xl:grid-cols-3">
            {visibleCapabilities.map((capability) => {
              const connector = findConnectorForCapability(tenantConnectors, capability);
              const busy = busyConnectorId === capability.platform;
              return (
                <article key={capability.platform} className="flex min-h-48 flex-col bg-[var(--wo-card)] p-4">
                  <div className="flex items-start gap-3"><PlatformIcon platform={capability.platform} size="lg" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><strong className="text-xs font-medium text-[var(--wo-text)]">{capability.label}</strong><Chip tone={capabilityTone(capability.mode)}>{capabilityLabel(capability.mode)}</Chip></div><span className="mt-1 block text-[9px] uppercase tracking-[0.06em] text-[var(--wo-muted)]">{connectorEnvironment(capability.platform)} · {capability.transport.join(" · ")}</span></div></div>
                  <p className="mt-3 text-[10px] leading-relaxed text-[var(--wo-muted)]">{capability.note}</p>
                  <div className="mt-3 flex flex-wrap gap-1">{Object.entries(capability.capabilities).filter(([, enabled]) => enabled).map(([name]) => <span key={name} className="rounded bg-[var(--wo-card-2)] px-2 py-1 text-[8px] text-[var(--wo-muted)]">{name}</span>)}</div>
                  <div className="mt-auto pt-4">
                    {connector ? (
                      <button type="button" onClick={() => connector.mode === "native" ? handleTest(connector) : openSetup(connector)} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--wo-primary)]"><CircleCheck className="h-3 w-3" /> {statusLabel(connector.status)} · abrir</button>
                    ) : capability.mode === "planned" ? (
                      <span className="inline-flex items-center gap-1.5 text-[9px] text-[var(--wo-muted)]"><TriangleAlert className="h-3 w-3" /> Ainda não configurável</span>
                    ) : capability.platform === "github" ? (
                      <button type="button" onClick={() => openConfiguration("github")} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--wo-primary)]"><Link2 className="h-3 w-3" /> Configurar adapter</button>
                    ) : (
                      <button type="button" onClick={() => openConfiguration(capability.platform === "kubernetes-otel" ? "runtime" : "universal", capability.platform, capability.label)} disabled={busy} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--wo-primary)] disabled:opacity-50">{busy && <Loader2 className="h-3 w-3 animate-spin" />} Configurar coleta</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {configurationOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="connector-dialog-title">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-shell)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-primary)]">Nova integração</span><h2 id="connector-dialog-title" className="mt-2 text-xl font-medium text-[var(--wo-text)]">Escolha como esta origem vai operar</h2></div><button type="button" aria-label="Fechar" onClick={() => setConfigurationOpen(false)} className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)]"><X className="h-4 w-4" /></button></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3"><ModeButton active={connectionKind === "github"} icon={Github} title="GitHub nativo" subtitle="Teste + discovery" onClick={() => openConfiguration("github")} /><ModeButton active={connectionKind === "universal"} icon={Network} title="Contrato universal" subtitle="SaaS, cloud e SDK" onClick={() => openConfiguration("universal")} /><ModeButton active={connectionKind === "runtime"} icon={Server} title="Runtime local" subtitle="Docker, K8s e GPU" onClick={() => openConfiguration("runtime")} /></div>
            <div className="mt-5 space-y-4">
              {connectionKind === "universal" && <Field label="Plataforma de origem"><select value={configurationForm.platform} onChange={(event) => { const capability = capabilities.find((entry) => entry.platform === event.target.value); setConfigurationForm((current) => ({ ...current, platform: event.target.value, name: capability?.label ?? current.name })); }} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]">{universalOptions.map((capability) => <option key={capability.platform} value={capability.platform}>{capability.label}</option>)}</select></Field>}
              <Field label="Nome da conexão"><input value={configurationForm.name} onChange={(event) => setConfigurationForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /></Field>
              {connectionKind === "github" ? <Field label="GitHub token"><input type="password" value={configurationForm.token} onChange={(event) => setConfigurationForm((current) => ({ ...current, token: event.target.value }))} placeholder="Opcional se GITHUB_TOKEN estiver no servidor" className="mt-2 h-10 w-full rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 text-xs text-[var(--wo-text)] outline-none focus:border-[var(--wo-primary)]" /><p className="mt-2 text-[9px] leading-relaxed text-[var(--wo-muted)]">A credencial é testada agora e armazenada cifrada. Somente leitura de conteúdo e metadados.</p></Field> : <div className="rounded-xl border border-[var(--wo-primary)] bg-[var(--wo-primary-soft)] p-3 text-[10px] leading-relaxed text-[var(--wo-muted)]">O Muster emitirá uma chave de ingestão mostrada uma única vez. A conexão continuará como “aguardando evento” até receber telemetria autenticada.</div>}
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfigurationOpen(false)} className="rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)]">Cancelar</button><button type="button" onClick={connectionKind === "github" ? handleRegisterGitHub : () => handleConfigureUniversal()} disabled={!configurationForm.name.trim() || registerConnector.isPending || connectPlatform.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50">{(registerConnector.isPending || connectPlatform.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}{connectionKind === "github" ? "Testar e conectar" : "Gerar credencial"}</button></div>
          </div>
        </div>
      )}

      {setupConnector && <SetupDialog connector={setupConnector} agentContext={setupAgentContext ?? undefined} onClose={() => { setSetupConnector(null); setSetupAgentContext(null); }} onCopy={copyText} onRotate={() => handleConfigureUniversal(setupConnector.platform, setupConnector.name)} rotating={connectPlatform.isPending} onAdmit={() => beginAdmission(setupConnector)} />}
    </div>
  );
}

function IntegrationLifecycle() {
  const stages = [
    { step: "01", title: "Conectar a origem", description: "Autentica GitHub, SaaS, cloud ou runtime local." },
    { step: "02", title: "Descobrir e avaliar", description: "Encontra candidatos, código, sinais e métricas possíveis." },
    { step: "03", title: "Admitir o profissional", description: "Formaliza propósito, donos, autonomia, limites e KPIs." },
    { step: "04", title: "Provar em operação", description: "O primeiro evento inicia telemetria e supervisão contínua." },
  ];
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-[var(--wo-line)] px-4 py-3">
        <h2 className="text-sm font-medium text-[var(--wo-text)]">Um fluxo, duas responsabilidades</h2>
        <p className="mt-1 text-[10px] text-[var(--wo-muted)]">Conectores transportam evidência. Admissão autoriza o agente a fazer parte da força de trabalho.</p>
      </div>
      <div className="grid gap-px bg-[var(--wo-line)] md:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => (
          <div key={stage.step} className="bg-[var(--wo-card)] p-4">
            <span className="font-mono text-[9px] text-[var(--wo-primary)]">{stage.step}</span>
            <strong className="mt-2 block text-xs font-medium text-[var(--wo-text)]">{stage.title}</strong>
            <p className="mt-1.5 text-[9px] leading-relaxed text-[var(--wo-muted)]">{stage.description}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ConnectionPath({ icon: Icon, eyebrow, title, description, action, onClick }: { icon: typeof Github; eyebrow: string; title: string; description: string; action: string; onClick: () => void }) {
  return <Panel className="group flex min-h-48 flex-col p-4 transition hover:border-[var(--wo-primary)]"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Icon className="h-4 w-4" /></span><span className="text-[8px] uppercase tracking-[0.12em] text-[var(--wo-muted)]">{eyebrow}</span></div><h2 className="mt-4 text-base font-medium text-[var(--wo-text)]">{title}</h2><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">{description}</p><button type="button" onClick={onClick} className="mt-auto inline-flex items-center gap-2 pt-4 text-[10px] font-medium text-[var(--wo-primary)]">{action} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></button></Panel>;
}

function SetupDialog({ connector, agentContext, onClose, onCopy, onRotate, rotating, onAdmit }: { connector: Connector; agentContext?: { agentId?: string; externalId?: string; name?: string }; onClose: () => void; onCopy: (value: string, label: string) => void; onRotate: () => void; rotating: boolean; onAdmit: () => void }) {
  const endpoint = `${publicApiBase()}${connector.setupEndpoint ?? "/api/integrations/agent-events"}`;
  const apiKey = connector.setupApiKey ?? "$MUSTER_CONNECTOR_KEY";
  const payload = connectorPayload(connector, agentContext);
  const curl = `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H 'Content-Type: application/json' \\
  --data '${payload.replace(/'/g, "'\\''")}'`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="my-6 w-full max-w-4xl rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-shell)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><PlatformIcon platform={connector.platform} size="lg" /><div><div className="flex flex-wrap items-center gap-2"><h2 id="setup-title" className="text-xl font-medium text-[var(--wo-text)]">{connector.name}</h2><Chip tone={statusTone(connector.status)}>{statusLabel(connector.status)}</Chip></div><p className="mt-1 text-[10px] text-[var(--wo-muted)]">{connector.mode} · credencial limitada à organização</p></div></div><button type="button" aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)]"><X className="h-4 w-4" /></button></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[.72fr_1.28fr]">
          <div className="space-y-3">
            {agentContext?.agentId && <div className="rounded-xl border border-[var(--wo-accent)] bg-[color-mix(in_srgb,var(--wo-accent)_10%,var(--wo-card))] p-4"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-accent)]">Admissão concluída</span><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-text)]">{agentContext.name || "Agente"}</strong> já está vinculado a esta origem. Envie o primeiro evento com <code className="text-[var(--wo-text)]">externalId: {agentContext.externalId}</code> para iniciar a supervisão.</p></div>}
            {connector.setupApiKey ? <div className="rounded-xl border border-[var(--wo-warning)] bg-[color-mix(in_srgb,var(--wo-warning)_10%,var(--wo-card))] p-4"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-warning)]">Chave exibida uma única vez</span><code className="mt-3 block break-all rounded-lg bg-[var(--wo-bg)] p-3 text-[9px] text-[var(--wo-text)]">{connector.setupApiKey}</code><button type="button" onClick={() => onCopy(connector.setupApiKey!, "Chave")} className="mt-3 inline-flex items-center gap-2 text-[10px] font-medium text-[var(--wo-warning)]"><Copy className="h-3 w-3" /> Copiar chave</button></div> : <div className="rounded-xl bg-[var(--wo-card-2)] p-4"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Credencial protegida</span><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">A chave existente não pode ser recuperada. Gere uma nova somente se perdeu a original; a anterior será revogada.</p><button type="button" onClick={onRotate} disabled={rotating} className="mt-3 inline-flex items-center gap-2 text-[10px] font-medium text-[var(--wo-primary)] disabled:opacity-50">{rotating ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />} Gerar nova chave</button></div>}
            <div className="rounded-xl border border-[var(--wo-line)] p-4"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Sequência de ativação</span><ol className="mt-3 space-y-3 text-[10px] text-[var(--wo-muted)]"><li><strong className="text-[var(--wo-text)]">01 · Salve a chave</strong><br />Guarde em secret manager ou variável de ambiente.</li><li><strong className="text-[var(--wo-text)]">02 · Admita o agente</strong><br />Formalize o contrato usando o externalId do runtime.</li><li><strong className="text-[var(--wo-text)]">03 · Envie um evento</strong><br />Execução, feedback ou observação de KPI.</li><li><strong className="text-[var(--wo-text)]">04 · Confirme a prova</strong><br />O status muda para comprovado e registra freshness.</li></ol>{!agentContext?.agentId && <button type="button" onClick={onAdmit} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--wo-primary)] px-3 py-2 text-[10px] font-medium text-[var(--wo-bg)]">Continuar para admissão <ArrowRight className="h-3 w-3" /></button>}</div>
          </div>
          <div className="min-w-0 rounded-xl bg-[#090d12] p-4 text-[#dce6f2]"><div className="flex items-center justify-between gap-3"><div><span className="text-[8px] uppercase tracking-[0.12em] text-[#7f91a8]">Primeiro evento · cURL</span><p className="mt-1 text-[9px] text-[#7f91a8]">{agentContext?.externalId ? "Payload pronto com o externalId admitido." : "Edite externalId para coincidir com a admissão."}</p></div><button type="button" onClick={() => onCopy(curl, "Comando")} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[9px] text-[#dce6f2]"><Copy className="h-3 w-3" /> Copiar</button></div><pre className="mt-4 max-h-[31rem] overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed text-[#b7c7da]">{curl}</pre></div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, icon: Icon, title, subtitle, onClick }: { active: boolean; icon: typeof Github; title: string; subtitle: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("rounded-xl border p-3 text-left transition", active ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)]" : "border-[var(--wo-line)] bg-[var(--wo-card)] hover:border-[var(--wo-primary)]")}><Icon className="h-4 w-4 text-[var(--wo-primary)]" /><strong className="mt-3 block text-xs text-[var(--wo-text)]">{title}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{subtitle}</span></button>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span>{children}</label>;
}

function ConnectorFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--wo-line)] p-2"><span className="block text-[8px] uppercase tracking-[0.06em] text-[var(--wo-muted)]">{label}</span><strong className="mt-1 block font-mono text-[9px] font-normal text-[var(--wo-text)]">{value}</strong></div>;
}

function formatMoment(value?: string | null): string {
  if (!value) return "não registrado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function Loading({ label }: { label: string }) {
  return <div className="flex min-h-32 items-center justify-center gap-2 text-xs text-[var(--wo-muted)]"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return <div className="grid min-h-32 place-items-center text-center"><div><strong className="text-xs text-[var(--wo-text)]">Não foi possível carregar os conectores</strong><button type="button" onClick={onRetry} className="mt-3 flex items-center gap-2 text-[10px] text-[var(--wo-primary)]"><RefreshCw className="h-3 w-3" />Tentar novamente</button></div></div>;
}

function Summary({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return <Panel className="p-4"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span><Icon className="h-4 w-4 text-[var(--wo-primary)]" /></div><strong className="mt-3 block font-mono text-2xl font-medium text-[var(--wo-text)]">{value}</strong></Panel>;
}

function AssessmentStat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return <div className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-center justify-between"><span className="text-[9px] text-[var(--wo-muted)]">{label}</span><Icon className="h-3.5 w-3.5 text-[var(--wo-primary)]" /></div><strong className="mt-2 block font-mono text-lg text-[var(--wo-text)]">{value}%</strong><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--wo-line)]"><div className="h-full rounded-full bg-[var(--wo-primary)]" style={{ width: `${value}%` }} /></div></div>;
}
