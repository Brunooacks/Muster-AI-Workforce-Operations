import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import {
  Building2,
  Plug,
  Users,
  Bell,
  ShieldCheck,
  CreditCard,
  Webhook,
  ArrowRight,
  Check,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeading, Eyebrow, Pill, AgentDisc } from "@/components/cohort";
import { useListConnectors } from "@workspace/api-client-react";
import { getTrialInfo } from "@/lib/plan";
import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SectionId =
  | "workspace"
  | "integracoes"
  | "equipe"
  | "notificacoes"
  | "seguranca"
  | "faturamento"
  | "webhooks";

const SECTIONS: { id: SectionId; icon: typeof Building2 }[] = [
  { id: "workspace", icon: Building2 },
  { id: "integracoes", icon: Plug },
  { id: "equipe", icon: Users },
  { id: "notificacoes", icon: Bell },
  { id: "seguranca", icon: ShieldCheck },
  { id: "faturamento", icon: CreditCard },
  { id: "webhooks", icon: Webhook },
];

const NOTIFICATION_PREF_IDS = [
  { id: "alerts", default: true },
  { id: "verdicts", default: true },
  { id: "probation", default: false },
  { id: "digest", default: true },
] as const;

type NotificationPrefId = (typeof NOTIFICATION_PREF_IDS)[number]["id"];

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  bcAccount: "Conta",
  bcSettings: "Configurações",
  eyebrow: "Conta · Configurações",
  title: "Configurações",
  subtitle: "Gerencie workspace, integrações, equipe, notificações, segurança e faturamento.",
  sections: {
    workspace: "Workspace",
    integracoes: "Integrações",
    equipe: "Equipe e permissões",
    notificacoes: "Notificações",
    seguranca: "Segurança",
    faturamento: "Faturamento",
    webhooks: "API · Webhooks",
  } as Record<SectionId, string>,
  wsTitle: "Workspace",
  wsDesc: "Identidade e configurações gerais do espaço de trabalho da sua frota.",
  wsName: "Nome do workspace",
  wsNameDesc: "Visível para toda a equipe",
  wsTz: "Fuso horário",
  wsTzDesc: "Usado em relatórios e janelas de avaliação",
  wsFleetModel: "Modelo de frota",
  wsFleetModelDesc: "Frota compartilhada por toda a organização",
  orgWide: "Org-wide",
  intTitle: "Integrações",
  intDesc: "Plataformas conectadas para descobrir e sincronizar agentes da frota.",
  connectorsEyebrow: "Conectores",
  manageConnectors: "Gerenciar conectores",
  connected: "Conectado",
  available: "Disponível",
  agentsDiscovered: (n: number) => `${n} agentes descobertos`,
  intEmpty: "Nenhuma integração disponível.",
  teamTitle: "Equipe e permissões",
  teamDesc: "Quem tem acesso à frota e com qual papel.",
  membersEyebrow: "Membros",
  inviteMember: "Convidar membro",
  userFallback: "Usuário",
  adminPill: "Administrador",
  rolesNote: "Papéis disponíveis: Administrador, Editor, Observador. Convites por e-mail em breve.",
  notifTitle: "Notificações",
  notifDesc: "Escolha quais eventos da frota geram avisos para você.",
  notifPrefs: {
    alerts: {
      label: "Vitória ilusória detectada",
      desc: "Avisar quando o Detector sinalizar um padrão enganoso",
    },
    verdicts: {
      label: "Novo veredito disponível",
      desc: "Promover, Mentorar ou Aposentar sugeridos pela análise",
    },
    probation: {
      label: "Fim de período de probation",
      desc: "Quando um agente conclui a janela de observação",
    },
    digest: {
      label: "Resumo semanal da frota",
      desc: "Panorama de desempenho enviado toda segunda-feira",
    },
  } as Record<NotificationPrefId, { label: string; desc: string }>,
  secTitle: "Segurança",
  secDesc: "Autenticação e proteção do acesso à sua frota.",
  secAuth: "Autenticação",
  secAuthDesc: "Login gerenciado com verificação de e-mail",
  active: "Ativo",
  sec2fa: "Autenticação em duas etapas",
  sec2faDesc: "Camada extra no acesso à conta",
  configure: "Configurar",
  secSso: "SSO corporativo (SAML)",
  secSsoDesc: "Disponível no plano Escala",
  ssoPill: "Plano Escala",
  billTitle: "Faturamento",
  billDesc: "Seu plano atual e opções de upgrade.",
  trialPill: "Trial",
  trialRemaining: (days: number, total: number) =>
    `${days} de ${total} dias restantes no período de avaliação`,
  plans: [
    {
      name: "Início",
      price: "Grátis",
      features: ["Até 5 agentes", "Análise de 5 camadas", "1 conector"],
      current: false,
    },
    {
      name: "Crescimento",
      price: "R$ 490/mês",
      features: ["Até 50 agentes", "Conectores ilimitados", "Detector de vitória ilusória"],
      current: true,
    },
    {
      name: "Escala",
      price: "Sob consulta",
      features: ["Agentes ilimitados", "SSO + SAML", "Governança avançada"],
      current: false,
    },
  ],
  currentPill: "Atual",
  currentPlanBtn: "Plano atual",
  selectBtn: "Selecionar",
  whTitle: "API · Webhooks",
  whDesc: "Receba eventos de incidentes da frota em sistemas externos.",
  whIncidents: "Webhook de incidentes",
  whIncidentsDesc: "Dispara quando o Detector registra uma vitória ilusória crítica",
  endpoint: "Endpoint",
  events: "Eventos",
  apiKey: "Chave de API",
  genKey: "Gerar nova chave",
};

type Dict = typeof PT;

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    bcAccount: "Account",
    bcSettings: "Settings",
    eyebrow: "Account · Settings",
    title: "Settings",
    subtitle: "Manage workspace, integrations, team, notifications, security and billing.",
    sections: {
      workspace: "Workspace",
      integracoes: "Integrations",
      equipe: "Team and permissions",
      notificacoes: "Notifications",
      seguranca: "Security",
      faturamento: "Billing",
      webhooks: "API · Webhooks",
    },
    wsTitle: "Workspace",
    wsDesc: "Identity and general settings of your fleet's workspace.",
    wsName: "Workspace name",
    wsNameDesc: "Visible to the whole team",
    wsTz: "Time zone",
    wsTzDesc: "Used in reports and evaluation windows",
    wsFleetModel: "Fleet model",
    wsFleetModelDesc: "Fleet shared across the whole organization",
    orgWide: "Org-wide",
    intTitle: "Integrations",
    intDesc: "Platforms connected to discover and sync fleet agents.",
    connectorsEyebrow: "Connectors",
    manageConnectors: "Manage connectors",
    connected: "Connected",
    available: "Available",
    agentsDiscovered: (n: number) => `${n} agents discovered`,
    intEmpty: "No integrations available.",
    teamTitle: "Team and permissions",
    teamDesc: "Who has access to the fleet and with which role.",
    membersEyebrow: "Members",
    inviteMember: "Invite member",
    userFallback: "User",
    adminPill: "Administrator",
    rolesNote: "Available roles: Administrator, Editor, Observer. E-mail invites coming soon.",
    notifTitle: "Notifications",
    notifDesc: "Choose which fleet events send you notices.",
    notifPrefs: {
      alerts: {
        label: "Illusory victory detected",
        desc: "Notify when the Detector flags a misleading pattern",
      },
      verdicts: {
        label: "New verdict available",
        desc: "Promote, Mentor or Retire suggested by the analysis",
      },
      probation: {
        label: "End of probation period",
        desc: "When an agent completes its observation window",
      },
      digest: {
        label: "Weekly fleet digest",
        desc: "Performance overview sent every Monday",
      },
    },
    secTitle: "Security",
    secDesc: "Authentication and protection of access to your fleet.",
    secAuth: "Authentication",
    secAuthDesc: "Managed login with e-mail verification",
    active: "Active",
    sec2fa: "Two-factor authentication",
    sec2faDesc: "Extra layer on account access",
    configure: "Configure",
    secSso: "Corporate SSO (SAML)",
    secSsoDesc: "Available on the Scale plan",
    ssoPill: "Scale plan",
    billTitle: "Billing",
    billDesc: "Your current plan and upgrade options.",
    trialPill: "Trial",
    trialRemaining: (days: number, total: number) =>
      `${days} of ${total} days left in the trial period`,
    plans: [
      {
        name: "Starter",
        price: "Free",
        features: ["Up to 5 agents", "5-layer analysis", "1 connector"],
        current: false,
      },
      {
        name: "Growth",
        price: "R$ 490/month",
        features: ["Up to 50 agents", "Unlimited connectors", "Illusory victory detector"],
        current: true,
      },
      {
        name: "Scale",
        price: "Contact us",
        features: ["Unlimited agents", "SSO + SAML", "Advanced governance"],
        current: false,
      },
    ],
    currentPill: "Current",
    currentPlanBtn: "Current plan",
    selectBtn: "Select",
    whTitle: "API · Webhooks",
    whDesc: "Receive fleet incident events in external systems.",
    whIncidents: "Incident webhook",
    whIncidentsDesc: "Fires when the Detector records a critical illusory victory",
    endpoint: "Endpoint",
    events: "Events",
    apiKey: "API key",
    genKey: "Generate new key",
  },
  es: {
    bcAccount: "Cuenta",
    bcSettings: "Configuración",
    eyebrow: "Cuenta · Configuración",
    title: "Configuración",
    subtitle: "Gestiona workspace, integraciones, equipo, notificaciones, seguridad y facturación.",
    sections: {
      workspace: "Workspace",
      integracoes: "Integraciones",
      equipe: "Equipo y permisos",
      notificacoes: "Notificaciones",
      seguranca: "Seguridad",
      faturamento: "Facturación",
      webhooks: "API · Webhooks",
    },
    wsTitle: "Workspace",
    wsDesc: "Identidad y configuraciones generales del espacio de trabajo de tu flota.",
    wsName: "Nombre del workspace",
    wsNameDesc: "Visible para todo el equipo",
    wsTz: "Zona horaria",
    wsTzDesc: "Usada en reportes y ventanas de evaluación",
    wsFleetModel: "Modelo de flota",
    wsFleetModelDesc: "Flota compartida por toda la organización",
    orgWide: "Org-wide",
    intTitle: "Integraciones",
    intDesc: "Plataformas conectadas para descubrir y sincronizar agentes de la flota.",
    connectorsEyebrow: "Conectores",
    manageConnectors: "Gestionar conectores",
    connected: "Conectado",
    available: "Disponible",
    agentsDiscovered: (n: number) => `${n} agentes descubiertos`,
    intEmpty: "Ninguna integración disponible.",
    teamTitle: "Equipo y permisos",
    teamDesc: "Quién tiene acceso a la flota y con qué rol.",
    membersEyebrow: "Miembros",
    inviteMember: "Invitar miembro",
    userFallback: "Usuario",
    adminPill: "Administrador",
    rolesNote:
      "Roles disponibles: Administrador, Editor, Observador. Invitaciones por correo electrónico próximamente.",
    notifTitle: "Notificaciones",
    notifDesc: "Elige qué eventos de la flota te generan avisos.",
    notifPrefs: {
      alerts: {
        label: "Victoria ilusoria detectada",
        desc: "Avisar cuando el Detector señale un patrón engañoso",
      },
      verdicts: {
        label: "Nuevo veredicto disponible",
        desc: "Ascender, Mentoría o Retirar sugeridos por el análisis",
      },
      probation: {
        label: "Fin del período de probation",
        desc: "Cuando un agente concluye la ventana de observación",
      },
      digest: {
        label: "Resumen semanal de la flota",
        desc: "Panorama de desempeño enviado cada lunes",
      },
    },
    secTitle: "Seguridad",
    secDesc: "Autenticación y protección del acceso a tu flota.",
    secAuth: "Autenticación",
    secAuthDesc: "Inicio de sesión gestionado con verificación de correo",
    active: "Activo",
    sec2fa: "Autenticación en dos pasos",
    sec2faDesc: "Capa extra en el acceso a la cuenta",
    configure: "Configurar",
    secSso: "SSO corporativo (SAML)",
    secSsoDesc: "Disponible en el plan Escala",
    ssoPill: "Plan Escala",
    billTitle: "Facturación",
    billDesc: "Tu plan actual y opciones de upgrade.",
    trialPill: "Trial",
    trialRemaining: (days: number, total: number) =>
      `${days} de ${total} días restantes en el período de prueba`,
    plans: [
      {
        name: "Inicio",
        price: "Gratis",
        features: ["Hasta 5 agentes", "Análisis de 5 capas", "1 conector"],
        current: false,
      },
      {
        name: "Crecimiento",
        price: "R$ 490/mes",
        features: ["Hasta 50 agentes", "Conectores ilimitados", "Detector de victoria ilusoria"],
        current: true,
      },
      {
        name: "Escala",
        price: "Bajo consulta",
        features: ["Agentes ilimitados", "SSO + SAML", "Gobernanza avanzada"],
        current: false,
      },
    ],
    currentPill: "Actual",
    currentPlanBtn: "Plan actual",
    selectBtn: "Seleccionar",
    whTitle: "API · Webhooks",
    whDesc: "Recibe eventos de incidentes de la flota en sistemas externos.",
    whIncidents: "Webhook de incidentes",
    whIncidentsDesc: "Se dispara cuando el Detector registra una victoria ilusoria crítica",
    endpoint: "Endpoint",
    events: "Eventos",
    apiKey: "Clave de API",
    genKey: "Generar nueva clave",
  },
};

function readInitialSection(): SectionId {
  const hash = window.location.hash.replace("#", "");
  return SECTIONS.some((s) => s.id === hash) ? (hash as SectionId) : "workspace";
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function WorkspaceSection() {
  const { lang } = useLang();
  const t = L[lang];
  return (
    <SectionShell
      title={t.wsTitle}
      description={t.wsDesc}
    >
      <Card className="divide-y divide-card-border">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">{t.wsName}</div>
            <div className="text-xs text-muted-foreground">{t.wsNameDesc}</div>
          </div>
          <span className="font-mono text-sm text-foreground">Muster</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">{t.wsTz}</div>
            <div className="text-xs text-muted-foreground">{t.wsTzDesc}</div>
          </div>
          <span className="font-mono text-sm text-foreground">America/Sao_Paulo (BRT)</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">{t.wsFleetModel}</div>
            <div className="text-xs text-muted-foreground">
              {t.wsFleetModelDesc}
            </div>
          </div>
          <Pill tone="sage">{t.orgWide}</Pill>
        </div>
      </Card>
    </SectionShell>
  );
}

function IntegrationsSection() {
  const { data: connectors, isLoading } = useListConnectors();
  const { lang } = useLang();
  const t = L[lang];
  return (
    <SectionShell
      title={t.intTitle}
      description={t.intDesc}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-card-border px-5 py-3">
          <Eyebrow>{t.connectorsEyebrow}</Eyebrow>
          <Link
            href="/conectores"
            className="inline-flex items-center gap-1 text-xs font-medium text-chart-1 transition-colors hover:text-foreground"
          >
            {t.manageConnectors} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="divide-y divide-card-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-5 py-4">
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : connectors && connectors.length > 0 ? (
          <div className="divide-y divide-card-border">
            {connectors.map((connector) => {
              const connected = connector.status === "connected";
              return (
                <Link
                  key={connector.id}
                  href="/conectores"
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary/60 text-muted-foreground">
                      <Plug className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {connector.name}
                        </span>
                        <Pill tone={connected ? "sage" : "muted"}>
                          {connected ? t.connected : t.available}
                        </Pill>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {connected
                          ? t.agentsDiscovered(connector.agentsDiscovered)
                          : connector.category}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t.intEmpty}
          </div>
        )}
      </Card>
    </SectionShell>
  );
}

function TeamSection() {
  const { user } = useUser();
  const { lang } = useLang();
  const t = L[lang];
  return (
    <SectionShell
      title={t.teamTitle}
      description={t.teamDesc}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-card-border px-5 py-3">
          <Eyebrow>{t.membersEyebrow}</Eyebrow>
          <Button size="sm" variant="outline" disabled>
            {t.inviteMember}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <AgentDisc name={user?.fullName ?? t.userFallback} size="sm" />
            <div>
              <div className="text-sm font-medium text-foreground">
                {user?.fullName || t.userFallback}
              </div>
              <div className="text-xs text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </div>
            </div>
          </div>
          <Pill tone="sage">{t.adminPill}</Pill>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        {t.rolesNote}
      </p>
    </SectionShell>
  );
}

function NotificationsSection() {
  const { lang } = useLang();
  const t = L[lang];
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_PREF_IDS.map((p) => [p.id, p.default])),
  );
  return (
    <SectionShell
      title={t.notifTitle}
      description={t.notifDesc}
    >
      <Card className="divide-y divide-card-border">
        {NOTIFICATION_PREF_IDS.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="text-sm font-medium text-foreground">{t.notifPrefs[p.id].label}</div>
              <div className="text-xs text-muted-foreground">{t.notifPrefs[p.id].desc}</div>
            </div>
            <Switch
              checked={prefs[p.id]}
              onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, [p.id]: v }))}
            />
          </div>
        ))}
      </Card>
    </SectionShell>
  );
}

function SecuritySection() {
  const { lang } = useLang();
  const t = L[lang];
  return (
    <SectionShell
      title={t.secTitle}
      description={t.secDesc}
    >
      <Card className="divide-y divide-card-border">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">{t.secAuth}</div>
            <div className="text-xs text-muted-foreground">
              {t.secAuthDesc}
            </div>
          </div>
          <Pill tone="sage">{t.active}</Pill>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">{t.sec2fa}</div>
            <div className="text-xs text-muted-foreground">{t.sec2faDesc}</div>
          </div>
          <Button size="sm" variant="outline" disabled>
            {t.configure}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">{t.secSso}</div>
            <div className="text-xs text-muted-foreground">{t.secSsoDesc}</div>
          </div>
          <Pill tone="muted">{t.ssoPill}</Pill>
        </div>
      </Card>
    </SectionShell>
  );
}

function BillingSection() {
  const trial = getTrialInfo();
  const { lang } = useLang();
  const t = L[lang];
  return (
    <SectionShell
      title={t.billTitle}
      description={t.billDesc}
    >
      <Card className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{trial.planName}</span>
            <Pill tone="ochre">{t.trialPill}</Pill>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t.trialRemaining(trial.daysRemaining, trial.totalDays)}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {t.plans.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "flex flex-col gap-3 p-5",
              plan.current && "border-primary/40 ring-1 ring-primary/20",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg font-medium text-foreground">{plan.name}</span>
              {plan.current && <Pill tone="sage">{t.currentPill}</Pill>}
            </div>
            <div className="font-mono text-sm text-foreground">{plan.price}</div>
            <ul className="space-y-1.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-chart-1" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant={plan.current ? "outline" : "default"}
              className="mt-auto"
              disabled={plan.current}
            >
              {plan.current ? t.currentPlanBtn : t.selectBtn}
            </Button>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}

function WebhooksSection() {
  const [enabled, setEnabled] = useState(true);
  const { lang } = useLang();
  const t = L[lang];
  return (
    <SectionShell
      title={t.whTitle}
      description={t.whDesc}
    >
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-foreground">{t.whIncidents}</div>
            <div className="text-xs text-muted-foreground">
              {t.whIncidentsDesc}
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div>
          <Eyebrow className="mb-1 block">{t.endpoint}</Eyebrow>
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            https://seu-sistema.com/webhooks/cohort
          </div>
        </div>
        <div>
          <Eyebrow className="mb-1 block">{t.events}</Eyebrow>
          <div className="flex flex-wrap gap-2">
            <Pill tone="terracotta">incident.created</Pill>
            <Pill tone="ochre">verdict.changed</Pill>
            <Pill tone="blue">agent.retired</Pill>
          </div>
        </div>
      </Card>
      <Card className="space-y-2 p-5">
        <Eyebrow className="block">{t.apiKey}</Eyebrow>
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          ch_live_••••••••••••••••••••••
        </div>
        <Button size="sm" variant="outline" disabled>
          {t.genKey}
        </Button>
      </Card>
    </SectionShell>
  );
}

const SECTION_CONTENT: Record<SectionId, React.FC> = {
  workspace: WorkspaceSection,
  integracoes: IntegrationsSection,
  equipe: TeamSection,
  notificacoes: NotificationsSection,
  seguranca: SecuritySection,
  faturamento: BillingSection,
  webhooks: WebhooksSection,
};

export default function SettingsPage() {
  const [section, setSection] = useState<SectionId>(readInitialSection);
  const { lang } = useLang();
  const t = L[lang];
  const Content = SECTION_CONTENT[section];

  return (
    <AppLayout breadcrumbs={[{ label: t.bcAccount }, { label: t.bcSettings }]}>
      <div className="mx-auto max-w-5xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
        />

        <div className="flex flex-col gap-8 lg:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => {
              const active = s.id === section;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSection(s.id);
                    history.replaceState(null, "", `#${s.id}`);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <s.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
                  {t.sections[s.id]}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1">
            <Content />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
