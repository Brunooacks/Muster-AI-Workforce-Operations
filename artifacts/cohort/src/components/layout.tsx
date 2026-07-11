import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import {
  LayoutGrid,
  Users,
  UserPlus,
  Plug,
  ShieldAlert,
  Scale,
  Gauge,
  BarChart3,
  Compass,
  Sparkles,
  LogOut,
  Menu,
  ChevronRight,
  Search,
  Bell,
  HelpCircle,
  Settings,
  UserCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAppShell } from "@/lib/app-shell";
import { Eyebrow, Pill } from "@/components/cohort";
import { CohortMark } from "@/components/logo";
import { useGetFleetSummary } from "@workspace/api-client-react";
import { platformLabel } from "@/lib/platforms";
import { getTrialInfo } from "@/lib/plan";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

type NavItem = { name: string; href: string; icon: typeof Users };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { name: "Comando", href: "/comando", icon: Compass },
      { name: "Agentes", href: "/agentes", icon: Users },
      { name: "Frota", href: "/frota", icon: LayoutGrid },
    ],
  },
  {
    label: "Governança",
    items: [
      { name: "Detector de vitória ilusória", href: "/alertas", icon: ShieldAlert },
      { name: "Governança", href: "/governanca", icon: Scale },
      { name: "Métricas", href: "/metricas", icon: Gauge },
      { name: "Benchmarks", href: "/benchmarks", icon: BarChart3 },
    ],
  },
  {
    label: "Conta",
    items: [
      { name: "Admissão", href: "/admissao", icon: UserPlus },
      { name: "Conectores", href: "/conectores", icon: Plug },
      { name: "Configurações", href: "/configuracoes", icon: Settings },
      { name: "Perfil", href: "/perfil", icon: UserCircle },
    ],
  },
];

function isActiveRoute(location: string, href: string) {
  return location === href || location.startsWith(href + "/");
}

function ConnectorsSection({ onNavigate }: { onNavigate?: () => void }) {
  const { data: summary } = useGetFleetSummary();
  const byPlatform = summary?.byPlatform ?? [];
  if (byPlatform.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <Eyebrow className="px-3">Conectores</Eyebrow>
      <div className="space-y-0.5">
        {byPlatform.map((p) => (
          <Link
            key={p.platform}
            href="/conectores"
            onClick={onNavigate}
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-1" />
              <span className="truncate">{platformLabel(p.platform)}</span>
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/70">
              {p.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DetectorV2Card() {
  return (
    <div className="rounded-xl border border-card-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-chart-2" strokeWidth={1.75} />
        <span className="text-sm font-medium text-foreground">Detector v2</span>
        <Pill tone="ochre">Beta</Pill>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        12 padrões novos de vitória ilusória, com correlação entre camadas.
      </p>
      <Button variant="outline" size="sm" className="w-full" disabled>
        Ativar
      </Button>
    </div>
  );
}

function PlanCard({ onNavigate }: { onNavigate?: () => void }) {
  const trial = getTrialInfo();
  return (
    <div className="rounded-xl border border-card-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{trial.planName}</span>
        <Pill tone="ochre">Trial</Pill>
      </div>
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="font-mono text-lg font-medium tabular-nums text-foreground">
          {trial.daysRemaining}
        </span>
        <span className="text-xs text-muted-foreground">
          {trial.daysRemaining === 1 ? "dia restante" : "dias restantes"}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-chart-2"
          style={{ width: `${Math.round(trial.progress * 100)}%` }}
        />
      </div>
      <Link
        href="/configuracoes#faturamento"
        onClick={onNavigate}
        className="text-xs font-medium text-chart-1 transition-colors hover:text-foreground"
      >
        Comparar planos →
      </Link>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <div className="space-y-6">
      <nav className="space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <Eyebrow className="px-3">{group.label}</Eyebrow>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActiveRoute(location, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <ConnectorsSection onNavigate={onNavigate} />
      <DetectorV2Card />
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <CohortMark className="h-7 w-7 shrink-0" />
      <div className="flex flex-col">
        <span className="font-serif text-2xl font-medium leading-none tracking-tight text-foreground">
          Muster
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          AI Workforce Operations
        </span>
      </div>
    </div>
  );
}

function UserCard({ onSignOut, onNavigate }: { onSignOut: () => void; onNavigate?: () => void }) {
  const { user } = useUser();
  return (
    <div className="rounded-xl border border-card-border bg-card p-3">
      <Link
        href="/perfil"
        onClick={onNavigate}
        className="mb-3 flex items-center gap-3 rounded-lg transition-colors hover:opacity-80"
      >
        <Avatar className="h-9 w-9 border border-border">
          <AvatarImage src={user?.imageUrl} />
          <AvatarFallback className="text-xs">{user?.firstName?.charAt(0) || "U"}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{user?.fullName || "Usuário"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user?.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={onSignOut}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>
    </div>
  );
}

function PerspectiveToggle() {
  const { perspective, setPerspective } = useAppShell();
  const options: { value: "gestor" | "platform"; label: string }[] = [
    { value: "gestor", label: "Gestor" },
    { value: "platform", label: "Platform" },
  ];
  return (
    <div className="hidden items-center rounded-full border border-border bg-card p-0.5 sm:flex">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setPerspective(opt.value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            perspective === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TopbarAvatar() {
  const { user } = useUser();
  return (
    <Link
      href="/perfil"
      className="rounded-full transition-opacity hover:opacity-80"
      aria-label="Perfil"
    >
      <Avatar className="h-8 w-8 border border-border">
        <AvatarImage src={user?.imageUrl} />
        <AvatarFallback className="text-xs">{user?.firstName?.charAt(0) || "U"}</AvatarFallback>
      </Avatar>
    </Link>
  );
}

function GlobalSearch() {
  const { search, setSearch } = useAppShell();
  const [, setLocation] = useLocation();
  const [value, setValue] = useState(search);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSearch(value);
        setLocation("/agentes");
      }}
      className="relative hidden max-w-xs flex-1 lg:block"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar agente, papel, plataforma…"
        className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
        aria-label="Buscar"
      />
    </form>
  );
}

export function AppLayout({ children, title, breadcrumbs }: LayoutProps) {
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const handleSignOut = () => signOut({ redirectUrl: basePath || "/" });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar — Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-6 py-6">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarNav />
        </div>
        <div className="space-y-3 p-3">
          <PlanCard />
          <UserCard onSignOut={handleSignOut} />
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-64 flex-col p-0">
                <div className="border-b border-sidebar-border px-6 py-6">
                  <Wordmark />
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <SidebarNav onNavigate={() => setMobileOpen(false)} />
                </div>
                <div className="space-y-3 p-3">
                  <PlanCard onNavigate={() => setMobileOpen(false)} />
                  <UserCard onSignOut={handleSignOut} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            {/* Breadcrumb / title */}
            {breadcrumbs ? (
              <div className="flex min-w-0 items-center text-sm text-muted-foreground">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.label} className="flex min-w-0 items-center">
                    {index > 0 && <ChevronRight className="mx-1 h-4 w-4 shrink-0" />}
                    {crumb.href ? (
                      <Link href={crumb.href} className="truncate transition-colors hover:text-foreground">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-foreground">{crumb.label}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <GlobalSearch />
            <PerspectiveToggle />
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Notificações">
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Ajuda">
              <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </Button>
            <TopbarAvatar />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
