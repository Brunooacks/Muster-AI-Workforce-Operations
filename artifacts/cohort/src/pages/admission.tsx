import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, ChevronDown } from "lucide-react";
import { AppLayout } from "@/components/layout";
import {
  useCreateAgent,
  useAnalyzeAgentSource,
  useFetchAgentSource,
  usePreAssessAgentSource,
  useListConnectors,
  useGetGitHubStatus,
  type AgentDraft,
  type AgentInput,
  type DraftMetric,
  type DraftMetricLayer,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PageHeading, Eyebrow, Pill } from "@/components/cohort";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { useLang, localeOf, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const AUTONOMY_VALUES = ["autonomous", "escalates", "restricted"] as const;
type AutonomyValue = (typeof AUTONOMY_VALUES)[number];

const LAYER_ORDER: DraftMetricLayer[] = [
  "efficacy",
  "efficiency",
  "adoption",
  "governance",
  "value",
];

const MAX_CONTENT_LENGTH = 100_000;

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  steps: [
    "Identidade",
    "Job Description",
    "Responsabilidade",
    "Autonomia",
    "Origem",
    "Conectar",
    "Probation",
  ],
  autonomy: {
    autonomous: { label: "Autônoma", desc: "Decide e age sem aprovação humana" },
    escalates: { label: "Escala", desc: "Age, mas escala casos sensíveis" },
    restricted: { label: "Restrita", desc: "Só age com aprovação humana" },
  } as Record<AutonomyValue, { label: string; desc: string }>,
  layers: {
    efficacy: "Eficácia",
    efficiency: "Eficiência",
    adoption: "Adoção",
    governance: "Governança",
    value: "Valor",
  } as Record<DraftMetricLayer, string>,
  bcAccount: "Conta",
  bcAdmission: "Admissão",
  eyebrow: "Conta · Admissão",
  title: "Cadastrar nova agente",
  subtitle: "A Carteira de Trabalho começa antes do agente existir. Cada campo evita uma falha futura.",
  identityTitle: "Identidade",
  identitySub: "Quem é a agente e onde ela opera.",
  aiToggle: "Pré-preencher com IA (opcional)",
  aiIntro:
    "Cole o código, prompts e definições de skills da agente. A IA propõe persona, Carteira de Trabalho e métricas — editáveis nos próximos passos.",
  sourcePlaceholder: "Cole aqui o código, prompts de sistema e/ou skills da agente…",
  importHeader: "Importar de um repositório Git ou URL",
  ghChecking: "GitHub: verificando…",
  ghConnected: "GitHub conectado",
  ghNotConnected: "GitHub não conectado",
  ghHintPre: "Repositórios públicos funcionam sem conexão. Para importar um repositório",
  ghHintStrong: "privado",
  ghHintPost:
    ", conecte sua conta GitHub nas integrações do Replit (painel de integrações) e recarregue esta página.",
  importPlaceholder: "https://github.com/org/repo ou URL de um arquivo público",
  importing: "Importando...",
  importBtn: "Importar",
  preAssessing: "Avaliando…",
  preAssessBtn: "⚡ Pré-assessment",
  preAssessStrong: "Pré-assessment",
  preAssessRest:
    'entende o repositório sem IA: detecta a stack, extrai papel/limites/KPIs do dossiê e enquadra as métricas pelo catálogo — preenchendo a carteira inteira para revisão. "Importar" apenas carrega os arquivos para a análise com IA.',
  importedFilesHeader: (selected: number, total: number) =>
    `Arquivos importados (${selected}/${total} selecionados)`,
  selectAll: "Selecionar todos",
  clearSelection: "Limpar seleção",
  removeAll: "Remover tudo",
  truncatedWarning:
    "Conteúdo truncado pelo limite de tamanho — alguns arquivos podem não ter sido incluídos por completo.",
  remove: "Remover",
  onlySelectedHint: "Apenas os arquivos selecionados serão enviados para a análise com IA.",
  charCount: (len: string, max: string) => `${len} / ${max} caracteres`,
  uploadFile: "Enviar arquivo",
  analyzing: "Analisando…",
  analyzeBtn: "Analisar com IA",
  nameLabel: "Nome",
  namePh: "Ex.: Júlia",
  roleLabel: "Papel",
  rolePh: "Ex.: Pré-qualificação Inbound",
  taglineLabel: "Tagline",
  taglineHint: "Uma frase que resume a missão da agente.",
  taglinePh: "Ex.: Qualifica leads antes do time comercial",
  platformLabel: "Plataforma",
  jobTitle: "Job Description",
  jobSub: "O que a agente faz — e o que não faz.",
  descLabel: "Descrição",
  descHint: "O que a agente entrega no dia a dia.",
  descPh: "Descreva a função principal da agente…",
  shouldDoLabel: "Deve fazer",
  shouldDoHint: "Uma responsabilidade por linha.",
  shouldDoPh: "Responder em até 2 minutos\nQualificar pelo orçamento\n…",
  shouldNotDoLabel: "Não deve fazer",
  shouldNotDoHint: "Uma restrição por linha.",
  shouldNotDoPh: "Prometer descontos\nFalar de concorrentes\n…",
  respTitle: "Responsabilidade",
  respSub: "A cadeia de donos. Sem os três nomes, a agente não vai para produção.",
  businessOwnerLabel: "Dono de negócio",
  businessOwnerPh: "Responsável pelo resultado",
  technicalOwnerLabel: "Dono técnico",
  technicalOwnerPh: "Responsável pela operação",
  sponsorLabel: "Sponsor de governança",
  sponsorPh: "Patrocinador executivo",
  approverLabel: "Aprovador de mudanças",
  approverHint: "Opcional.",
  approverPh: "Quem aprova alterações",
  ownersIncompletePill: "Preencha os três donos para avançar",
  autonomyTitle: "Autonomia",
  autonomySub: "Até onde a agente pode ir sozinha — e onde precisa de gente.",
  autonomyNotesLabel: "Notas de autonomia",
  autonomyNotesHint: "Quando ela decide sozinha e quando escala.",
  autonomyNotesPh: "Ex.: Decide sozinha até R$ 500; acima disso, escala ao dono de negócio.",
  limitsLabel: "Limites rígidos",
  limitsHint: "Uma proibição por linha.",
  limitsPh: "Nunca alterar contratos\nNunca acessar dados financeiros\n…",
  originTitle: "Origem",
  originSub: "O business case: por que esta agente existe e o que ela precisa provar.",
  bcaseLabel: "Business case",
  bcaseHint: "O problema que justifica a agente.",
  bcasePh: "Ex.: Reduzir o tempo de primeira resposta e liberar o time comercial.",
  baselineLabel: "Baseline atual",
  baselineHint: "O ponto de partida sem a agente.",
  baselinePh: "Ex.: 6h de tempo médio de resposta",
  paybackLabel: "Payback alvo",
  paybackHint: "Quando o investimento se paga.",
  paybackPh: "Ex.: 3 meses",
  connectTitle: "Conectar",
  connectSub: "De onde virão os sinais de desempenho da agente.",
  dataSourceLabel: "Fonte de dados",
  dataSourceHint: "Vincule um conector para alimentar as métricas.",
  dataSourcePh: "Selecione um conector",
  connectedSuffix: " · conectado",
  manageLater: "Você pode gerenciar conectores depois em Conta · Conectores.",
  probationTitle: "Probation",
  probationSub: "A agente entra em período de observação antes de ser promovida.",
  probationDurationLabel: "Duração do probation (semanas)",
  weeks: (w: string) => `${w} semanas`,
  metricsGoalsEyebrow: "Metas das métricas",
  metricsGoalsHint:
    "Ajuste o valor atual, a meta e a justificativa de cada métrica antes de admitir. Deixe o valor atual em branco para gerá-lo automaticamente.",
  addMetric: "+ Adicionar",
  noMetricsLayer: "Nenhuma métrica nesta camada.",
  metricLabelPh: "Rótulo",
  metricUnitPh: "Unid.",
  metricCurrentPh: "Atual",
  metricTargetPh: "Meta",
  metricRemove: "Remover",
  metricRationalePh: "Justificativa da meta (por que este alvo?)",
  summaryEyebrow: "Resumo",
  sumAgent: "Agente",
  sumPlatform: "Plataforma",
  sumOwners: "Donos",
  sumAutonomy: "Autonomia",
  sumMetrics: "Métricas propostas",
  cancel: "Cancelar",
  back: "Voltar",
  advance: "Avançar",
  admitting: "Admitindo…",
  admitBtn: "Admitir na frota",
  toastDraftApplied: "Rascunho aplicado",
  toastDraftAppliedDesc:
    "Os campos do cadastro foram preenchidos. Revise cada passo antes de admitir.",
  toastNoUrlTitle: "Informe um endereço",
  toastNoUrlDesc: "Cole a URL de um repositório Git ou de um arquivo público.",
  toastImportedTitle: "Material importado",
  toastImportedDesc: (n: number, truncated: boolean) =>
    `${n} arquivo(s) carregado(s)${
      truncated ? " (conteúdo truncado pelo limite)" : ""
    }. Revise a lista e clique em Analisar com IA.`,
  toastImportFailTitle: "Falha na importação",
  toastImportFail429: "Limite de requisições atingido. Tente novamente em alguns minutos.",
  toastImportFail403:
    "Sua conta GitHub não tem acesso a este repositório. Conecte ou reconecte sua conta GitHub e verifique as permissões.",
  toastImportFail404:
    "Repositório ou endereço não encontrado. Se for um repositório privado, conecte sua conta GitHub para importá-lo.",
  toastImportFail422: "Nenhum conteúdo relevante encontrado no endereço.",
  toastImportFailDefault: "Não foi possível importar o material desse endereço.",
  toastPreAssessDoneTitle: "Pré-assessment concluído",
  toastPreAssessDoneDesc: (platform: string, signals: number, confidence: number) =>
    `Stack: ${platform} · ${signals} sinal(is) · confiança ${confidence}%. Revise os campos e admita.`,
  notIdentified: "não identificada",
  toastPreAssessFailTitle: "Pré-assessment falhou",
  toastPreAssessFailDesc: "Verifique a URL do repositório e tente novamente.",
  toastInsufficientTitle: "Material insuficiente",
  toastInsufficientDesc: "Cole o código e/ou as definições de skills do agente.",
  toastTooLargeTitle: "Conteúdo muito grande",
  toastTooLargeDesc: (max: string) => `Reduza para até ${max} caracteres.`,
  toastIdentityIncompleteTitle: "Identidade incompleta",
  toastIdentityIncompleteDesc: "Informe ao menos nome e papel da agente.",
  toastOwnersIncompleteTitle: "Cadeia de donos incompleta",
  toastOwnersIncompleteDesc: "Defina dono de negócio, dono técnico e sponsor de governança.",
  toastOwnersIncompleteSubmitDesc: "Sem os três donos, a agente não pode ir para produção.",
  toastAdmissionDoneTitle: "Admissão concluída",
  toastAdmissionDoneDesc: "Carteira de Trabalho gerada com sucesso.",
  toastAdmissionErrTitle: "Erro na admissão",
  toastAdmissionErrDesc: "Ocorreu um erro ao registrar a agente.",
  changeApproverLine: (name: string) => `Aprovador de mudanças: ${name}`,
  dataSourceLine: (source: string) => `Fonte de dados: ${source}`,
  probationLine: (weeks: string) => `Período de probation: ${weeks} semanas`,
  bioFallback: (role: string) => `${role} na frota.`,
};

type Dict = typeof PT;

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    steps: [
      "Identity",
      "Job Description",
      "Responsibility",
      "Autonomy",
      "Origin",
      "Connect",
      "Probation",
    ],
    autonomy: {
      autonomous: { label: "Autonomous", desc: "Decides and acts without human approval" },
      escalates: { label: "Escalates", desc: "Acts, but escalates sensitive cases" },
      restricted: { label: "Restricted", desc: "Only acts with human approval" },
    },
    layers: {
      efficacy: "Efficacy",
      efficiency: "Efficiency",
      adoption: "Adoption",
      governance: "Governance",
      value: "Value",
    },
    bcAccount: "Account",
    bcAdmission: "Admission",
    eyebrow: "Account · Admission",
    title: "Register new agent",
    subtitle: "The Work Record starts before the agent exists. Every field prevents a future failure.",
    identityTitle: "Identity",
    identitySub: "Who the agent is and where it operates.",
    aiToggle: "Pre-fill with AI (optional)",
    aiIntro:
      "Paste the agent's code, prompts and skill definitions. The AI proposes a persona, Work Record and metrics — editable in the next steps.",
    sourcePlaceholder: "Paste the agent's code, system prompts and/or skills here…",
    importHeader: "Import from a Git repository or URL",
    ghChecking: "GitHub: checking…",
    ghConnected: "GitHub connected",
    ghNotConnected: "GitHub not connected",
    ghHintPre: "Public repositories work without a connection. To import a",
    ghHintStrong: "private",
    ghHintPost:
      " repository, connect your GitHub account in Replit's integrations (integrations panel) and reload this page.",
    importPlaceholder: "https://github.com/org/repo or a public file URL",
    importing: "Importing...",
    importBtn: "Import",
    preAssessing: "Assessing…",
    preAssessBtn: "⚡ Pre-assessment",
    preAssessStrong: "Pre-assessment",
    preAssessRest:
      'understands the repository without AI: it detects the stack, extracts role/limits/KPIs from the dossier and frames the metrics from the catalog — filling the whole record for review. "Import" only loads the files for the AI analysis.',
    importedFilesHeader: (selected: number, total: number) =>
      `Imported files (${selected}/${total} selected)`,
    selectAll: "Select all",
    clearSelection: "Clear selection",
    removeAll: "Remove all",
    truncatedWarning:
      "Content truncated by the size limit — some files may not have been fully included.",
    remove: "Remove",
    onlySelectedHint: "Only the selected files will be sent to the AI analysis.",
    charCount: (len: string, max: string) => `${len} / ${max} characters`,
    uploadFile: "Upload file",
    analyzing: "Analyzing…",
    analyzeBtn: "Analyze with AI",
    nameLabel: "Name",
    namePh: "E.g.: Júlia",
    roleLabel: "Role",
    rolePh: "E.g.: Inbound pre-qualification",
    taglineLabel: "Tagline",
    taglineHint: "One sentence that sums up the agent's mission.",
    taglinePh: "E.g.: Qualifies leads before the sales team",
    platformLabel: "Platform",
    jobTitle: "Job Description",
    jobSub: "What the agent does — and what it doesn't.",
    descLabel: "Description",
    descHint: "What the agent delivers day to day.",
    descPh: "Describe the agent's main function…",
    shouldDoLabel: "Should do",
    shouldDoHint: "One responsibility per line.",
    shouldDoPh: "Reply within 2 minutes\nQualify by budget\n…",
    shouldNotDoLabel: "Should not do",
    shouldNotDoHint: "One restriction per line.",
    shouldNotDoPh: "Promise discounts\nTalk about competitors\n…",
    respTitle: "Responsibility",
    respSub: "The chain of owners. Without the three names, the agent doesn't go to production.",
    businessOwnerLabel: "Business owner",
    businessOwnerPh: "Accountable for the outcome",
    technicalOwnerLabel: "Technical owner",
    technicalOwnerPh: "Accountable for the operation",
    sponsorLabel: "Governance sponsor",
    sponsorPh: "Executive sponsor",
    approverLabel: "Change approver",
    approverHint: "Optional.",
    approverPh: "Who approves changes",
    ownersIncompletePill: "Fill in the three owners to move on",
    autonomyTitle: "Autonomy",
    autonomySub: "How far the agent can go on its own — and where it needs people.",
    autonomyNotesLabel: "Autonomy notes",
    autonomyNotesHint: "When it decides alone and when it escalates.",
    autonomyNotesPh: "E.g.: Decides alone up to R$ 500; above that, escalates to the business owner.",
    limitsLabel: "Hard limits",
    limitsHint: "One prohibition per line.",
    limitsPh: "Never change contracts\nNever access financial data\n…",
    originTitle: "Origin",
    originSub: "The business case: why this agent exists and what it needs to prove.",
    bcaseLabel: "Business case",
    bcaseHint: "The problem that justifies the agent.",
    bcasePh: "E.g.: Reduce first-response time and free up the sales team.",
    baselineLabel: "Current baseline",
    baselineHint: "The starting point without the agent.",
    baselinePh: "E.g.: 6h average response time",
    paybackLabel: "Target payback",
    paybackHint: "When the investment pays off.",
    paybackPh: "E.g.: 3 months",
    connectTitle: "Connect",
    connectSub: "Where the agent's performance signals will come from.",
    dataSourceLabel: "Data source",
    dataSourceHint: "Link a connector to feed the metrics.",
    dataSourcePh: "Select a connector",
    connectedSuffix: " · connected",
    manageLater: "You can manage connectors later in Account · Connectors.",
    probationTitle: "Probation",
    probationSub: "The agent goes through an observation period before being promoted.",
    probationDurationLabel: "Probation duration (weeks)",
    weeks: (w: string) => `${w} weeks`,
    metricsGoalsEyebrow: "Metric targets",
    metricsGoalsHint:
      "Adjust each metric's current value, target and rationale before admitting. Leave the current value blank to generate it automatically.",
    addMetric: "+ Add",
    noMetricsLayer: "No metrics in this layer.",
    metricLabelPh: "Label",
    metricUnitPh: "Unit",
    metricCurrentPh: "Current",
    metricTargetPh: "Target",
    metricRemove: "Remove",
    metricRationalePh: "Target rationale (why this target?)",
    summaryEyebrow: "Summary",
    sumAgent: "Agent",
    sumPlatform: "Platform",
    sumOwners: "Owners",
    sumAutonomy: "Autonomy",
    sumMetrics: "Proposed metrics",
    cancel: "Cancel",
    back: "Back",
    advance: "Next",
    admitting: "Admitting…",
    admitBtn: "Admit to the fleet",
    toastDraftApplied: "Draft applied",
    toastDraftAppliedDesc:
      "The registration fields were filled in. Review each step before admitting.",
    toastNoUrlTitle: "Provide an address",
    toastNoUrlDesc: "Paste the URL of a Git repository or a public file.",
    toastImportedTitle: "Material imported",
    toastImportedDesc: (n: number, truncated: boolean) =>
      `${n} file(s) loaded${
        truncated ? " (content truncated by the limit)" : ""
      }. Review the list and click Analyze with AI.`,
    toastImportFailTitle: "Import failed",
    toastImportFail429: "Request limit reached. Try again in a few minutes.",
    toastImportFail403:
      "Your GitHub account doesn't have access to this repository. Connect or reconnect your GitHub account and check the permissions.",
    toastImportFail404:
      "Repository or address not found. If it's a private repository, connect your GitHub account to import it.",
    toastImportFail422: "No relevant content found at the address.",
    toastImportFailDefault: "Could not import material from that address.",
    toastPreAssessDoneTitle: "Pre-assessment complete",
    toastPreAssessDoneDesc: (platform: string, signals: number, confidence: number) =>
      `Stack: ${platform} · ${signals} signal(s) · confidence ${confidence}%. Review the fields and admit.`,
    notIdentified: "not identified",
    toastPreAssessFailTitle: "Pre-assessment failed",
    toastPreAssessFailDesc: "Check the repository URL and try again.",
    toastInsufficientTitle: "Insufficient material",
    toastInsufficientDesc: "Paste the agent's code and/or skill definitions.",
    toastTooLargeTitle: "Content too large",
    toastTooLargeDesc: (max: string) => `Reduce it to at most ${max} characters.`,
    toastIdentityIncompleteTitle: "Incomplete identity",
    toastIdentityIncompleteDesc: "Provide at least the agent's name and role.",
    toastOwnersIncompleteTitle: "Incomplete chain of owners",
    toastOwnersIncompleteDesc: "Define the business owner, technical owner and governance sponsor.",
    toastOwnersIncompleteSubmitDesc: "Without the three owners, the agent can't go to production.",
    toastAdmissionDoneTitle: "Admission complete",
    toastAdmissionDoneDesc: "Work Record generated successfully.",
    toastAdmissionErrTitle: "Admission error",
    toastAdmissionErrDesc: "An error occurred while registering the agent.",
    changeApproverLine: (name: string) => `Change approver: ${name}`,
    dataSourceLine: (source: string) => `Data source: ${source}`,
    probationLine: (weeks: string) => `Probation period: ${weeks} weeks`,
    bioFallback: (role: string) => `${role} in the fleet.`,
  },
  es: {
    steps: [
      "Identidad",
      "Job Description",
      "Responsabilidad",
      "Autonomía",
      "Origen",
      "Conectar",
      "Probation",
    ],
    autonomy: {
      autonomous: { label: "Autónoma", desc: "Decide y actúa sin aprobación humana" },
      escalates: { label: "Escala", desc: "Actúa, pero escala casos sensibles" },
      restricted: { label: "Restringida", desc: "Solo actúa con aprobación humana" },
    },
    layers: {
      efficacy: "Eficacia",
      efficiency: "Eficiencia",
      adoption: "Adopción",
      governance: "Gobernanza",
      value: "Valor",
    },
    bcAccount: "Cuenta",
    bcAdmission: "Admisión",
    eyebrow: "Cuenta · Admisión",
    title: "Registrar nueva agente",
    subtitle: "El Expediente Laboral comienza antes de que el agente exista. Cada campo evita una falla futura.",
    identityTitle: "Identidad",
    identitySub: "Quién es la agente y dónde opera.",
    aiToggle: "Prerrellenar con IA (opcional)",
    aiIntro:
      "Pega el código, los prompts y las definiciones de skills de la agente. La IA propone persona, Expediente Laboral y métricas — editables en los próximos pasos.",
    sourcePlaceholder: "Pega aquí el código, los prompts de sistema y/o las skills de la agente…",
    importHeader: "Importar de un repositorio Git o URL",
    ghChecking: "GitHub: verificando…",
    ghConnected: "GitHub conectado",
    ghNotConnected: "GitHub no conectado",
    ghHintPre: "Los repositorios públicos funcionan sin conexión. Para importar un repositorio",
    ghHintStrong: "privado",
    ghHintPost:
      ", conecta tu cuenta de GitHub en las integraciones de Replit (panel de integraciones) y recarga esta página.",
    importPlaceholder: "https://github.com/org/repo o URL de un archivo público",
    importing: "Importando...",
    importBtn: "Importar",
    preAssessing: "Evaluando…",
    preAssessBtn: "⚡ Pre-assessment",
    preAssessStrong: "Pre-assessment",
    preAssessRest:
      'entiende el repositorio sin IA: detecta el stack, extrae rol/límites/KPIs del dossier y encuadra las métricas según el catálogo — rellenando el expediente completo para revisión. "Importar" solo carga los archivos para el análisis con IA.',
    importedFilesHeader: (selected: number, total: number) =>
      `Archivos importados (${selected}/${total} seleccionados)`,
    selectAll: "Seleccionar todos",
    clearSelection: "Limpiar selección",
    removeAll: "Quitar todo",
    truncatedWarning:
      "Contenido truncado por el límite de tamaño — algunos archivos pueden no haberse incluido por completo.",
    remove: "Quitar",
    onlySelectedHint: "Solo los archivos seleccionados se enviarán al análisis con IA.",
    charCount: (len: string, max: string) => `${len} / ${max} caracteres`,
    uploadFile: "Subir archivo",
    analyzing: "Analizando…",
    analyzeBtn: "Analizar con IA",
    nameLabel: "Nombre",
    namePh: "Ej.: Júlia",
    roleLabel: "Rol",
    rolePh: "Ej.: Precalificación Inbound",
    taglineLabel: "Tagline",
    taglineHint: "Una frase que resume la misión de la agente.",
    taglinePh: "Ej.: Califica leads antes del equipo comercial",
    platformLabel: "Plataforma",
    jobTitle: "Job Description",
    jobSub: "Qué hace la agente — y qué no hace.",
    descLabel: "Descripción",
    descHint: "Lo que la agente entrega en el día a día.",
    descPh: "Describe la función principal de la agente…",
    shouldDoLabel: "Debe hacer",
    shouldDoHint: "Una responsabilidad por línea.",
    shouldDoPh: "Responder en hasta 2 minutos\nCalificar por presupuesto\n…",
    shouldNotDoLabel: "No debe hacer",
    shouldNotDoHint: "Una restricción por línea.",
    shouldNotDoPh: "Prometer descuentos\nHablar de competidores\n…",
    respTitle: "Responsabilidad",
    respSub: "La cadena de dueños. Sin los tres nombres, la agente no va a producción.",
    businessOwnerLabel: "Dueño de negocio",
    businessOwnerPh: "Responsable del resultado",
    technicalOwnerLabel: "Dueño técnico",
    technicalOwnerPh: "Responsable de la operación",
    sponsorLabel: "Sponsor de gobernanza",
    sponsorPh: "Patrocinador ejecutivo",
    approverLabel: "Aprobador de cambios",
    approverHint: "Opcional.",
    approverPh: "Quién aprueba cambios",
    ownersIncompletePill: "Completa los tres dueños para avanzar",
    autonomyTitle: "Autonomía",
    autonomySub: "Hasta dónde puede llegar la agente sola — y dónde necesita gente.",
    autonomyNotesLabel: "Notas de autonomía",
    autonomyNotesHint: "Cuándo decide sola y cuándo escala.",
    autonomyNotesPh: "Ej.: Decide sola hasta R$ 500; por encima, escala al dueño de negocio.",
    limitsLabel: "Límites rígidos",
    limitsHint: "Una prohibición por línea.",
    limitsPh: "Nunca alterar contratos\nNunca acceder a datos financieros\n…",
    originTitle: "Origen",
    originSub: "El business case: por qué existe esta agente y qué necesita probar.",
    bcaseLabel: "Business case",
    bcaseHint: "El problema que justifica a la agente.",
    bcasePh: "Ej.: Reducir el tiempo de primera respuesta y liberar al equipo comercial.",
    baselineLabel: "Baseline actual",
    baselineHint: "El punto de partida sin la agente.",
    baselinePh: "Ej.: 6h de tiempo medio de respuesta",
    paybackLabel: "Payback objetivo",
    paybackHint: "Cuándo se paga la inversión.",
    paybackPh: "Ej.: 3 meses",
    connectTitle: "Conectar",
    connectSub: "De dónde vendrán las señales de desempeño de la agente.",
    dataSourceLabel: "Fuente de datos",
    dataSourceHint: "Vincula un conector para alimentar las métricas.",
    dataSourcePh: "Selecciona un conector",
    connectedSuffix: " · conectado",
    manageLater: "Puedes gestionar conectores después en Cuenta · Conectores.",
    probationTitle: "Probation",
    probationSub: "La agente entra en período de observación antes de ser ascendida.",
    probationDurationLabel: "Duración del probation (semanas)",
    weeks: (w: string) => `${w} semanas`,
    metricsGoalsEyebrow: "Metas de las métricas",
    metricsGoalsHint:
      "Ajusta el valor actual, la meta y la justificación de cada métrica antes de admitir. Deja el valor actual en blanco para generarlo automáticamente.",
    addMetric: "+ Agregar",
    noMetricsLayer: "Ninguna métrica en esta capa.",
    metricLabelPh: "Etiqueta",
    metricUnitPh: "Unid.",
    metricCurrentPh: "Actual",
    metricTargetPh: "Meta",
    metricRemove: "Quitar",
    metricRationalePh: "Justificación de la meta (¿por qué este objetivo?)",
    summaryEyebrow: "Resumen",
    sumAgent: "Agente",
    sumPlatform: "Plataforma",
    sumOwners: "Dueños",
    sumAutonomy: "Autonomía",
    sumMetrics: "Métricas propuestas",
    cancel: "Cancelar",
    back: "Volver",
    advance: "Avanzar",
    admitting: "Admitiendo…",
    admitBtn: "Admitir en la flota",
    toastDraftApplied: "Borrador aplicado",
    toastDraftAppliedDesc:
      "Los campos del registro fueron completados. Revisa cada paso antes de admitir.",
    toastNoUrlTitle: "Indica una dirección",
    toastNoUrlDesc: "Pega la URL de un repositorio Git o de un archivo público.",
    toastImportedTitle: "Material importado",
    toastImportedDesc: (n: number, truncated: boolean) =>
      `${n} archivo(s) cargado(s)${
        truncated ? " (contenido truncado por el límite)" : ""
      }. Revisa la lista y haz clic en Analizar con IA.`,
    toastImportFailTitle: "Fallo en la importación",
    toastImportFail429: "Límite de solicitudes alcanzado. Inténtalo de nuevo en unos minutos.",
    toastImportFail403:
      "Tu cuenta de GitHub no tiene acceso a este repositorio. Conecta o reconecta tu cuenta de GitHub y verifica los permisos.",
    toastImportFail404:
      "Repositorio o dirección no encontrados. Si es un repositorio privado, conecta tu cuenta de GitHub para importarlo.",
    toastImportFail422: "Ningún contenido relevante encontrado en la dirección.",
    toastImportFailDefault: "No fue posible importar el material de esa dirección.",
    toastPreAssessDoneTitle: "Pre-assessment completado",
    toastPreAssessDoneDesc: (platform: string, signals: number, confidence: number) =>
      `Stack: ${platform} · ${signals} señal(es) · confianza ${confidence}%. Revisa los campos y admite.`,
    notIdentified: "no identificado",
    toastPreAssessFailTitle: "El pre-assessment falló",
    toastPreAssessFailDesc: "Verifica la URL del repositorio e inténtalo de nuevo.",
    toastInsufficientTitle: "Material insuficiente",
    toastInsufficientDesc: "Pega el código y/o las definiciones de skills del agente.",
    toastTooLargeTitle: "Contenido demasiado grande",
    toastTooLargeDesc: (max: string) => `Redúcelo a un máximo de ${max} caracteres.`,
    toastIdentityIncompleteTitle: "Identidad incompleta",
    toastIdentityIncompleteDesc: "Indica al menos el nombre y el rol de la agente.",
    toastOwnersIncompleteTitle: "Cadena de dueños incompleta",
    toastOwnersIncompleteDesc: "Define dueño de negocio, dueño técnico y sponsor de gobernanza.",
    toastOwnersIncompleteSubmitDesc: "Sin los tres dueños, la agente no puede ir a producción.",
    toastAdmissionDoneTitle: "Admisión completada",
    toastAdmissionDoneDesc: "Expediente Laboral generado con éxito.",
    toastAdmissionErrTitle: "Error en la admisión",
    toastAdmissionErrDesc: "Ocurrió un error al registrar a la agente.",
    changeApproverLine: (name: string) => `Aprobador de cambios: ${name}`,
    dataSourceLine: (source: string) => `Fuente de datos: ${source}`,
    probationLine: (weeks: string) => `Período de probation: ${weeks} semanas`,
    bioFallback: (role: string) => `${role} en la flota.`,
  },
};

// A draft metric row in the wizard. `valueText` is the editing buffer for the
// optional reviewer-set starting value, kept as free text so pt-BR decimals
// (e.g. "4,2") can be typed without the input fighting the parser.
type MetricRow = Omit<DraftMetric, "value"> & { valueText?: string };

interface WizardData {
  name: string;
  tagline: string;
  role: string;
  platform: string;
  bio: string;
  shouldDo: string;
  shouldNotDo: string;
  businessOwner: string;
  technicalOwner: string;
  governanceSponsor: string;
  changeApprover: string;
  autonomyLevel: NonNullable<AgentInput["autonomyLevel"]>;
  autonomyNotes: string;
  limits: string;
  businessCaseDescription: string;
  baseline: string;
  targetPayback: string;
  dataSource: string;
  probationWeeks: string;
}

const INITIAL: WizardData = {
  name: "",
  tagline: "",
  role: "",
  platform: "openai-assistants",
  bio: "",
  shouldDo: "",
  shouldNotDo: "",
  businessOwner: "",
  technicalOwner: "",
  governanceSponsor: "",
  changeApprover: "",
  autonomyLevel: "escalates",
  autonomyNotes: "",
  limits: "",
  businessCaseDescription: "",
  baseline: "",
  targetPayback: "",
  dataSource: "",
  probationWeeks: "4",
};

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function StepField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A single file pulled in via the import-from-URL flow, kept selectable so the
// user can trim noise before spending an AI analysis on it.
interface ImportedFile {
  id: string;
  path: string;
  bytes: number;
  content: string;
  sourceType: "git" | "url";
  selected: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// The server concatenates git files as `===== <path> =====\n<body>` chunks
// joined by blank lines (see fetch-source.ts). Split that back into per-file
// bodies so each one can be reviewed and toggled independently. A single URL
// import has no markers and maps to one file.
function splitImportedFiles(
  content: string,
  files: { path: string; bytes: number }[],
  sourceType: "git" | "url",
): ImportedFile[] {
  const base = `${sourceType}-${Date.now()}`;
  if (sourceType === "url" || files.length <= 1) {
    return files.map((f, i) => ({
      id: `${base}-${i}`,
      path: f.path,
      bytes: f.bytes,
      content,
      sourceType,
      selected: true,
    }));
  }
  const parts = content.split(/^===== (.+?) =====$/m);
  const byPath = new Map<string, string>();
  for (let i = 1; i < parts.length; i += 2) {
    const path = parts[i]!.trim();
    const body = (parts[i + 1] ?? "").replace(/^\n/, "").replace(/\n+$/, "");
    byPath.set(path, body);
  }
  return files.map((f, i) => ({
    id: `${base}-${i}`,
    path: f.path,
    bytes: f.bytes,
    content: byPath.get(f.path) ?? "",
    sourceType,
    selected: true,
  }));
}

// Re-serialize selected imported files into the same chunk format the AI sees.
function serializeImportedFiles(files: ImportedFile[]): string {
  return files
    .filter((f) => f.selected)
    .map((f) =>
      f.sourceType === "git" ? `===== ${f.path} =====\n${f.content}` : f.content,
    )
    .join("\n\n");
}

export default function AdmissionPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { lang } = useLang();
  const t = L[lang];
  const locale = localeOf(lang);
  const createAgent = useCreateAgent();
  const analyze = useAnalyzeAgentSource();
  const fetchSource = useFetchAgentSource();
  const preAssess = usePreAssessAgentSource();
  const { data: connectors } = useListConnectors();
  const { data: githubStatus, isLoading: githubStatusLoading } =
    useGetGitHubStatus();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [metrics, setMetrics] = useState<MetricRow[] | null>(null);

  // AI assist (optional)
  const [aiOpen, setAiOpen] = useState(false);
  const [source, setSource] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [importTruncated, setImportTruncated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The text actually sent to the AI: manually pasted source plus the selected
  // imported files. Imported content is kept out of the textarea so the file
  // list stays the source of truth for what gets analyzed.
  const importedSource = useMemo(
    () => serializeImportedFiles(importedFiles),
    [importedFiles],
  );
  const effectiveSource = useMemo(
    () => [source.trim(), importedSource].filter(Boolean).join("\n\n"),
    [source, importedSource],
  );
  const selectedImportedCount = importedFiles.filter((f) => f.selected).length;

  const overLimit = effectiveSource.length > MAX_CONTENT_LENGTH;

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

    const updateMetric = (index: number, patch: Partial<MetricRow>) =>
      setMetrics((prev) =>
        prev ? prev.map((m, i) => (i === index ? { ...m, ...patch } : m)) : prev,
      );

    const removeMetric = (index: number) =>
      setMetrics((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));

    const addMetric = (layer: DraftMetricLayer) =>
      setMetrics((prev) => [
        ...(prev ?? []),
        { layer, label: "", unit: "%", target: "", valueText: "" },
      ]);

    // Parse the free-text value input (pt-BR comma decimals allowed) into a
    // number, or undefined when blank/invalid so the server seeds it instead.
    const parseMetricValue = (raw: string): number | undefined => {
      const trimmed = raw.trim();
      if (!trimmed) return undefined;
      const num = Number(trimmed.replace(/\./g, "").replace(/,/g, "."));
      return Number.isFinite(num) ? num : undefined;
    };

  const ownersComplete =
    data.businessOwner.trim() && data.technicalOwner.trim() && data.governanceSponsor.trim();

  const canAdvance = (() => {
    if (step === 0) return data.name.trim().length >= 2 && data.role.trim().length >= 2;
    if (step === 2) return Boolean(ownersComplete);
    return true;
  })();

  function applyDraft(d: AgentDraft) {
    setData((prev) => ({
      ...prev,
      name: d.name || prev.name,
      tagline: d.tagline || prev.tagline,
      role: d.role || prev.role,
      bio: d.bio || prev.bio,
      shouldDo: d.shouldDo?.length ? d.shouldDo.join("\n") : prev.shouldDo,
      shouldNotDo: d.shouldNotDo?.length ? d.shouldNotDo.join("\n") : prev.shouldNotDo,
      autonomyLevel: d.autonomyLevel ?? prev.autonomyLevel,
      autonomyNotes: d.autonomyNotes || prev.autonomyNotes,
      limits: d.limits?.length ? d.limits.join("\n") : prev.limits,
      businessCaseDescription: d.businessCase?.description || prev.businessCaseDescription,
      baseline: d.businessCase?.baseline || prev.baseline,
      targetPayback: d.businessCase?.targetPayback || prev.targetPayback,
    }));
    setMetrics(
      d.proposedMetrics
        ?.filter((m) => m.label.trim())
        .map((m) => ({
          layer: m.layer,
          label: m.label.trim(),
          unit: m.unit?.trim() || "%",
          target: m.target?.trim() ?? "",
          valueText:
            typeof m.value === "number" && Number.isFinite(m.value)
              ? String(m.value)
              : "",
          rationale: m.rationale,
        })) ?? null,
    );
    setAiOpen(false);
    toast({
      title: t.toastDraftApplied,
      description: t.toastDraftAppliedDesc,
    });
  }

  function onImportUrl() {
    const url = importUrl.trim();
    if (!url) {
      toast({
        variant: "destructive",
        title: t.toastNoUrlTitle,
        description: t.toastNoUrlDesc,
      });
      return;
    }
    fetchSource.mutate(
      { data: { url } },
      {
        onSuccess: (res) => {
          const parsed = splitImportedFiles(
            res.content,
            res.files,
            res.sourceType,
          );
          setImportedFiles((prev) => [...prev, ...parsed]);
          setImportTruncated((prev) => prev || res.truncated);
          setImportUrl("");
          toast({
            title: t.toastImportedTitle,
            description: t.toastImportedDesc(res.files.length, res.truncated),
          });
        },
        onError: (err) => {
          const status = (err as { status?: number } | null)?.status;
          toast({
            variant: "destructive",
            title: t.toastImportFailTitle,
            description:
              status === 429
                ? t.toastImportFail429
                : status === 403
                  ? t.toastImportFail403
                  : status === 404
                    ? t.toastImportFail404
                    : status === 422
                      ? t.toastImportFail422
                      : t.toastImportFailDefault,
          });
        },
      },
    );
  }

  // Pre-assessment (R4): heuristics over the repo, no AI key — fetches the
  // source server-side, frames metrics from the catalog and fills the whole
  // wizard via the same applyDraft used by the AI analyzer.
  function onPreAssess() {
    const url = importUrl.trim();
    if (!url) return;
    preAssess.mutate(
      { data: { url, nameHint: data.name || undefined } },
      {
        onSuccess: (r) => {
          applyDraft(r.draft);
          toast({
            title: t.toastPreAssessDoneTitle,
            description: t.toastPreAssessDoneDesc(
              r.platform ?? t.notIdentified,
              r.signals.length,
              Math.round(r.draft.confidence),
            ),
          });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: t.toastPreAssessFailTitle,
            description: t.toastPreAssessFailDesc,
          }),
      },
    );
  }

  function onAnalyze() {
    if (effectiveSource.trim().length < 10) {
      toast({
        variant: "destructive",
        title: t.toastInsufficientTitle,
        description: t.toastInsufficientDesc,
      });
      return;
    }
    if (overLimit) {
      toast({
        variant: "destructive",
        title: t.toastTooLargeTitle,
        description: t.toastTooLargeDesc(MAX_CONTENT_LENGTH.toLocaleString(locale)),
      });
      return;
    }
    analyze.mutate(
      {
        data: {
          content: effectiveSource,
          platform: data.platform || undefined,
          nameHint: data.name || undefined,
        },
      },
      { onSuccess: applyDraft },
    );
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSource((prev) => (prev ? `${prev}\n\n${text}` : text));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleImportedFile(id: string) {
    setImportedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)),
    );
  }

  function removeImportedFile(id: string) {
    setImportedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function setAllImportedSelected(selected: boolean) {
    setImportedFiles((prev) => prev.map((f) => ({ ...f, selected })));
  }

  function clearImportedFiles() {
    setImportedFiles([]);
    setImportTruncated(false);
  }

  function next() {
    if (!canAdvance) {
      if (step === 0) {
        toast({
          variant: "destructive",
          title: t.toastIdentityIncompleteTitle,
          description: t.toastIdentityIncompleteDesc,
        });
      } else if (step === 2) {
        toast({
          variant: "destructive",
          title: t.toastOwnersIncompleteTitle,
          description: t.toastOwnersIncompleteDesc,
        });
      }
      return;
    }
    setStep((s) => Math.min(s + 1, t.steps.length - 1));
  }

  function submit() {
    if (!ownersComplete) {
      setStep(2);
      toast({
        variant: "destructive",
        title: t.toastOwnersIncompleteTitle,
        description: t.toastOwnersIncompleteSubmitDesc,
      });
      return;
    }

    const autonomyNotes = [
      data.autonomyNotes.trim(),
      data.changeApprover.trim() ? t.changeApproverLine(data.changeApprover.trim()) : "",
    ]
      .filter(Boolean)
      .join("\n");

    const businessCaseDescription = [
      data.businessCaseDescription.trim(),
      data.dataSource.trim() ? t.dataSourceLine(data.dataSource.trim()) : "",
      data.probationWeeks.trim() ? t.probationLine(data.probationWeeks.trim()) : "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload: AgentInput = {
      name: data.name.trim(),
      role: data.role.trim(),
      platform: data.platform,
      bio: data.bio.trim() || data.tagline.trim() || t.bioFallback(data.role.trim()),
      tagline: data.tagline.trim() || undefined,
      shouldDo: toLines(data.shouldDo),
      shouldNotDo: toLines(data.shouldNotDo),
      autonomyLevel: data.autonomyLevel,
      autonomyNotes: autonomyNotes || undefined,
      limits: toLines(data.limits),
      businessOwner: data.businessOwner.trim() || undefined,
      technicalOwner: data.technicalOwner.trim() || undefined,
      governanceSponsor: data.governanceSponsor.trim() || undefined,
      baseline: data.baseline.trim() || undefined,
      targetPayback: data.targetPayback.trim() || undefined,
      businessCaseDescription: businessCaseDescription || undefined,
      ...(() => {
          const cleaned = (metrics ?? [])
            .filter((m) => m.label.trim())
            .map((m) => {
              const value = parseMetricValue(m.valueText ?? "");
              return {
                layer: m.layer,
                label: m.label.trim(),
                unit: m.unit.trim() || "%",
                target: m.target.trim(),
                ...(value !== undefined ? { value } : {}),
                rationale: m.rationale?.trim() || undefined,
              };
            });
          return cleaned.length > 0 ? { proposedMetrics: cleaned } : {};
        })(),
    };

    createAgent.mutate(
      { data: payload },
      {
        onSuccess: (agent) => {
          toast({
            title: t.toastAdmissionDoneTitle,
            description: t.toastAdmissionDoneDesc,
          });
          setLocation(`/agentes/${agent.agent.id}`);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: t.toastAdmissionErrTitle,
            description: t.toastAdmissionErrDesc,
          });
        },
      },
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: t.bcAccount }, { label: t.bcAdmission }]}>
      <div className="mx-auto max-w-3xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
        />

        {/* Stepper */}
        <div className="flex flex-wrap items-center gap-1.5">
          {t.steps.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                step === i
                  ? "bg-primary text-primary-foreground"
                  : step > i
                    ? "text-chart-1 hover:bg-secondary/60"
                    : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              {step > i ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="font-mono">{(i + 1).toString().padStart(2, "0")}</span>
              )}
              {label}
            </button>
          ))}
        </div>

        <Card className="p-6">
          {/* STEP 1 — Identidade */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">{t.identityTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.identitySub}</p>
              </div>

              {/* AI assist */}
              <div className="rounded-xl border border-card-border bg-secondary/30">
                <button
                  type="button"
                  onClick={() => setAiOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-chart-2" strokeWidth={1.75} />
                    {t.aiToggle}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      aiOpen && "rotate-180",
                    )}
                  />
                </button>
                {aiOpen && (
                  <div className="space-y-3 border-t border-card-border px-4 py-4">
                    <p className="text-xs text-muted-foreground">
                      {t.aiIntro}
                    </p>
                    <Textarea
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder={t.sourcePlaceholder}
                      className="min-h-[120px] font-mono text-xs"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.toml"
                      className="hidden"
                      onChange={onUpload}
                    />
                    <div className="space-y-1.5 rounded-md border border-card-border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                          {t.importHeader}
                        </span>
                        {githubStatusLoading ? (
                          <Pill tone="blue">{t.ghChecking}</Pill>
                        ) : githubStatus?.connected ? (
                          <Pill tone="sage">{t.ghConnected}</Pill>
                        ) : (
                          <Pill tone="ochre">{t.ghNotConnected}</Pill>
                        )}
                      </div>
                      {!githubStatusLoading && !githubStatus?.connected && (
                        <p className="text-xs text-muted-foreground">
                          {t.ghHintPre} <strong>{t.ghHintStrong}</strong>{t.ghHintPost}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (!fetchSource.isPending) onImportUrl();
                            }
                          }}
                          placeholder={t.importPlaceholder}
                          className="min-w-[16rem] flex-1 font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onImportUrl}
                          disabled={fetchSource.isPending}
                        >
                          {fetchSource.isPending ? t.importing : t.importBtn}
                        </Button>
                        <Button
                          type="button"
                          onClick={onPreAssess}
                          disabled={preAssess.isPending || !importUrl.trim()}
                        >
                          {preAssess.isPending ? t.preAssessing : t.preAssessBtn}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <strong>{t.preAssessStrong}</strong> {t.preAssessRest}
                      </p>
                    </div>

                    {importedFiles.length > 0 && (
                      <div className="space-y-3 rounded-md border border-card-border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                            {t.importedFilesHeader(selectedImportedCount, importedFiles.length)}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllImportedSelected(true)}
                              disabled={selectedImportedCount === importedFiles.length}
                            >
                              {t.selectAll}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllImportedSelected(false)}
                              disabled={selectedImportedCount === 0}
                            >
                              {t.clearSelection}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={clearImportedFiles}
                            >
                              {t.removeAll}
                            </Button>
                          </div>
                        </div>
                        {importTruncated && (
                          <p className="text-xs text-destructive">
                            {t.truncatedWarning}
                          </p>
                        )}
                        <ul className="max-h-64 space-y-1 overflow-y-auto">
                          {importedFiles.map((file) => (
                            <li
                              key={file.id}
                              className="flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-muted/60"
                            >
                              <Checkbox
                                id={`imported-${file.id}`}
                                checked={file.selected}
                                onCheckedChange={() => toggleImportedFile(file.id)}
                              />
                              <label
                                htmlFor={`imported-${file.id}`}
                                className="min-w-0 flex-1 cursor-pointer truncate font-mono text-xs"
                                title={file.path}
                              >
                                {file.path}
                              </label>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                {formatBytes(file.bytes)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => removeImportedFile(file.id)}
                              >
                                {t.remove}
                              </Button>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          {t.onlySelectedHint}
                        </p>
                      </div>
                    )}
                    <p
                      className={`text-right font-mono text-xs ${
                        overLimit ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {t.charCount(
                        effectiveSource.length.toLocaleString(locale),
                        MAX_CONTENT_LENGTH.toLocaleString(locale),
                      )}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {t.uploadFile}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={onAnalyze}
                        disabled={analyze.isPending || overLimit}
                      >
                        {analyze.isPending ? t.analyzing : t.analyzeBtn}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <StepField label={t.nameLabel}>
                  <Input
                    value={data.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder={t.namePh}
                  />
                </StepField>
                <StepField label={t.roleLabel}>
                  <Input
                    value={data.role}
                    onChange={(e) => set("role", e.target.value)}
                    placeholder={t.rolePh}
                  />
                </StepField>
              </div>
              <StepField label={t.taglineLabel} hint={t.taglineHint}>
                <Input
                  value={data.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  placeholder={t.taglinePh}
                />
              </StepField>
              <StepField label={t.platformLabel}>
                <Select value={data.platform} onValueChange={(v) => set("platform", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StepField>
            </div>
          )}

          {/* STEP 2 — Job Description */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">{t.jobTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.jobSub}</p>
              </div>
              <StepField label={t.descLabel} hint={t.descHint}>
                <Textarea
                  value={data.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder={t.descPh}
                  className="min-h-[100px]"
                />
              </StepField>
              <StepField label={t.shouldDoLabel} hint={t.shouldDoHint}>
                <Textarea
                  value={data.shouldDo}
                  onChange={(e) => set("shouldDo", e.target.value)}
                  placeholder={t.shouldDoPh}
                  className="min-h-[100px]"
                />
              </StepField>
              <StepField label={t.shouldNotDoLabel} hint={t.shouldNotDoHint}>
                <Textarea
                  value={data.shouldNotDo}
                  onChange={(e) => set("shouldNotDo", e.target.value)}
                  placeholder={t.shouldNotDoPh}
                  className="min-h-[100px]"
                />
              </StepField>
            </div>
          )}

          {/* STEP 3 — Responsabilidade */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">{t.respTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.respSub}
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <StepField label={t.businessOwnerLabel}>
                  <Input
                    value={data.businessOwner}
                    onChange={(e) => set("businessOwner", e.target.value)}
                    placeholder={t.businessOwnerPh}
                  />
                </StepField>
                <StepField label={t.technicalOwnerLabel}>
                  <Input
                    value={data.technicalOwner}
                    onChange={(e) => set("technicalOwner", e.target.value)}
                    placeholder={t.technicalOwnerPh}
                  />
                </StepField>
                <StepField label={t.sponsorLabel}>
                  <Input
                    value={data.governanceSponsor}
                    onChange={(e) => set("governanceSponsor", e.target.value)}
                    placeholder={t.sponsorPh}
                  />
                </StepField>
                <StepField label={t.approverLabel} hint={t.approverHint}>
                  <Input
                    value={data.changeApprover}
                    onChange={(e) => set("changeApprover", e.target.value)}
                    placeholder={t.approverPh}
                  />
                </StepField>
              </div>
              {!ownersComplete && (
                <Pill tone="ochre">{t.ownersIncompletePill}</Pill>
              )}
            </div>
          )}

          {/* STEP 4 — Autonomia */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">{t.autonomyTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.autonomySub}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {AUTONOMY_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("autonomyLevel", value)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      data.autonomyLevel === value
                        ? "border-primary bg-primary/5"
                        : "border-card-border hover:border-foreground/30",
                    )}
                  >
                    <div className="text-sm font-medium text-foreground">{t.autonomy[value].label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t.autonomy[value].desc}</div>
                  </button>
                ))}
              </div>
              <StepField label={t.autonomyNotesLabel} hint={t.autonomyNotesHint}>
                <Textarea
                  value={data.autonomyNotes}
                  onChange={(e) => set("autonomyNotes", e.target.value)}
                  placeholder={t.autonomyNotesPh}
                  className="min-h-[90px]"
                />
              </StepField>
              <StepField label={t.limitsLabel} hint={t.limitsHint}>
                <Textarea
                  value={data.limits}
                  onChange={(e) => set("limits", e.target.value)}
                  placeholder={t.limitsPh}
                  className="min-h-[90px]"
                />
              </StepField>
            </div>
          )}

          {/* STEP 5 — Origem */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">{t.originTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.originSub}
                </p>
              </div>
              <StepField label={t.bcaseLabel} hint={t.bcaseHint}>
                <Textarea
                  value={data.businessCaseDescription}
                  onChange={(e) => set("businessCaseDescription", e.target.value)}
                  placeholder={t.bcasePh}
                  className="min-h-[90px]"
                />
              </StepField>
              <div className="grid gap-5 sm:grid-cols-2">
                <StepField label={t.baselineLabel} hint={t.baselineHint}>
                  <Input
                    value={data.baseline}
                    onChange={(e) => set("baseline", e.target.value)}
                    placeholder={t.baselinePh}
                  />
                </StepField>
                <StepField label={t.paybackLabel} hint={t.paybackHint}>
                  <Input
                    value={data.targetPayback}
                    onChange={(e) => set("targetPayback", e.target.value)}
                    placeholder={t.paybackPh}
                  />
                </StepField>
              </div>
            </div>
          )}

          {/* STEP 6 — Conectar */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">{t.connectTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.connectSub}
                </p>
              </div>
              <StepField label={t.dataSourceLabel} hint={t.dataSourceHint}>
                <Select
                  value={data.dataSource || undefined}
                  onValueChange={(v) => set("dataSource", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.dataSourcePh} />
                  </SelectTrigger>
                  <SelectContent>
                    {(connectors ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                        {c.status === "connected" ? t.connectedSuffix : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StepField>
              <p className="text-xs text-muted-foreground">
                {t.manageLater}
              </p>
            </div>
          )}

          {/* STEP 7 — Probation */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">{t.probationTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.probationSub}
                </p>
              </div>
              <StepField label={t.probationDurationLabel}>
                <Select value={data.probationWeeks} onValueChange={(v) => set("probationWeeks", v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["2", "4", "6", "8"].map((w) => (
                      <SelectItem key={w} value={w}>
                        {t.weeks(w)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StepField>

              {metrics && metrics.length > 0 && (
                  <div className="space-y-4 rounded-xl border border-card-border bg-secondary/30 p-4">
                    <div>
                      <Eyebrow>{t.metricsGoalsEyebrow}</Eyebrow>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {t.metricsGoalsHint}
                      </p>
                    </div>
                    {LAYER_ORDER.map((layer) => {
                      const rows = metrics
                        .map((m, i) => ({ m, i }))
                        .filter((x) => x.m.layer === layer);
                      return (
                        <div key={layer} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                              {t.layers[layer]}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => addMetric(layer)}
                            >
                              {t.addMetric}
                            </Button>
                          </div>
                          {rows.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              {t.noMetricsLayer}
                            </p>
                          )}
                          {rows.map(({ m, i }) => (
                            <div
                              key={i}
                              className="space-y-2 rounded-md border border-card-border bg-background/40 p-2"
                            >
                              <div className="grid grid-cols-[1fr_4.5rem_5rem_6rem_auto] gap-2">
                                <Input
                                  value={m.label}
                                  onChange={(e) => updateMetric(i, { label: e.target.value })}
                                  placeholder={t.metricLabelPh}
                                  className="text-sm"
                                />
                                <Input
                                  value={m.unit}
                                  onChange={(e) => updateMetric(i, { unit: e.target.value })}
                                  placeholder={t.metricUnitPh}
                                  className="text-sm"
                                />
                                <Input
                                  value={m.valueText ?? ""}
                                  onChange={(e) =>
                                    updateMetric(i, { valueText: e.target.value })
                                  }
                                  inputMode="decimal"
                                  placeholder={t.metricCurrentPh}
                                  className="text-sm font-mono"
                                />
                                <Input
                                  value={m.target}
                                  onChange={(e) => updateMetric(i, { target: e.target.value })}
                                  placeholder={t.metricTargetPh}
                                  className="text-sm"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMetric(i)}
                                >
                                  {t.metricRemove}
                                </Button>
                              </div>
                              <Textarea
                                value={m.rationale ?? ""}
                                onChange={(e) => updateMetric(i, { rationale: e.target.value })}
                                placeholder={t.metricRationalePh}
                                className="min-h-[48px] text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Resumo */}
              <div className="rounded-xl border border-card-border bg-secondary/30 p-4">
                <Eyebrow>{t.summaryEyebrow}</Eyebrow>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.sumAgent}</dt>
                    <dd className="font-medium text-foreground">
                      {data.name || "—"} · {data.role || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.sumPlatform}</dt>
                    <dd className="font-medium text-foreground">
                      {PLATFORM_LABELS[data.platform] ?? data.platform}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.sumOwners}</dt>
                    <dd className="font-medium text-foreground">
                      {[data.businessOwner, data.technicalOwner, data.governanceSponsor]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.sumAutonomy}</dt>
                    <dd className="font-medium text-foreground">
                      {t.autonomy[data.autonomyLevel].label}
                    </dd>
                  </div>
                </dl>
                {metrics && metrics.length > 0 && (
                  <div className="mt-3">
                    <dt className="text-xs text-muted-foreground">{t.sumMetrics}</dt>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {LAYER_ORDER.filter((l) => metrics.some((m) => m.layer === l)).map((l) => (
                        <Pill key={l} tone="blue">
                          {t.layers[l]}
                        </Pill>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="mt-6 flex items-center justify-between border-t border-card-border pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (step === 0 ? setLocation("/agentes") : setStep((s) => s - 1))}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {step === 0 ? t.cancel : t.back}
            </Button>
            {step < t.steps.length - 1 ? (
              <Button type="button" onClick={next} disabled={!canAdvance}>
                {t.advance} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={createAgent.isPending}>
                {createAgent.isPending ? t.admitting : t.admitBtn}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
