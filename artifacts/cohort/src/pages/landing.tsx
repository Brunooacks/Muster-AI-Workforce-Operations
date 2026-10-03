import { useState, type CSSProperties } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  CloudCog,
  DatabaseZap,
  FileCheck2,
  Fingerprint,
  Gauge,
  Gavel,
  LockKeyhole,
  Network,
  Palette,
  Plug,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { MusterMark } from "@/components/logo";
import LandingDemo from "@/components/landing-demo";
import {
  WorkforceOverview,
  WORKFORCE_OVERVIEW_PT,
  type WorkforceOverviewLabels,
} from "@/components/workforce-overview";
import { LangSwitcher } from "@/components/lang-switcher";
import { useLang, type Lang } from "@/lib/i18n";
import { inviteContactUrl, inviteOnlyEnabled } from "@/lib/invite-only";

type LandingPaletteId = "graphite" | "dracula" | "mocha";

const LANDING_PALETTES: Record<LandingPaletteId, CSSProperties> = {
  graphite: {
    "--background": "220 38% 6%",
    "--foreground": "216 45% 96%",
    "--border": "218 24% 20%",
    "--input": "218 24% 20%",
    "--ring": "211 100% 68%",
    "--card": "220 30% 10%",
    "--card-foreground": "216 45% 96%",
    "--card-border": "218 24% 20%",
    "--popover": "220 30% 10%",
    "--popover-foreground": "216 45% 96%",
    "--primary": "211 100% 68%",
    "--primary-foreground": "220 44% 8%",
    "--secondary": "220 25% 14%",
    "--secondary-foreground": "216 45% 96%",
    "--muted": "220 25% 14%",
    "--muted-foreground": "217 16% 66%",
    "--accent": "266 90% 74%",
    "--accent-foreground": "220 44% 8%",
    "--chart-1": "190 95% 62%",
    "--chart-2": "42 96% 64%",
    "--chart-3": "350 88% 68%",
    "--chart-4": "266 90% 74%",
    "--chart-5": "211 100% 68%",
    colorScheme: "dark",
  } as CSSProperties,
  dracula: {
    "--background": "231 16% 14%",
    "--foreground": "60 30% 96%",
    "--border": "232 15% 34%",
    "--input": "232 15% 34%",
    "--ring": "265 89% 78%",
    "--card": "232 16% 20%",
    "--card-foreground": "60 30% 96%",
    "--card-border": "232 15% 34%",
    "--popover": "232 16% 20%",
    "--popover-foreground": "60 30% 96%",
    "--primary": "265 89% 78%",
    "--primary-foreground": "231 16% 14%",
    "--secondary": "232 15% 27%",
    "--secondary-foreground": "60 30% 96%",
    "--muted": "232 15% 27%",
    "--muted-foreground": "232 37% 78%",
    "--accent": "326 100% 74%",
    "--accent-foreground": "231 16% 14%",
    "--chart-1": "191 97% 77%",
    "--chart-2": "65 92% 76%",
    "--chart-3": "0 100% 67%",
    "--chart-4": "326 100% 74%",
    "--chart-5": "265 89% 78%",
    colorScheme: "dark",
  } as CSSProperties,
  mocha: {
    "--background": "240 22% 11%",
    "--foreground": "226 64% 88%",
    "--border": "237 17% 24%",
    "--input": "237 17% 24%",
    "--ring": "217 92% 76%",
    "--card": "237 17% 16%",
    "--card-foreground": "226 64% 88%",
    "--card-border": "237 17% 24%",
    "--popover": "237 17% 16%",
    "--popover-foreground": "226 64% 88%",
    "--primary": "217 92% 76%",
    "--primary-foreground": "240 22% 11%",
    "--secondary": "237 17% 20%",
    "--secondary-foreground": "226 64% 88%",
    "--muted": "237 17% 20%",
    "--muted-foreground": "228 24% 72%",
    "--accent": "316 72% 86%",
    "--accent-foreground": "240 22% 11%",
    "--chart-1": "217 92% 76%",
    "--chart-2": "23 92% 75%",
    "--chart-3": "343 81% 75%",
    "--chart-4": "267 84% 81%",
    "--chart-5": "189 71% 73%",
    colorScheme: "dark",
  } as CSSProperties,
};

const LANDING_PALETTE_OPTIONS: Array<{
  id: LandingPaletteId;
  label: string;
  color: string;
}> = [
  { id: "graphite", label: "Graphite", color: "#5ba7ff" },
  { id: "dracula", label: "Dracula", color: "#bd93f9" },
  { id: "mocha", label: "Mocha", color: "#89b4fa" },
];

const inviteOnly = inviteOnlyEnabled(import.meta.env.VITE_MUSTER_INVITE_ONLY);
const contactUrl = inviteContactUrl(import.meta.env.VITE_MUSTER_CONTACT_URL);

function InvitationAccess({ className }: { className: string }) {
  return (
    <div className={className} data-invite-only-access="true">
      <span>Acesso por convite</span>
      {contactUrl ? (
        <a href={contactUrl} className="underline underline-offset-4">
          Falar com a equipe
        </a>
      ) : (
        <span className="text-muted-foreground">
          Contate a equipe responsável.
        </span>
      )}
    </div>
  );
}

/* ── Dicionário da landing (pt canônico · en · es) ─────────── */

interface LandingDict {
  signIn: string;
  signUp: string;
  signUpShort: string;
  nav: [string, string, string, string];
  eyebrow: string;
  h1a: string;
  h1b: string;
  sub: string;
  heroProofs: [string, string, string];
  schematicHeader: string;
  live: string;
  ctaMain: string;
  ctaSecondary: string;
  proofLabel: string;
  proofItems: Array<{ title: string; desc: string }>;
  sectionEyebrow: string;
  sectionTitle: string;
  features: Array<{ title: string; desc: string }>;
  demoEyebrow: string;
  demoTitle: string;
  demoSub: string;
  reportEyebrow: string;
  reportTitle: string;
  reportSub: string;
  reportSummary: string;
  reportDecision: string;
  reportAction: string;
  reportMetrics: [string, string, string];
  reportFooter: string;
  aiEyebrow: string;
  aiTitle: string;
  aiSub: string;
  aiCards: Array<{ title: string; desc: string; badge: string }>;
  enterpriseEyebrow: string;
  enterpriseTitle: string;
  enterpriseSub: string;
  enterpriseCards: Array<{ title: string; desc: string }>;
  finalTitleA: string;
  finalTitleB: string;
  finalSub: string;
  finalCta: string;
  footerRight: string;
  ticker: Array<[string, string, string, string]>;
  mvpEyebrow: string;
  mvpTitle: string;
  mvpSub: string;
  mvpCards: Array<{ title: string; desc: string; meta: string; href: string }>;
  overview: WorkforceOverviewLabels;
}

const OVERVIEW_EN: WorkforceOverviewLabels = {
  aria: "Muster Workforce OS connecting cloud, hybrid and local environments to professional contracts, mixed teams, A2A journeys and continuous supervision.",
  environments: "Connected environments",
  environmentItems: ["Cloud", "Hybrid", "On-premise / local"],
  connected: "connected",
  professionalRecord: "Professional contract",
  agentName: "Vega",
  agentRole: "Continuous delivery operator",
  purpose: "Contracted purpose",
  purposeText: "Deliver reliable changes within the approved technical scope.",
  scores: ["Purpose", "Quality", "Evidence"],
  contractStatus: "Contract fulfilled",
  mixedTeam: "Mixed team",
  teamMembers: ["Agent executes", "Agent recommends", "Human accountable"],
  journey: "A2A journey",
  journeyName: "Safe continuous delivery",
  stages: ["Plan", "Implement", "Authorize", "Observe"],
  loop: "Management loop",
  loopItems: ["Collect", "Evaluate", "Decide", "Develop"],
  live: "continuous supervision",
};

const OVERVIEW_ES: WorkforceOverviewLabels = {
  aria: "Muster Workforce OS conectando ambientes cloud, híbridos y locales con contratos profesionales, equipos mixtos, jornadas A2A y supervisión continua.",
  environments: "Ambientes conectados",
  environmentItems: ["Cloud", "Híbrido", "On-premise / local"],
  connected: "conectado",
  professionalRecord: "Contrato profesional",
  agentName: "Vega",
  agentRole: "Operadora de entrega continua",
  purpose: "Propósito contratado",
  purposeText:
    "Entregar cambios confiables dentro del alcance técnico aprobado.",
  scores: ["Propósito", "Calidad", "Evidencia"],
  contractStatus: "Contrato cumplido",
  mixedTeam: "Equipo mixto",
  teamMembers: ["Agente ejecuta", "Agente recomienda", "Humano responde"],
  journey: "Jornada A2A",
  journeyName: "Entrega continua segura",
  stages: ["Planificar", "Implementar", "Autorizar", "Observar"],
  loop: "Ciclo de gestión",
  loopItems: ["Recopilar", "Evaluar", "Decidir", "Desarrollar"],
  live: "supervisión continua",
};

const L: Record<Lang, LandingDict> = {
  pt: {
    signIn: "Entrar",
    signUp: "Iniciar avaliação",
    signUpShort: "Avaliar",
    nav: ["Visão", "Plataforma", "Governança", "Board"],
    eyebrow: "Enterprise AI Workforce Governance",
    h1a: "Agentes executam.",
    h1b: "O Muster prova se cumprem o combinado.",
    sub: "A camada de gestão para transformar agentes cloud, on-premise e locais em uma força de trabalho responsável — com identidade, propósito, contratos de performance, supervisão contínua e decisões explicáveis.",
    heroProofs: [
      "Fatos calculados antes da narrativa de IA",
      "Evidência ligada a cada métrica e decisão",
      "Controle por companhia, área, equipe e agente",
    ],
    schematicHeader: "// visão operacional — do runtime ao resultado",
    live: "ao vivo",
    ctaMain: "Iniciar diagnóstico da força de trabalho",
    ctaSecondary: "Ver o modelo operacional",
    proofLabel: "Uma cadeia de controle, não mais uma tela de métricas",
    proofItems: [
      {
        title: "Conectar",
        desc: "Cloud, SaaS, Docker, Kubernetes, vLLM e ambientes privados.",
      },
      {
        title: "Qualificar",
        desc: "Código, configuração e telemetria viram função, risco e contrato inicial.",
      },
      {
        title: "Supervisionar",
        desc: "Execuções, custos, qualidade, handoffs e desvios em ciclo contínuo.",
      },
      {
        title: "Decidir",
        desc: "Recomendações aprovadas viram ações com owner, autonomia, SLA e evidência.",
      },
    ],
    sectionEyebrow: "Sistema operacional da força de trabalho de IA",
    sectionTitle:
      "Da identidade do agente à decisão do board — com o mesmo contexto e a mesma evidência.",
    features: [
      {
        title: "Contrato profissional",
        desc: "Propósito, deveres, responsabilidades, owner, autonomia e critérios de sucesso versionados para cada função.",
      },
      {
        title: "Métricas por função",
        desc: "Qualidade técnica, confiabilidade, segurança, experiência e impacto — economia é uma dimensão opcional, não o único placar.",
      },
      {
        title: "Equipes mistas",
        desc: "Pessoas e agentes compartilham um propósito com direitos de decisão, supervisão e accountability explícitos.",
      },
      {
        title: "Jornadas A2A",
        desc: "Acompanhe agentes, subagentes, pessoas e handoffs até o resultado end-to-end, sem premiar apenas sucesso local.",
      },
      {
        title: "Decisão e desenvolvimento",
        desc: "Aprove, ajuste ou rejeite recomendações e desdobre ações entre Muster, agente e humano com SLA.",
      },
      {
        title: "Infraestrutura plural",
        desc: "Conecte cloud, SaaS, Kubernetes, Docker, vLLM e ambientes privados pelo mesmo contrato de telemetria e governança.",
      },
    ],
    demoEyebrow: "Da observação à ação",
    demoTitle:
      "Veja o Muster transformar performance em uma decisão operacional.",
    demoSub:
      "A simulação percorre admissão, avaliação multicamada, detecção de vitória ilusória e veredito com plano de desenvolvimento.",
    reportEyebrow: "Inteligência executiva",
    reportTitle:
      "O board não precisa de mais dashboards. Precisa de memória decisória.",
    reportSub:
      "Snapshots mensais versionados mostram o que mudou, por que importa, quais limitações existem e quem responde pela próxima ação.",
    reportSummary:
      "A força de trabalho ampliou cobertura sem degradar qualidade. O principal risco está concentrado em governança e dois handoffs críticos.",
    reportDecision: "Decisão recomendada",
    reportAction:
      "Expandir autonomia apenas para agentes com cobertura de evidência acima do contrato e manter revisão humana nos handoffs críticos.",
    reportMetrics: ["Propósito", "Saúde operacional", "Cobertura de evidência"],
    reportFooter:
      "Narrativa assistida por IA · métricas determinísticas · revisão humana",
    aiEyebrow: "IA com responsabilidade",
    aiTitle:
      "Use IA para ampliar a capacidade de gestão — nunca para fabricar certeza.",
    aiSub:
      "O Muster separa fatos, hipóteses e decisões. A IA interpreta contexto e acelera o trabalho do gestor; o ledger preserva origem, confiança e revisão.",
    aiCards: [
      {
        title: "Discovery assistido",
        desc: "Lê código, contratos e logs para sugerir função, riscos, métricas e lacunas de instrumentação.",
        badge: "Humano publica",
      },
      {
        title: "Diagnóstico contínuo",
        desc: "Explica anomalias, correlaciona mudanças e propõe testes sem presumir causalidade.",
        badge: "Evidência obrigatória",
      },
      {
        title: "Planos de desenvolvimento",
        desc: "Transforma vereditos em ações para Muster, agente ou humano, com SLA e critério de conclusão.",
        badge: "Autonomia por política",
      },
      {
        title: "Narrativa para o board",
        desc: "Adapta a leitura ao público sem alterar números, qualidade, portfólio ou limitações.",
        badge: "Fatos imutáveis",
      },
    ],
    enterpriseEyebrow: "Arquitetura para ambientes reais",
    enterpriseTitle: "Governança central. Execução onde o cliente decidir.",
    enterpriseSub:
      "O Muster cobre organizações cloud-first, ambientes híbridos e operações privadas com infraestrutura própria — sem transformar uma condição técnica em premissa comercial.",
    enterpriseCards: [
      {
        title: "Isolamento por tenant",
        desc: "Companhia como raiz de segurança, com áreas, squads, usuários e agentes dentro do mesmo modelo de governança.",
      },
      {
        title: "Deployment flexível",
        desc: "Coletores e runtimes podem operar em cloud, on-premise ou local, inclusive com fallback por política.",
      },
      {
        title: "Auditoria de ponta a ponta",
        desc: "Eventos, métricas, recomendações, aprovações e ações permanecem ligados à sua origem.",
      },
      {
        title: "Integração por contrato",
        desc: "API, webhooks, SDK e templates de conectores reduzem dependência de uma única plataforma.",
      },
    ],
    finalTitleA: "Se um agente toma decisões pela empresa, a empresa precisa",
    finalTitleB: "saber como ele trabalha.",
    finalSub:
      "Comece com um assessment objetivo: conecte uma execução real, estabeleça o contrato de performance e produza a primeira revisão executiva.",
    finalCta: "Iniciar avaliação enterprise",
    footerRight: "Identidade · Evidência · Decisão · Accountability",
    ticker: [
      ["text-chart-1", "● CONTRATO CUMPRIDO", "Vega · entrega contínua", "91%"],
      ["text-chart-2", "◆ REVIEW NECESSÁRIO", "Sofia · suporte N1", "42 min"],
      ["text-chart-1", "↗ JORNADA A2A", "Entrega contínua segura", "94% e2e"],
      ["text-chart-1", "● EVIDÊNCIA", "traces correlacionados", "97%"],
      [
        "text-chart-2",
        "◆ BENCHMARK",
        "Revisor PR · pares equivalentes",
        "mediana",
      ],
      ["text-chart-1", "● EQUIPE MISTA", "7 pessoas · 4 agentes", "saudável"],
      ["text-chart-3", "▼ GUARDRAIL", "mudança fora do escopo", "bloqueada"],
      ["text-chart-1", "● CLOUD + LOCAL", "fallback por política", "pronto"],
    ],
    mvpEyebrow: "O modelo operacional completo",
    mvpTitle: "Do portfólio profissional à jornada completa.",
    mvpSub:
      "Modele a função, componha equipes, conecte a execução e mantenha um ciclo contínuo de evidência, decisão e desenvolvimento.",
    mvpCards: [
      {
        title: "Portfólio profissional",
        desc: "Veja cumprimento do propósito × saúde operacional e abra o prontuário de cada agente.",
        meta: "Função + contrato + evolução",
        href: "/prototipos/workforce-os",
      },
      {
        title: "Métricas por domínio",
        desc: "Defina indicadores comparáveis para engenharia, atendimento, operações, risco e outras funções.",
        meta: "Baseline + alvo + fonte",
        href: "/metricas",
      },
      {
        title: "Equipes mistas",
        desc: "Distribua execução, recomendação, aprovação e accountability entre pessoas e agentes.",
        meta: "Propósito + papéis + decisão",
        href: "/equipes",
      },
      {
        title: "Jornadas A2A",
        desc: "Monitore etapas, contratos de handoff, gargalos e resultado end-to-end.",
        meta: "Participantes + handoff + SLA",
        href: "/jornadas",
      },
      {
        title: "Benchmark contextual",
        desc: "Compare profissionais equivalentes por função, risco, maturidade e grau de autonomia.",
        meta: "Coorte + normalização + evidência",
        href: "/benchmarks",
      },
      {
        title: "Conectores e governança",
        desc: "Integre cloud, SaaS e runtimes privados sem impor uma arquitetura única ao cliente.",
        meta: "Cloud + híbrido + local",
        href: "/conectores",
      },
    ],
    overview: WORKFORCE_OVERVIEW_PT,
  },
  en: {
    signIn: "Sign in",
    signUp: "Start assessment",
    signUpShort: "Assess",
    nav: ["Vision", "Platform", "Governance", "Board"],
    eyebrow: "Enterprise AI Workforce Governance",
    h1a: "Agents execute.",
    h1b: "Muster proves whether they deliver what was agreed.",
    sub: "The management layer that turns cloud, on-premise and local agents into an accountable workforce — with identity, purpose, performance contracts, continuous supervision and explainable decisions.",
    heroProofs: [
      "Calculated facts before AI narrative",
      "Evidence linked to every metric and decision",
      "Control by company, area, team and agent",
    ],
    schematicHeader: "// operational view — from runtime to outcome",
    live: "live",
    ctaMain: "Start workforce diagnosis",
    ctaSecondary: "See the operating model",
    proofLabel: "A control chain, not another metrics screen",
    proofItems: [
      {
        title: "Connect",
        desc: "Cloud, SaaS, Docker, Kubernetes, vLLM and private environments.",
      },
      {
        title: "Qualify",
        desc: "Code, configuration and telemetry become role, risk and an initial contract.",
      },
      {
        title: "Supervise",
        desc: "Executions, cost, quality, handoffs and deviations in a continuous loop.",
      },
      {
        title: "Decide",
        desc: "Approved recommendations become actions with owner, autonomy, SLA and evidence.",
      },
    ],
    sectionEyebrow: "The operating system for the AI workforce",
    sectionTitle:
      "From agent identity to board decision — with the same context and evidence.",
    features: [
      {
        title: "Professional contract",
        desc: "Version purpose, duties, responsibilities, owner, autonomy and success criteria for every role.",
      },
      {
        title: "Role-specific metrics",
        desc: "Technical quality, reliability, safety, experience and impact — economics is optional, not the only score.",
      },
      {
        title: "Mixed teams",
        desc: "People and agents share a purpose with explicit decision rights, supervision and accountability.",
      },
      {
        title: "A2A journeys",
        desc: "Follow agents, subagents, people and handoffs to the end-to-end outcome instead of rewarding local success.",
      },
      {
        title: "Decision and development",
        desc: "Approve, adjust or reject recommendations and unfold actions across Muster, agent and human with an SLA.",
      },
      {
        title: "Plural infrastructure",
        desc: "Connect cloud, SaaS, Kubernetes, Docker, vLLM and private environments through one telemetry and governance contract.",
      },
    ],
    demoEyebrow: "From observation to action",
    demoTitle: "See Muster turn performance into an operational decision.",
    demoSub:
      "The simulation covers admission, multi-layer evaluation, illusory-win detection and a verdict with a development plan.",
    reportEyebrow: "Executive intelligence",
    reportTitle:
      "The board does not need more dashboards. It needs decision memory.",
    reportSub:
      "Versioned monthly snapshots show what changed, why it matters, which limitations remain and who owns the next action.",
    reportSummary:
      "The workforce expanded coverage without degrading quality. The main risk is concentrated in governance and two critical handoffs.",
    reportDecision: "Recommended decision",
    reportAction:
      "Expand autonomy only for agents whose evidence coverage exceeds the contract, while keeping human review on critical handoffs.",
    reportMetrics: ["Purpose", "Operational health", "Evidence coverage"],
    reportFooter:
      "AI-assisted narrative · deterministic metrics · human review",
    aiEyebrow: "Responsible AI",
    aiTitle:
      "Use AI to expand management capacity — never to manufacture certainty.",
    aiSub:
      "Muster separates facts, hypotheses and decisions. AI interprets context and accelerates managers; the ledger preserves source, confidence and review.",
    aiCards: [
      {
        title: "Assisted discovery",
        desc: "Reads code, contracts and logs to suggest role, risk, metrics and instrumentation gaps.",
        badge: "Human publishes",
      },
      {
        title: "Continuous diagnosis",
        desc: "Explains anomalies, correlates changes and proposes tests without assuming causality.",
        badge: "Evidence required",
      },
      {
        title: "Development plans",
        desc: "Turns verdicts into actions for Muster, the agent or a human, with SLA and completion criteria.",
        badge: "Policy-based autonomy",
      },
      {
        title: "Board narrative",
        desc: "Adapts the reading to the audience without changing numbers, quality, portfolio or limitations.",
        badge: "Immutable facts",
      },
    ],
    enterpriseEyebrow: "Architecture for real environments",
    enterpriseTitle:
      "Central governance. Execution wherever the customer decides.",
    enterpriseSub:
      "Muster supports cloud-first organizations, hybrid environments and private operations with their own infrastructure — without turning one technical condition into a commercial premise.",
    enterpriseCards: [
      {
        title: "Tenant isolation",
        desc: "The company is the security root, with areas, squads, users and agents in one governance model.",
      },
      {
        title: "Flexible deployment",
        desc: "Collectors and runtimes can operate in cloud, on-premise or locally, including policy-based fallback.",
      },
      {
        title: "End-to-end audit",
        desc: "Events, metrics, recommendations, approvals and actions remain linked to their origin.",
      },
      {
        title: "Contract-based integration",
        desc: "API, webhooks, SDK and connector templates reduce dependency on a single platform.",
      },
    ],
    finalTitleA:
      "If an agent makes decisions for the company, the company must",
    finalTitleB: "know how it works.",
    finalSub:
      "Start with an objective assessment: connect a real execution, establish the performance contract and produce the first executive review.",
    finalCta: "Start enterprise assessment",
    footerRight: "Identity · Evidence · Decision · Accountability",
    ticker: [
      [
        "text-chart-1",
        "● CONTRACT FULFILLED",
        "Vega · continuous delivery",
        "91%",
      ],
      ["text-chart-2", "◆ REVIEW REQUIRED", "Sofia · tier-1 support", "42 min"],
      ["text-chart-1", "↗ A2A JOURNEY", "Safe continuous delivery", "94% e2e"],
      ["text-chart-1", "● EVIDENCE", "correlated traces", "97%"],
      [
        "text-chart-2",
        "◆ BENCHMARK",
        "PR Reviewer · equivalent peers",
        "median",
      ],
      ["text-chart-1", "● MIXED TEAM", "7 people · 4 agents", "healthy"],
      ["text-chart-3", "▼ GUARDRAIL", "out-of-scope change", "blocked"],
      ["text-chart-1", "● CLOUD + LOCAL", "policy-based fallback", "ready"],
    ],
    mvpEyebrow: "The complete operating model",
    mvpTitle: "From professional portfolio to complete journey.",
    mvpSub:
      "Model the role, compose teams, connect execution and sustain a continuous evidence, decision and development loop.",
    mvpCards: [
      {
        title: "Professional portfolio",
        desc: "See purpose fulfillment × operational health and open every agent's professional record.",
        meta: "Role + contract + development",
        href: "/prototipos/workforce-os",
      },
      {
        title: "Domain metrics",
        desc: "Define comparable indicators for engineering, support, operations, risk and other roles.",
        meta: "Baseline + target + source",
        href: "/metricas",
      },
      {
        title: "Mixed teams",
        desc: "Distribute execution, recommendation, approval and accountability across people and agents.",
        meta: "Purpose + roles + decision",
        href: "/equipes",
      },
      {
        title: "A2A journeys",
        desc: "Monitor stages, handoff contracts, bottlenecks and end-to-end outcomes.",
        meta: "Participants + handoff + SLA",
        href: "/jornadas",
      },
      {
        title: "Contextual benchmark",
        desc: "Compare equivalent professionals by role, risk, maturity and autonomy level.",
        meta: "Cohort + normalization + evidence",
        href: "/benchmarks",
      },
      {
        title: "Connectors and governance",
        desc: "Integrate cloud, SaaS and private runtimes without imposing one architecture on every customer.",
        meta: "Cloud + hybrid + local",
        href: "/conectores",
      },
    ],
    overview: OVERVIEW_EN,
  },
  es: {
    signIn: "Iniciar sesión",
    signUp: "Iniciar evaluación",
    signUpShort: "Evaluar",
    nav: ["Visión", "Plataforma", "Gobernanza", "Board"],
    eyebrow: "Enterprise AI Workforce Governance",
    h1a: "Los agentes ejecutan.",
    h1b: "Muster demuestra si cumplen lo acordado.",
    sub: "La capa de gestión que convierte agentes cloud, on-premise y locales en una fuerza laboral responsable, con identidad, propósito, contratos de desempeño, supervisión continua y decisiones explicables.",
    heroProofs: [
      "Hechos calculados antes de la narrativa de IA",
      "Evidencia vinculada a cada métrica y decisión",
      "Control por compañía, área, equipo y agente",
    ],
    schematicHeader: "// visión operativa — del runtime al resultado",
    live: "en vivo",
    ctaMain: "Iniciar diagnóstico de la fuerza laboral",
    ctaSecondary: "Ver el modelo operativo",
    proofLabel: "Una cadena de control, no otra pantalla de métricas",
    proofItems: [
      {
        title: "Conectar",
        desc: "Cloud, SaaS, Docker, Kubernetes, vLLM y ambientes privados.",
      },
      {
        title: "Calificar",
        desc: "Código, configuración y telemetría se convierten en función, riesgo y contrato inicial.",
      },
      {
        title: "Supervisar",
        desc: "Ejecuciones, costo, calidad, handoffs y desvíos en un ciclo continuo.",
      },
      {
        title: "Decidir",
        desc: "Recomendaciones aprobadas se convierten en acciones con owner, autonomía, SLA y evidencia.",
      },
    ],
    sectionEyebrow: "El sistema operativo de la fuerza laboral de IA",
    sectionTitle:
      "De la identidad del agente a la decisión del board, con el mismo contexto y evidencia.",
    features: [
      {
        title: "Contrato profesional",
        desc: "Versiona propósito, deberes, responsabilidades, owner, autonomía y criterios de éxito para cada función.",
      },
      {
        title: "Métricas por función",
        desc: "Calidad técnica, confiabilidad, seguridad, experiencia e impacto; economía es opcional, no el único marcador.",
      },
      {
        title: "Equipos mixtos",
        desc: "Personas y agentes comparten un propósito con derechos de decisión, supervisión y accountability explícitos.",
      },
      {
        title: "Jornadas A2A",
        desc: "Acompaña agentes, subagentes, personas y handoffs hasta el resultado end-to-end.",
      },
      {
        title: "Decisión y desarrollo",
        desc: "Aprueba, ajusta o rechaza recomendaciones y distribuye acciones entre Muster, agente y humano con SLA.",
      },
      {
        title: "Infraestructura plural",
        desc: "Conecta cloud, SaaS, Kubernetes, Docker, vLLM y ambientes privados con un mismo contrato de gobernanza.",
      },
    ],
    demoEyebrow: "De la observación a la acción",
    demoTitle:
      "Mira cómo Muster transforma desempeño en una decisión operativa.",
    demoSub:
      "La simulación recorre admisión, evaluación multicapa, detección de victoria ilusoria y veredicto con plan de desarrollo.",
    reportEyebrow: "Inteligencia ejecutiva",
    reportTitle:
      "El board no necesita más dashboards. Necesita memoria de decisión.",
    reportSub:
      "Snapshots mensuales versionados muestran qué cambió, por qué importa, qué limitaciones existen y quién responde por la próxima acción.",
    reportSummary:
      "La fuerza laboral amplió cobertura sin degradar calidad. El principal riesgo está concentrado en gobernanza y dos handoffs críticos.",
    reportDecision: "Decisión recomendada",
    reportAction:
      "Ampliar autonomía solo para agentes con cobertura de evidencia superior al contrato y mantener revisión humana en los handoffs críticos.",
    reportMetrics: ["Propósito", "Salud operativa", "Cobertura de evidencia"],
    reportFooter:
      "Narrativa asistida por IA · métricas determinísticas · revisión humana",
    aiEyebrow: "IA con responsabilidad",
    aiTitle:
      "Usa IA para ampliar la capacidad de gestión, nunca para fabricar certeza.",
    aiSub:
      "Muster separa hechos, hipótesis y decisiones. La IA interpreta contexto y acelera al gestor; el ledger preserva origen, confianza y revisión.",
    aiCards: [
      {
        title: "Discovery asistido",
        desc: "Lee código, contratos y logs para sugerir función, riesgos, métricas y brechas de instrumentación.",
        badge: "Humano publica",
      },
      {
        title: "Diagnóstico continuo",
        desc: "Explica anomalías, correlaciona cambios y propone pruebas sin asumir causalidad.",
        badge: "Evidencia obligatoria",
      },
      {
        title: "Planes de desarrollo",
        desc: "Convierte veredictos en acciones para Muster, agente o humano, con SLA y criterio de conclusión.",
        badge: "Autonomía por política",
      },
      {
        title: "Narrativa para el board",
        desc: "Adapta la lectura al público sin alterar números, calidad, portafolio o limitaciones.",
        badge: "Hechos inmutables",
      },
    ],
    enterpriseEyebrow: "Arquitectura para ambientes reales",
    enterpriseTitle: "Gobernanza central. Ejecución donde el cliente decida.",
    enterpriseSub:
      "Muster cubre organizaciones cloud-first, ambientes híbridos y operaciones privadas con infraestructura propia, sin convertir una condición técnica en premisa comercial.",
    enterpriseCards: [
      {
        title: "Aislamiento por tenant",
        desc: "La compañía es la raíz de seguridad, con áreas, squads, usuarios y agentes en un mismo modelo de gobernanza.",
      },
      {
        title: "Deployment flexible",
        desc: "Coletores y runtimes pueden operar en cloud, on-premise o local, incluso con fallback por política.",
      },
      {
        title: "Auditoría end-to-end",
        desc: "Eventos, métricas, recomendaciones, aprobaciones y acciones permanecen vinculados a su origen.",
      },
      {
        title: "Integración por contrato",
        desc: "API, webhooks, SDK y templates de conectores reducen dependencia de una única plataforma.",
      },
    ],
    finalTitleA:
      "Si un agente toma decisiones por la empresa, la empresa necesita",
    finalTitleB: "saber cómo trabaja.",
    finalSub:
      "Comienza con un assessment objetivo: conecta una ejecución real, establece el contrato de desempeño y produce la primera revisión ejecutiva.",
    finalCta: "Iniciar evaluación enterprise",
    footerRight: "Identidad · Evidencia · Decisión · Accountability",
    ticker: [
      ["text-chart-1", "● CONTRATO CUMPLIDO", "Vega · entrega continua", "91%"],
      ["text-chart-2", "◆ REVISIÓN NECESARIA", "Sofia · soporte N1", "42 min"],
      ["text-chart-1", "↗ JORNADA A2A", "Entrega continua segura", "94% e2e"],
      ["text-chart-1", "● EVIDENCIA", "traces correlacionados", "97%"],
      [
        "text-chart-2",
        "◆ BENCHMARK",
        "Revisor PR · pares equivalentes",
        "mediana",
      ],
      ["text-chart-1", "● EQUIPO MIXTO", "7 personas · 4 agentes", "saludable"],
      ["text-chart-3", "▼ GUARDRAIL", "cambio fuera de alcance", "bloqueado"],
      ["text-chart-1", "● CLOUD + LOCAL", "fallback por política", "listo"],
    ],
    mvpEyebrow: "El modelo operativo completo",
    mvpTitle: "Del portafolio profesional a la jornada completa.",
    mvpSub:
      "Modela la función, compone equipos, conecta la ejecución y mantiene un ciclo continuo de evidencia, decisión y desarrollo.",
    mvpCards: [
      {
        title: "Portafolio profesional",
        desc: "Observa propósito × salud operativa y abre el expediente profesional de cada agente.",
        meta: "Función + contrato + evolución",
        href: "/prototipos/workforce-os",
      },
      {
        title: "Métricas por dominio",
        desc: "Define indicadores comparables para ingeniería, atención, operaciones, riesgo y otras funciones.",
        meta: "Baseline + objetivo + fuente",
        href: "/metricas",
      },
      {
        title: "Equipos mixtos",
        desc: "Distribuye ejecución, recomendación, aprobación y accountability entre personas y agentes.",
        meta: "Propósito + roles + decisión",
        href: "/equipes",
      },
      {
        title: "Jornadas A2A",
        desc: "Monitorea etapas, contratos de handoff, cuellos de botella y resultados end-to-end.",
        meta: "Participantes + handoff + SLA",
        href: "/jornadas",
      },
      {
        title: "Benchmark contextual",
        desc: "Compara profesionales equivalentes por función, riesgo, madurez y autonomía.",
        meta: "Cohorte + normalización + evidencia",
        href: "/benchmarks",
      },
      {
        title: "Conectores y gobernanza",
        desc: "Integra cloud, SaaS y runtimes privados sin imponer una arquitectura única.",
        meta: "Cloud + híbrido + local",
        href: "/conectores",
      },
    ],
    overview: OVERVIEW_ES,
  },
};

/* ── Ticker de vereditos (pregão da frota) ─────────────────── */
function VerdictTicker({ items }: { items: LandingDict["ticker"] }) {
  const reel = [...items, ...items]; // duas cópias → -50% loopa sem emenda
  return (
    <div
      aria-hidden="true"
      className="relative h-10 w-full overflow-hidden whitespace-nowrap border-b border-primary/25 font-mono text-xs tracking-wide"
    >
      <div
        className="ops-reel-anim absolute left-0 top-2.5 inline-flex gap-11 pr-11"
        style={{ animation: "ops-reel 36s linear infinite" }}
      >
        {reel.map(([tone, tag, who, score], i) => (
          <span key={i} className="inline-flex gap-3">
            <span className={tone}>{tag}</span>
            <span className="text-foreground/70">{who}</span>
            <span className="text-foreground/40">{score}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const FEATURE_ICONS = [Fingerprint, Gauge, Users, Activity, Gavel, Plug];
const OPERATING_MODEL_ICONS = [
  Fingerprint,
  Gauge,
  Users,
  Activity,
  Target,
  Plug,
];
const PROOF_ICONS = [Plug, ScanSearch, Activity, Gavel];
const AI_ICONS = [ScanSearch, DatabaseZap, Target, FileCheck2];
const ENTERPRISE_ICONS = [Building2, CloudCog, LockKeyhole, Network];

function ExecutiveBriefPreview({ t }: { t: LandingDict }) {
  const values = ["92%", "86%", "94%"];
  const deltas = ["+4 pp", "+2 pp", "+7 pp"];
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-[0_32px_100px_hsl(var(--background)/0.75)]">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/12 to-transparent" />
      <div className="relative border-b border-card-border px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">
              Board Brief · monthly snapshot
            </span>
            <h2 className="mt-1 font-serif text-xl font-medium">
              AI Workforce Review
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-primary">
            <CheckCircle2 className="h-3 w-3" /> decision ready
          </span>
        </div>
      </div>
      <div className="relative p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2">
          {t.reportMetrics.map((metric, index) => (
            <div
              key={metric}
              className="rounded-xl border border-card-border bg-background/55 p-3"
            >
              <span className="block text-[9px] leading-tight text-muted-foreground">
                {metric}
              </span>
              <strong className="mt-2 block font-mono text-xl font-medium text-foreground">
                {values[index]}
              </strong>
              <span className="mt-1 block font-mono text-[8px] text-primary">
                {deltas[index]} MoM
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.055] p-4">
          <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> executive reading
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-foreground/85">
            {t.reportSummary}
          </p>
        </div>
        <div className="mt-3 rounded-xl border border-card-border p-4">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">
            {t.reportDecision}
          </span>
          <div className="mt-2 flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[11px] leading-relaxed text-foreground">
              {t.reportAction}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>{t.reportFooter}</span>
          <span>illustrative data</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { lang } = useLang();
  const t = L[lang];
  const [palette, setPaletteState] = useState<LandingPaletteId>(() => {
    const storedPalette = window.localStorage.getItem("muster-workforce-theme");
    return storedPalette === "dracula" ||
      storedPalette === "mocha" ||
      storedPalette === "graphite"
      ? storedPalette
      : "graphite";
  });

  function setPalette(nextPalette: LandingPaletteId) {
    setPaletteState(nextPalette);
    window.localStorage.setItem("muster-workforce-theme", nextPalette);
  }

  return (
    <div
      className="landing-surface min-h-[100dvh] overflow-x-hidden bg-background text-foreground transition-colors duration-300"
      style={LANDING_PALETTES[palette]}
      data-landing-theme={palette}
    >
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Muster — página inicial"
          >
            <MusterMark className="h-7 w-7" />
            <span className="font-serif text-lg font-medium tracking-tight">
              Muster
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
              AI Workforce Operations
            </span>
          </Link>
          <nav
            className="hidden items-center gap-6 lg:flex"
            aria-label="Navegação principal"
          >
            {["visao", "plataforma", "governanca", "relatorios"].map(
              (id, index) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t.nav[index]}
                </a>
              ),
            )}
          </nav>
          <nav className="flex items-center gap-2">
            <div
              className="hidden items-center gap-1 rounded-full border border-card-border bg-card/75 p-1 shadow-sm backdrop-blur md:flex"
              aria-label="Paleta visual da página inicial"
            >
              <Palette
                className="mx-1 h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              {LANDING_PALETTE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPalette(option.id)}
                  aria-label={`Usar paleta ${option.label}`}
                  aria-pressed={palette === option.id}
                  title={option.label}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium transition-colors ${
                    palette === option.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="hidden xl:inline">{option.label}</span>
                </button>
              ))}
            </div>
            <LangSwitcher />
            <Link
              href="/sign-in"
              className="rounded-md px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {t.signIn}
            </Link>
            {inviteOnly ? (
              <InvitationAccess className="hidden items-center gap-2 rounded-md border border-primary/30 px-3 py-2 text-xs font-semibold text-primary sm:flex" />
            ) : (
              <Link
                href="/sign-up"
                className="whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4"
              >
                <span className="sm:hidden">{t.signUpShort}</span>
                <span className="hidden sm:inline">{t.signUp}</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <VerdictTicker items={t.ticker} />

      {/* ── Hero ── */}
      <section
        id="visao"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-16 sm:pt-24"
      >
        <div className="grid items-center gap-12 xl:grid-cols-[1.05fr_.95fr] xl:gap-16">
          <div>
            <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
              <span style={{ animation: "ops-blink 1.6s steps(1) infinite" }}>
                ●
              </span>{" "}
              {t.eyebrow}
            </p>
            <h1 className="mt-5 max-w-[12ch] font-serif text-5xl font-medium leading-[1.01] tracking-[-0.035em] [text-wrap:balance] sm:text-7xl">
              {t.h1a} <em className="italic text-primary">{t.h1b}</em>
            </h1>
            <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t.sub}
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {t.heroProofs.map((proof) => (
                <div
                  key={proof}
                  className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/80"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{" "}
                  {proof}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {inviteOnly ? (
                <InvitationAccess className="inline-flex flex-col items-start gap-1 rounded-lg border border-primary/30 bg-primary/[0.07] px-5 py-3 text-sm font-semibold text-primary" />
              ) : (
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  {t.ctaMain}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <a
                href="#plataforma"
                className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-card px-6 py-3.5 text-sm font-medium text-foreground transition hover:border-primary/50 hover:bg-secondary"
              >
                {t.ctaSecondary}
              </a>
            </div>
          </div>
          <ExecutiveBriefPreview t={t} />
        </div>

        <div className="mt-16 border-y border-primary/20 py-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">
            {t.proofLabel}
          </p>
          <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-card-border bg-card-border sm:grid-cols-2 xl:grid-cols-4">
            {t.proofItems.map((item, index) => {
              const Icon = PROOF_ICONS[index] ?? Activity;
              return (
                <div key={item.title} className="bg-background p-4">
                  <Icon className="h-4 w-4 text-primary" />
                  <strong className="mt-3 block text-sm font-medium">
                    {item.title}
                  </strong>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Visão: sistema operacional da força de trabalho ── */}
      <section
        id="plataforma"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-24"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
              {t.sectionEyebrow}
            </p>
            <h2 className="mt-4 max-w-[28ch] font-serif text-3xl font-medium tracking-tight sm:text-5xl">
              {t.sectionTitle}
            </h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            runtime → contrato → evidência → decisão → board
          </span>
        </div>
        <div className="mt-10 overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/25 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{t.schematicHeader}</span>
            <span className="text-primary">
              <span style={{ animation: "ops-blink 1.6s steps(1) infinite" }}>
                ●
              </span>{" "}
              {t.live}
            </span>
          </div>
          <WorkforceOverview labels={t.overview} />
        </div>
      </section>

      {/* ── O que a sala controla ── */}
      <section className="mx-auto max-w-7xl px-5 pb-8 pt-16">
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? Plug;
            return (
              <div
                key={f.title}
                className="rounded-lg border border-card-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Icon
                    className="h-[18px] w-[18px] text-primary"
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="mt-4 font-serif text-lg font-medium tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        id="governanca"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-8 pt-24"
      >
        <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
          <div>
            <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
              {t.demoEyebrow}
            </p>
            <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight sm:text-5xl">
              {t.demoTitle}
            </h2>
          </div>
          <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground lg:justify-self-end">
            {t.demoSub}
          </p>
        </div>
        <div className="mt-10">
          <LandingDemo />
        </div>
      </section>

      <section
        id="relatorios"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24"
      >
        <div className="overflow-hidden rounded-3xl border border-primary/25 bg-card">
          <div className="grid lg:grid-cols-[.85fr_1.15fr]">
            <div className="border-b border-card-border p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                {t.reportEyebrow}
              </p>
              <h2 className="mt-4 max-w-[18ch] font-serif text-3xl font-medium tracking-tight sm:text-5xl">
                {t.reportTitle}
              </h2>
              <p className="mt-5 max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
                {t.reportSub}
              </p>
              <div className="mt-8 grid gap-2">
                {["Board Brief", "Performance Review", "Risk & Governance"].map(
                  (model, index) => (
                    <div
                      key={model}
                      className="flex items-center justify-between rounded-xl border border-card-border bg-background/55 px-4 py-3"
                    >
                      <span className="flex items-center gap-3 text-xs font-medium">
                        <FileCheck2 className="h-4 w-4 text-primary" />
                        {model}
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
                        0{index + 1}
                      </span>
                    </div>
                  ),
                )}
              </div>
              {inviteOnly ? (
                <InvitationAccess className="mt-8 inline-flex flex-col items-start gap-1 text-sm font-semibold text-primary" />
              ) : (
                <Link
                  href="/sign-up"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  {t.ctaMain}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
            <div className="relative bg-[radial-gradient(circle_at_80%_0%,hsl(var(--primary)/0.16),transparent_38%)] p-7 sm:p-10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-primary">
                    monthly close · v3
                  </span>
                  <strong className="mt-1 block font-serif text-xl font-medium">
                    Agosto 2026
                  </strong>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-primary">
                  decision ready
                </span>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  { label: t.reportMetrics[0], value: 92, delta: "+4 pp" },
                  { label: t.reportMetrics[1], value: 86, delta: "+2 pp" },
                  { label: t.reportMetrics[2], value: 94, delta: "+7 pp" },
                  { label: "Governança", value: 78, delta: "-3 pp" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-card-border bg-background/60 p-4"
                  >
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{metric.label}</span>
                      <span
                        className={
                          metric.delta.startsWith("-")
                            ? "text-chart-2"
                            : "text-primary"
                        }
                      >
                        {metric.delta}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end gap-3">
                      <strong className="font-mono text-2xl font-medium">
                        {metric.value}%
                      </strong>
                      <div className="mb-1.5 h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${metric.value}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.055] p-4">
                <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> insight priorizado · 91%
                  confiança
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/85">
                  {t.reportSummary}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    "agent_events",
                    "metric_points",
                    "evaluations",
                    "alerts",
                  ].map((source) => (
                    <span
                      key={source}
                      className="rounded-md bg-background/70 px-2 py-1 font-mono text-[7px] text-muted-foreground"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-[0.08em] text-muted-foreground">
                <DatabaseZap className="h-3.5 w-3.5 text-primary" /> snapshot
                versionado <ArrowRight className="h-3 w-3" /> narrativa auditada{" "}
                <ArrowRight className="h-3 w-3" /> decisão humana
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-8 pt-8">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
              {t.aiEyebrow}
            </p>
            <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight sm:text-5xl">
              {t.aiTitle}
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {t.aiSub}
            </p>
            <div className="mt-7 rounded-xl border border-primary/20 bg-primary/[0.05] p-4 text-xs leading-relaxed text-foreground/80">
              <strong className="text-primary">Facts first.</strong> Métricas
              determinísticas, hipóteses explícitas, confiança visível e revisão
              antes de qualquer comunicação externa.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.aiCards.map((card, index) => {
              const Icon = AI_ICONS[index] ?? Bot;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-card-border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full border border-primary/20 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.08em] text-primary">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 font-serif text-lg font-medium">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    {card.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-8 pt-24">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
          {t.mvpEyebrow}
        </p>
        <h2 className="mt-4 max-w-[27ch] font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          {t.mvpTitle}
        </h2>
        <p className="mt-4 max-w-[62ch] text-muted-foreground">{t.mvpSub}</p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.mvpCards.map((card, i) => {
            const Icon = OPERATING_MODEL_ICONS[i] ?? Activity;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-lg border border-card-border bg-card/70 p-5 transition-colors hover:border-primary/50 hover:bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Icon
                      className="h-[18px] w-[18px] text-primary"
                      strokeWidth={1.75}
                    />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <h3 className="mt-5 font-serif text-lg font-medium tracking-tight">
                  {card.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  {card.desc}
                </p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-primary/80">
                  {card.meta}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24">
        <div className="rounded-3xl border border-card-border bg-card/70 p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
            <div>
              <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
                {t.enterpriseEyebrow}
              </p>
              <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight sm:text-5xl">
                {t.enterpriseTitle}
              </h2>
            </div>
            <p className="max-w-[66ch] text-sm leading-relaxed text-muted-foreground lg:justify-self-end">
              {t.enterpriseSub}
            </p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-card-border bg-card-border md:grid-cols-2 xl:grid-cols-4">
            {t.enterpriseCards.map((card, index) => {
              const Icon = ENTERPRISE_ICONS[index] ?? ShieldCheck;
              return (
                <div key={card.title} className="bg-background/80 p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/20 bg-primary/[0.06] text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-serif text-lg font-medium">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    {card.desc}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-card-border pt-5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> tenant-aware
            </span>
            <span className="inline-flex items-center gap-2">
              <DatabaseZap className="h-3.5 w-3.5 text-primary" /> event-driven
            </span>
            <span className="inline-flex items-center gap-2">
              <Network className="h-3.5 w-3.5 text-primary" /> API-first
            </span>
            <span className="inline-flex items-center gap-2">
              <CloudCog className="h-3.5 w-3.5 text-primary" /> cloud · hybrid ·
              local
            </span>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="mx-auto max-w-7xl px-5 py-24 text-center">
        <h2 className="mx-auto max-w-[24ch] font-serif text-4xl font-medium tracking-tight [text-wrap:balance] sm:text-5xl">
          {t.finalTitleA}{" "}
          <em className="italic text-primary">{t.finalTitleB}</em>
        </h2>
        <p className="mx-auto mt-5 max-w-[48ch] text-muted-foreground">
          {t.finalSub}
        </p>
        <div className="mt-9">
          {inviteOnly ? (
            <InvitationAccess className="inline-flex flex-col items-center gap-1 rounded-md border border-primary/30 bg-primary/[0.07] px-6 py-3 text-sm font-semibold text-primary" />
          ) : (
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t.finalCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>

      {/* ── Rodapé ── */}
      <footer className="border-t border-primary/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="flex items-center gap-2">
            <MusterMark className="h-4 w-4" /> Muster · AI Workforce Operations
          </span>
          <span>{t.footerRight}</span>
        </div>
      </footer>
    </div>
  );
}
