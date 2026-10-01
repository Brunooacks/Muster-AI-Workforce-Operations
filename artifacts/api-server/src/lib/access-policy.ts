import type {
  AccessPermission,
  AccessScopeType,
  OrgMemberRole,
} from "@workspace/db";

export const ACCESS_PERMISSIONS = [
  "agents:read",
  "agents:operate",
  "teams:read",
  "teams:manage",
  "journeys:read",
  "journeys:manage",
  "decisions:approve",
  "governance:read",
  "governance:manage",
  "reports:read",
  "connectors:manage",
  "members:manage",
] as const satisfies readonly AccessPermission[];

export interface AccessPermissionPreset {
  id: string;
  name: string;
  description: string;
  permissions: AccessPermission[];
}

export const ACCESS_PERMISSION_PRESETS: AccessPermissionPreset[] = [
  {
    id: "operations-manager",
    name: "Gestor de operação",
    description: "Opera agentes, equipes, jornadas e decisões dentro do escopo.",
    permissions: [
      "agents:read",
      "agents:operate",
      "teams:read",
      "teams:manage",
      "journeys:read",
      "journeys:manage",
      "decisions:approve",
      "governance:read",
      "reports:read",
    ],
  },
  {
    id: "journey-supervisor",
    name: "Supervisor de jornada",
    description: "Supervisiona execução, aprova decisões e acompanha governança.",
    permissions: [
      "agents:read",
      "teams:read",
      "journeys:read",
      "journeys:manage",
      "decisions:approve",
      "governance:read",
      "reports:read",
    ],
  },
  {
    id: "governance-auditor",
    name: "Auditor de IA",
    description: "Consulta evidências, relatórios e controles sem alterar a operação.",
    permissions: [
      "agents:read",
      "teams:read",
      "journeys:read",
      "governance:read",
      "reports:read",
    ],
  },
  {
    id: "platform-operator",
    name: "Operador de plataforma",
    description: "Administra conectores e opera agentes com governança visível.",
    permissions: [
      "agents:read",
      "agents:operate",
      "teams:read",
      "journeys:read",
      "governance:read",
      "connectors:manage",
    ],
  },
  {
    id: "observer",
    name: "Observador executivo",
    description: "Acompanha portfólio, jornadas, governança e relatórios.",
    permissions: [
      "agents:read",
      "teams:read",
      "journeys:read",
      "governance:read",
      "reports:read",
    ],
  },
];

export interface AccessGrant {
  scopeType: AccessScopeType;
  scopeId: string | null;
  permissions: AccessPermission[];
}

export interface AccessScope {
  type: Exclude<AccessScopeType, "organization">;
  id: string;
}

const permissionSet = new Set<string>(ACCESS_PERMISSIONS);

export function normalizeAccessPermissions(value: unknown): AccessPermission[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (permission): permission is AccessPermission =>
          typeof permission === "string" && permissionSet.has(permission),
      ),
    ),
  );
}

export function accessGrantMatchesScope(
  grant: Pick<AccessGrant, "scopeType" | "scopeId">,
  scope?: AccessScope,
): boolean {
  if (grant.scopeType === "organization") return true;
  return Boolean(
    scope && grant.scopeType === scope.type && grant.scopeId === scope.id,
  );
}

export function effectivePermissions(
  role: OrgMemberRole | null,
  grants: AccessGrant[],
  scope?: AccessScope,
): AccessPermission[] {
  if (role === "owner" || role === "admin") {
    return [...ACCESS_PERMISSIONS];
  }
  if (role !== "member") return [];

  return Array.from(
    new Set(
      grants
        .filter((grant) => accessGrantMatchesScope(grant, scope))
        .flatMap((grant) => grant.permissions),
    ),
  );
}

export function canAccess(
  role: OrgMemberRole | null,
  grants: AccessGrant[],
  permission: AccessPermission,
  scope?: AccessScope,
): boolean {
  return effectivePermissions(role, grants, scope).includes(permission);
}
