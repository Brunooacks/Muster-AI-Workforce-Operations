import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  accessGroupMembers,
  accessGroups,
  areas,
  db,
  teams,
  type AccessScopeType,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import {
  ACCESS_PERMISSIONS,
  ACCESS_PERMISSION_PRESETS,
  normalizeAccessPermissions,
} from "../lib/access-policy";
import { readUserAccess } from "../lib/access-control-service";
import { ensureOrganizationMember } from "../lib/organization-provisioning";

const router: IRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readPathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function readScopeType(value: unknown): AccessScopeType | null {
  return value === "organization" || value === "area" || value === "team"
    ? value
    : null;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );
}

async function validateScope(
  orgId: string,
  scopeType: AccessScopeType,
  rawScopeId: unknown,
): Promise<{ scopeId: string | null; scopeLabel: string } | null> {
  if (scopeType === "organization") {
    return { scopeId: null, scopeLabel: "Toda a organização" };
  }

  const scopeId = readText(rawScopeId);
  if (!scopeId) return null;
  if (scopeType === "area") {
    const [area] = await db
      .select({ name: areas.name })
      .from(areas)
      .where(and(eq(areas.id, scopeId), eq(areas.orgId, orgId)))
      .limit(1);
    return area ? { scopeId, scopeLabel: area.name } : null;
  }

  const [team] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, scopeId), eq(teams.orgId, orgId)))
    .limit(1);
  return team ? { scopeId, scopeLabel: team.name } : null;
}

async function accessOverview(orgId: string, userId: string) {
  const [groupRows, memberRows, areaRows, teamRows, access] = await Promise.all([
    db
      .select()
      .from(accessGroups)
      .where(eq(accessGroups.orgId, orgId))
      .orderBy(asc(accessGroups.name)),
    db
      .select({
        id: accessGroupMembers.id,
        groupId: accessGroupMembers.groupId,
        userId: accessGroupMembers.userId,
        userName: accessGroupMembers.userName,
        userEmail: accessGroupMembers.userEmail,
        createdAt: accessGroupMembers.createdAt,
      })
      .from(accessGroupMembers)
      .innerJoin(accessGroups, eq(accessGroups.id, accessGroupMembers.groupId))
      .where(eq(accessGroups.orgId, orgId))
      .orderBy(asc(accessGroupMembers.userName)),
    db
      .select({ id: areas.id, name: areas.name })
      .from(areas)
      .where(eq(areas.orgId, orgId))
      .orderBy(asc(areas.name)),
    db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.orgId, orgId))
      .orderBy(asc(teams.name)),
    readUserAccess(orgId, userId),
  ]);

  const areaNames = new Map(areaRows.map((area) => [area.id, area.name]));
  const teamNames = new Map(teamRows.map((team) => [team.id, team.name]));
  const membersByGroup = new Map<string, typeof memberRows>();
  for (const member of memberRows) {
    const members = membersByGroup.get(member.groupId) ?? [];
    members.push(member);
    membersByGroup.set(member.groupId, members);
  }
  const permissions =
    access.role === "owner" || access.role === "admin"
      ? [...ACCESS_PERMISSIONS]
      : Array.from(
          new Set(access.grants.flatMap((grant) => grant.permissions)),
        );

  return {
    currentUser: {
      userId,
      orgRole: access.role,
      permissions,
    },
    presets: ACCESS_PERMISSION_PRESETS,
    groups: groupRows.map((group) => {
      const members = membersByGroup.get(group.id) ?? [];
      const scopeLabel =
        group.scopeType === "organization"
          ? "Toda a organização"
          : group.scopeType === "area"
            ? areaNames.get(group.scopeId ?? "") ?? "Área removida"
            : teamNames.get(group.scopeId ?? "") ?? "Equipe removida";
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        scopeType: group.scopeType,
        scopeId: group.scopeId,
        scopeLabel,
        permissions: group.permissions,
        memberCount: members.length,
        members: members.map((member) => ({
          id: member.id,
          userId: member.userId,
          userName: member.userName,
          userEmail: member.userEmail,
          createdAt: member.createdAt.toISOString(),
        })),
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      };
    }),
    scopes: { areas: areaRows, teams: teamRows },
  };
}

router.get(
  "/access-control/overview",
  requireAuth,
  requireOrg,
  async (req, res) => {
    res.json(await accessOverview(req.orgId!, req.userId!));
  },
);

router.post(
  "/access-control/groups",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    if (!isRecord(req.body)) {
      res.status(400).json({ error: "Corpo inválido." });
      return;
    }
    const name = readText(req.body.name);
    const description = readText(req.body.description);
    const scopeType = readScopeType(req.body.scopeType);
    const permissions = normalizeAccessPermissions(req.body.permissions);
    if (!name || !scopeType || permissions.length === 0) {
      res.status(400).json({ error: "Nome, escopo e ao menos uma permissão são obrigatórios." });
      return;
    }
    const scope = await validateScope(req.orgId!, scopeType, req.body.scopeId);
    if (!scope) {
      res.status(400).json({ error: "O escopo informado não pertence à organização." });
      return;
    }

    try {
      const [created] = await db
        .insert(accessGroups)
        .values({
          orgId: req.orgId!,
          name,
          slug: slugify(name) || `grupo-${Date.now()}`,
          description,
          scopeType,
          scopeId: scope.scopeId,
          permissions,
          createdBy: req.userId!,
        })
        .returning();
      res.status(201).json({
        id: created!.id,
        name: created!.name,
        description: created!.description,
        scopeType: created!.scopeType,
        scopeId: created!.scopeId,
        scopeLabel: scope.scopeLabel,
        permissions: created!.permissions,
        memberCount: 0,
        members: [],
        createdAt: created!.createdAt.toISOString(),
        updatedAt: created!.updatedAt.toISOString(),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Já existe um grupo com esse nome." });
        return;
      }
      throw error;
    }
  },
);

router.patch(
  "/access-control/groups/:groupId",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const groupId = readPathParam(req.params.groupId);
    if (!isRecord(req.body)) {
      res.status(400).json({ error: "Corpo inválido." });
      return;
    }
    const [current] = await db
      .select()
      .from(accessGroups)
      .where(
        and(
          eq(accessGroups.id, groupId),
          eq(accessGroups.orgId, req.orgId!),
        ),
      )
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Grupo não encontrado." });
      return;
    }

    const name = readText(req.body.name, current.name);
    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : current.description;
    const scopeType = readScopeType(req.body.scopeType) ?? current.scopeType;
    const permissions =
      req.body.permissions === undefined
        ? current.permissions
        : normalizeAccessPermissions(req.body.permissions);
    const scope = await validateScope(
      req.orgId!,
      scopeType,
      req.body.scopeId === undefined ? current.scopeId : req.body.scopeId,
    );
    if (!name || permissions.length === 0 || !scope) {
      res.status(400).json({ error: "Nome, escopo e ao menos uma permissão são obrigatórios." });
      return;
    }

    try {
      const [updated] = await db
        .update(accessGroups)
        .set({
          name,
          slug: slugify(name) || current.slug,
          description,
          scopeType,
          scopeId: scope.scopeId,
          permissions,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accessGroups.id, current.id),
            eq(accessGroups.orgId, req.orgId!),
          ),
        )
        .returning();
      res.json({
        id: updated!.id,
        name: updated!.name,
        description: updated!.description,
        scopeType: updated!.scopeType,
        scopeId: updated!.scopeId,
        scopeLabel: scope.scopeLabel,
        permissions: updated!.permissions,
        createdAt: updated!.createdAt.toISOString(),
        updatedAt: updated!.updatedAt.toISOString(),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Já existe um grupo com esse nome." });
        return;
      }
      throw error;
    }
  },
);

router.delete(
  "/access-control/groups/:groupId",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const groupId = readPathParam(req.params.groupId);
    const deleted = await db
      .delete(accessGroups)
      .where(
        and(
          eq(accessGroups.id, groupId),
          eq(accessGroups.orgId, req.orgId!),
        ),
      )
      .returning({ id: accessGroups.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Grupo não encontrado." });
      return;
    }
    res.status(204).end();
  },
);

router.post(
  "/access-control/groups/:groupId/members",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const groupId = readPathParam(req.params.groupId);
    if (!isRecord(req.body)) {
      res.status(400).json({ error: "Corpo inválido." });
      return;
    }
    const userId = readText(req.body.userId);
    if (!userId) {
      res.status(400).json({ error: "Usuário é obrigatório." });
      return;
    }
    const [group] = await db
      .select({ id: accessGroups.id })
      .from(accessGroups)
      .where(
        and(
          eq(accessGroups.id, groupId),
          eq(accessGroups.orgId, req.orgId!),
        ),
      )
      .limit(1);
    if (!group) {
      res.status(404).json({ error: "Grupo não encontrado." });
      return;
    }

    const memberProfile = await ensureOrganizationMember(req.orgId!, userId);
    if (!memberProfile) {
      res.status(400).json({ error: "O usuário não pertence à organização ativa." });
      return;
    }
    const userName = readText(req.body.userName, memberProfile.name);
    const userEmail = readText(req.body.userEmail, memberProfile.email ?? "") || null;

    try {
      const [created] = await db
        .insert(accessGroupMembers)
        .values({
          groupId: group.id,
          userId,
          userName,
          userEmail,
        })
        .returning();
      res.status(201).json({
        ...created,
        createdAt: created!.createdAt.toISOString(),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Este usuário já pertence ao grupo." });
        return;
      }
      throw error;
    }
  },
);

router.delete(
  "/access-control/groups/:groupId/members/:userId",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const groupId = readPathParam(req.params.groupId);
    const userId = readPathParam(req.params.userId);
    const [group] = await db
      .select({ id: accessGroups.id })
      .from(accessGroups)
      .where(
        and(
          eq(accessGroups.id, groupId),
          eq(accessGroups.orgId, req.orgId!),
        ),
      )
      .limit(1);
    if (!group) {
      res.status(404).json({ error: "Grupo não encontrado." });
      return;
    }
    const deleted = await db
      .delete(accessGroupMembers)
      .where(
        and(
          eq(accessGroupMembers.groupId, group.id),
          eq(accessGroupMembers.userId, userId),
        ),
      )
      .returning({ id: accessGroupMembers.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Membro não encontrado no grupo." });
      return;
    }
    res.status(204).end();
  },
);

export default router;
