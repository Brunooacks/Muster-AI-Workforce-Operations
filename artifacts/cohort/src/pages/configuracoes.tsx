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
import { platformLabel } from "@/lib/platforms";
import { getTrialInfo } from "@/lib/plan";
import { cn } from "@/lib/utils";

type SectionId =
  | "workspace"
  | "integracoes"
  | "equipe"
  | "notificacoes"
  | "seguranca"
  | "faturamento"
  | "webhooks";

const SECTIONS: { id: SectionId; label: string; icon: typeof Building2 }[] = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "integracoes", label: "Integrações", icon: Plug },
  { id: "equipe", label: "Equipe e permissões", icon: Users },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck },
  { id: "faturamento", label: "Faturamento", icon: CreditCard },
  { id: "webhooks", label: "API · Webhooks", icon: Webhook },
];

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
  return (
    <SectionShell
      title="Workspace"
      description="Identidade e configurações gerais do espaço de trabalho da sua frota."
    >
      <Card className="divide-y divide-card-border">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">Nome do workspace</div>
            <div className="text-xs text-muted-foreground">Visível para toda a equipe</div>
          </div>
          <span className="font-mono text-sm text-foreground">Muster</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">Fuso horário</div>
            <div className="text-xs text-muted-foreground">Usado em relatórios e janelas de avaliação</div>
          </div>
          <span className="font-mono text-sm text-foreground">America/Sao_Paulo (BRT)</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">Modelo de frota</div>
            <div className="text-xs text-muted-foreground">
              Frota compartilhada por toda a organização
            </div>
          </div>
          <Pill tone="sage">Org-wide</Pill>
        </div>
      </Card>
    </SectionShell>
  );
}

function IntegrationsSection() {
  const { data: connectors, isLoading } = useListConnectors();
  return (
    <SectionShell
      title="Integrações"
      description="Plataformas conectadas para descobrir e sincronizar agentes da frota."
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-card-border px-5 py-3">
          <Eyebrow>Conectores</Eyebrow>
          <Link
            href="/conectores"
            className="inline-flex items-center gap-1 text-xs font-medium text-chart-1 transition-colors hover:text-foreground"
          >
            Gerenciar conectores <ArrowRight className="h-3 w-3" />
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
                          {connected ? "Conectado" : "Disponível"}
                        </Pill>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {connected
                          ? `${connector.agentsDiscovered} agentes descobertos`
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
            Nenhuma integração disponível.
          </div>
        )}
      </Card>
    </SectionShell>
  );
}

function TeamSection() {
  const { user } = useUser();
  return (
    <SectionShell
      title="Equipe e permissões"
      description="Quem tem acesso à frota e com qual papel."
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-card-border px-5 py-3">
          <Eyebrow>Membros</Eyebrow>
          <Button size="sm" variant="outline" disabled>
            Convidar membro
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <AgentDisc name={user?.fullName ?? "Usuário"} size="sm" />
            <div>
              <div className="text-sm font-medium text-foreground">
                {user?.fullName || "Usuário"}
              </div>
              <div className="text-xs text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </div>
            </div>
          </div>
          <Pill tone="sage">Administrador</Pill>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        Papéis disponíveis: Administrador, Editor, Observador. Convites por e-mail em breve.
      </p>
    </SectionShell>
  );
}

const NOTIFICATION_PREFS = [
  {
    id: "alerts",
    label: "Vitória ilusória detectada",
    desc: "Avisar quando o Detector sinalizar um padrão enganoso",
    default: true,
  },
  {
    id: "verdicts",
    label: "Novo veredito disponível",
    desc: "Promover, Mentorar ou Aposentar sugeridos pela análise",
    default: true,
  },
  {
    id: "probation",
    label: "Fim de período de probation",
    desc: "Quando um agente conclui a janela de observação",
    default: false,
  },
  {
    id: "digest",
    label: "Resumo semanal da frota",
    desc: "Panorama de desempenho enviado toda segunda-feira",
    default: true,
  },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_PREFS.map((p) => [p.id, p.default])),
  );
  return (
    <SectionShell
      title="Notificações"
      description="Escolha quais eventos da frota geram avisos para você."
    >
      <Card className="divide-y divide-card-border">
        {NOTIFICATION_PREFS.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="text-sm font-medium text-foreground">{p.label}</div>
              <div className="text-xs text-muted-foreground">{p.desc}</div>
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
  return (
    <SectionShell
      title="Segurança"
      description="Autenticação e proteção do acesso à sua frota."
    >
      <Card className="divide-y divide-card-border">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">Autenticação</div>
            <div className="text-xs text-muted-foreground">
              Login gerenciado com verificação de e-mail
            </div>
          </div>
          <Pill tone="sage">Ativo</Pill>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">Autenticação em duas etapas</div>
            <div className="text-xs text-muted-foreground">Camada extra no acesso à conta</div>
          </div>
          <Button size="sm" variant="outline" disabled>
            Configurar
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">SSO corporativo (SAML)</div>
            <div className="text-xs text-muted-foreground">Disponível no plano Escala</div>
          </div>
          <Pill tone="muted">Plano Escala</Pill>
        </div>
      </Card>
    </SectionShell>
  );
}

const PLANS = [
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
];

function BillingSection() {
  const trial = getTrialInfo();
  return (
    <SectionShell
      title="Faturamento"
      description="Seu plano atual e opções de upgrade."
    >
      <Card className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{trial.planName}</span>
            <Pill tone="ochre">Trial</Pill>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {trial.daysRemaining} de {trial.totalDays} dias restantes no período de avaliação
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "flex flex-col gap-3 p-5",
              plan.current && "border-primary/40 ring-1 ring-primary/20",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg font-medium text-foreground">{plan.name}</span>
              {plan.current && <Pill tone="sage">Atual</Pill>}
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
              {plan.current ? "Plano atual" : "Selecionar"}
            </Button>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}

function WebhooksSection() {
  const [enabled, setEnabled] = useState(true);
  return (
    <SectionShell
      title="API · Webhooks"
      description="Receba eventos de incidentes da frota em sistemas externos."
    >
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-foreground">Webhook de incidentes</div>
            <div className="text-xs text-muted-foreground">
              Dispara quando o Detector registra uma vitória ilusória crítica
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div>
          <Eyebrow className="mb-1 block">Endpoint</Eyebrow>
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            https://seu-sistema.com/webhooks/cohort
          </div>
        </div>
        <div>
          <Eyebrow className="mb-1 block">Eventos</Eyebrow>
          <div className="flex flex-wrap gap-2">
            <Pill tone="terracotta">incident.created</Pill>
            <Pill tone="ochre">verdict.changed</Pill>
            <Pill tone="blue">agent.retired</Pill>
          </div>
        </div>
      </Card>
      <Card className="space-y-2 p-5">
        <Eyebrow className="block">Chave de API</Eyebrow>
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          ch_live_••••••••••••••••••••••
        </div>
        <Button size="sm" variant="outline" disabled>
          Gerar nova chave
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
  const Content = SECTION_CONTENT[section];

  return (
    <AppLayout breadcrumbs={[{ label: "Conta" }, { label: "Configurações" }]}>
      <div className="mx-auto max-w-5xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow="Conta · Configurações"
          title="Configurações"
          subtitle="Gerencie workspace, integrações, equipe, notificações, segurança e faturamento."
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
                  {s.label}
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
