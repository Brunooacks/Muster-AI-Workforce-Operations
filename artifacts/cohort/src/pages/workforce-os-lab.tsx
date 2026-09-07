import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth, useClerk, useUser } from "@clerk/react";
import {
  getListAgentsQueryKey,
  getGetAgentQueryKey,
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
  LogOut,
  Palette,
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
import { OperationalMixedTeamsScreen } from "@/pages/mixed-teams-operational";
import { ConnectorsScreen } from "@/pages/connectors-workforce";
import { ExecutiveReportsScreen } from "@/pages/executive-reports-workforce";
import MetricasPage from "@/pages/metricas";
import BenchmarksPage from "@/pages/benchmarks";
import GovernancePage from "@/pages/governanca";
import JourneysPage from "@/pages/journeys";
import AdmissionPage from "@/pages/admission";
import AlertsPage from "@/pages/alerts";
import AccountSettingsPage from "@/pages/configuracoes";
import ProfilePage from "@/pages/perfil";
import ConectarPage from "@/pages/conectar";
import AdminConsolePage from "@/pages/admin-console";
import { queryClient } from "@/lib/queryClient";
import {
  adaptApiAgent,
  type WorkforceContractMetric,
  type WorkforceProfessionalAgent,
} from "@/lib/workforce-agent-adapter";

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
    "--muted-foreground": "232 42% 77%",
    "--accent": "232 14% 31%",
    "--accent-foreground": "60 30% 96%",
    "--chart-1": "265 89% 78%",
    "--chart-2": "135 94% 65%",
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
    "--wo-primary-soft": "#dbeee9",
    "--wo-accent": "#9dd36f",
    "--wo-accent-ink": "#13250f",
    "--wo-warning": "#a76f16",
    "--wo-danger": "#c14f43",
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
    "--wo-primary-soft": "#102e3f",
    "--wo-accent": "#7ee2b8",
    "--wo-accent-ink": "#061812",
    "--wo-warning": "#f4c45e",
    "--wo-danger": "#ff7a8a",
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
    "--wo-primary-soft": "#45365e",
    "--wo-accent": "#50fa7b",
    "--wo-accent-ink": "#102716",
    "--wo-warning": "#f1fa8c",
    "--wo-danger": "#ff5555",
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
    "--wo-primary-soft": "#293550",
    "--wo-accent": "#a6e3a1",
    "--wo-accent-ink": "#132414",
    "--wo-warning": "#f9e2af",
    "--wo-danger": "#f38ba8",
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
    autonomy: "Supervisionada",
    duties: [
      "Identificar intenção e contexto mínimo do atendimento.",
      "Resolver somente solicitações cobertas pelo contrato operacional.",
      "Registrar evidências e comunicar o resultado ao cliente.",
    ],
    responsibilities: [
      "Manter resolução no primeiro contato acima de 75%.",
      "Escalonar risco, ambiguidade ou ausência de conhecimento.",
      "Evitar encerramento sem confirmação do outcome real.",
    ],
    boundaries: [
      "Não alterar dados financeiros sem aprovação.",
      "Não decidir exceções de política.",
      "Solicitar revisão humana com confiança abaixo de 70%.",
    ],
    metrics: [
      { label: "Resolução no primeiro contato", baseline: "68%", target: "≥ 75%", current: "61%", status: "off", source: "Zendesk · tickets" },
      { label: "Reabertura em 72 horas", baseline: "17%", target: "≤ 15%", current: "24%", status: "off", source: "Zendesk · eventos" },
      { label: "Escalonamento apropriado", baseline: "82%", target: "≥ 80%", current: "86%", status: "on", source: "Auditoria amostral" },
      { label: "Completude de evidência", baseline: "88%", target: "≥ 95%", current: "91%", status: "watch", source: "Muster telemetry" },
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
    autonomy: "Supervisionada",
    duties: ["Enriquecer o contexto do lead.", "Aplicar critérios de qualificação vigentes.", "Registrar motivo e confiança da decisão."],
    responsibilities: ["Preservar qualidade do pipeline.", "Evitar falso positivo acima de 5%.", "Escalonar campanhas sem regra de ICP válida."],
    boundaries: ["Não descartar contas estratégicas.", "Não alterar critérios comerciais.", "Solicitar revisão em campanhas novas."],
    metrics: [
      { label: "Conversão qualificada", baseline: "24%", target: "≥ 25%", current: "21%", status: "off", source: "Salesforce · pipeline" },
      { label: "Falso positivo de lead", baseline: "6%", target: "≤ 5%", current: "11%", status: "off", source: "Feedback do vendedor" },
      { label: "Speed to lead", baseline: "7 min", target: "< 5 min", current: "3 min", status: "on", source: "Salesforce · eventos" },
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
    autonomy: "Autônoma",
    duties: ["Validar pré-condições de deploy.", "Executar rollout gradual.", "Acionar rollback ao romper guardrails."],
    responsibilities: ["Manter taxa de sucesso acima de 95%.", "Garantir evidência por execução.", "Notificar owner em recuperação automática."],
    boundaries: ["Não promover mudança sem testes.", "Não ignorar bloqueios de segurança.", "Não alterar guardrails sem comitê."],
    metrics: [
      { label: "Deploys sem rollback", baseline: "91%", target: "≥ 95%", current: "97%", status: "on", source: "CI/CD telemetry" },
      { label: "Completude de trace", baseline: "94%", target: "≥ 99%", current: "99%", status: "on", source: "OpenTelemetry" },
    ],
    diagnosis: "Vega cumpre o contrato com evidência consistente e pode assumir maior volume dentro dos mesmos limites.",
    recommendation: "Promover gradualmente o volume, preservando rollback automático e revisão quinzenal.",
  },
  {
    id: "reviewer",
    initials: "RP",
    name: "Revisor PR",
    role: "Especialista de Code Review",
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
    autonomy: "Supervisionada",
    duties: ["Inspecionar mudanças elegíveis.", "Classificar riscos.", "Justificar recomendações."],
    responsibilities: ["Cobrir mais de 90% dos PRs elegíveis.", "Manter defeito escapado abaixo de 5%.", "Exigir gate humano em módulos críticos."],
    boundaries: ["Não aprovar merge.", "Não dispensar testes obrigatórios.", "Não revisar segredos ou dados não autorizados."],
    metrics: [
      { label: "Cobertura de revisão", baseline: "76%", target: "≥ 90%", current: "92%", status: "on", source: "GitHub" },
      { label: "Defeito escapado", baseline: "6%", target: "≤ 5%", current: "8%", status: "off", source: "Incidentes atribuídos" },
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
    autonomy: "Autônoma",
    duties: ["Orientar próximos passos.", "Confirmar documentos.", "Escalonar exceções."],
    responsibilities: ["Evitar pendências silenciosas.", "Preservar experiência humana.", "Registrar consentimento e evidências."],
    boundaries: ["Não decidir exceções trabalhistas.", "Não acessar dados fora do escopo.", "Não concluir onboarding incompleto."],
    metrics: [
      { label: "Onboardings completos", baseline: "89%", target: "≥ 92%", current: "93%", status: "on", source: "HRIS" },
      { label: "Experiência do colaborador", baseline: "4,1/5", target: "≥ 4/5", current: "4,5/5", status: "on", source: "Pesquisa pós-ciclo" },
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
    autonomy: "Assistida",
    duties: ["Comparar registros.", "Classificar divergências.", "Encaminhar exceções com contexto."],
    responsibilities: ["Manter precisão acima de 98%.", "Não ocultar divergências.", "Produzir trilha auditável."],
    boundaries: ["Não efetuar baixa financeira.", "Não alterar origem dos dados.", "Não resolver exceções sem owner."],
    metrics: [
      { label: "Precisão de conciliação", baseline: "92%", target: "≥ 98%", current: "89%", status: "off", source: "ERP · amostra auditada" },
      { label: "Exceções com evidência", baseline: "74%", target: "≥ 95%", current: "71%", status: "off", source: "Muster evidence" },
    ],
    diagnosis: "Dora ainda não demonstra consistência suficiente para cumprir a função acordada.",
    recommendation: "Reduzir escopo, corrigir instrumentação e repetir período de experiência com amostra mínima.",
  },
];

const agentManagerScorecards: Record<string, { cost: string; accuracy: number; efficacy: number; efficiency: number; adoption: number; governance: number }> = {
  sofia: { cost: "R$ 0,12", accuracy: 72, efficacy: 61, efficiency: 88, adoption: 84, governance: 95 },
  julia: { cost: "R$ 0,18", accuracy: 74, efficacy: 72, efficiency: 91, adoption: 79, governance: 93 },
  vega: { cost: "R$ 0,16", accuracy: 96, efficacy: 91, efficiency: 94, adoption: 81, governance: 99 },
  reviewer: { cost: "R$ 0,09", accuracy: 84, efficacy: 76, efficiency: 92, adoption: 78, governance: 97 },
  maia: { cost: "R$ 0,14", accuracy: 93, efficacy: 93, efficiency: 88, adoption: 90, governance: 98 },
  dora: { cost: "R$ 0,41", accuracy: 89, efficacy: 48, efficiency: 61, adoption: 58, governance: 91 },
};

const statusStyle: Record<AgentStatus, CSSProperties> = {
  healthy: { color: "var(--wo-accent-ink)", background: "var(--wo-accent)" },
  attention: { color: "var(--wo-accent-ink)", background: "var(--wo-warning)" },
  critical: { color: "white", background: "var(--wo-danger)" },
  probation: { color: "var(--wo-text)", background: "var(--wo-primary-soft)" },
};

function StatusBadge({ agent }: { agent: ProfessionalAgent }) {
  return (
    <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em]" style={statusStyle[agent.status]}>
      {agent.statusLabel}
    </span>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)]", className)}>
      {children}
    </section>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[110px_1fr_34px] items-center gap-2 text-xs">
      <span className="text-[var(--wo-muted)]">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--wo-line)]">
        <div className="h-full rounded-full bg-[var(--wo-primary)]" style={{ width: `${value}%` }} />
      </div>
      <strong className="text-right font-mono font-medium text-[var(--wo-text)]">{value}</strong>
    </div>
  );
}

function AppHeader({ palette, setPalette, labMode, screen }: { palette: PaletteId; setPalette: (palette: PaletteId) => void; labMode: boolean; screen: Screen }) {
  const paletteOptions: Array<{ id: PaletteId; color: string; label: string }> = [
    { id: "mineral", color: "#0f766e", label: "Mineral" },
    { id: "graphite", color: "#55c2ff", label: "Graphite" },
    { id: "dracula", color: "#bd93f9", label: "Dracula" },
    { id: "mocha", color: "#89b4fa", label: "Mocha" },
  ];

  return (
    <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--wo-line)] bg-[var(--wo-shell)] px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={labMode ? "/prototipos" : "/comando"} className="inline-flex items-center gap-2 text-xs text-[var(--wo-muted)] transition-colors hover:text-[var(--wo-text)]">
          <ArrowLeft className="h-4 w-4" /> {labMode ? "Laboratório" : "Operação"}
        </Link>
        <span className="hidden h-4 w-px bg-[var(--wo-line)] sm:block" />
        <span className="truncate text-sm font-medium text-[var(--wo-text)]">Muster Workforce OS</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 text-[11px] text-[var(--wo-accent)] sm:flex">
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
        <div className="flex items-center gap-1 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-1" aria-label="Direção visual">
          <Palette className="mx-1 h-3.5 w-3.5 text-[var(--wo-muted)]" />
          {paletteOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-label={`Tema ${option.label}`}
              aria-pressed={palette === option.id}
              onClick={() => setPalette(option.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-[9px] transition-colors", palette === option.id ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "border-transparent text-[var(--wo-muted)] hover:text-[var(--wo-text)]")}
            >
              <span className="h-3 w-3 rounded-full border border-white/20" style={{ background: option.color }} />
              <span className="hidden lg:inline">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

const workforceNavIcons: Record<Screen, typeof House> = {
  today: House,
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
  selectedAgentId,
}: {
  screen: Screen;
  navigate: (screen: Screen) => void;
  labMode: boolean;
  selectedAgentId: string;
}) {
  const { signOut } = useClerk();
  const { orgRole } = useAuth();
  const { user } = useUser();
  const displayName = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || "Conta";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "US";
  let currentGroup = "";
  return (
    <aside className="sticky top-0 flex h-screen w-[68px] shrink-0 flex-col items-center overflow-y-auto border-r border-[var(--wo-line)] bg-[var(--wo-shell)] py-3 xl:w-[220px] xl:items-stretch">
      <div className="flex items-center justify-center gap-3 px-2 xl:justify-start xl:px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]" data-testid="muster-brand-mark"><MusterMark className="h-7 w-7" /></span>
        <span className="hidden xl:block"><strong className="block text-sm font-medium text-[var(--wo-text)]">Muster</strong><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Workforce OS</span></span>
      </div>
      <nav className="mt-5 grid w-full gap-1 px-2">
        {WORKFORCE_NAV_ITEMS.filter((item) => item.screen !== "admin" || labMode || orgRole === "org:admin").map((item) => {
          const showGroup = item.group !== currentGroup;
          currentGroup = item.group;
          const Icon = workforceNavIcons[item.screen];
          const active = navigationScreenForWorkforceScreen(screen) === item.screen;
          const href = item.screen === "professional"
            ? selectedAgentId
              ? routeForWorkforceScreen(item.screen, selectedAgentId)
              : "/admissao"
            : item.path;
          const controlClassName = cn("grid min-h-10 w-full place-items-center rounded-xl text-[var(--wo-muted)] transition-colors xl:grid-cols-[28px_1fr] xl:justify-items-start xl:px-3", active ? "bg-[var(--wo-primary-soft)] text-[var(--wo-text)]" : "hover:bg-[var(--wo-card-2)] hover:text-[var(--wo-text)]");
          return (
            <div key={item.screen}>
              {showGroup && <div className="my-2 hidden px-3 pt-1 text-[8px] font-medium uppercase tracking-[0.12em] text-[var(--wo-muted)] xl:block">{item.group}</div>}
              {showGroup && <div className="mx-auto my-2 h-px w-7 bg-[var(--wo-line)] xl:hidden" />}
              {labMode ? (
                <button type="button" title={item.label} aria-label={item.label} aria-pressed={active} onClick={() => navigate(item.screen)} className={controlClassName}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden text-[11px] xl:block">{item.label}</span>
                </button>
              ) : (
                <Link href={href} title={item.label} aria-label={item.label} aria-current={active ? "page" : undefined} className={controlClassName}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden text-[11px] xl:block">{item.label}</span>
                </Link>
              )}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-[var(--wo-line)] px-2 pt-3">
        {labMode ? (
          <button
            type="button"
            onClick={() => navigate("onboarding")}
            aria-label="Central de adoção e novidades"
            title="Central de adoção e novidades"
            className="mb-2 grid min-h-10 w-full place-items-center rounded-xl text-[var(--wo-muted)] transition-colors hover:bg-[var(--wo-card-2)] hover:text-[var(--wo-text)] xl:grid-cols-[28px_1fr] xl:justify-items-start xl:px-3"
          >
            <BookOpenCheck className="h-4 w-4" />
            <span className="hidden text-[11px] xl:block">Adoção e novidades</span>
          </button>
        ) : (
          <Link
            href="/guia"
            aria-label="Central de adoção e novidades"
            title="Central de adoção e novidades"
            className="mb-2 grid min-h-10 w-full place-items-center rounded-xl text-[var(--wo-muted)] transition-colors hover:bg-[var(--wo-card-2)] hover:text-[var(--wo-text)] xl:grid-cols-[28px_1fr] xl:justify-items-start xl:px-3"
          >
            <BookOpenCheck className="h-4 w-4" />
            <span className="hidden text-[11px] xl:block">Adoção e novidades</span>
          </Link>
        )}
        <Link href="/perfil" aria-label="Abrir perfil" className="flex items-center justify-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-[var(--wo-card-2)] xl:justify-start xl:px-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--wo-line)] bg-[var(--wo-card-2)] text-[10px] font-medium text-[var(--wo-text)]">{initials}</div>
          <span className="hidden min-w-0 flex-1 xl:block"><strong className="block truncate text-[10px] font-medium text-[var(--wo-text)]">{displayName}</strong><span className="mt-0.5 block text-[9px] text-[var(--wo-muted)]">Sessão autenticada</span></span>
        </Link>
        <Link
          href="/configuracoes"
          aria-label="Configurações da conta"
          title="Configurações da conta"
          className="mt-2 grid min-h-10 w-full place-items-center rounded-xl text-[var(--wo-muted)] transition-colors hover:bg-[var(--wo-card-2)] hover:text-[var(--wo-text)] xl:grid-cols-[28px_1fr] xl:justify-items-start xl:px-3"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden text-[11px] xl:block">Configurações da conta</span>
        </Link>
        <button
          type="button"
          aria-label="Sair e voltar para a página inicial"
          title="Sair e voltar para a página inicial"
          onClick={() => void signOut({ redirectUrl: import.meta.env.BASE_URL || "/" })}
          className="mt-2 grid min-h-10 w-full place-items-center rounded-xl text-[var(--wo-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--wo-danger)_12%,var(--wo-card))] hover:text-[var(--wo-danger)] xl:grid-cols-[28px_1fr] xl:justify-items-start xl:px-3"
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
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent)]">Gestão da força de trabalho</div>
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
          ["Cumprimento dos contratos", "82%", "+4 pp no trimestre", ClipboardCheck],
          ["Responsabilidades atendidas", "91%", "23 profissionais dentro da meta", UserCheck],
          ["Reviews necessários", "3", "1 SLA crítico hoje", Clock3],
          ["Evidência confiável", "89%", "telemetria e auditoria válidas", DatabaseZap],
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
              ["Autonomia dentro do contrato", "87%", "+6 pp no trimestre"],
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
                  <span className="text-[10px] text-[var(--wo-warning)]">{agent.reviewUrgency}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">{agent.diagnosis}</p>
                <div className="mt-2 flex items-center justify-between text-[10px]"><span className="text-[var(--wo-accent)]">Contrato {agent.contractFulfillment}%</span><ChevronRight className="h-3.5 w-3.5 text-[var(--wo-muted)]" /></div>
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
      <span className="absolute right-4 top-3 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-accent)]">Expandir responsabilidades</span>
      <span className="absolute left-4 top-3 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-warning)]">Mentorar</span>
      <span className="absolute bottom-3 left-4 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-danger)]">Rever função</span>
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

function PortfolioScreen({ agents, selectedAgent, onSelect, openProfessional, isLoading, isError }: { agents: ProfessionalAgent[]; selectedAgent: ProfessionalAgent | null; onSelect: (agentId: string) => void; openProfessional: (agentId: string) => void; isLoading: boolean; isError: boolean }) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent)]">Portfólio profissional</div>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-4xl">Propósito × saúde operacional</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--wo-muted)]">O eixo principal avalia se cada profissional executa a função combinada. Volume, custo e impacto financeiro permanecem como contexto secundário.</p>
      </div>
      {isLoading ? (
        <Panel className="p-8 text-sm text-[var(--wo-muted)]">Carregando profissionais reais do tenant…</Panel>
      ) : isError ? (
        <Panel className="border-[var(--wo-danger)] p-8"><h2 className="text-lg font-medium text-[var(--wo-text)]">Não foi possível carregar o portfólio</h2><p className="mt-2 text-sm text-[var(--wo-muted)]">A operação não substitui dados indisponíveis por demonstrações. Verifique API, autenticação e tenant.</p></Panel>
      ) : !selectedAgent ? (
        <Panel className="p-8"><h2 className="text-lg font-medium text-[var(--wo-text)]">Nenhum profissional admitido</h2><p className="mt-2 max-w-xl text-sm text-[var(--wo-muted)]">Cadastre um agente, conecte sua telemetria e forme uma baseline real. Dados de demonstração aparecem somente no laboratório visual.</p><Link href="/admissao" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]"><UserPlus className="h-4 w-4" /> Admitir primeiro agente</Link></Panel>
      ) : <>
      <div className="grid gap-3 xl:grid-cols-[1.45fr_.55fr]">
        <Panel className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-[var(--wo-text)]">Mapa da força de trabalho</h2><span className="text-[10px] text-[var(--wo-muted)]">Bolha = volume acompanhado</span></div>
          <PortfolioMatrix agents={agents} selectedAgentId={selectedAgent.id} onSelect={onSelect} />
        </Panel>
        <Panel className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-xs font-medium text-[var(--wo-primary)]">{selectedAgent.initials}</span><div><h2 className="text-base font-medium text-[var(--wo-text)]">{selectedAgent.name}</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">{selectedAgent.role}</p><div className="mt-2"><PlatformStack platforms={selectedAgent.platforms} /></div></div></div>
            <StatusBadge agent={selectedAgent} />
          </div>
          <div className="mt-4 rounded-xl bg-[var(--wo-card-2)] p-3"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Propósito contratado</span><p className="mt-2 text-xs leading-relaxed text-[var(--wo-text)]">{selectedAgent.purpose}</p></div>
          <div className="mt-4 space-y-3">
            <ScoreBar label="Propósito" value={selectedAgent.contractFulfillment} />
            <ScoreBar label="Saúde" value={selectedAgent.operationalHealth} />
            <ScoreBar label="Responsabilidades" value={selectedAgent.responsibilityCoverage} />
            <ScoreBar label="Evidência" value={selectedAgent.evidenceConfidence} />
          </div>
          <div className="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--wo-warning)_14%,var(--wo-card))] p-3"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-warning)]">Próxima decisão</span><p className="mt-2 text-[11px] leading-relaxed text-[var(--wo-muted)]">{selectedAgent.recommendation}</p></div>
          <button type="button" onClick={() => openProfessional(selectedAgent.id)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--wo-accent)] px-3 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">Abrir prontuário profissional <ArrowRight className="h-4 w-4" /></button>
        </Panel>
      </div>
      <Panel className="overflow-hidden">
        <div className="border-b border-[var(--wo-line)] px-4 py-3"><h2 className="text-sm font-medium text-[var(--wo-text)]">Gestão direta</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Cada linha liga função, contrato, review e autonomia.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-xs">
            <thead><tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><th className="px-4 py-3 font-normal">Profissional · função</th><th className="px-3 py-3 font-normal">Owner</th><th className="px-3 py-3 font-normal">Contrato</th><th className="px-3 py-3 font-normal">Responsabilidades</th><th className="px-3 py-3 font-normal">Autonomia</th><th className="px-3 py-3 font-normal">Review</th><th className="px-3 py-3 font-normal" /></tr></thead>
            <tbody>{agents.map((agent) => <tr key={agent.id} className="border-t border-[var(--wo-line)] transition-colors hover:bg-[var(--wo-card-2)]"><td className="px-4 py-3"><button type="button" onClick={() => onSelect(agent.id)} className="flex items-center gap-3 text-left"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--wo-primary-soft)] text-[10px] font-medium text-[var(--wo-primary)]">{agent.initials}</span><span><strong className="block font-medium text-[var(--wo-text)]">{agent.name}</strong><span className="mt-1 block text-[10px] text-[var(--wo-muted)]">{agent.role} · {agent.team}</span><span className="mt-2 block"><PlatformStack platforms={agent.platforms} compact /></span></span></button></td><td className="px-3 py-3 text-[var(--wo-muted)]">{agent.owner}</td><td className="px-3 py-3 font-mono text-[var(--wo-text)]">{agent.contractFulfillment}%</td><td className="px-3 py-3 font-mono text-[var(--wo-text)]">{agent.responsibilityCoverage}%</td><td className="px-3 py-3 text-[var(--wo-muted)]">{agent.autonomy}</td><td className="px-3 py-3 text-[var(--wo-muted)]">{agent.reviewDue}</td><td className="px-3 py-3"><button type="button" aria-label={`Abrir prontuário de ${agent.name}`} onClick={() => openProfessional(agent.id)} className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-primary-soft)] hover:text-[var(--wo-text)]"><ChevronRight className="h-4 w-4" /></button></td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
      </>}
    </div>
  );
}

function ContractList({ title, icon: Icon, items }: { title: string; icon: typeof Goal; items: string[] }) {
  return (
    <div className="rounded-xl bg-[var(--wo-card-2)] p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-muted)]"><Icon className="h-3.5 w-3.5" /> {title}</div>
      <ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-[var(--wo-text)]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--wo-accent)]" />{item}</li>)}</ul>
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
    tone: "text-[var(--wo-accent)]",
    consequence: "O plano entra em execução supervisionada; a aprovação não encerra o trabalho.",
    nextSteps: [
      { actor: "Muster", title: "Congela a baseline", detail: "Preserva a referência e abre a janela de acompanhamento." },
      { actor: "Agente", title: "Executa o plano", detail: "Trabalha sob guardrails e entrega evidência por execução." },
      { actor: "Humano", title: "Valida a evolução", detail: "Compara ciclos e decide autonomia, mentoria ou encerramento." },
    ],
  },
  adjustment_requested: {
    title: "Solicitar ajuste do plano",
    confirm: "Devolver para ajuste",
    success: "Ajuste solicitado. A nova revisão recebeu SLA e responsáveis.",
    tone: "text-[var(--wo-warning)]",
    consequence: "A versão atual fica congelada e o profissional recebe uma tarefa de reformulação com prazo.",
    nextSteps: [
      { actor: "Muster", title: "Preserva a versão", detail: "Mantém hipótese e evidências recusadas para comparação." },
      { actor: "Agente", title: "Reformula em até 4h", detail: "Incorpora o feedback sem ampliar risco ou escopo." },
      { actor: "Humano", title: "Revisa em até 8h", detail: "Confirma o novo contrato antes de liberar a execução." },
    ],
  },
  rejected: {
    title: "Rejeitar plano de desenvolvimento",
    confirm: "Rejeitar e bloquear execução",
    success: "Plano rejeitado. A execução foi bloqueada e o destino do profissional virou ação humana.",
    tone: "text-[var(--wo-danger)]",
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

function ProfessionalScreen({ agent }: { agent: ProfessionalAgent }) {
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
  const managerScorecard = agentManagerScorecards[agent.id] ?? {
    cost: agent.costPerExecution == null
      ? "Não medido"
      : agent.costPerExecution.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
    accuracy: agent.contractFulfillment,
    efficacy: agent.contractFulfillment,
    efficiency: agent.operationalHealth,
    adoption: agent.responsibilityCoverage,
    governance: agent.evidenceConfidence,
  };
  const decisionsQuery = useListProfessionalPlanDecisions(agent.id);
  const reevaluate = useReevaluateAgent();
  const recordDecision = useRecordProfessionalPlanDecision();
  const updatePlanAction = useUpdateProfessionalPlanAction();
  const latestDecision = decisionsQuery.data?.[0];
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
            `Reavaliação concluída com ${outcome.dataSource === "telemetry" ? "telemetria real" : "baseline"}: saúde ${outcome.healthScore}/100 e veredito ${outcome.verdict}.`,
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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--wo-accent)] text-sm font-medium text-[var(--wo-accent-ink)]">{agent.initials}</span><div><div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent)]">Prontuário profissional</div><h1 className="mt-1 text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)]">{agent.name}</h1><p className="mt-1 text-xs text-[var(--wo-muted)]">{agent.role} · {agent.team} · owner {agent.owner}</p><div className="mt-2"><PlatformStack platforms={agent.platforms} /></div></div></div>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge agent={agent} /><span className="rounded-full border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-2 py-1 text-[10px] text-[var(--wo-muted)]">Review: {agent.reviewDue}</span><button type="button" data-testid="reevaluate-professional" data-operational-action="reevaluate-agent" onClick={handleReevaluate} disabled={reevaluate.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-3 py-2 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50"><RefreshCw className={cn("h-3.5 w-3.5", reevaluate.isPending && "animate-spin")} />{reevaluate.isPending ? "Reavaliando…" : "Reavaliar agora"}</button></div>
      </div>

      {reevaluationMessage && <div className="rounded-xl bg-[color-mix(in_srgb,var(--wo-accent)_13%,var(--wo-card))] px-3 py-2 text-[11px] text-[var(--wo-accent)]" role="status">{reevaluationMessage}</div>}

      <Panel className="p-4 sm:p-5">
        <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Goal className="h-4 w-4" /></span><div><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">Contrato de propósito</span><h2 className="mt-2 max-w-4xl text-xl font-medium leading-snug text-[var(--wo-text)]">{agent.purpose}</h2></div></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3"><ContractList title="Deveres" icon={ClipboardCheck} items={agent.duties} /><ContractList title="Responsabilidades" icon={UserCheck} items={agent.responsibilities} /><ContractList title="Limites de atuação" icon={ShieldCheck} items={agent.boundaries} /></div>
      </Panel>

      <Panel className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Scorecard gerencial</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">As lentes executivas acompanham o contrato até o nível do agente.</p></div><span className="text-[9px] text-[var(--wo-muted)]">janela móvel de 30 dias</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">{[
          ["Custo / execução", managerScorecard.cost, "-12%", DatabaseZap],
          ["Acurácia", `${managerScorecard.accuracy}%`, "+2 pp", Target],
          ["Eficácia", `${managerScorecard.efficacy}%`, "outcome", Goal],
          ["Eficiência", `${managerScorecard.efficiency}%`, "tempo + recurso", Clock3],
          ["Adoção", `${managerScorecard.adoption}%`, "uso recorrente", Users],
          ["Governança", `${managerScorecard.governance}%`, "guardrails", ShieldCheck],
        ].map(([label, value, note, Icon]) => <div key={label as string} className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-center justify-between"><span className="text-[9px] text-[var(--wo-muted)]">{label as string}</span><Icon className="h-3.5 w-3.5 text-[var(--wo-primary)]" /></div><strong className="mt-3 block font-mono text-lg font-medium text-[var(--wo-text)]">{value as string}</strong><span className="mt-1 block text-[9px] text-[var(--wo-muted)]">{note as string}</span></div>)}</div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--wo-line)] px-4 py-3"><div><h2 className="text-sm font-medium text-[var(--wo-text)]">Avaliação do contrato</h2><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Baseline, compromisso, resultado e fonte de evidência.</p></div><span className="font-mono text-sm text-[var(--wo-text)]">{agent.contractFulfillment}%</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><th className="px-4 py-3 font-normal">Compromisso</th><th className="px-3 py-3 text-right font-normal">Baseline</th><th className="px-3 py-3 text-right font-normal">Meta</th><th className="px-3 py-3 text-right font-normal">Atual</th></tr></thead><tbody>{agent.metrics.map((metric) => <tr key={metric.label} className="border-t border-[var(--wo-line)]"><td className="px-4 py-3"><strong className="block font-medium text-[var(--wo-text)]">{metric.label}</strong><span className="mt-2 flex items-center gap-2 text-[10px] text-[var(--wo-muted)]"><PlatformStack platforms={platformIdsFromSource(metric.source)} compact />{metric.source}</span></td><td className="px-3 py-3 text-right font-mono text-[var(--wo-muted)]">{metric.baseline}</td><td className="px-3 py-3 text-right font-mono text-[var(--wo-muted)]">{metric.target}</td><td className={cn("px-3 py-3 text-right font-mono font-medium", metric.status === "off" ? "text-[var(--wo-danger)]" : metric.status === "watch" ? "text-[var(--wo-warning)]" : "text-[var(--wo-accent)]")}>{metric.current}</td></tr>)}</tbody></table></div>
        </Panel>
        <div className="space-y-3">
          <Panel className="p-4"><h2 className="text-sm font-medium text-[var(--wo-text)]">Leitura de desempenho</h2><div className="mt-4 space-y-3"><ScoreBar label="Propósito" value={agent.contractFulfillment} /><ScoreBar label="Saúde" value={agent.operationalHealth} /><ScoreBar label="Responsabilidade" value={agent.responsibilityCoverage} /><ScoreBar label="Evidência" value={agent.evidenceConfidence} /></div><div className="mt-4 rounded-xl border-l-2 border-[var(--wo-primary)] bg-[var(--wo-primary-soft)] p-3"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-primary)]">Diagnóstico</span><p className="mt-2 text-[11px] leading-relaxed text-[var(--wo-muted)]">{agent.diagnosis}</p></div></Panel>
          <Panel className="p-4"><div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--wo-muted)]"><Activity className="h-3.5 w-3.5" /> Evidência correlacionada</div><div className="mt-3 space-y-2"><div className="rounded-xl bg-[var(--wo-card-2)] p-3 text-[10px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-text)]">Telemetria:</strong> {agent.diagnosis}</div><div className="rounded-xl bg-[var(--wo-card-2)] p-3 text-[10px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-text)]">Cobertura:</strong> {agent.metrics.length > 0 ? `${agent.observedMetricCount ?? agent.metrics.length}/${agent.metrics.length} compromissos com evidência observada no último ciclo.` : "a baseline ainda não possui métricas suficientes."}</div></div></Panel>
        </div>
      </div>

      <Panel className="border-[var(--wo-accent)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--wo-accent)]">Plano de desenvolvimento</div><h2 className="mt-2 text-lg font-medium text-[var(--wo-text)]">{agent.recommendation}</h2></div><span className="text-right text-[10px] text-[var(--wo-muted)]">Próxima avaliação<br /><strong className="text-sm font-medium text-[var(--wo-accent)]">2 ciclos válidos</strong></span></div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">{[
          ["Muster · autônomo", "Preparar coorte", "Agrupar casos afetados, preservar evidência e agendar reavaliação.", Radar],
          [`${agent.name} · supervisionado`, "Executar plano corrigido", "Aplicar feedback dentro dos limites e reportar cada resultado.", Bot],
          ["Humano · decisão", "Validar evolução", "Confirmar que propósito, responsabilidades e guardrails voltaram ao combinado.", Users],
        ].map(([actor, title, description, Icon]) => <div key={actor as string} className="rounded-xl bg-[var(--wo-card-2)] p-3"><div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]"><span>{actor as string}</span><Icon className="h-3.5 w-3.5" /></div><strong className="mt-3 block text-xs font-medium text-[var(--wo-text)]">{title as string}</strong><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">{description as string}</p></div>)}</div>
        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--wo-line)] pt-4 lg:flex-row lg:items-center lg:justify-between"><div><strong className="text-xs font-medium text-[var(--wo-text)]">Decisão do responsável</strong><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Toda decisão abre um fluxo com responsável, SLA e evidência. Um novo ciclo só começa após concluir o atual.</p>{hasOpenWorkflow && <p className="mt-2 text-[10px] font-medium text-[var(--wo-warning)]">Fluxo em andamento · conclua “{activeAction?.title}” antes de registrar outra decisão.</p>}</div><div className="flex flex-wrap gap-2"><button type="button" data-testid="reject-professional-plan" data-operational-action="record-plan-decision" onClick={() => openDecision("rejected")} disabled={recordDecision.isPending || hasOpenWorkflow} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 py-2 text-xs text-[var(--wo-text)] disabled:opacity-50"><X className="h-3.5 w-3.5" /> Rejeitar</button><button type="button" data-testid="adjust-professional-plan" data-operational-action="record-plan-decision" onClick={() => openDecision("adjustment_requested")} disabled={recordDecision.isPending || hasOpenWorkflow} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 py-2 text-xs text-[var(--wo-text)] disabled:opacity-50"><FileCheck2 className="h-3.5 w-3.5" /> Ajustar</button><button type="button" data-testid="approve-professional-plan" data-operational-action="record-plan-decision" onClick={() => openDecision("approved")} disabled={recordDecision.isPending || hasOpenWorkflow} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-3 py-2 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Aprovar plano</button></div></div>
        {decisionMessage && <div className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--wo-accent)_13%,var(--wo-card))] px-3 py-2 text-[11px] text-[var(--wo-accent)]" role="status">{decisionMessage}</div>}
        {decisionError && <div className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--wo-danger)_12%,var(--wo-card))] px-3 py-2 text-[11px] text-[var(--wo-danger)]" role="alert">{decisionError}</div>}
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
                    <div className="flex items-center justify-between gap-2"><span className="text-[8px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{action.actorType} · {action.owner}</span><span className={cn("text-[8px]", action.status === "blocked" ? "text-[var(--wo-danger)]" : action.status === "completed" ? "text-[var(--wo-accent)]" : "text-[var(--wo-primary)]")}>{planActionStatusCopy[action.status]}</span></div>
                    <strong className="mt-2 block text-[11px] font-medium text-[var(--wo-text)]">{action.title}</strong>
                    <p className="mt-1 text-[9px] leading-relaxed text-[var(--wo-muted)]">{action.description}</p>
                    <span className="mt-2 block text-[8px] text-[var(--wo-muted)]">Prazo: {formatPlanDate(action.dueAt)}</span>
                    {action.evidence && <p className="mt-2 rounded-md bg-[var(--wo-card-2)] p-2 text-[9px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-text)]">Evidência:</strong> {action.evidence}</p>}
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
            <p className="mt-3 text-[9px] text-[var(--wo-muted)]">{decisionsQuery.data?.length ?? 0} decisão(ões) preservada(s) no histórico.</p>
          </div>
        )}
      </Panel>

      {decisionRequest && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="plan-decision-title">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-shell)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-primary)]">Decisão auditável</span><h2 id="plan-decision-title" className="mt-2 text-xl font-medium text-[var(--wo-text)]">{planDecisionCopy[decisionRequest.decision].title}</h2><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">{planDecisionCopy[decisionRequest.decision].consequence}</p></div><button type="button" aria-label="Fechar decisão" onClick={() => setDecisionRequest(null)} disabled={recordDecision.isPending} className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)] disabled:opacity-50"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] p-3" data-testid="plan-decision-preview"><span className="text-[8px] font-medium uppercase tracking-[0.1em] text-[var(--wo-primary)]">Depois de confirmar</span><div className="mt-2 space-y-2">{planDecisionCopy[decisionRequest.decision].nextSteps.map((step, index) => <div key={step.title} className="grid grid-cols-[20px_1fr] gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--wo-primary-soft)] text-[8px] text-[var(--wo-primary)]">{index + 1}</span><p className="text-[9px] leading-relaxed text-[var(--wo-muted)]"><strong className="text-[var(--wo-text)]">{step.actor} · {step.title}.</strong> {step.detail}</p></div>)}</div></div>
            <label className="mt-5 block"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Justificativa obrigatória</span><textarea value={decisionRequest.reason} onChange={(event) => setDecisionRequest((current) => current ? { ...current, reason: event.target.value } : current)} rows={4} autoFocus placeholder="Registre evidências, riscos e condição esperada para o próximo ciclo." className="mt-2 w-full resize-none rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-3 text-xs text-[var(--wo-text)] outline-none placeholder:text-[var(--wo-muted)] focus:border-[var(--wo-primary)]" /></label>
            {decisionError && <p className="mt-3 text-[10px] text-[var(--wo-danger)]" role="alert">{decisionError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDecisionRequest(null)} disabled={recordDecision.isPending} className="rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)] disabled:opacity-50">Cancelar</button><button type="button" onClick={submitDecision} disabled={recordDecision.isPending || decisionRequest.reason.trim().length < 3} className="rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50">{recordDecision.isPending ? "Registrando…" : planDecisionCopy[decisionRequest.decision].confirm}</button></div>
          </div>
        </div>
      )}

      {actionRequest && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="plan-action-title">
          <div className="w-full max-w-md rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-shell)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-primary)]">Evidência operacional</span><h2 id="plan-action-title" className="mt-2 text-lg font-medium text-[var(--wo-text)]">{actionRequest.status === "completed" ? "Concluir" : actionRequest.status === "blocked" ? "Bloquear" : "Cancelar"} · {actionRequest.title}</h2><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">Registre o resultado observado, o impedimento ou a razão do encerramento. Essa evidência permanece vinculada à decisão.</p></div><button type="button" aria-label="Fechar atualização" onClick={() => setActionRequest(null)} disabled={updatePlanAction.isPending} className="rounded-lg p-2 text-[var(--wo-muted)] hover:bg-[var(--wo-card-2)] disabled:opacity-50"><X className="h-4 w-4" /></button></div>
            <label className="mt-5 block"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Evidência obrigatória</span><textarea value={actionRequest.evidence} onChange={(event) => setActionRequest((current) => current ? { ...current, evidence: event.target.value } : current)} rows={4} autoFocus placeholder="Ex.: 40 casos válidos concluídos, acurácia de 93% e nenhum guardrail violado." className="mt-2 w-full resize-none rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-3 text-xs text-[var(--wo-text)] outline-none placeholder:text-[var(--wo-muted)] focus:border-[var(--wo-primary)]" /></label>
            {decisionError && <p className="mt-3 text-[10px] text-[var(--wo-danger)]" role="alert">{decisionError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setActionRequest(null)} disabled={updatePlanAction.isPending} className="rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)] disabled:opacity-50">Voltar</button><button type="button" onClick={submitActionTransition} disabled={updatePlanAction.isPending || actionRequest.evidence.trim().length < 3} className="rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-50">{updatePlanAction.isPending ? "Salvando…" : "Confirmar e continuar"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkforceOsLabPage({ defaultScreen, labMode = true }: { defaultScreen?: Screen; labMode?: boolean } = {}) {
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
  const agentsQuery = useListAgents(undefined, {
    query: { queryKey: getListAgentsQueryKey(), enabled: !labMode },
  });
  const operationalAgents = useMemo(
    () => (agentsQuery.data ?? []).map((agent) => adaptApiAgent(agent)),
    [agentsQuery.data],
  );
  const visibleAgents = labMode ? demoAgents : operationalAgents;
  const [selectedAgentId, setSelectedAgentId] = useState(resolvedRoute?.agentId ?? (labMode ? "sofia" : ""));
  const selectedAgentDetailQuery = useGetAgent(selectedAgentId, {
    query: {
      queryKey: getGetAgentQueryKey(selectedAgentId),
      enabled: !labMode && Boolean(selectedAgentId),
    },
  });
  const selectedAgent = useMemo(() => {
    const baseAgent = visibleAgents.find((agent) => agent.id === selectedAgentId)
      ?? visibleAgents[0]
      ?? null;
    if (labMode || !baseAgent || !selectedAgentDetailQuery.data) return baseAgent;
    return adaptApiAgent(selectedAgentDetailQuery.data.agent, selectedAgentDetailQuery.data);
  }, [labMode, selectedAgentDetailQuery.data, selectedAgentId, visibleAgents]);

  useEffect(() => {
    if (labMode) return;
    const nextRoute = resolveWorkforceRoute(location);
    if (!nextRoute) return;
    setScreen(nextRoute.screen);
    if (nextRoute.agentId) setSelectedAgentId(nextRoute.agentId);
  }, [labMode, location]);

  useEffect(() => {
    if (visibleAgents.length === 0) return;
    if (visibleAgents.some((agent) => agent.id === selectedAgentId)) return;
    setSelectedAgentId(visibleAgents[0]!.id);
  }, [selectedAgentId, visibleAgents]);

  function navigate(nextScreen: Screen) {
    if (labMode) {
      setScreen(nextScreen);
      return;
    }
    setLocation(routeForWorkforceScreen(nextScreen, selectedAgentId));
  }

  function openProfessional(agentId: string) {
    setSelectedAgentId(agentId);
    if (labMode) setScreen("professional");
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
    <div className="min-h-screen bg-[var(--wo-bg)] text-[var(--wo-text)] transition-colors duration-300" style={workforcePalettes[palette]} data-workforce-theme={palette} data-workforce-shell="true" data-workforce-screen={screen}>
      <div className="flex min-h-screen">
        <NavigationRail screen={screen} navigate={navigate} labMode={labMode} selectedAgentId={selectedAgent?.id ?? ""} />
        <div className="min-w-0 flex-1">
          <AppHeader palette={palette} setPalette={setPalette} labMode={labMode} screen={screen} />
          <main>
            {screen === "today" && <ManagerScreen selectAgent={openProfessional} navigate={navigate} agents={visibleAgents} operational={!labMode} />}
            {screen === "onboarding" && <OnboardingScreen navigate={navigate} />}
            {screen === "reports" && <ExecutiveReportsScreen />}
            {screen === "portfolio" && <PortfolioScreen agents={visibleAgents} selectedAgent={selectedAgent} onSelect={setSelectedAgentId} openProfessional={openProfessional} isLoading={!labMode && agentsQuery.isLoading} isError={!labMode && agentsQuery.isError} />}
            {screen === "professional" && (selectedAgent ? <ProfessionalScreen key={selectedAgent.id} agent={selectedAgent} /> : <div className="p-6"><Panel className="p-8"><h1 className="text-xl font-medium text-[var(--wo-text)]">Profissional não encontrado</h1><p className="mt-2 text-sm text-[var(--wo-muted)]">Admitir e conectar o agente é obrigatório antes de abrir seu prontuário operacional.</p><Link href="/admissao" className="mt-5 inline-flex rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">Abrir admissão</Link></Panel></div>)}
            {screen === "metrics" && (labMode ? <MetricsScreen /> : <MetricasPage embedded />)}
            {screen === "teams" && (labMode ? <MixedTeamsScreen /> : <OperationalMixedTeamsScreen />)}
            {screen === "journeys" && (labMode ? <JourneysScreen /> : <JourneysPage embedded />)}
            {screen === "benchmarks" && (labMode ? <BenchmarksScreen /> : <BenchmarksPage embedded />)}
            {screen === "connectors" && <ConnectorsScreen />}
            {screen === "settings" && (labMode ? <SettingsScreen /> : <GovernancePage embedded />)}
            {screen === "admission" && <AdmissionPage embedded />}
            {screen === "alerts" && <AlertsPage embedded />}
            {screen === "admin" && <AdminConsolePage />}
            {screen === "accountSettings" && <AccountSettingsPage embedded />}
            {screen === "profile" && <ProfilePage embedded />}
            {screen === "connection" && <ConectarPage embedded />}
          </main>
        </div>
      </div>
    </div>
  );
}
