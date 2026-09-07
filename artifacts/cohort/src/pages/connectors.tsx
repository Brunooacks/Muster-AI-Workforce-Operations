import { AppLayout } from "@/components/layout";
import {
  useListConnectors,
  useConnectPlatform,
  useDiscoverAgents,
  useImportDiscoveredAgents,
  useRegisterConnector,
  useListConnectorCapabilities,
  usePreAssessAgentSource,
  usePreAssessConnectorSource,
} from "@workspace/api-client-react";
import type { PreAssessResult } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  ArrowRight,
  Check,
  Code2,
  Download,
  Gauge,
  Link2,
  Plug,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { ErrorState } from "@/components/query-state";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getListConnectorsQueryKey } from "@workspace/api-client-react";
import { PageHeading, Pill, Eyebrow } from "@/components/cohort";
import { useLang, localeOf, type Lang } from "@/lib/i18n";
import { useLocation } from "wouter";
import {
  summarizeFastAssessment,
  type FastAssessmentSummary,
} from "@/lib/fast-assessment";

// Platforms with a REAL connector implementation; the rest of the list still
// comes from the demo catalog until their connectors land (R3 incremental).
const REAL_PLATFORMS = [{ key: "github", label: "GitHub" }];

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  bcAccount: "Conta",
  bcConnectors: "Conectores",
  eyebrow: "Conta · Integrações",
  title: "Conectores",
  subtitle:
    "Conecte plataformas para descobrir agentes e importar suas métricas propostas automaticamente.",
  registerBtn: "Cadastrar conector",
  toastRegOk: "Conector conectado",
  toastRegPending: "Conector cadastrado — credencial pendente",
  toastRegErr: "Erro ao cadastrar conector",
  toastLinked: "Conector vinculado",
  toastLinkedDesc: (platform: string) => `Conexão com ${platform} estabelecida.`,
  toastDiscoveryDone: "Discovery concluído",
  toastDiscoveryDesc: (n: number) => `${n} agentes encontrados.`,
  toastErr: "Erro",
  toastDiscoveryFail: "Falha ao realizar discovery.",
  toastImportDone: "Importação concluída",
  toastImportDesc: "Agentes admitidos na frota.",
  discoveryTitle: "Discovery",
  metricsMapped: (n: number) => `${n} métricas mapeadas`,
  confidence: (c: number) => `· Confiança ${c}%`,
  alreadyInFleet: "Já na frota",
  importAdmit: "Importar & admitir",
  close: "Fechar",
  errLoad: "Não foi possível carregar os conectores",
  availableIntegrations: "Integrações disponíveis",
  connected: "Conectado",
  available: "Disponível",
  connectedMeta: (n: number, lastSync: string) =>
    `${n} agentes descobertos · último sync ${lastSync}`,
  never: "nunca",
  discovering: "Descobrindo…",
  runDiscovery: "Rodar discovery",
  connect: "Conectar",
  emptyTitle: "Nenhum conector disponível",
  emptyDesc: "Conecte uma plataforma para começar a descobrir agentes.",
  dialogTitle: "Cadastrar conector",
  dialogDesc:
    "Conecte uma plataforma real. A credencial é testada na hora e fica armazenada apenas no seu banco — nunca é exibida de volta.",
  platformLabel: "Plataforma",
  platformsSoon: "AWS Bedrock, Azure AI e Vertex chegam nas próximas iterações do R3.",
  nameLabel: "Nome do conector",
  namePlaceholder: "ex.: GitHub — org principal",
  tokenLabel: "Token (PAT)",
  tokenPlaceholder: "ghp_… (opcional — vazio usa GITHUB_TOKEN do ambiente)",
  scopePre: "Escopo mínimo: leitura de repositórios. Fine-grained PAT com",
  scopePost: "é suficiente.",
  cancel: "Cancelar",
  testing: "Testando conexão…",
  registerTest: "Cadastrar e testar",
  capabilityTitle: "Mapa de cobertura",
  capabilityLive: "Live",
  capabilityReady: "Contrato pronto",
  capabilityPlanned: "Planejado",
  capabilityHint: "A integração pode começar pelo webhook universal enquanto o adapter nativo é construído.",
  fastEyebrow: "Fast assessment · sem integração prévia",
  fastTitle: "Comece pelo código do agente, não por um formulário vazio.",
  fastDesc: "Informe um repositório ou URL pública. O Muster lê estrutura, framework, ferramentas, runtime, telemetria e métricas declaradas para montar uma pré-qualificação auditável.",
  repoUrl: "URL do repositório ou código",
  repoPlaceholder: "https://github.com/empresa/agente",
  nameHint: "Nome opcional",
  nameHintPlaceholder: "ex.: Revisor de PR",
  assess: "Analisar e pré-qualificar",
  assessing: "Analisando código…",
  assessDone: "Fast assessment concluído",
  assessFail: "Não foi possível analisar esta origem.",
  scoreLabel: "Prontidão para instrumentação",
  statusReady: "Pronto para revisão",
  statusReview: "Instrumentação pendente",
  statusBlocked: "Evidência insuficiente",
  codeConfidence: "Leitura do código",
  purposeConfidence: "Propósito e papel",
  telemetryReadiness: "Coleta e telemetria",
  metricReadiness: "Contrato de métricas",
  detectedStack: "Stack detectada",
  detectedSignals: "Sinais encontrados",
  metricsPreview: "Métricas pré-enquadradas",
  declaredMetrics: (n: number) => `${n} declaradas no código`,
  suggestedMetrics: (n: number) => `${n} sugeridas pelo catálogo`,
  gapsTitle: "Lacunas antes da avaliação real",
  nextTitle: "Próximo passo recomendado",
  nextReady: "Revisar a função e conectar uma execução real para iniciar baseline e probation.",
  nextReview: "Completar telemetria, metas e guardrails antes de admitir o agente como observável.",
  nextBlocked: "Definir propósito, runtime e sinais mínimos antes de usar esta origem para decisão.",
  continueAdmission: "Continuar na admissão",
  assessCandidate: "Avaliar código",
  staticDisclaimer: "Pré-qualificação estática: não representa desempenho real até receber execuções, outcomes e evidências.",
  noCriticalGaps: "Nenhuma lacuna estrutural crítica detectada.",
  gaps: {
    framework: "Framework não identificado",
    runtime: "Runtime não identificado",
    telemetry: "Telemetria não encontrada",
    metrics: "Poucas métricas declaradas",
    purpose: "Propósito ou responsabilidades incompletos",
    governance: "Guardrails ou autonomia pouco claros",
  },
};

type Dict = typeof PT;

const FAST_ASSESSMENT_HANDOFF_KEY = "muster:fast-assessment-handoff";

interface FastAssessmentView {
  sourceUrl: string;
  result: PreAssessResult;
  summary: FastAssessmentSummary;
}

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    bcAccount: "Account",
    bcConnectors: "Connectors",
    eyebrow: "Account · Integrations",
    title: "Connectors",
    subtitle:
      "Connect platforms to discover agents and import their proposed metrics automatically.",
    registerBtn: "Register connector",
    toastRegOk: "Connector connected",
    toastRegPending: "Connector registered — credential pending",
    toastRegErr: "Error registering connector",
    toastLinked: "Connector linked",
    toastLinkedDesc: (platform: string) => `Connection with ${platform} established.`,
    toastDiscoveryDone: "Discovery complete",
    toastDiscoveryDesc: (n: number) => `${n} agents found.`,
    toastErr: "Error",
    toastDiscoveryFail: "Failed to run discovery.",
    toastImportDone: "Import complete",
    toastImportDesc: "Agents admitted to the fleet.",
    discoveryTitle: "Discovery",
    metricsMapped: (n: number) => `${n} metrics mapped`,
    confidence: (c: number) => `· Confidence ${c}%`,
    alreadyInFleet: "Already in the fleet",
    importAdmit: "Import & admit",
    close: "Close",
    errLoad: "Could not load the connectors",
    availableIntegrations: "Available integrations",
    connected: "Connected",
    available: "Available",
    connectedMeta: (n: number, lastSync: string) =>
      `${n} agents discovered · last sync ${lastSync}`,
    never: "never",
    discovering: "Discovering…",
    runDiscovery: "Run discovery",
    connect: "Connect",
    emptyTitle: "No connectors available",
    emptyDesc: "Connect a platform to start discovering agents.",
    dialogTitle: "Register connector",
    dialogDesc:
      "Connect a real platform. The credential is tested on the spot and stored only in your database — it is never displayed back.",
    platformLabel: "Platform",
    platformsSoon: "AWS Bedrock, Azure AI and Vertex arrive in the next R3 iterations.",
    nameLabel: "Connector name",
    namePlaceholder: "e.g.: GitHub — main org",
    tokenLabel: "Token (PAT)",
    tokenPlaceholder: "ghp_… (optional — empty uses the environment's GITHUB_TOKEN)",
    scopePre: "Minimum scope: repository read. A fine-grained PAT with",
    scopePost: "is enough.",
    cancel: "Cancel",
    testing: "Testing connection…",
    registerTest: "Register and test",
    capabilityTitle: "Coverage map",
    capabilityLive: "Live",
    capabilityReady: "Contract ready",
    capabilityPlanned: "Planned",
    capabilityHint: "Integration can start with the universal webhook while the native adapter is built.",
    fastEyebrow: "Fast assessment · no prior integration",
    fastTitle: "Start from the agent code, not an empty form.",
    fastDesc: "Provide a repository or public URL. Muster reads structure, framework, tools, runtime, telemetry and declared metrics to build an auditable pre-qualification.",
    repoUrl: "Repository or code URL",
    repoPlaceholder: "https://github.com/company/agent",
    nameHint: "Optional name",
    nameHintPlaceholder: "e.g. PR Reviewer",
    assess: "Analyze and pre-qualify",
    assessing: "Analyzing code…",
    assessDone: "Fast assessment complete",
    assessFail: "This source could not be analyzed.",
    scoreLabel: "Instrumentation readiness",
    statusReady: "Ready for review",
    statusReview: "Instrumentation pending",
    statusBlocked: "Insufficient evidence",
    codeConfidence: "Code understanding",
    purposeConfidence: "Purpose and role",
    telemetryReadiness: "Collection and telemetry",
    metricReadiness: "Metrics contract",
    detectedStack: "Detected stack",
    detectedSignals: "Detected signals",
    metricsPreview: "Pre-framed metrics",
    declaredMetrics: (n: number) => `${n} declared in code`,
    suggestedMetrics: (n: number) => `${n} suggested by the catalog`,
    gapsTitle: "Gaps before real evaluation",
    nextTitle: "Recommended next step",
    nextReady: "Review the role and connect a real execution to start baseline and probation.",
    nextReview: "Complete telemetry, targets and guardrails before admitting the agent as observable.",
    nextBlocked: "Define purpose, runtime and minimum signals before using this source for decisions.",
    continueAdmission: "Continue to admission",
    assessCandidate: "Assess code",
    staticDisclaimer: "Static pre-qualification: it is not real performance until executions, outcomes and evidence arrive.",
    noCriticalGaps: "No critical structural gap detected.",
    gaps: {
      framework: "Framework not identified",
      runtime: "Runtime not identified",
      telemetry: "Telemetry not found",
      metrics: "Too few declared metrics",
      purpose: "Purpose or responsibilities incomplete",
      governance: "Guardrails or autonomy unclear",
    },
  },
  es: {
    bcAccount: "Cuenta",
    bcConnectors: "Conectores",
    eyebrow: "Cuenta · Integraciones",
    title: "Conectores",
    subtitle:
      "Conecta plataformas para descubrir agentes e importar sus métricas propuestas automáticamente.",
    registerBtn: "Registrar conector",
    toastRegOk: "Conector conectado",
    toastRegPending: "Conector registrado — credencial pendiente",
    toastRegErr: "Error al registrar el conector",
    toastLinked: "Conector vinculado",
    toastLinkedDesc: (platform: string) => `Conexión con ${platform} establecida.`,
    toastDiscoveryDone: "Discovery completado",
    toastDiscoveryDesc: (n: number) => `${n} agentes encontrados.`,
    toastErr: "Error",
    toastDiscoveryFail: "Fallo al realizar el discovery.",
    toastImportDone: "Importación completada",
    toastImportDesc: "Agentes admitidos en la flota.",
    discoveryTitle: "Discovery",
    metricsMapped: (n: number) => `${n} métricas mapeadas`,
    confidence: (c: number) => `· Confianza ${c}%`,
    alreadyInFleet: "Ya en la flota",
    importAdmit: "Importar y admitir",
    close: "Cerrar",
    errLoad: "No fue posible cargar los conectores",
    availableIntegrations: "Integraciones disponibles",
    connected: "Conectado",
    available: "Disponible",
    connectedMeta: (n: number, lastSync: string) =>
      `${n} agentes descubiertos · última sincronización ${lastSync}`,
    never: "nunca",
    discovering: "Descubriendo…",
    runDiscovery: "Ejecutar discovery",
    connect: "Conectar",
    emptyTitle: "Ningún conector disponible",
    emptyDesc: "Conecta una plataforma para comenzar a descubrir agentes.",
    dialogTitle: "Registrar conector",
    dialogDesc:
      "Conecta una plataforma real. La credencial se prueba al momento y queda almacenada solo en tu base de datos — nunca se muestra de vuelta.",
    platformLabel: "Plataforma",
    platformsSoon: "AWS Bedrock, Azure AI y Vertex llegan en las próximas iteraciones del R3.",
    nameLabel: "Nombre del conector",
    namePlaceholder: "ej.: GitHub — org principal",
    tokenLabel: "Token (PAT)",
    tokenPlaceholder: "ghp_… (opcional — vacío usa el GITHUB_TOKEN del entorno)",
    scopePre: "Alcance mínimo: lectura de repositorios. Un fine-grained PAT con",
    scopePost: "es suficiente.",
    cancel: "Cancelar",
    testing: "Probando conexión…",
    registerTest: "Registrar y probar",
    capabilityTitle: "Mapa de cobertura",
    capabilityLive: "Live",
    capabilityReady: "Contrato listo",
    capabilityPlanned: "Planificado",
    capabilityHint: "La integración puede comenzar por el webhook universal mientras se construye el adapter nativo.",
    fastEyebrow: "Fast assessment · sin integración previa",
    fastTitle: "Comienza por el código del agente, no por un formulario vacío.",
    fastDesc: "Informa un repositorio o URL pública. Muster lee estructura, framework, herramientas, runtime, telemetría y métricas declaradas para crear una precalificación auditable.",
    repoUrl: "URL del repositorio o código",
    repoPlaceholder: "https://github.com/empresa/agente",
    nameHint: "Nombre opcional",
    nameHintPlaceholder: "ej.: Revisor de PR",
    assess: "Analizar y precalificar",
    assessing: "Analizando código…",
    assessDone: "Fast assessment completado",
    assessFail: "No fue posible analizar este origen.",
    scoreLabel: "Preparación para instrumentación",
    statusReady: "Listo para revisión",
    statusReview: "Instrumentación pendiente",
    statusBlocked: "Evidencia insuficiente",
    codeConfidence: "Lectura del código",
    purposeConfidence: "Propósito y rol",
    telemetryReadiness: "Colecta y telemetría",
    metricReadiness: "Contrato de métricas",
    detectedStack: "Stack detectado",
    detectedSignals: "Señales encontradas",
    metricsPreview: "Métricas preencuadradas",
    declaredMetrics: (n: number) => `${n} declaradas en el código`,
    suggestedMetrics: (n: number) => `${n} sugeridas por el catálogo`,
    gapsTitle: "Brechas antes de la evaluación real",
    nextTitle: "Próximo paso recomendado",
    nextReady: "Revisar la función y conectar una ejecución real para iniciar baseline y probation.",
    nextReview: "Completar telemetría, metas y guardrails antes de admitir al agente como observable.",
    nextBlocked: "Definir propósito, runtime y señales mínimas antes de usar este origen para decisiones.",
    continueAdmission: "Continuar a admisión",
    assessCandidate: "Evaluar código",
    staticDisclaimer: "Precalificación estática: no representa desempeño real hasta recibir ejecuciones, outcomes y evidencias.",
    noCriticalGaps: "No se detectó ninguna brecha estructural crítica.",
    gaps: {
      framework: "Framework no identificado",
      runtime: "Runtime no identificado",
      telemetry: "Telemetría no encontrada",
      metrics: "Pocas métricas declaradas",
      purpose: "Propósito o responsabilidades incompletos",
      governance: "Guardrails o autonomía poco claros",
    },
  },
};

export default function ConnectorsPage() {
  const [, setLocation] = useLocation();
  const { data: connectors, isLoading, isError, refetch } = useListConnectors();
  const { data: capabilities } = useListConnectorCapabilities();
  const { toast } = useToast();
  const { lang } = useLang();
  const t = L[lang];
  const locale = localeOf(lang);

  const connectPlatform = useConnectPlatform();
  const discoverAgents = useDiscoverAgents();
  const importAgents = useImportDiscoveredAgents();
  const registerConnector = useRegisterConnector();
  const preAssess = usePreAssessAgentSource();
  const preAssessConnector = usePreAssessConnectorSource();

  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({ platform: "github", name: "", token: "" });
  const [assessmentForm, setAssessmentForm] = useState({ url: "", nameHint: "" });
  const [assessment, setAssessment] = useState<FastAssessmentView | null>(null);

  const presentAssessment = (sourceUrl: string, result: PreAssessResult) => {
    const summary = summarizeFastAssessment(result);
    setAssessment({ sourceUrl, result, summary });
    toast({ title: t.assessDone, description: `${result.draft.name} · ${summary.score}/100` });
  };

  const runFastAssessment = (sourceUrl = assessmentForm.url, nameHint = assessmentForm.nameHint) => {
    const url = sourceUrl.trim();
    if (!url) return;
    setAssessmentForm({ url, nameHint });
    preAssess.mutate(
      { data: { url, nameHint: nameHint.trim() || undefined } },
      {
        onSuccess: (result) => presentAssessment(url, result),
        onError: (error) => toast({
          title: t.toastErr,
          description: error instanceof Error ? error.message : t.assessFail,
          variant: "destructive",
        }),
      },
    );
  };

  const runConnectorAssessment = (connectorId: string, sourceUrl: string, nameHint: string) => {
    const url = sourceUrl.trim();
    setAssessmentForm({ url, nameHint });
    preAssessConnector.mutate(
      { connectorId, data: { url, nameHint: nameHint.trim() || undefined } },
      {
        onSuccess: (result) => presentAssessment(url, result),
        onError: (error) => toast({
          title: t.toastErr,
          description: error instanceof Error ? error.message : t.assessFail,
          variant: "destructive",
        }),
      },
    );
  };

  const continueAdmission = () => {
    if (!assessment) return;
    sessionStorage.setItem(
      FAST_ASSESSMENT_HANDOFF_KEY,
      JSON.stringify({ sourceUrl: assessment.sourceUrl, result: assessment.result }),
    );
    setLocation("/admissao?assessment=fast");
  };

  const handleRegister = () => {
    if (!regForm.name.trim()) return;
    registerConnector.mutate(
      {
        data: {
          platform: regForm.platform,
          name: regForm.name.trim(),
          token: regForm.token.trim() || null,
        },
      },
      {
        onSuccess: (r) => {
          toast({
            title: r.test.ok ? t.toastRegOk : t.toastRegPending,
            description: r.test.message,
            variant: r.test.ok ? undefined : "destructive",
          });
          setRegisterOpen(false);
          setRegForm({ platform: "github", name: "", token: "" });
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        },
        onError: () =>
          toast({ title: t.toastRegErr, variant: "destructive" }),
      },
    );
  };

  const handleConnect = (platform: string) => {
    connectPlatform.mutate(
      { data: { platform } },
      {
        onSuccess: () => {
          toast({ title: t.toastLinked, description: t.toastLinkedDesc(platform) });
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        },
      },
    );
  };

  const handleDiscover = (connectorId: string) => {
    setDiscoveringId(connectorId);
    discoverAgents.mutate(
      { connectorId },
      {
        onSuccess: (result) => {
          setDiscoveryResult(result);
          setDiscoveringId(null);
          toast({ title: t.toastDiscoveryDone, description: t.toastDiscoveryDesc(result.agentsFound) });
        },
        onError: () => {
          setDiscoveringId(null);
          toast({ title: t.toastErr, description: t.toastDiscoveryFail, variant: "destructive" });
        },
      },
    );
  };

  const handleImport = (externalIds: string[]) => {
    if (!discoveryResult) return;
    importAgents.mutate(
      { connectorId: discoveryResult.connectorId, data: { externalIds } },
      {
        onSuccess: () => {
          toast({ title: t.toastImportDone, description: t.toastImportDesc });
          setDiscoveryResult(null);
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        },
      },
    );
  };

  const assessmentTone = assessment?.summary.status === "ready"
    ? "sage"
    : assessment?.summary.status === "review"
      ? "ochre"
      : "terracotta";
  const assessmentStatus = assessment?.summary.status === "ready"
    ? t.statusReady
    : assessment?.summary.status === "review"
      ? t.statusReview
      : t.statusBlocked;
  const assessmentNext = assessment?.summary.status === "ready"
    ? t.nextReady
    : assessment?.summary.status === "review"
      ? t.nextReview
      : t.nextBlocked;

  return (
    <AppLayout breadcrumbs={[{ label: t.bcAccount }, { label: t.bcConnectors }]}>
      <div className="max-w-5xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
          action={
            <Button onClick={() => setRegisterOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t.registerBtn}
            </Button>
          }
        />

        <Card className="overflow-hidden border-primary/35 bg-primary/[0.03]">
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Eyebrow>{t.fastEyebrow}</Eyebrow>
              </div>
              <h2 className="mt-2 font-serif text-2xl font-medium tracking-tight">{t.fastTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t.fastDesc}</p>
            </div>
            <Pill tone="blue">read-only · sem IA</Pill>
          </div>
          <div className="grid gap-3 border-t border-card-border bg-background/35 p-5 lg:grid-cols-[1fr_230px_auto]">
            <div className="space-y-2">
              <Label htmlFor="assessment-url">{t.repoUrl}</Label>
              <Input
                id="assessment-url"
                value={assessmentForm.url}
                onChange={(event) => setAssessmentForm((current) => ({ ...current, url: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !preAssess.isPending) runFastAssessment();
                }}
                placeholder={t.repoPlaceholder}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment-name">{t.nameHint}</Label>
              <Input
                id="assessment-name"
                value={assessmentForm.nameHint}
                onChange={(event) => setAssessmentForm((current) => ({ ...current, nameHint: event.target.value }))}
                placeholder={t.nameHintPlaceholder}
              />
            </div>
            <Button
              className="self-end"
              onClick={() => runFastAssessment()}
              disabled={!assessmentForm.url.trim() || preAssess.isPending}
            >
              <Code2 className="mr-2 h-4 w-4" />
              {preAssess.isPending ? t.assessing : t.assess}
            </Button>
          </div>
        </Card>

        {assessment && (
          <Card className="overflow-hidden border-primary/35">
            <div className="flex flex-col gap-4 border-b border-card-border bg-primary/[0.04] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={assessmentTone}>{assessmentStatus}</Pill>
                  <span className="font-mono text-xs text-muted-foreground">{assessment.result.platform ?? "stack não identificada"}</span>
                </div>
                <h2 className="mt-3 font-serif text-2xl font-medium tracking-tight">{assessment.result.draft.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{assessment.result.draft.role}</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-card px-5 py-3 text-right">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{t.scoreLabel}</span>
                <strong className="mt-1 block font-mono text-3xl font-medium text-primary">{assessment.summary.score}</strong>
              </div>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: t.codeConfidence, value: assessment.summary.codeConfidence, icon: Code2 },
                { label: t.purposeConfidence, value: assessment.summary.purposeConfidence, icon: Target },
                { label: t.telemetryReadiness, value: assessment.summary.telemetryReadiness, icon: Activity },
                { label: t.metricReadiness, value: assessment.summary.metricReadiness, icon: Gauge },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-card-border bg-secondary/25 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <strong className="mt-3 block font-mono text-xl font-medium">{value}%</strong>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-5 border-t border-card-border p-5 xl:grid-cols-[.8fr_1.15fr_1fr]">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="h-4 w-4 text-primary" />{t.detectedSignals}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {assessment.result.signals.slice(0, 12).map((signal) => <Pill key={signal} tone="muted">{signal.replace(/^[^:]+:/, "")}</Pill>)}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{assessment.result.draft.summary}</p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium"><Gauge className="h-4 w-4 text-primary" />{t.metricsPreview}</div>
                  <span className="text-[10px] text-muted-foreground">{t.declaredMetrics(assessment.summary.declaredMetrics)} · {t.suggestedMetrics(assessment.summary.suggestedMetrics)}</span>
                </div>
                <div className="mt-3 divide-y divide-card-border rounded-xl border border-card-border">
                  {assessment.result.draft.proposedMetrics.slice(0, 6).map((metric) => (
                    <div key={`${metric.layer}-${metric.label}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0"><span className="block truncate text-xs font-medium">{metric.label}</span><span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">{metric.layer}</span></div>
                      <span className="shrink-0 font-mono text-xs text-primary">{metric.target || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-medium"><TriangleAlert className="h-4 w-4 text-chart-2" />{t.gapsTitle}</div>
                <div className="mt-3 space-y-2">
                  {assessment.summary.gaps.length > 0 ? assessment.summary.gaps.map((gap) => (
                    <div key={gap} className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">{t.gaps[gap]}</div>
                  )) : <div className="rounded-lg bg-chart-1/10 px-3 py-2 text-xs text-chart-1">{t.noCriticalGaps}</div>}
                </div>
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-primary">{t.nextTitle}</span>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{assessmentNext}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-card-border bg-secondary/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{t.staticDisclaimer}</p>
              <Button onClick={continueAdmission}>{t.continueAdmission}<ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </Card>
        )}

        {capabilities && capabilities.length > 0 && (
          <Card className="border-card-border bg-secondary/20 px-5 py-4">
            <div className="flex items-start gap-3">
              <Radio className="mt-0.5 h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <Eyebrow>{t.capabilityTitle}</Eyebrow>
                <p className="mt-1 text-xs text-muted-foreground">{t.capabilityHint}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {capabilities.map((capability) => {
                    const tone = capability.mode === "live" ? "sage" : capability.mode === "contract-ready" ? "ochre" : "muted";
                    const label = capability.mode === "live" ? t.capabilityLive : capability.mode === "contract-ready" ? t.capabilityReady : t.capabilityPlanned;
                    return (
                      <Pill key={capability.platform} tone={tone}>
                        {capability.label} · {label}
                      </Pill>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}

        {discoveryResult && (
          <Card className="overflow-hidden border-primary/30">
            <div className="border-b border-card-border bg-primary/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-serif text-lg font-medium">
                  {t.discoveryTitle} · {discoveryResult.platform}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{discoveryResult.coverageNote}</p>
            </div>
            <div className="divide-y divide-card-border">
              {discoveryResult.agents.map((agent: any) => (
                <div
                  key={agent.externalId}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      <Pill tone="muted">{agent.role}</Pill>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>{t.metricsMapped(agent.proposedMetrics.length)}</span>
                      <span>{t.confidence(agent.confidence)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {agent.sourceUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runConnectorAssessment(discoveryResult.connectorId, agent.sourceUrl, agent.name)}
                        disabled={preAssessConnector.isPending}
                      >
                        <Code2 className="mr-1 h-4 w-4" />
                        {t.assessCandidate}
                      </Button>
                    )}
                    {agent.alreadyImported ? (
                      <Pill tone="sage">{t.alreadyInFleet}</Pill>
                    ) : (
                      <Button size="sm" onClick={() => handleImport([agent.externalId])}>
                        <Download className="mr-1 h-4 w-4" />
                        {t.importAdmit}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-card-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setDiscoveryResult(null)}>
                {t.close}
              </Button>
            </div>
          </Card>
        )}

        {isError ? (
          <ErrorState title={t.errLoad} onRetry={() => refetch()} />
        ) : (
          <Card className="overflow-hidden">
            <div className="border-b border-card-border px-5 py-3">
              <Eyebrow>{t.availableIntegrations}</Eyebrow>
            </div>
            {isLoading ? (
              <div className="divide-y divide-card-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="h-10 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : connectors && connectors.length > 0 ? (
              <div className="divide-y divide-card-border">
                {connectors.map((connector) => {
                  const connected = connector.status === "connected";
                  return (
                    <div
                      key={connector.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary/60 text-muted-foreground">
                          <Plug className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{connector.name}</span>
                            <Pill tone={connected ? "sage" : "muted"}>
                              {connected ? t.connected : t.available}
                            </Pill>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {connected
                              ? t.connectedMeta(
                                  connector.agentsDiscovered,
                                  connector.lastSyncAt
                                    ? new Date(connector.lastSyncAt).toLocaleDateString(locale)
                                    : t.never,
                                )
                              : connector.category}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {connected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDiscover(connector.id)}
                            disabled={discoveringId === connector.id}
                          >
                            {discoveringId === connector.id ? (
                              t.discovering
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" /> {t.runDiscovery}
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConnect(connector.platform)}
                            disabled={connectPlatform.isPending}
                          >
                            <Link2 className="mr-2 h-4 w-4" /> {t.connect}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-muted-foreground">
                <Plug className="h-8 w-8 opacity-50" />
                <p className="font-medium text-foreground">{t.emptyTitle}</p>
                <p className="text-sm">{t.emptyDesc}</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Cadastro de conector real (R3) */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.dialogTitle}</DialogTitle>
            <DialogDescription>
              {t.dialogDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.platformLabel}</Label>
              <Select
                value={regForm.platform}
                onValueChange={(v) => setRegForm((p) => ({ ...p, platform: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REAL_PLATFORMS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t.platformsSoon}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-name">{t.nameLabel}</Label>
              <Input
                id="reg-name"
                value={regForm.name}
                placeholder={t.namePlaceholder}
                onChange={(e) => setRegForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-token">{t.tokenLabel}</Label>
              <Input
                id="reg-token"
                type="password"
                value={regForm.token}
                placeholder={t.tokenPlaceholder}
                onChange={(e) => setRegForm((p) => ({ ...p, token: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {t.scopePre}{" "}
                <code className="font-mono">contents:read</code> {t.scopePost}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleRegister}
              disabled={!regForm.name.trim() || registerConnector.isPending}
            >
              {registerConnector.isPending ? t.testing : t.registerTest}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
