import { useMemo, type ReactNode } from "react";
import { OrganizationSwitcher, useClerk, useOrganization } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  KeyRound,
  Layers3,
  LockKeyhole,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { AccessControlPanel } from "@/components/access-control/access-control-panel";
import { cn } from "@/lib/utils";

type AdminOverview = {
  currentUser: {
    orgRole: "owner" | "admin" | "member";
    permissions: string[];
  };
  groups: Array<{ id: string }>;
  scopes: {
    areas: Array<{ id: string; name: string }>;
    teams: Array<{ id: string; name: string }>;
  };
};

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)]", className)}>
      {children}
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Panel className="p-4">
      <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--wo-muted)]">{label}</span>
      <strong className="mt-3 block text-2xl font-medium text-[var(--wo-text)]">{value}</strong>
      <span className="mt-1 block text-[10px] text-[var(--wo-muted)]">{detail}</span>
    </Panel>
  );
}

async function loadAdminOverview(): Promise<AdminOverview> {
  return customFetch<AdminOverview>("/api/access-control/overview", {
    credentials: "include",
    responseType: "json",
  });
}

export default function AdminConsolePage() {
  const { openCreateOrganization, openOrganizationProfile } = useClerk();
  const { organization, memberships, isLoaded: organizationLoaded } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true, pageSize: 100 },
  });
  const overviewQuery = useQuery({
    queryKey: ["admin-console", "overview", organization?.id],
    queryFn: loadAdminOverview,
    enabled: organizationLoaded && Boolean(organization),
    retry: false,
  });
  const overview = overviewQuery.data;
  const canManage = overview?.currentUser.orgRole === "owner" || overview?.currentUser.orgRole === "admin";
  const memberCount = memberships?.count ?? 0;
  const roleLabel = useMemo(() => {
    if (overview?.currentUser.orgRole === "owner") return "Proprietário";
    if (overview?.currentUser.orgRole === "admin") return "Administrador";
    return "Membro";
  }, [overview?.currentUser.orgRole]);

  if (overviewQuery.isLoading || !organizationLoaded) {
    return (
      <div className="grid min-h-[70vh] place-items-center p-6">
        <RefreshCw className="h-6 w-6 animate-spin text-[var(--wo-primary)]" aria-label="Carregando administração" />
      </div>
    );
  }

  if (overviewQuery.isError || !overview) {
    return (
      <div className="p-4 sm:p-6">
        <Panel className="mx-auto max-w-2xl p-7 text-center">
          <LockKeyhole className="mx-auto h-8 w-8 text-[var(--wo-warning)]" />
          <h1 className="mt-4 text-2xl font-medium text-[var(--wo-text)]">Administração indisponível</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--wo-muted)]">
            Não foi possível confirmar sua alçada no tenant ativo. Troque de organização ou tente carregar novamente.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <OrganizationSwitcher hidePersonal skipInvitationScreen />
            <button type="button" onClick={() => overviewQuery.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)]">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-4 sm:p-6">
        <Panel className="mx-auto max-w-2xl p-7 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-[var(--wo-primary)]" />
          <span className="mt-4 block text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--wo-primary)]">Admin Console</span>
          <h1 className="mt-2 text-2xl font-medium text-[var(--wo-text)]">Acesso administrativo necessário</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--wo-muted)]">
            Sua sessão é de membro. Somente proprietários e administradores podem alterar organizações, membros, grupos e estrutura de equipes.
          </p>
          <Link href="/comando" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">
            Voltar à operação <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6" data-testid="admin-console" data-operational-source="api">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--wo-primary)]">Admin Console · tenant control plane</span>
          <h1 className="mt-2 max-w-5xl text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-4xl">
            Estruture a companhia antes de operar a força de trabalho.
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--wo-muted)]">
            Organizações, pessoas, grupos de acesso e equipes são administrados aqui. As telas de squads permanecem focadas na execução e no desempenho.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openOrganizationProfile()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] px-4 py-2.5 text-xs text-[var(--wo-text)]">
            <UserPlus className="h-4 w-4" /> Membros e convites
          </button>
          <button type="button" onClick={() => openCreateOrganization()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)]">
            <Plus className="h-4 w-4" /> Nova organização
          </button>
        </div>
      </header>

      <Panel className="overflow-hidden">
        <div className="grid gap-px bg-[var(--wo-line)] lg:grid-cols-[1.2fr_.8fr]">
          <div className="bg-[var(--wo-card)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Building2 className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">Organização ativa</span>
                  <strong className="mt-1 block truncate text-lg font-medium text-[var(--wo-text)]">{organization?.name ?? "Tenant não identificado"}</strong>
                  <span className="text-[10px] text-[var(--wo-muted)]">{roleLabel} · isolamento ativo por organização</span>
                </div>
              </div>
              <OrganizationSwitcher hidePersonal skipInvitationScreen />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[var(--wo-line)]">
            <div className="bg-[var(--wo-card)] p-5"><Users className="h-4 w-4 text-[var(--wo-primary)]" /><strong className="mt-3 block text-2xl text-[var(--wo-text)]">{memberCount}</strong><span className="text-[10px] text-[var(--wo-muted)]">membros</span></div>
            <div className="bg-[var(--wo-card)] p-5"><KeyRound className="h-4 w-4 text-[var(--wo-primary)]" /><strong className="mt-3 block text-2xl text-[var(--wo-text)]">{overview.currentUser.permissions.length}</strong><span className="text-[10px] text-[var(--wo-muted)]">permissões efetivas</span></div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Áreas" value={String(overview.scopes.areas.length)} detail="unidades organizacionais" />
        <Stat label="Equipes" value={String(overview.scopes.teams.length)} detail="contratos de trabalho" />
        <Stat label="Grupos" value={String(overview.groups.length)} detail="papéis e escopos" />
        <Stat label="Tenant" value="Isolado" detail="dados e decisões segregados" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Layers3 className="h-5 w-5" /></span><div><h2 className="text-base font-medium text-[var(--wo-text)]">Estrutura organizacional</h2><p className="mt-1 text-xs leading-relaxed text-[var(--wo-muted)]">Organize áreas e equipes com propósito, responsáveis, pessoas e agentes.</p></div></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/equipes?create=1" className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-primary)] px-4 py-2.5 text-xs font-medium text-[var(--wo-bg)]"><Network className="h-4 w-4" /> Criar equipe</Link>
            <Link href="/equipes" className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)]">Ver estrutura <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-base font-medium text-[var(--wo-text)]">Governança de acesso</h2><p className="mt-1 text-xs leading-relaxed text-[var(--wo-muted)]">Defina quem pode observar, operar, aprovar e administrar em cada escopo.</p></div></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#grupos-e-permissoes" className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-primary)] px-4 py-2.5 text-xs font-medium text-[var(--wo-bg)]"><KeyRound className="h-4 w-4" /> Configurar acessos</a>
            <button type="button" onClick={() => openOrganizationProfile()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] px-4 py-2.5 text-xs text-[var(--wo-text)]">Gerenciar membros <ArrowRight className="h-4 w-4" /></button>
          </div>
        </Panel>
      </div>

      <section id="grupos-e-permissoes" className="scroll-mt-20 space-y-3">
        <div>
          <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--wo-primary)]">Papéis, escopos e alçadas</span>
          <h2 className="mt-1 text-xl font-medium text-[var(--wo-text)]">Grupos de usuários e permissões</h2>
        </div>
        <AccessControlPanel onInvite={() => openOrganizationProfile()} />
      </section>
    </div>
  );
}
