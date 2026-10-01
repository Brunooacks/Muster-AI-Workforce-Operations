export type WorkforceScreen =
  | "today"
  | "onboarding"
  | "reports"
  | "portfolio"
  | "professional"
  | "metrics"
  | "teams"
  | "journeys"
  | "benchmarks"
  | "connectors"
  | "settings"
  | "admission"
  | "alerts"
  | "admin"
  | "accountSettings"
  | "profile"
  | "connection";

export type WorkforceNavGroup = "Gestão" | "Operação" | "Plataforma" | "Administração";

export type WorkforceNavItem = {
  screen: WorkforceScreen;
  label: string;
  path: string;
  group: WorkforceNavGroup;
};

export const WORKFORCE_NAV_ITEMS: WorkforceNavItem[] = [
  { screen: "today", label: "Visão gerencial", path: "/comando", group: "Gestão" },
  { screen: "reports", label: "Relatórios executivos", path: "/relatorios", group: "Gestão" },
  { screen: "portfolio", label: "Portfólio", path: "/agentes", group: "Gestão" },
  { screen: "professional", label: "Profissional", path: "/agentes/sofia", group: "Gestão" },
  { screen: "metrics", label: "Métricas", path: "/metricas", group: "Operação" },
  { screen: "teams", label: "Equipes mistas", path: "/equipes", group: "Operação" },
  { screen: "journeys", label: "Jornadas A2A", path: "/jornadas", group: "Operação" },
  { screen: "benchmarks", label: "Benchmarks", path: "/benchmarks", group: "Operação" },
  { screen: "connectors", label: "Conectores", path: "/conectores", group: "Plataforma" },
  { screen: "settings", label: "Governança", path: "/governanca", group: "Plataforma" },
  { screen: "admin", label: "Admin Console", path: "/admin", group: "Administração" },
];

export const WORKFORCE_SPECIALIZED_ROUTES: WorkforceNavItem[] = [
  { screen: "onboarding", label: "Central de adoção", path: "/guia", group: "Gestão" },
  { screen: "admission", label: "Admissão", path: "/admissao", group: "Plataforma" },
  { screen: "alerts", label: "Alertas", path: "/alertas", group: "Operação" },
  { screen: "accountSettings", label: "Configurações", path: "/configuracoes", group: "Plataforma" },
  { screen: "profile", label: "Perfil", path: "/perfil", group: "Plataforma" },
];

export function isWorkforceScreen(value: string | null): value is WorkforceScreen {
  return value !== null && [...WORKFORCE_NAV_ITEMS, ...WORKFORCE_SPECIALIZED_ROUTES]
    .some((item) => item.screen === value);
}

export const WORKFORCE_STATIC_PATHS = [
  ...WORKFORCE_NAV_ITEMS.filter((item) => item.screen !== "professional").map((item) => item.path),
  ...WORKFORCE_SPECIALIZED_ROUTES.map((item) => item.path),
  "/frota",
  "/guia/novidades",
  "/guia/radar",
] as const;

export const APP_STATIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/prototipos",
  "/prototipos/workforce-os",
  "/onboarding",
  ...WORKFORCE_STATIC_PATHS,
] as const;

export function isKnownAppPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  const pathname = value.split(/[?#]/, 1)[0] || "/";
  if (APP_STATIC_PATHS.some((path) => path === pathname)) return true;
  if (pathname.startsWith("/sign-in/") || pathname.startsWith("/sign-up/")) return true;
  return /^\/agentes\/[^/]+(?:\/conectar)?$/.test(pathname);
}

export type ResolvedWorkforceRoute = {
  screen: WorkforceScreen;
  agentId?: string;
};

export function routeForWorkforceScreen(
  screen: WorkforceScreen,
  agentId = "sofia",
): string {
  if (screen === "professional") return `/agentes/${encodeURIComponent(agentId)}`;
  if (screen === "connection") return `/agentes/${encodeURIComponent(agentId)}/conectar`;
  return [...WORKFORCE_NAV_ITEMS, ...WORKFORCE_SPECIALIZED_ROUTES]
    .find((item) => item.screen === screen)?.path ?? "/comando";
}

export function navigationScreenForWorkforceScreen(screen: WorkforceScreen): WorkforceScreen {
  if (screen === "admission" || screen === "connection") return "connectors";
  if (screen === "alerts") return "today";
  if (screen === "accountSettings" || screen === "profile") return "settings";
  return screen;
}

export function resolveWorkforceRoute(location: string): ResolvedWorkforceRoute | null {
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  if (pathname === "/frota") return { screen: "portfolio" };
  if (pathname === "/guia/novidades" || pathname === "/guia/radar") return { screen: "onboarding" };
  const connectionMatch = pathname.match(/^\/agentes\/([^/]+)\/conectar$/);
  if (connectionMatch) {
    return { screen: "connection", agentId: decodeURIComponent(connectionMatch[1]) };
  }
  const agentMatch = pathname.match(/^\/agentes\/([^/]+)$/);
  if (agentMatch) {
    return { screen: "professional", agentId: decodeURIComponent(agentMatch[1]) };
  }
  const item = [...WORKFORCE_NAV_ITEMS, ...WORKFORCE_SPECIALIZED_ROUTES]
    .find((candidate) => candidate.path === pathname);
  return item ? { screen: item.screen } : null;
}
