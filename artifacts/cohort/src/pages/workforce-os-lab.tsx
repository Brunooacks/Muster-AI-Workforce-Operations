import { Suspense, lazy, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from "react";
import { useAuth, useClerk, useUser } from "@clerk/react";
import {
  getListAgentsQueryKey,
  getGetAgentQueryKey,
  getListProfessionalPlanDecisionsQueryKey,
  useGetAgent,
  useListAgents,
  useListProfessionalPlanDecisions,
  useReevaluateAgent,
  useRecordProfessionalPlanDecision,
  useUpdateProfessionalPlanAction,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BellRing,
  Bot,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  DatabaseZap,
  FileCheck2,
  GitBranch,
  Goal,
  House,
  Layers3,
  ListChecks,
  LogOut,
  Map as MapIcon,
  Radar,
  Radio,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdicionarAgenteScreen } from "@/pages/adicionar-agente";
import { EntregasScreen } from "@/pages/entregas";
import { PendenciasScreen } from "@/pages/pendencias";
import { MapaScreen } from "@/pages/mapa";
import { SHELL_NAV, SHELL_RODAPE, shellItemAtivo, seloDaTela, classeSelo } from "@/lib/shell-nav";
import { ShellBottomBar } from "@/components/shell/bottom-bar";
import { ContaBoundary, useConta } from "@/components/shell/conta";
import { PlatformStack, platformIdsFromSource } from "@/components/platform-badge";
import { MusterMark } from "@/components/logo";
import {
  WORKFORCE_NAV_ITEMS,
  isWorkforceScreen,
  navigationScreenForWorkforceScreen,
  resolveWorkforceRoute,
  routeForWorkforceScreen,
  type WorkforceScreen,
} from "@/lib/workforce-routing";
import {
  BenchmarksScreen,
  JourneysScreen,
  ManagerScreen,
  MetricsScreen,
  OnboardingScreen,
  SettingsScreen,
} from "@/pages/workforce-os-modules";
import { MixedTeamsScreen } from "@/pages/mixed-teams-workforce";
import { ConnectorsScreen } from "@/pages/connectors-workforce";
import { ExecutiveReportsScreen } from "@/pages/executive-reports-workforce";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/calculadora";
import {
  FRICCAO_ILUSTRATIVA,
  bulletDaMeta,
  coberturaDoAgente,
  metasDoAgente,
  motivoDoStatus,
  ordenarAgentes,
  statusDoAgente,
  type StatusAgente,
} from "@/lib/agentes";
import { BulletMeta, FriccaoEmpilhada, SeloCobertura, ChipStatus } from "@/components/shell/agentes-graficos";
import { AgentOutcomePanel } from "@/components/agent-outcome";
import { AgentContractPanel } from "@/components/agent-contract";
import { queryClient } from "@/lib/queryClient";
import {
  adaptApiAgent,
  type WorkforceContractMetric,
  type WorkforceProfessionalAgent,
} from "@/lib/workforce-agent-adapter";

// Telas ligadas à API e de conta: carregadas sob demanda para não pesar no
// bundle inicial (home, calculadora e telas de demonstração).
const OperationalMixedTeamsScreen = lazy(() =>
  import("@/pages/mixed-teams-operational").then((m) => ({ default: m.OperationalMixedTeamsScreen })),
);
const MetricasPage = lazy(() => import("@/pages/metricas"));
const BenchmarksPage = lazy(() => import("@/pages/benchmarks"));
const GovernancePage = lazy(() => import("@/pages/governanca"));
const JourneysPage = lazy(() => import("@/pages/journeys"));
const AdmissionPage = lazy(() => import("@/pages/admission"));
const AlertsPage = lazy(() => import("@/pages/alerts"));
const AccountSettingsPage = lazy(() => import("@/pages/configuracoes"));
const ProfilePage = lazy(() => import("@/pages/perfil"));
const ConectarPage = lazy(() => import("@/pages/conectar"));
const AdminConsolePage = lazy(() => import("@/pages/admin-console"));

function TelaCarregando() {
  return (
    <div className="p-6" role="status" aria-live="polite">
      <p className="text-sm text-[var(--wo-muted)]">Carregando…</p>
    </div>
  );
}

/** Telas que dependem da conta real (Clerk): no demo explicam em vez de quebrar. */
function SoComLogin({ titulo }: { titulo: string }) {
  return (
    <div className="p-4 sm:p-6">
      <Panel className="p-8">
        <h1 className="text-xl font-medium text-[var(--wo-text)]">{titulo}</h1>
        <p className="mt-2 text-sm text-[var(--wo-muted)]">
          Disponível com login. Na demonstração não há organização nem membros reais.
        </p>
      </Panel>
    </div>
  );
}

type Screen = WorkforceScreen;
export type PaletteId = "mineral" | "graphite" | "dracula" | "mocha";
type AgentStatus = "healthy" | "attention" | "critical" | "probation";
type PlanDecision = "approved" | "adjustment_requested" | "rejected";
type PlanActionTransition = "in_progress" | "blocked" | "completed" | "cancelled";

const productTokens: Record<PaletteId, CSSProperties> = {
  mineral: {
    "--background": "120 12% 95%",
    "--foreground": "157 23% 10%",
    "--border": "140 8% 85%",
    "--input": "140 8% 85%",
    "--ring": "176 77% 26%",
    "--card": "0 0% 100%",
    "--card-foreground": "157 23% 10%",
    "--card-border": "140 8% 85%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "157 23% 10%",
    "--primary": "176 77% 26%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "135 13% 94%",
    "--secondary-foreground": "157 23% 10%",
    "--muted": "135 13% 94%",
    "--muted-foreground": "150 6% 39%",
    "--accent": "135 13% 94%",
    "--accent-foreground": "157 23% 10%",
    "--chart-1": "176 77% 26%",
    "--chart-2": "93 52% 63%",
    // Versões de texto dos tons de status (chips), ≥4,5:1 no cartão e no cartão-2
    "--chart-2-text": "93 60% 24%",
    "--chart-3-text": "12 60% 38%",
    "--chart-4-text": "340 80% 38%",
    "--destructive-text": "12 60% 38%",
  } as CSSProperties,
  graphite: {
    "--background": "214 30% 5%",
    "--foreground": "198 33% 96%",
    "--border": "211 24% 21%",
    "--input": "211 24% 21%",
    "--ring": "201 100% 67%",
    "--card": "211 29% 10%",
    "--card-foreground": "198 33% 96%",
    "--card-border": "211 24% 21%",
    "--popover": "211 29% 10%",
    "--popover-foreground": "198 33% 96%",
    "--primary": "201 100% 67%",
    "--primary-foreground": "214 30% 5%",
    "--secondary": "212 28% 13%",
    "--secondary-foreground": "198 33% 96%",
    "--muted": "212 28% 13%",
    "--muted-foreground": "210 13% 60%",
    "--accent": "212 28% 13%",
    "--accent-foreground": "198 33% 96%",
    "--chart-1": "201 100% 67%",
    "--chart-2": "155 62% 69%",
    // Versões de texto dos tons de status (chips), ≥4,5:1 no cartão e no cartão-2
    "--chart-2-text": "155 62% 69%",
    "--chart-3-text": "350 100% 78%",
    "--chart-4-text": "4 85% 74%",
    "--destructive-text": "350 100% 78%",
  } as CSSProperties,
  dracula: {
    "--background": "231 15% 15%",
    "--foreground": "60 30% 96%",
    "--border": "232 14% 38%",
    "--input": "232 14% 38%",
    "--ring": "265 89% 78%",
    "--card": "232 15% 21%",
    "--card-foreground": "60 30% 96%",
    "--card-border": "232 14% 38%",
    "--popover": "232 15% 21%",
    "--popover-foreground": "60 30% 96%",
    "--primary": "265 89% 78%",
    "--primary-foreground": "231 15% 15%",
    "--secondary": "232 14% 31%",
    "--secondary-foreground": "60 30% 96%",
    "--muted": "232 14% 31%",
    "--muted-foreground": "232 42% 79%",
    "--accent": "232 14% 31%",
    "--accent-foreground": "60 30% 96%",
    "--chart-1": "265 89% 78%",
    "--chart-2": "135 94% 65%",
    // Versões de texto dos tons de status (chips), ≥4,5:1 no cartão e no cartão-2
    "--chart-2-text": "135 94% 65%",
    "--chart-3-text": "350 100% 82%",
    "--chart-4-text": "4 90% 80%",
    "--destructive-text": "350 100% 82%",
  } as CSSProperties,
  mocha: {
    "--background": "240 21% 12%",
    "--foreground": "226 64% 88%",
    "--border": "237 16% 23%",
    "--input": "237 16% 23%",
    "--ring": "217 92% 76%",
    "--card": "237 16% 16%",
    "--card-foreground": "226 64% 88%",
    "--card-border": "237 16% 23%",
    "--popover": "237 16% 16%",
    "--popover-foreground": "226 64% 88%",
    "--primary": "217 92% 76%",
    "--primary-foreground": "240 21% 12%",
    "--secondary": "237 16% 20%",
    "--secondary-foreground": "226 64% 88%",
    "--muted": "237 16% 20%",
    "--muted-foreground": "228 24% 72%",
    "--accent": "237 16% 20%",
    "--accent-foreground": "226 64% 88%",
    "--chart-1": "217 92% 76%",
    "--chart-2": "115 54% 76%",
    // Versões de texto dos tons de status (chips), ≥4,5:1 no cartão e no cartão-2
    "--chart-2-text": "115 54% 76%",
    "--chart-3-text": "350 100% 80%",
    "--chart-4-text": "4 85% 78%",
    "--destructive-text": "350 100% 80%",
  } as CSSProperties,
};

type ContractMetric = WorkforceContractMetric;
type ProfessionalAgent = WorkforceProfessionalAgent;

export const workforcePalettes: Record<PaletteId, CSSProperties> = {
  mineral: {
    ...productTokens.mineral,
    "--wo-bg": "#f2f4f1",
    "--wo-shell": "#fafbf8",
    "--wo-card": "#ffffff",
    "--wo-card-2": "#edf1ed",
    "--wo-line": "#d7ddd8",
    "--wo-text": "#14201c",
    "--wo-muted": "#5d6963",
    "--wo-primary": "#0f766e",
    "--wo-primary-ink": "#ffffff",
    "--wo-primary-soft": "#dbeee9",
    "--wo-accent": "#9dd36f",
    "--wo-accent-text": "#45702a",
    "--wo-accent-ink": "#13250f",
    "--wo-warning": "#996310",
    "--wo-danger": "#c14f43",
    "--wo-warning-text": "#845409",
    "--wo-danger-text": "#a23f36",
    colorScheme: "light",
  } as CSSProperties,
  graphite: {
    ...productTokens.graphite,
    "--wo-bg": "#080b0f",
    "--wo-shell": "#0c1117",
    "--wo-card": "#111820",
    "--wo-card-2": "#18212b",
    "--wo-line": "#293643",
    "--wo-text": "#f2f7fa",
    "--wo-muted": "#8b99a7",
    "--wo-primary": "#55c2ff",
    "--wo-primary-ink": "#061018",
    "--wo-primary-soft": "#102e3f",
    "--wo-accent": "#7ee2b8",
    "--wo-accent-text": "#7ee2b8",
    "--wo-accent-ink": "#061812",
    "--wo-warning": "#f4c45e",
    "--wo-danger": "#ff7a8a",
    "--wo-warning-text": "#f4c45e",
    "--wo-danger-text": "#ff7a8a",
    colorScheme: "dark",
  } as CSSProperties,
  dracula: {
    ...productTokens.dracula,
    "--wo-bg": "#21222c",
    "--wo-shell": "#282a36",
    "--wo-card": "#2d303e",
    "--wo-card-2": "#44475a",
    "--wo-line": "#56596e",
    "--wo-text": "#f8f8f2",
    "--wo-muted": "#aeb4db",
    "--wo-primary": "#bd93f9",
    "--wo-primary-ink": "#21222c",
    "--wo-primary-soft": "#45365e",
    "--wo-accent": "#50fa7b",
    "--wo-accent-text": "#50fa7b",
    "--wo-accent-ink": "#102716",
    "--wo-warning": "#f1fa8c",
    "--wo-danger": "#ff6b6b",
    "--wo-warning-text": "#f1fa8c",
    "--wo-danger-text": "#ffb3b3",
    colorScheme: "dark",
  } as CSSProperties,
  mocha: {
    ...productTokens.mocha,
    "--wo-bg": "#11111b",
    "--wo-shell": "#181825",
    "--wo-card": "#1e1e2e",
    "--wo-card-2": "#313244",
    "--wo-line": "#45475a",
    "--wo-text": "#cdd6f4",
    "--wo-muted": "#a6adc8",
    "--wo-primary": "#89b4fa",
    "--wo-primary-ink": "#11111b",
    "--wo-primary-soft": "#293550",
    "--wo-accent": "#a6e3a1",
    "--wo-accent-text": "#a6e3a1",
    "--wo-accent-ink": "#132414",
    "--wo-warning": "#f9e2af",
    "--wo-danger": "#f38ba8",
    "--wo-warning-text": "#f9e2af",
    "--wo-danger-text": "#f5a3bb",
    colorScheme: "dark",
  } as CSSProperties,
};

const demoAgents: ProfessionalAgent[] = [
  {
    id: "sofia",
    initials: "SO",
    name: "Sofia",
    role: "Especialista de Suporte N1",
    team: "Atendimento híbrido",
    purpose: "Resolver solicitações elegíveis com qualidade, transparência e baixa reincidência.",
    owner: "Patrícia Lima",
    platforms: ["zendesk-ai", "openai-assistants"],
    status: "critical",
    statusLabel: "Review necessário",
    contractFulfillment: 61,
    operationalHealth: 68,
    responsibilityCoverage: 83,
    evidenceConfidence: 91,
    reviewDue: "Hoje, 14:30",
    reviewUrgency: "42 min",
    volume: "22,1 mil",
    monthlyVolume: 236,
    monthlyCost: 49.56,
    observedMetricCount: 3,
    percepcao: { nota: 4.2, respostas: 14, positivas: 11, negativas: 3 },
    autonomy: "Supervisionada",
    duties: [
      "Identificar intenção e contexto mínimo do atendimento.",
      "Resolver somente solicitações cobertas pelo contrato operacional.",
      "Registrar as provas e comunicar o resultado ao cliente.",
    ],
    responsibilities: [
      "Manter resolução no primeiro contato acima de 75%.",
      "Escalonar risco, ambiguidade ou ausência de conhecimento.",
      "Evitar encerramento sem confirmação do resultado real.",
    ],
    boundaries: [
      "Não alterar dados financeiros sem aprovação.",
      "Não decidir exceções de política.",
      "Solicitar revisão humana com confiança abaixo de 70%.",
    ],
    metrics: [
      { label: "Resolução no primeiro contato", baseline: "68%", target: "≥ 75%", current: "61%", status: "off", source: "Zendesk · tickets", casos: 96 },
      { label: "Reabertura em 72 horas", baseline: "17%", target: "≤ 15%", current: "24%", status: "off", source: "Zendesk · eventos", casos: 61 },
      { label: "Escalonamento apropriado", baseline: "82%", target: "≥ 80%", current: "86%", status: "on", source: "Auditoria amostral", casos: 24 },
      { label: "Completude da prova", baseline: "88%", target: "≥ 95%", current: "91%", status: "watch", source: "Muster telemetry", casos: 30 },
    ],
    diagnosis: "Sofia executa o dever de responder rapidamente, mas deixou de cumprir a responsabilidade de confirmar resolução sustentável.",
    recommendation: "Revisar a base de conhecimento de cobrança e manter autonomia supervisionada até dois ciclos consecutivos dentro da meta.",
  },
  {
    id: "julia",
    initials: "JU",
    name: "Júlia",
    role: "Analista de Qualificação Inbound",
    team: "Revenue Operations",
    purpose: "Entregar oportunidades aderentes ao ICP sem transferir desperdício para o time comercial.",
    owner: "Renata Silva",
    platforms: ["salesforce-agentforce", "openai-assistants"],
    status: "attention",
    statusLabel: "Mentoria ativa",
    contractFulfillment: 72,
    operationalHealth: 79,
    responsibilityCoverage: 88,
    evidenceConfidence: 84,
    reviewDue: "Hoje, 17:00",
    reviewUrgency: "3 h",
    volume: "14,2 mil",
    monthlyVolume: 50,
    monthlyCost: 11,
    observedMetricCount: 1,
    percepcao: { nota: 4, respostas: 8, positivas: 7, negativas: 1 },
    autonomy: "Supervisionada",
    duties: ["Enriquecer o contexto do lead.", "Aplicar critérios de qualificação vigentes.", "Registrar motivo e confiança da decisão."],
    responsibilities: ["Preservar qualidade do pipeline.", "Evitar falso positivo acima de 5%.", "Escalonar campanhas sem regra de ICP válida."],
    boundaries: ["Não descartar contas estratégicas.", "Não alterar critérios comerciais.", "Solicitar revisão em campanhas novas."],
    metrics: [
      { label: "Conversão qualificada", baseline: "24%", target: "≥ 25%", current: "21%", status: "off", source: "Salesforce · pipeline", casos: 41 },
      { label: "Falso positivo na qualificação", baseline: "6%", target: "≤ 5%", current: "11%", status: "off", source: "Feedback do vendedor", casos: 18 },
      { label: "Tempo até o primeiro contato", baseline: "7 min", target: "< 5 min", current: "3 min", status: "on", source: "Salesforce · eventos", casos: 52 },
    ],
    diagnosis: "A rapidez foi preservada, mas o critério de fit não acompanhou a nova campanha enterprise.",
    recommendation: "Recalibrar regras por campanha e revisar amostra com Revenue Operations antes da próxima janela.",
  },
  {
    id: "vega",
    initials: "VE",
    name: "Vega",
    role: "Operadora de Entrega Contínua",
    team: "Engenharia assistida",
    purpose: "Orquestrar entregas confiáveis e recuperar falhas com rastreabilidade e rollback seguro.",
    owner: "Caio Mendes",
    platforms: ["github", "kubernetes", "opentelemetry"],
    status: "healthy",
    statusLabel: "Contrato cumprido",
    contractFulfillment: 91,
    operationalHealth: 94,
    responsibilityCoverage: 96,
    evidenceConfidence: 97,
    reviewDue: "Em 12 dias",
    reviewUrgency: "No prazo",
    volume: "8,7 mil",
    monthlyVolume: 9,
    monthlyCost: 3.96,
    observedMetricCount: 2,
    percepcao: { nota: 4.8, respostas: 5, positivas: 5, negativas: 0 },
    autonomy: "Autônoma",
    duties: ["Validar pré-condições de deploy.", "Publicar em etapas graduais.", "Acionar a reversão ao romper os limites combinados."],
    responsibilities: ["Manter taxa de sucesso acima de 95%.", "Garantir prova por entrega.", "Notificar o responsável em recuperação automática."],
    boundaries: ["Não promover mudança sem testes.", "Não ignorar bloqueios de segurança.", "Não alterar os limites combinados sem comitê."],
    metrics: [
      { label: "Publicações sem reversão", baseline: "91%", target: "≥ 95%", current: "97%", status: "on", source: "Integração contínua", casos: 9 },
      { label: "Completude da prova", baseline: "94%", target: "≥ 99%", current: "99%", status: "on", source: "OpenTelemetry", casos: 9 },
    ],
    diagnosis: "Vega cumpre o contrato com prova consistente e pode assumir maior volume dentro dos mesmos limites.",
    recommendation: "Promover gradualmente o volume, preservando rollback automático e revisão quinzenal.",
  },
  {
    id: "reviewer",
    initials: "TÉ",
    name: "Téo",
    role: "Especialista de Revisão de PR",
    team: "Engenharia assistida",
    purpose: "Aumentar a cobertura de revisão sem elevar regressões ou reduzir responsabilidade humana.",
    owner: "Marina Costa",
    platforms: ["github-copilot", "sentry", "linear"],
    status: "attention",
    statusLabel: "Mentoria ativa",
    contractFulfillment: 76,
    operationalHealth: 84,
    responsibilityCoverage: 89,
    evidenceConfidence: 88,
    reviewDue: "Amanhã",
    reviewUrgency: "19 h",
    volume: "486 PRs",
    monthlyVolume: 5,
    monthlyCost: 1.3,
    observedMetricCount: 1,
    percepcao: { nota: 3, respostas: 6, positivas: 4, negativas: 2 },
    autonomy: "Supervisionada",
    duties: ["Inspecionar mudanças elegíveis.", "Classificar riscos.", "Justificar recomendações."],
    responsibilities: ["Cobrir mais de 90% dos PRs elegíveis.", "Manter defeito escapado abaixo de 5%.", "Exigir gate humano em módulos críticos."],
    boundaries: ["Não aprovar merge.", "Não dispensar testes obrigatórios.", "Não revisar segredos ou dados não autorizados."],
    metrics: [
      { label: "Cobertura de revisão", baseline: "76%", target: "≥ 90%", current: "92%", status: "on", source: "GitHub", casos: 5 },
      { label: "Defeito escapado", baseline: "6%", target: "≤ 5%", current: "8%", status: "off", source: "Incidentes atribuídos", casos: 12 },
    ],
    diagnosis: "A cobertura cresceu, mas a profundidade de revisão não acompanhou o risco de módulos concorrentes.",
    recommendation: "Aplicar política por risco e manter gate humano para módulos críticos.",
  },
  {
    id: "maia",
    initials: "MA",
    name: "Maia",
    role: "Facilitadora de Onboarding",
    team: "People Operations",
    purpose: "Concluir onboarding com clareza, conformidade e boa experiência para cada pessoa.",
    owner: "Ana Reis",
    platforms: ["openai-assistants", "hris"],
    status: "healthy",
    statusLabel: "Contrato cumprido",
    contractFulfillment: 93,
    operationalHealth: 89,
    responsibilityCoverage: 94,
    evidenceConfidence: 86,
    reviewDue: "Em 8 dias",
    reviewUrgency: "No prazo",
    volume: "1,8 mil",
    monthlyVolume: 8,
    monthlyCost: 1.44,
    observedMetricCount: 2,
    percepcao: { nota: 5, respostas: 3, positivas: 3, negativas: 0 },
    autonomy: "Autônoma",
    duties: ["Orientar próximos passos.", "Confirmar documentos.", "Escalonar exceções."],
    responsibilities: ["Evitar pendências silenciosas.", "Preservar experiência humana.", "Registrar consentimento e provas."],
    boundaries: ["Não decidir exceções trabalhistas.", "Não acessar dados fora do escopo.", "Não concluir onboarding incompleto."],
    metrics: [
      { label: "Onboardings completos", baseline: "89%", target: "≥ 92%", current: "93%", status: "on", source: "HRIS", casos: 8 },
      { label: "Experiência do colaborador", baseline: "4,1/5", target: "≥ 4/5", current: "4,5/5", status: "on", source: "Pesquisa pós-ciclo", casos: 3 },
    ],
    diagnosis: "Maia cumpre propósito e responsabilidades com impacto humano positivo.",
    recommendation: "Manter contrato e ampliar volume com acompanhamento mensal da experiência.",
  },
  {
    id: "dora",
    initials: "DO",
    name: "Dora",
    role: "Analista de Conciliação",
    team: "Backoffice financeiro",
    purpose: "Conciliar transações com precisão, auditabilidade e tratamento correto de exceções.",
    owner: "Lucas Prado",
    platforms: ["erp", "vllm"],
    status: "probation",
    statusLabel: "Em experiência",
    contractFulfillment: 48,
    operationalHealth: 56,
    responsibilityCoverage: 64,
    evidenceConfidence: 71,
    reviewDue: "Vencido",
    reviewUrgency: "2 h atrasado",
    volume: "3,2 mil",
    monthlyVolume: 4,
    monthlyCost: 1.64,
    observedMetricCount: 0,
    percepcao: { nota: 4.5, respostas: 2, positivas: 2, negativas: 0 },
    autonomy: "Assistida",
    duties: ["Comparar registros.", "Classificar divergências.", "Encaminhar exceções com contexto."],
    responsibilities: ["Manter precisão acima de 98%.", "Não ocultar divergências.", "Produzir trilha auditável."],
    boundaries: ["Não efetuar baixa financeira.", "Não alterar origem dos dados.", "Não resolver exceções sem responsável."],
    metrics: [
      { label: "Precisão de conciliação", baseline: "92%", target: "≥ 98%", current: "89%", status: "off", source: "ERP · amostra auditada", casos: 0 },
      { label: "Exceções com prova", baseline: "74%", target: "≥ 95%", current: "71%", status: "off", source: "Muster · prova", casos: 0 },
      { label: "Tempo até a primeira exceção do dia", baseline: "6 h", target: "", current: "4 h", status: "off", source: "ERP · amostra auditada", casos: 0 },
    ],
    diagnosis: "Dora ainda não demonstra consistência suficiente para cumprir a função acordada.",
    recommendation: "Reduzir escopo, corrigir instrumentação e repetir período de experiência com amostra mínima.",
  },
];

function Panel({ children, className, ...rest }: ComponentPropsWithoutRef<"section">) {
  return (
    <section {...rest} className={cn("rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)]", className)}>
      {children}
    </section>
  );
}

function AppHeader({ labMode, screen }: { labMode: boolean; screen: Screen }) {
  const selo = seloDaTela(screen);

  return (
    <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--wo-line)] bg-[var(--wo-shell)] px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={labMode ? "/prototipos" : "/comando"} className="inline-flex items-center gap-2 text-xs text-[var(--wo-muted)] transition-colors hover:text-[var(--wo-text)]">
          <ArrowLeft className="h-4 w-4" /> {labMode ? "Laboratório" : "Operação"}
        </Link>
        <span className="hidden h-4 w-px bg-[var(--wo-line)] sm:block" />
        <span className="truncate text-sm font-medium text-[var(--wo-text)]">
          <span className="sm:hidden">Muster</span>
          <span className="hidden sm:inline">Muster Workforce OS</span>
        </span>
        {selo && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]",
              classeSelo(selo),
            )}
          >
            {selo}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 text-[11px] text-[var(--wo-accent-text)] sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-current" /> Supervisão contínua
        </span>
        <div className="hidden items-center gap-1 md:flex" aria-label="Adoção e novidades">
          <Link
            href="/guia"
            aria-label="Abrir onboarding"
            aria-current={screen === "onboarding" ? "page" : undefined}
            data-testid="adoption-onboarding-link"
            className={cn("inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[10px] font-medium transition-colors", screen === "onboarding" ? "bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]" : "text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)] hover:text-[var(--wo-text)]")}
          >
            <BookOpenCheck className="h-3.5 w-3.5" /> Aprender
          </Link>
          <Link
            href="/guia/novidades"
            aria-label="Abrir novidades da plataforma"
            data-testid="adoption-updates-link"
            className="relative inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[10px] font-medium text-[var(--wo-muted)] transition-colors hover:bg-[var(--wo-card-2)] hover:text-[var(--wo-text)]"
          >
            <BellRing className="h-3.5 w-3.5" /> Novidades
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--wo-accent)]" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

const workforceNavIcons: Record<Screen, typeof House> = {
  today: House,
  entregas: ListChecks,
  mapa: MapIcon,
  onboarding: ClipboardCheck,
  reports: FileCheck2,
  portfolio: Layers3,
  professional: BriefcaseBusiness,
  metrics: Radar,
  teams: Users,
  journeys: GitBranch,
  benchmarks: Target,
  connectors: DatabaseZap,
  settings: ShieldCheck,
  admission: UserPlus,
  alerts: ShieldAlert,
  admin: Building2,
  accountSettings: Settings,
  profile: UserCircle,
  connection: Radio,
};

function NavigationRail({
  screen,
  navigate,
  labMode,
}: {
  screen: Screen;
  navigate: (screen: Screen) => void;
  labMode: boolean;
}) {
  const conta = useConta();
  const ativo = shellItemAtivo(screen);

  return (
    <aside className="sticky top-0 hidden h-screen w-[68px] shrink-0 flex-col overflow-y-auto border-r border-border bg-background md:flex xl:w-[220px]">
      <div className="flex items-center justify-center gap-3 px-2 py-3 xl:justify-start xl:px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" data-testid="muster-brand-mark"><MusterMark className="h-7 w-7" /></span>
        <span className="hidden xl:block"><strong className="block text-sm font-medium text-foreground">Muster</strong><span className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">AI Workforce</span></span>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1 px-2 xl:px-3" aria-label="Menu principal">
        {SHELL_NAV.map((item) => {
          const Icon = workforceNavIcons[item.screen];
          const active = ativo?.screen === item.screen;
          const classes = cn(
            "relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] transition-colors",
            active
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          );
          const conteudo = (
            <>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden xl:block">{item.label}</span>
              {active && (
                <span className="absolute right-2 hidden h-1.5 w-1.5 rounded-full bg-primary xl:block" aria-hidden="true" />
              )}
            </>
          );
          return labMode ? (
            <button
              key={item.screen}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={active}
              onClick={() => navigate(item.screen)}
              className={classes}
            >
              {conteudo}
            </button>
          ) : (
            <Link
              key={item.screen}
              href={item.path}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={classes}
            >
              {conteudo}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border px-2 py-3 xl:px-3">
        <Link
          href={SHELL_RODAPE.path}
          aria-label={SHELL_RODAPE.label}
          title={SHELL_RODAPE.label}
          className="grid min-h-10 w-full place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground xl:grid-cols-[28px_1fr] xl:justify-items-start xl:px-3"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden text-[11px] xl:block">{SHELL_RODAPE.label}</span>
          <span className="hidden rounded-full border border-primary/50 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-primary xl:ml-auto xl:block">
            {SHELL_RODAPE.selo}
          </span>
        </Link>
        <Link href="/perfil" aria-label="Abrir perfil" className="mt-2 flex items-center justify-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-secondary/60 xl:justify-start xl:px-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-secondary text-[10px] font-medium text-foreground">{conta.iniciais}</div>
          <span className="hidden min-w-0 flex-1 xl:block"><strong className="block truncate text-[10px] font-medium text-foreground">{conta.nome}</strong><span className="mt-0.5 block text-[9px] text-muted-foreground">Sessão autenticada</span></span>
        </Link>
        <button
          type="button"
          aria-label="Sair e voltar para a página inicial"
          title="Sair e voltar para a página inicial"
          onClick={conta.sair}
          className="mt-2 grid min-h-10 w-full place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive-text xl:grid-cols-[28px_1fr] xl:justify-items-start xl:px-3"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden text-[11px] xl:block">Sair para a página inicial</span>
        </button>
      </div>
    </aside>
  );
}

function TodayScreen({ selectAgent }: { selectAgent: (agentId: string) => void }) {
  const priorityAgents = demoAgents.filter((agent) => agent.status === "critical" || agent.status === "attention");
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent-text)]">Gestão da força de trabalho</div>
          <h1 className="mt-2 max-w-4xl text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-5xl">
            Três profissionais precisam de revisão para continuar cumprindo o combinado.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--wo-muted)]">
            O Muster prioriza desvios de propósito, responsabilidade e limites de atuação. Valor financeiro aparece quando for relevante, nunca como única medida de desempenho.
          </p>
          <div className="mt-4 flex max-w-4xl flex-wrap gap-2">
            {["Propósito", "Qualidade técnica", "Confiabilidade", "Governança", "Experiência humana", "Economia · opcional"].map((lens) => (
              <span key={lens} className="rounded-full border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-2.5 py-1 text-[10px] text-[var(--wo-muted)]">{lens}</span>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => selectAgent("sofia")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">
          Iniciar reviews <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Cumprimento dos contratos", "82%", "+4 pontos percentuais no trimestre", ClipboardCheck],
          ["Responsabilidades atendidas", "91%", "23 profissionais dentro da meta", UserCheck],
          ["Reviews necessários", "3", "1 SLA crítico hoje", Clock3],
          ["Prova confiável", "89%", "telemetria e auditoria válidas", DatabaseZap],
        ].map(([label, value, detail, Icon]) => (
          <Panel key={label as string} className="p-4">
            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">
              <span>{label as string}</span><Icon className="h-4 w-4" />
            </div>
            <strong className="mt-4 block text-3xl font-medium tracking-tight text-[var(--wo-text)]">{value as string}</strong>
            <span className="mt-2 block text-[11px] text-[var(--wo-muted)]">{detail as string}</span>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.35fr_.65fr]">
        <div className="space-y-3">
          <Panel className="overflow-hidden border-[var(--wo-primary)] bg-[linear-gradient(135deg,var(--wo-primary-soft),var(--wo-card))] p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--wo-primary)]"><Sparkles className="h-4 w-4" /> Leitura do Muster</span>
              <span className="text-[10px] text-[var(--wo-muted)]">Atualizado há 2 min</span>
            </div>
            <h2 className="mt-5 max-w-3xl text-2xl font-medium tracking-[-0.03em] text-[var(--wo-text)]">
              Sofia continua executando tarefas, mas deixou de cumprir parte central da função: confirmar resolução sustentável.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--wo-muted)]">
              O tempo médio melhorou, porém a reabertura em 72 horas atingiu 24%. A recomendação é corrigir conhecimento e acompanhar dois ciclos antes de qualquer ampliação de autonomia.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {["Propósito: 61%", "Responsabilidades: 83%", "Confiança: 91%"].map((item) => <div key={item} className="rounded-xl bg-[color-mix(in_srgb,var(--wo-card)_68%,transparent)] px-3 py-2.5 text-xs font-medium text-[var(--wo-text)]">{item}</div>)}
            </div>
          </Panel>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Profissionais ativos", "26", "4 equipes · 3 jornadas"],
              ["Autonomia dentro do contrato", "87%", "+6 pontos percentuais no trimestre"],
              ["Reviews concluídos no prazo", "91%", "2 pendências abertas"],
            ].map(([label, value, detail]) => (
              <Panel key={label} className="p-4">
                <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span>
                <strong className="mt-2 block text-2xl font-medium text-[var(--wo-text)]">{value}</strong>
                <span className="mt-1 block text-[10px] text-[var(--wo-muted)]">{detail}</span>
              </Panel>
            ))}
          </div>
        </div>

        <Panel className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-sm font-medium text-[var(--wo-text)]">Fila de gestão</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Prioridade por desvio e prazo</p></div>
            <Radar className="h-4 w-4 text-[var(--wo-primary)]" />
          </div>
          <div className="mt-4 space-y-2">
            {priorityAgents.map((agent) => (
              <button key={agent.id} type="button" onClick={() => selectAgent(agent.id)} className="w-full rounded-xl border border-transparent bg-[var(--wo-card-2)] p-3 text-left transition-colors hover:border-[var(--wo-primary)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--wo-text)]">{agent.name} · {agent.role}</span>
                  <span className="text-[10px] text-[var(--wo-warning-text)]">{agent.reviewUrgency}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">{agent.diagnosis}</p>
                <div className="mt-2 flex items-center justify-between text-[10px]"><span className="text-[var(--wo-accent-text)]">Contrato {agent.contractFulfillment}%</span><ChevronRight className="h-3.5 w-3.5 text-[var(--wo-muted)]" /></div>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PortfolioMatrix({ agents, selectedAgentId, onSelect }: { agents: ProfessionalAgent[]; selectedAgentId: string; onSelect: (agentId: string) => void }) {
  return (
    <div className="relative h-[360px] overflow-hidden rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card-2)]">
      <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--wo-line)]" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--wo-line)]" />
      <span className="absolute right-4 top-3 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-accent-text)]">Expandir responsabilidades</span>
      <span className="absolute left-4 top-3 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-warning-text)]">Mentorar</span>
      <span className="absolute bottom-3 left-4 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-danger-text)]">Rever função</span>
      <span className="absolute bottom-3 right-4 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-muted)]">Corrigir operação</span>
      {agents.map((agent) => {
        const size = Math.max(38, Math.min(58, Number.parseFloat(agent.volume.replace(/[^0-9,.]/g, "").replace(",", ".")) || 42));
        return (
          <button
            key={agent.id}
            type="button"
            aria-label={`${agent.name}: propósito ${agent.contractFulfillment}, saúde ${agent.operationalHealth}`}
            onClick={() => onSelect(agent.id)}
            className={cn("absolute grid -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border-2 text-[10px] font-medium text-[var(--wo-text)] shadow-lg transition-transform hover:scale-105", selectedAgentId === agent.id && "ring-4 ring-[var(--wo-primary-soft)]")}
            style={{
              left: `${agent.operationalHealth}%`,
              bottom: `${agent.contractFulfillment}%`,
              width: size,
              height: size,
              borderColor: agent.status === "critical" ? "var(--wo-danger)" : agent.status === "attention" ? "var(--wo-warning)" : "var(--wo-accent)",
              background: "var(--wo-card)",
            }}
          >
            {agent.initials}
          </button>
        );
      })}
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-[var(--wo-muted)]">Saúde operacional →</span>
      <span className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-[var(--wo-muted)]">Cumprimento do propósito →</span>
    </div>
  );
}

function PortfolioScreen({ agents, selectedAgent, onSelect, openProfessional, isLoading, isError, operational = false }: { agents: ProfessionalAgent[]; selectedAgent: ProfessionalAgent | null; onSelect: (agentId: string) => void; openProfessional: (agentId: string) => void; isLoading: boolean; isError: boolean; operational?: boolean }) {
  const linhas = ordenarAgentes(agents.map((agent) => ({ agent, status: statusDoAgente(agent) })));
  const totalEntregas = agents.reduce((soma, agent) => soma + (agent.monthlyVolume ?? 0), 0);
  const coberturas = (["fechada", "parcial", "aberta"] as const).map((estado) => ({
    estado,
    quantidade: agents.filter((agent) => coberturaDoAgente(agent) === estado).length,
  }));
  const semAgentes = !isLoading && !isError && agents.length === 0;

  if (isLoading) {
    return <div className="space-y-4 p-4 sm:p-6"><Panel className="p-8 text-sm text-[var(--wo-muted)]">Carregando agentes reais do tenant…</Panel></div>;
  }
  if (isError) {
    return <div className="space-y-4 p-4 sm:p-6"><Panel className="border-[var(--wo-danger)] p-8"><h2 className="text-lg font-medium text-[var(--wo-text)]">Não foi possível carregar os agentes</h2><p className="mt-2 text-sm text-[var(--wo-muted)]">A tela não substitui dados indisponíveis por demonstrações. Verifique API, autenticação e tenant.</p></Panel></div>;
  }
  if (semAgentes) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent-text)]">Operação · últimos 30 dias</div>
        <Panel className="p-8">
          <h2 className="text-lg font-medium text-[var(--wo-text)]">Nenhum agente ainda.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--wo-muted)]">Adicione o primeiro agente para acompanhar o que ele entregou, a prova e o custo. Os primeiros dados aparecem após a primeira execução.</p>
          <Link href="/admissao" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><UserPlus className="h-4 w-4" /> Adicionar agente</Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6" data-testid="agentes-lista">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent-text)]">Operação · últimos 30 dias</div>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-4xl">Agentes</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--wo-muted)]">O que cada agente entregou, quanto custou e o que ainda precisa da sua decisão. Quem está fora do combinado vem primeiro.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!operational && <Badge variant="illustrative">Dados ilustrativos</Badge>}
          <Link href="/admissao" className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-3 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><UserPlus className="h-4 w-4" /> Adicionar agente</Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
        <Panel className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-[var(--wo-text)]">Fricção por tipo</h2>
            <span className="text-[10px] text-[var(--wo-muted)]">execuções que precisaram de mais de uma tentativa</span>
          </div>
          <FriccaoEmpilhada
            segmentos={operational ? [] : FRICCAO_ILUSTRATIVA}
            totalEntregas={operational ? (totalEntregas || null) : 312}
            periodo="out/26"
            vazio="Sem fricção registrada nos últimos 30 dias. Ela aparece quando uma entrega precisa de nova tentativa."
          />
        </Panel>
        <Panel className="p-4">
          <h2 className="text-sm font-medium text-[var(--wo-text)]">Prova das metas</h2>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <strong className="font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{coberturas[0]!.quantidade}</strong>
            <span className="text-xs text-[var(--wo-muted)]">de {agents.length} agentes com cobertura fechada</span>
          </div>
          <ul className="mt-3 space-y-2">
            {coberturas.map((item) => (
              <li key={item.estado} className="flex items-center justify-between gap-2 text-[11px]">
                <SeloCobertura cobertura={item.estado} />
                <span className="font-mono text-[var(--wo-muted)]">{item.quantidade} {item.quantidade === 1 ? "agente" : "agentes"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] leading-relaxed text-[var(--wo-muted)]">
            Cobertura fecha quando toda meta do agente tem prova registrada no período.
          </p>
        </Panel>
      </div>

      <Panel className="overflow-hidden" data-testid="agentes-tabela">
        <div className="border-b border-[var(--wo-line)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--wo-text)]">Lista de agentes</h2>
          <p className="mt-1 text-[10px] text-[var(--wo-muted)]">Colunas: agente · função, responsável, entregas (30 dias), gasto (30 dias), metas atingidas, cobertura e próxima revisão.</p>
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">
                <th className="px-4 py-3 font-normal">Agente · função</th>
                <th className="px-3 py-3 font-normal">Responsável</th>
                <th className="px-3 py-3 text-right font-normal">Entregas (30 d)</th>
                <th className="px-3 py-3 text-right font-normal">Gasto (30 d)</th>
                <th className="px-3 py-3 font-normal">Metas atingidas</th>
                <th className="px-3 py-3 font-normal">Cobertura</th>
                <th className="px-3 py-3 font-normal">Próxima revisão</th>
                <th className="px-3 py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ agent, status }) => {
                const metas = metasDoAgente(agent);
                const cobertura = coberturaDoAgente(agent);
                const custoPorEntrega = agent.monthlyVolume && agent.monthlyCost != null
                  ? agent.monthlyCost / agent.monthlyVolume
                  : null;
                return (
                  <tr key={agent.id} className="border-t border-[var(--wo-line)] transition-colors hover:bg-[var(--wo-card-2)]">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => onSelect(agent.id)} className="flex items-center gap-3 text-left">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--wo-primary-soft)] text-[10px] font-medium text-[var(--wo-primary)]">{agent.initials}</span>
                        <span className="min-w-0">
                          <strong className="block font-medium text-[var(--wo-text)]">{agent.name}</strong>
                          <span className="mt-1 block truncate text-[10px] text-[var(--wo-muted)]">{agent.role}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <ChipStatus status={status} />
                            <span className="text-[9px] text-[var(--wo-muted)]">Cumpre {metas.rotulo}</span>
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-[var(--wo-muted)]">{agent.owner}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--wo-text)]">{agent.monthlyVolume?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="block font-mono tabular-nums text-[var(--wo-text)]">{agent.monthlyCost != null ? formatBRL(agent.monthlyCost) : "—"}</span>
                      <span className="mt-0.5 block text-[9px] text-[var(--wo-muted)]">{custoPorEntrega != null ? `${formatBRL(custoPorEntrega)} por entrega` : "sem custo registrado"}</span>
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-[var(--wo-text)]">{metas.rotulo}</td>
                    <td className="px-3 py-3"><SeloCobertura cobertura={cobertura} /></td>
                    <td className="px-3 py-3 text-[var(--wo-muted)]">{agent.reviewDue}</td>
                    <td className="px-3 py-3">
                      <button type="button" aria-label={`Abrir prontuário de ${agent.name}`} onClick={() => openProfessional(agent.id)} className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-primary-soft)] hover:text-[var(--wo-text)]"><ChevronRight className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-[var(--wo-line)] sm:hidden">
          {linhas.map(({ agent, status }) => {
            const metas = metasDoAgente(agent);
            const cobertura = coberturaDoAgente(agent);
            return (
              <li key={agent.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--wo-primary-soft)] text-[10px] font-medium text-[var(--wo-primary)]">{agent.initials}</span>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-medium text-[var(--wo-text)]">{agent.name}</strong>
                      <span className="mt-0.5 block truncate text-[10px] text-[var(--wo-muted)]">{agent.role} · {agent.owner}</span>
                    </div>
                  </div>
                  <ChipStatus status={status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div><dt className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Entregas (30 d)</dt><dd className="font-mono tabular-nums text-[var(--wo-text)]">{agent.monthlyVolume?.toLocaleString("pt-BR") ?? "—"}</dd></div>
                  <div><dt className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Gasto (30 d)</dt><dd className="font-mono tabular-nums text-[var(--wo-text)]">{agent.monthlyCost != null ? formatBRL(agent.monthlyCost) : "—"}</dd></div>
                  <div><dt className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Metas</dt><dd className="font-mono tabular-nums text-[var(--wo-text)]">{metas.rotulo}</dd></div>
                  <div><dt className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Próxima revisão</dt><dd className="text-[var(--wo-text)]">{agent.reviewDue}</dd></div>
                </dl>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <SeloCobertura cobertura={cobertura} />
                  <button type="button" onClick={() => openProfessional(agent.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wo-line)] px-3 py-2 text-[11px] text-[var(--wo-text)]">Abrir prontuário <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[1.45fr_.55fr]">
        <Panel className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-[var(--wo-text)]">Mapa da força de trabalho</h2><span className="text-[10px] text-[var(--wo-muted)]">Bolha = volume acompanhado</span></div>
          <PortfolioMatrix agents={agents} selectedAgentId={selectedAgent?.id ?? ""} onSelect={onSelect} />
        </Panel>
        <Panel className="p-4">
          {!selectedAgent ? (
            <div className="text-sm text-[var(--wo-muted)]">Escolha um agente na lista para ver o combinado dele.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-xs font-medium text-[var(--wo-primary)]">{selectedAgent.initials}</span><div><h2 className="text-base font-medium text-[var(--wo-text)]">{selectedAgent.name}</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">{selectedAgent.role}</p><div className="mt-2"><PlatformStack platforms={selectedAgent.platforms} /></div></div></div>
                <ChipStatus status={statusDoAgente(selectedAgent)} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--wo-muted)]">{motivoDoStatus(selectedAgent)}</p>
              <div className="mt-4 rounded-xl bg-[var(--wo-card-2)] p-3"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">O que foi combinado</span><p className="mt-2 text-xs leading-relaxed text-[var(--wo-text)]">{selectedAgent.purpose}</p></div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--wo-card-2)] p-3"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Metas atingidas</span><span className="font-mono text-sm text-[var(--wo-text)]">{metasDoAgente(selectedAgent).rotulo}</span></div>
              <div className="mt-3"><SeloCobertura cobertura={coberturaDoAgente(selectedAgent)} /></div>
              <button type="button" onClick={() => openProfessional(selectedAgent.id)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-3 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">Abrir prontuário <ArrowRight className="h-4 w-4" /></button>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ContractList({ title, icon: Icon, items }: { title: string; icon: typeof Goal; items: string[] }) {
  return (
    <div className="rounded-xl bg-[var(--wo-card-2)] p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-muted)]"><Icon className="h-3.5 w-3.5" /> {title}</div>
      <ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-[var(--wo-text)]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--wo-accent-text)]" />{item}</li>)}</ul>
    </div>
  );
}

const planDecisionCopy: Record<PlanDecision, {
  title: string;
  confirm: string;
  success: string;
  tone: string;
  consequence: string;
  nextSteps: Array<{ actor: string; title: string; detail: string }>;
}> = {
  approved: {
    title: "Aprovar plano de desenvolvimento",
    confirm: "Aprovar e liberar ações",
    success: "Plano aprovado. Ações, responsáveis e próxima revisão foram registrados.",
    tone: "text-[var(--wo-accent-text)]",
    consequence: "O plano entra em execução supervisionada; a aprovação não encerra o trabalho.",
    nextSteps: [
      { actor: "Muster", title: "Congela a linha de base", detail: "Preserva a referência e abre a janela de acompanhamento." },
      { actor: "Agente", title: "Executa o plano", detail: "Trabalha nos limites combinados e entrega prova por entrega." },
      { actor: "Humano", title: "Valida a evolução", detail: "Compara ciclos e decide autonomia, mentoria ou encerramento." },
    ],
  },
  adjustment_requested: {
    title: "Solicitar ajuste do plano",
    confirm: "Devolver para ajuste",
    success: "Ajuste solicitado. A nova revisão recebeu SLA e responsáveis.",
    tone: "text-[var(--wo-warning-text)]",
    consequence: "A versão atual fica congelada e o profissional recebe uma tarefa de reformulação com prazo.",
    nextSteps: [
      { actor: "Muster", title: "Preserva a versão", detail: "Mantém hipótese e provas recusadas para comparação." },
      { actor: "Agente", title: "Reformula em até 4h", detail: "Incorpora o feedback sem ampliar risco ou escopo." },
      { actor: "Humano", title: "Revisa em até 8h", detail: "Confirma o novo contrato antes de liberar a execução." },
    ],
  },
  rejected: {
    title: "Rejeitar plano de desenvolvimento",
    confirm: "Rejeitar e bloquear execução",
    success: "Plano rejeitado. A execução foi bloqueada e o destino do profissional virou ação humana.",
    tone: "text-[var(--wo-danger-text)]",
    consequence: "A execução é bloqueada; o responsável deve redefinir a função, abrir nova hipótese ou encerrar o vínculo.",
    nextSteps: [
      { actor: "Muster", title: "Bloqueia a execução", detail: "Cancela a liberação e preserva a decisão na auditoria." },
      { actor: "Humano", title: "Define o destino", detail: "Escolhe redefinir, reavaliar ou retirar o profissional da operação." },
    ],
  },
};

const planActionStatusCopy = {
  ready: "Pronta",
  in_progress: "Em execução",
  blocked: "Bloqueada",
  completed: "Concluída",
  cancelled: "Cancelada",
} as const;

function formatPlanDate(value: string | null): string {
  if (!value) return "sem nova revisão";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function ProfessionalScreen({ agent, operational = false }: { agent: ProfessionalAgent; operational?: boolean }) {
  const [decisionMessage, setDecisionMessage] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [reevaluationMessage, setReevaluationMessage] = useState("");
  const [decisionRequest, setDecisionRequest] = useState<{
    decision: PlanDecision;
    reason: string;
  } | null>(null);
  const [actionRequest, setActionRequest] = useState<{
    sequence: number;
    title: string;
    status: Exclude<PlanActionTransition, "in_progress">;
    evidence: string;
  } | null>(null);

  const decisionsQuery = useListProfessionalPlanDecisions(agent.id, {
    query: { queryKey: getListProfessionalPlanDecisionsQueryKey(agent.id), enabled: operational },
  });
  const reevaluate = useReevaluateAgent();
  const recordDecision = useRecordProfessionalPlanDecision();
  const updatePlanAction = useUpdateProfessionalPlanAction();
  // Sem API (modo demonstração/preview estático) a rota responde HTML, não lista.
  const historico = Array.isArray(decisionsQuery.data) ? decisionsQuery.data : [];
  const latestDecision = historico[0];
  const activeAction = latestDecision?.actions.find(
    (action) => !["completed", "cancelled"].includes(action.status),
  );
  const hasOpenWorkflow = Boolean(activeAction);

  function handleReevaluate() {
    setReevaluationMessage("");
    setDecisionError("");
    reevaluate.mutate(
      { agentId: agent.id },
      {
        onSuccess: async (outcome) => {
          setReevaluationMessage(
            `Reavaliação concluída com ${outcome.dataSource === "telemetry" ? "telemetria real" : "linha de base"}: saúde ${outcome.healthScore}/100 e veredito ${outcome.verdict}.`,
          );
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agent.id) }),
            queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }),
          ]);
        },
        onError: (error) => {
          setDecisionError(error instanceof Error ? error.message : "Não foi possível reavaliar com a telemetria.");
        },
      },
    );
  }

  function openDecision(decision: PlanDecision) {
    setDecisionError("");
    setDecisionRequest({ decision, reason: "" });
  }

  function submitDecision() {
    if (!decisionRequest || decisionRequest.reason.trim().length < 3) return;
    setDecisionError("");
    recordDecision.mutate(
      {
        professionalRef: agent.id,
        data: {
          professionalName: agent.name,
          recommendation: agent.recommendation,
          decision: decisionRequest.decision,
          reason: decisionRequest.reason.trim(),
          owner: agent.owner,
        },
      },
      {
        onSuccess: async () => {
          setDecisionMessage(planDecisionCopy[decisionRequest.decision].success);
          setDecisionRequest(null);
          await decisionsQuery.refetch();
        },
        onError: (error) => {
          setDecisionError(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
        },
      },
    );
  }

  function updateAction(
    sequence: number,
    status: PlanActionTransition,
    evidence?: string,
  ) {
    if (!latestDecision) return;
    setDecisionError("");
    updatePlanAction.mutate(
      {
        professionalRef: agent.id,
        decisionId: latestDecision.id,
        sequence,
        data: { status, evidence: evidence?.trim() || undefined },
      },
      {
        onSuccess: async (decision) => {
          const action = decision.actions.find((item) => item.sequence === sequence);
          setDecisionMessage(
            action
              ? `${action.title}: ${planActionStatusCopy[action.status].toLocaleLowerCase()}.`
              : "Fluxo atualizado.",
          );
          setActionRequest(null);
          await decisionsQuery.refetch();
        },
        onError: (error) => {
          setDecisionError(
            error instanceof Error
              ? error.message
              : "Não foi possível atualizar a ação.",
          );
        },
      },
    );
  }

  function requestActionTransition(
    sequence: number,
    title: string,
    status: PlanActionTransition,
  ) {
    if (status === "in_progress") {
      updateAction(sequence, status);
      return;
    }
    setDecisionError("");
    setActionRequest({ sequence, title, status, evidence: "" });
  }

  function submitActionTransition() {
    if (!actionRequest || actionRequest.evidence.trim().length < 3) return;
    updateAction(
      actionRequest.sequence,
      actionRequest.status,
      actionRequest.evidence,
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between" data-testid="prontuario-abertura">
        <div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--wo-accent)] text-sm font-medium text-[var(--wo-accent-ink)]">{agent.initials}</span><div className="min-w-0"><div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent-text)]">Agentes · prontuário</div><h1 className="mt-1 text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)]">{agent.name}</h1><p className="mt-1 text-xs text-[var(--wo-muted)]">{agent.role} · Responsável: {agent.owner}</p><div className="mt-2 flex flex-wrap items-center gap-2"><PlatformStack platforms={agent.platforms} /><ChipStatus status={statusDoAgente(agent)} /><SeloCobertura cobertura={coberturaDoAgente(agent)} /></div><p className="mt-3 text-[13px] leading-relaxed text-[var(--wo-text)]" data-testid="prontuario-status">{motivoDoStatus(agent)}</p><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Revisão humana marcada: {agent.reviewDue}</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" data-testid="reevaluate-professional" data-operational-action="reevaluate-agent" onClick={handleReevaluate} disabled={reevaluate.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-3 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50"><RefreshCw className={cn("h-3.5 w-3.5", reevaluate.isPending && "animate-spin")} />{reevaluate.isPending ? "Recalculando…" : "Recalcular com os dados das últimas 24 h"}</button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="prontuario-blocos">
        <Panel className="p-3"><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">1 · Entregas</span><strong className="mt-2 block font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{agent.monthlyVolume?.toLocaleString("pt-BR") ?? "—"}</strong><span className="mt-1 block text-[10px] text-[var(--wo-muted)]">entregas nos últimos 30 dias</span><Link href={`/entregas?agente=${encodeURIComponent(agent.name)}`} className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--wo-primary)]">Ver as entregas <ArrowRight className="h-3 w-3" /></Link></Panel>
        <Panel className="p-3"><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">2 · Prova</span><strong className="mt-2 block font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{metasDoAgente(agent).total === 0 ? "—" : `${agent.observedMetricCount ?? 0} de ${metasDoAgente(agent).total}`}</strong><span className="mt-1 block text-[10px] text-[var(--wo-muted)]">metas com prova no período</span><div className="mt-2"><SeloCobertura cobertura={coberturaDoAgente(agent)} /></div></Panel>
        <Panel className="p-3"><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">3 · Custo</span><strong className="mt-2 block font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{agent.monthlyCost != null ? formatBRL(agent.monthlyCost) : "—"}</strong><span className="mt-1 block text-[10px] text-[var(--wo-muted)]">{agent.monthlyVolume && agent.monthlyCost != null ? `${formatBRL(agent.monthlyCost / agent.monthlyVolume)} por entrega · out/26` : "sem custo registrado no período"}</span></Panel>
        <Panel className="p-3"><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">4 · Percepção</span>{agent.percepcao ? <><strong className="mt-2 block font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{agent.percepcao.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong><span className="mt-1 block text-[10px] text-[var(--wo-muted)]">de 5 em {agent.percepcao.respostas} respostas · <span aria-hidden="true">👎</span> {agent.percepcao.negativas}</span></> : <p className="mt-2 text-[11px] leading-relaxed text-[var(--wo-muted)]">Sem percepção registrada no período. Ela aparece depois que quem recebe a entrega responde.</p>}</Panel>
        <Panel className="p-3"><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">5 · O que fazer agora</span><p className="mt-2 text-[11px] leading-relaxed text-[var(--wo-text)]">{agent.recommendation}</p><Link href="/pendencias" className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--wo-primary)]">Abrir Pendências <ArrowRight className="h-3 w-3" /></Link></Panel>
      </div>

      {reevaluationMessage && <div className="rounded-xl bg-[color-mix(in_srgb,var(--wo-accent)_13%,var(--wo-card))] px-3 py-2 text-[11px] text-[var(--wo-accent-text)]" role="status">{reevaluationMessage}</div>}

      <Panel className="p-4 sm:p-5">
        <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Goal className="h-4 w-4" /></span><div><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">O que foi combinado</span><h2 className="mt-2 max-w-4xl text-xl font-medium leading-snug text-[var(--wo-text)]">{agent.purpose}</h2></div></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3"><ContractList title="Faz" icon={ClipboardCheck} items={agent.duties} /><ContractList title="Precisa garantir" icon={UserCheck} items={agent.responsibilities} /><ContractList title="Não pode" icon={ShieldCheck} items={agent.boundaries} /></div>
      </Panel>

      <Panel className="p-4 sm:p-5" data-testid="prontuario-metas">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--wo-accent-text)]">Metas</div>
            <h2 className="mt-2 text-lg font-medium text-[var(--wo-text)]">Antes do agente, o combinado e os últimos 30 dias</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[var(--wo-muted)]">Cada linha mostra o valor medido antes do agente começar, o que foi combinado e o que aconteceu nos últimos 30 dias — com a prova que sustenta o número.</p>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-2.5 py-1 font-mono text-[10px] text-[var(--wo-muted)]">{metasDoAgente(agent).rotulo} cumpridas</span>
        </div>
        {agent.metrics.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--wo-line)] px-4 py-6 text-center text-[11px] leading-relaxed text-[var(--wo-muted)]">
            Nenhuma meta declarada. Defina metas para medir o combinado deste agente.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {agent.metrics.map((metric) => {
              const bullet = bulletDaMeta(metric);
              return (
                <li key={metric.label} className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <strong className="block text-sm font-medium text-[var(--wo-text)]">{bullet.rotulo}</strong>
                      <span className="mt-0.5 block text-[10px] text-[var(--wo-muted)]">{bullet.fonte}</span>
                    </div>
                    {bullet.casos != null && bullet.casos > 0 ? (
                      <Link href={`/entregas?agente=${encodeURIComponent(agent.name)}`} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--wo-line)] px-2.5 py-1 text-[10px] text-[var(--wo-primary)]">ver {bullet.casos} casos</Link>
                    ) : (
                      <span className="shrink-0 text-[10px] text-[var(--wo-muted)]">sem casos registrados</span>
                    )}
                  </div>
                  <div className="mt-3"><BulletMeta bullet={bullet} periodo="out/26" semRotulo /></div>
                  {bullet.semMeta && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--wo-card)] px-3 py-2">
                      <span className="text-[11px] text-[var(--wo-muted)]">Estimado · sem meta definida. Defina metas para medir o combinado.</span>
                      <Link href="/metricas" className="text-[11px] font-medium text-[var(--wo-primary)]">Definir metas</Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {operational && (
        <Panel className="p-4 sm:p-5">
          <AgentOutcomePanel agentId={agent.id} />
          <div className="mt-5 border-t border-[var(--wo-line)] pt-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--wo-text)]">Contrato numérico</h3>
            <AgentContractPanel agentId={agent.id} legacy={{}} />
          </div>
        </Panel>
      )}



      <Panel className="border-[var(--wo-accent)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--wo-accent-text)]">Plano de desenvolvimento</div><h2 className="mt-2 text-lg font-medium text-[var(--wo-text)]">{agent.recommendation}</h2></div><span className="text-right text-[10px] text-[var(--wo-muted)]">Próxima avaliação<br /><strong className="text-sm font-medium text-[var(--wo-accent-text)]">2 ciclos válidos</strong></span></div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">{[
          ["Muster · autônomo", "Preparar coorte", "Agrupar casos afetados, preservar a prova e agendar reavaliação.", Radar],
          [`${agent.name} · supervisionado`, "Executar plano corrigido", "Aplicar feedback dentro dos limites e reportar cada resultado.", Bot],
          ["Humano · decisão", "Validar evolução", "Confirmar que propósito, responsabilidades e limites seguem no combinado.", Users],
        ].map(([actor, title, description, Icon]) => <div key={actor as string} className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><span>{actor as string}</span><Icon className="h-3.5 w-3.5" /></div><strong className="mt-3 block text-xs font-medium text-[var(--wo-text)]">{title as string}</strong><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">{description as string}</p></div>)}</div>
        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--wo-line)] pt-4 lg:flex-row lg:items-center lg:justify-between"><div><strong className="text-xs font-medium text-[var(--wo-text)]">Decisão do responsável</strong><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Toda decisão abre um fluxo com responsável, prazo e prova. Um novo ciclo só começa após concluir o atual.</p>{hasOpenWorkflow && <p className="mt-2 text-[10px] font-medium text-[var(--wo-warning-text)]">Fluxo em andamento · conclua “{activeAction?.title}” antes de registrar outra decisão.</p>}</div><div className="flex flex-wrap gap-2"><button type="button" data-testid="reject-professional-plan" data-operational-action="record-plan-decision" onClick={() => openDecision("rejected")} disabled={recordDecision.isPending || hasOpenWorkflow} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 py-2 text-xs text-[var(--wo-text)] disabled:opacity-50"><X className="h-3.5 w-3.5" /> Rejeitar</button><button type="button" data-testid="adjust-professional-plan" data-operational-action="record-plan-decision" onClick={() => openDecision("adjustment_requested")} disabled={recordDecision.isPending || hasOpenWorkflow} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 py-2 text-xs text-[var(--wo-text)] disabled:opacity-50"><FileCheck2 className="h-3.5 w-3.5" /> Ajustar</button><button type="button" data-testid="approve-professional-plan" data-operational-action="record-plan-decision" onClick={() => openDecision("approved")} disabled={recordDecision.isPending || hasOpenWorkflow} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-3 py-2 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Aprovar plano</button></div></div>
        {decisionMessage && <div className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--wo-accent)_13%,var(--wo-card))] px-3 py-2 text-[11px] text-[var(--wo-accent-text)]" role="status">{decisionMessage}</div>}
        {decisionError && <div className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--wo-danger)_12%,var(--wo-card))] px-3 py-2 text-[11px] text-[var(--wo-danger-text)]" role="alert">{decisionError}</div>}
        {decisionsQuery.isLoading && <p className="mt-3 text-[10px] text-[var(--wo-muted)]">Carregando histórico de decisões…</p>}
        {latestDecision && (
          <div className="mt-4 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3" data-testid="professional-plan-decision">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div><span className={cn("text-[9px] font-medium uppercase tracking-[0.1em]", planDecisionCopy[latestDecision.decision].tone)}>{planDecisionCopy[latestDecision.decision].title}</span><p className="mt-2 text-[11px] text-[var(--wo-text)]">{latestDecision.reason}</p></div>
              <div className="text-[9px] text-[var(--wo-muted)] sm:text-right"><span>{formatPlanDate(latestDecision.decidedAt)}</span><br /><span>Próxima revisão: {formatPlanDate(latestDecision.nextReviewAt)}</span></div>
            </div>
            <div className={cn("mt-3 rounded-lg border px-3 py-2", activeAction ? "border-[var(--wo-warning)] bg-[color-mix(in_srgb,var(--wo-warning)_8%,var(--wo-card))]" : "border-[var(--wo-accent)] bg-[color-mix(in_srgb,var(--wo-accent)_8%,var(--wo-card))]")} data-testid="professional-plan-next-action">
              <span className="text-[8px] font-medium uppercase tracking-[0.1em] text-[var(--wo-muted)]">{activeAction ? "Próximo passo agora" : "Fluxo concluído"}</span>
              <p className="mt-1 text-[11px] font-medium text-[var(--wo-text)]">{activeAction ? `${activeAction.owner} · ${activeAction.title}` : "Todas as ações foram encerradas com rastreabilidade."}</p>
              {activeAction && <p className="mt-1 text-[9px] text-[var(--wo-muted)]">Prazo {formatPlanDate(activeAction.dueAt)} · {planActionStatusCopy[activeAction.status]}</p>}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {latestDecision.actions.map((action) => {
                const previousActionsComplete = latestDecision.actions
                  .filter((item) => item.sequence < action.sequence)
                  .every((item) => item.status === "completed");
                return (
                  <div key={`${latestDecision.id}-${action.sequence}`} className={cn("rounded-lg border bg-[var(--wo-card)] p-3", action.sequence === activeAction?.sequence ? "border-[var(--wo-warning)]" : "border-[var(--wo-line)]")}>
                    <div className="flex items-center justify-between gap-2"><span className="text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{action.actorType} · {action.owner}</span><span className={cn("text-[8px]", action.status === "blocked" ? "text-[var(--wo-danger-text)]" : action.status === "completed" ? "text-[var(--wo-accent-text)]" : "text-[var(--wo-primary)]")}>{planActionStatusCopy[action.status]}</span></div>
                    <strong className="mt-2 block text-[11px] font-medium text-[var(--wo-text)]">{action.title}</strong>
                    <p className="mt-1 text-[9px] leading-relaxed text-[var(--wo-muted)]">{action.description}</p>
                    <span className="mt-2 block text-[8px] text-[var(--wo-muted)]">Prazo: {formatPlanDate(action.dueAt)}</span>
                    {action.evidence && <p className="mt-2 rounded-md bg-[var(--wo-card-2)] p-2 text-[9px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-text)]">Prova:</strong> {action.evidence}</p>}
                    {action.status === "ready" && (
                      <button type="button" onClick={() => requestActionTransition(action.sequence, action.title, "in_progress")} disabled={!previousActionsComplete || updatePlanAction.isPending} className="mt-3 w-full rounded-lg bg-[var(--wo-primary)] px-3 py-2 text-[10px] font-medium text-[var(--wo-primary-ink)] disabled:opacity-45" data-testid={`start-plan-action-${action.sequence}`}>{previousActionsComplete ? "Iniciar etapa" : "Aguardando etapa anterior"}</button>
                    )}
                    {action.status === "in_progress" && (
                      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => requestActionTransition(action.sequence, action.title, "blocked")} disabled={updatePlanAction.isPending} className="rounded-lg border border-[var(--wo-line)] px-2 py-2 text-[10px] text-[var(--wo-text)] disabled:opacity-50">Bloquear</button><button type="button" onClick={() => requestActionTransition(action.sequence, action.title, "completed")} disabled={updatePlanAction.isPending} className="rounded-lg bg-[var(--wo-accent)] px-2 py-2 text-[10px] font-medium text-[var(--wo-accent-ink)] disabled:opacity-50">Concluir</button></div>
                    )}
                    {action.status === "blocked" && (
                      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => requestActionTransition(action.sequence, action.title, "cancelled")} disabled={updatePlanAction.isPending} className="rounded-lg border border-[var(--wo-line)] px-2 py-2 text-[10px] text-[var(--wo-text)] disabled:opacity-50">Cancelar</button><button type="button" onClick={() => requestActionTransition(action.sequence, action.title, "in_progress")} disabled={updatePlanAction.isPending} className="rounded-lg bg-[var(--wo-primary)] px-2 py-2 text-[10px] font-medium text-[var(--wo-primary-ink)] disabled:opacity-50">Retomar</button></div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[9px] text-[var(--wo-muted)]">{historico.length} decisão(ões) preservada(s) no histórico.</p>
          </div>
        )}
      </Panel>

      {decisionRequest && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="plan-decision-title">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-shell)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-primary)]">Decisão auditável</span><h2 id="plan-decision-title" className="mt-2 text-xl font-medium text-[var(--wo-text)]">{planDecisionCopy[decisionRequest.decision].title}</h2><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">{planDecisionCopy[decisionRequest.decision].consequence}</p></div><button type="button" aria-label="Fechar decisão" onClick={() => setDecisionRequest(null)} disabled={recordDecision.isPending} className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)] disabled:opacity-50"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3" data-testid="plan-decision-preview"><span className="text-[8px] font-medium uppercase tracking-[0.1em] text-[var(--wo-primary)]">Depois de confirmar</span><div className="mt-2 space-y-2">{planDecisionCopy[decisionRequest.decision].nextSteps.map((step, index) => <div key={step.title} className="grid grid-cols-[20px_1fr] gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--wo-primary-soft)] text-[8px] text-[var(--wo-primary)]">{index + 1}</span><p className="text-[9px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-text)]">{step.actor} · {step.title}.</strong> {step.detail}</p></div>)}</div></div>
            <label className="mt-5 block"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Justificativa obrigatória</span><textarea value={decisionRequest.reason} onChange={(event) => setDecisionRequest((current) => current ? { ...current, reason: event.target.value } : current)} rows={4} autoFocus placeholder="Registre provas, riscos e condição esperada para o próximo ciclo." className="mt-2 w-full resize-none rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-3 text-xs text-[var(--wo-text)] outline-none placeholder:text-[var(--wo-muted)] focus:border-[var(--wo-primary)]" /></label>
            {decisionError && <p className="mt-3 text-[10px] text-[var(--wo-danger-text)]" role="alert">{decisionError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDecisionRequest(null)} disabled={recordDecision.isPending} className="rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)] disabled:opacity-50">Cancelar</button><button type="button" onClick={submitDecision} disabled={recordDecision.isPending || decisionRequest.reason.trim().length < 3} className="rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50">{recordDecision.isPending ? "Registrando…" : planDecisionCopy[decisionRequest.decision].confirm}</button></div>
          </div>
        </div>
      )}

      {actionRequest && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="plan-action-title">
          <div className="w-full max-w-md rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-shell)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-primary)]">Prova operacional</span><h2 id="plan-action-title" className="mt-2 text-lg font-medium text-[var(--wo-text)]">{actionRequest.status === "completed" ? "Concluir" : actionRequest.status === "blocked" ? "Bloquear" : "Cancelar"} · {actionRequest.title}</h2><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">Registre o resultado observado, o impedimento ou a razão do encerramento. Essa prova permanece vinculada à decisão.</p></div><button type="button" aria-label="Fechar atualização" onClick={() => setActionRequest(null)} disabled={updatePlanAction.isPending} className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)] disabled:opacity-50"><X className="h-4 w-4" /></button></div>
            <label className="mt-5 block"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Prova obrigatória</span><textarea value={actionRequest.evidence} onChange={(event) => setActionRequest((current) => current ? { ...current, evidence: event.target.value } : current)} rows={4} autoFocus placeholder="Ex.: 40 casos válidos concluídos, acurácia de 93% e nenhum limite combinado violado." className="mt-2 w-full resize-none rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-3 text-xs text-[var(--wo-text)] outline-none placeholder:text-[var(--wo-muted)] focus:border-[var(--wo-primary)]" /></label>
            {decisionError && <p className="mt-3 text-[10px] text-[var(--wo-danger-text)]" role="alert">{decisionError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setActionRequest(null)} disabled={updatePlanAction.isPending} className="rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)] disabled:opacity-50">Voltar</button><button type="button" onClick={submitActionTransition} disabled={updatePlanAction.isPending || actionRequest.evidence.trim().length < 3} className="rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50">{updatePlanAction.isPending ? "Salvando…" : "Confirmar e continuar"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkforceOsLabPage({ defaultScreen, labMode = true, demo = false }: { defaultScreen?: Screen; labMode?: boolean; demo?: boolean } = {}) {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialScreen = searchParams.get("screen");
  const requestedPalette = searchParams.get("theme");
  const resolvedRoute = resolveWorkforceRoute(location);
  const requestedScreen = defaultScreen
    ?? (!labMode && resolvedRoute
      ? resolvedRoute.screen
      : isWorkforceScreen(initialScreen)
        ? initialScreen
        : "today");
  const [screen, setScreen] = useState<Screen>(requestedScreen);
  const storedPalette = window.localStorage.getItem("muster-workforce-theme");
  const [palette, setPaletteState] = useState<PaletteId>(
    requestedPalette && ["mineral", "graphite", "dracula", "mocha"].includes(requestedPalette)
      ? requestedPalette as PaletteId
      : storedPalette && ["mineral", "graphite", "dracula", "mocha"].includes(storedPalette)
        ? storedPalette as PaletteId
      : "mineral",
  );
  const semApi = labMode || demo;
  const navegaPorRota = !labMode || demo;
  const agentsQuery = useListAgents(undefined, {
    query: { queryKey: getListAgentsQueryKey(), enabled: !semApi },
  });
  const operationalAgents = useMemo(
    () => (agentsQuery.data ?? []).map((agent) => adaptApiAgent(agent)),
    [agentsQuery.data],
  );
  const visibleAgents = semApi ? demoAgents : operationalAgents;
  const [selectedAgentId, setSelectedAgentId] = useState(resolvedRoute?.agentId ?? (labMode ? "sofia" : ""));
  const selectedAgentDetailQuery = useGetAgent(selectedAgentId, {
    query: {
      queryKey: getGetAgentQueryKey(selectedAgentId),
      enabled: !semApi && Boolean(selectedAgentId),
    },
  });
  const selectedAgent = useMemo(() => {
    const baseAgent = visibleAgents.find((agent) => agent.id === selectedAgentId)
      ?? visibleAgents[0]
      ?? null;
    if (semApi || !baseAgent || !selectedAgentDetailQuery.data) return baseAgent;
    return adaptApiAgent(selectedAgentDetailQuery.data.agent, selectedAgentDetailQuery.data);
  }, [labMode, selectedAgentDetailQuery.data, selectedAgentId, visibleAgents]);

  useEffect(() => {
    if (!navegaPorRota) return;
    const nextRoute = resolveWorkforceRoute(location);
    if (!nextRoute) return;
    setScreen(nextRoute.screen);
    if (nextRoute.agentId) setSelectedAgentId(nextRoute.agentId);
  }, [navegaPorRota, location]);

  useEffect(() => {
    if (visibleAgents.length === 0) return;
    if (visibleAgents.some((agent) => agent.id === selectedAgentId)) return;
    setSelectedAgentId(visibleAgents[0]!.id);
  }, [selectedAgentId, visibleAgents]);

  function navigate(nextScreen: Screen) {
    if (!navegaPorRota) {
      setScreen(nextScreen);
      return;
    }
    setLocation(routeForWorkforceScreen(nextScreen, selectedAgentId));
  }

  function openProfessional(agentId: string) {
    setSelectedAgentId(agentId);
    if (!navegaPorRota) setScreen("professional");
    else setLocation(routeForWorkforceScreen("professional", agentId));
  }

  function setPalette(nextPalette: PaletteId) {
    setPaletteState(nextPalette);
    window.localStorage.setItem("muster-workforce-theme", nextPalette);
    const url = new URL(window.location.href);
    url.searchParams.set("theme", nextPalette);
    window.history.replaceState({}, "", url);
  }

  return (
    <ContaBoundary demo={demo}>
    <div className="min-h-screen bg-[var(--wo-bg)] text-[var(--wo-text)] transition-colors duration-300" style={workforcePalettes[palette]} data-workforce-theme={palette} data-workforce-shell="true" data-workforce-screen={screen}>
      <div className="flex min-h-screen">
        <NavigationRail screen={screen} navigate={navigate} labMode={labMode} />
        <div className="min-w-0 flex-1">
          <AppHeader labMode={labMode} screen={screen} />
          <main className="pb-16 md:pb-0">
            <Suspense fallback={<TelaCarregando />}>
            {screen === "today" && <ManagerScreen selectAgent={openProfessional} navigate={navigate} agents={visibleAgents} operational={!semApi} />}
            {screen === "onboarding" && <OnboardingScreen navigate={navigate} />}
            {screen === "reports" && <ExecutiveReportsScreen operational={!semApi} />}
            {screen === "portfolio" && <PortfolioScreen agents={visibleAgents} selectedAgent={selectedAgent} onSelect={setSelectedAgentId} openProfessional={openProfessional} isLoading={!semApi && agentsQuery.isLoading} isError={!semApi && agentsQuery.isError} operational={!semApi} />}
            {screen === "professional" && (selectedAgent ? <ProfessionalScreen key={selectedAgent.id} agent={selectedAgent} operational={!semApi} /> : <div className="p-6"><Panel className="p-8"><h1 className="text-xl font-medium text-[var(--wo-text)]">Profissional não encontrado</h1><p className="mt-2 text-sm text-[var(--wo-muted)]">Admitir e conectar o agente é obrigatório antes de abrir seu prontuário operacional.</p><Link href="/admissao" className="mt-5 inline-flex rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">Abrir admissão</Link></Panel></div>)}
            {screen === "metrics" && (semApi ? <MetricsScreen /> : <MetricasPage embedded />)}
            {screen === "teams" && (semApi ? <MixedTeamsScreen /> : <OperationalMixedTeamsScreen />)}
            {screen === "journeys" && (semApi ? <JourneysScreen /> : <JourneysPage embedded />)}
            {screen === "benchmarks" && (semApi ? <BenchmarksScreen /> : <BenchmarksPage embedded />)}
            {screen === "connectors" && <ConnectorsScreen />}
            {screen === "settings" && (semApi ? <SettingsScreen /> : <GovernancePage embedded />)}
            {screen === "admission" && (semApi ? <AdicionarAgenteScreen /> : <AdmissionPage embedded />)}
            {screen === "alerts" &&
              (semApi || location === "/pendencias" ? <PendenciasScreen /> : <AlertsPage embedded />)}
            {screen === "admin" && (demo ? <SoComLogin titulo="Administração da organização" /> : <AdminConsolePage />)}
            {screen === "accountSettings" && <AccountSettingsPage embedded palette={palette} setPalette={setPalette} />}
            {screen === "profile" && <ProfilePage embedded demo={demo} />}
            {screen === "connection" && <ConectarPage embedded />}
            {screen === "entregas" && <EntregasScreen />}
            {screen === "mapa" && <MapaScreen />}
            </Suspense>
          </main>
          <ShellBottomBar screen={screen} labMode={!navegaPorRota} navigate={navigate} />
        </div>
      </div>
    </div>
    </ContaBoundary>
  );
}
