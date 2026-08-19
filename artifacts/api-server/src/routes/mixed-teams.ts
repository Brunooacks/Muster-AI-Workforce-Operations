import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  agents,
  db,
  purposes,
  teamAgentAssignments,
  teamMemberships,
  teams,
} from "@workspace/db";
import {
  AgentAssignment,
  AgentAssignmentInput,
  CreateTeamInput,
  ListPurposesResponse,
  ListTeamsResponse,
  Purpose,
  PurposeIdParams,
  PurposeInput,
  Team,
  TeamAssignmentParams,
  TeamDetail,
  TeamIdParams,
  TeamMember,
  TeamMemberInput,
  TeamMemberParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireMixedTeamManager } from "../middlewares/mixedTeamRole";
import { normalizeDecisionRights, slugifyTeamName } from "../lib/mixed-team";

const router: IRouter = Router();

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function toPurpose(row: typeof purposes.$inferSelect) {
  return Purpose.parse({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    domain: row.domain,
    outcome: row.outcome,
    riskTier: row.riskTier,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toTeam(
  row: typeof teams.$inferSelect,
  memberCount: number,
  agentCount: number,
) {
  return Team.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    purposeId: row.purposeId,
    status: row.status,
    memberCount,
    agentCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toMember(row: typeof teamMemberships.$inferSelect) {
  return TeamMember.parse({
    id: row.id,
    teamId: row.teamId,
    memberId: row.memberId,
    memberName: row.memberName,
    role: row.role,
    decisionRights: row.decisionRights,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toAssignment(row: typeof teamAgentAssignments.$inferSelect) {
  return AgentAssignment.parse({
    id: row.id,
    teamId: row.teamId,
    agentId: row.agentId,
    assignmentRole: row.assignmentRole,
    responsibility: row.responsibility,
    status: row.status,
    assignedAt: row.assignedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

async function getTeam(teamId: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return null;

  const [purpose] = await db
    .select()
    .from(purposes)
    .where(eq(purposes.id, team.purposeId));
  const members = await db
    .select()
    .from(teamMemberships)
    .where(eq(teamMemberships.teamId, teamId))
    .orderBy(desc(teamMemberships.createdAt));
  const assignments = await db
    .select()
    .from(teamAgentAssignments)
    .where(eq(teamAgentAssignments.teamId, teamId))
    .orderBy(desc(teamAgentAssignments.createdAt));

  if (!purpose) return null;
  return TeamDetail.parse({
    ...toTeam(team, members.length, assignments.length),
    purpose: toPurpose(purpose),
    members: members.map(toMember),
    assignments: assignments.map(toAssignment),
  });
}

router.get("/purposes", requireAuth, requireOrg, async (_req, res) => {
  const rows = await db
    .select()
    .from(purposes)
    .orderBy(desc(purposes.createdAt));
  res.json(ListPurposesResponse.parse(rows.map(toPurpose)));
});

router.post(
  "/purposes",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const body = PurposeInput.parse(req.body);
    try {
      const [created] = await db
        .insert(purposes)
        .values({ ...body, orgId: req.orgId! })
        .returning();
      res.status(201).json(Purpose.parse(toPurpose(created!)));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Purpose key already exists" });
        return;
      }
      throw error;
    }
  },
);

router.get("/purposes/:purposeId", requireAuth, requireOrg, async (req, res) => {
  const { purposeId } = PurposeIdParams.parse(req.params);
  const [purpose] = await db
    .select()
    .from(purposes)
    .where(eq(purposes.id, purposeId));
  if (!purpose) {
    res.status(404).json({ error: "Purpose not found" });
    return;
  }
  res.json(toPurpose(purpose));
});

router.delete(
  "/purposes/:purposeId",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { purposeId } = PurposeIdParams.parse(req.params);
    const deleted = await db
      .delete(purposes)
      .where(eq(purposes.id, purposeId))
      .returning({ id: purposes.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Purpose not found" });
      return;
    }
    res.status(204).end();
  },
);

router.get("/teams", requireAuth, requireOrg, async (_req, res) => {
  const rows = await db.select().from(teams).orderBy(desc(teams.createdAt));
  const members = await db.select().from(teamMemberships);
  const assignments = await db.select().from(teamAgentAssignments);
  const memberCounts = new Map<string, number>();
  const agentCounts = new Map<string, number>();
  for (const member of members) {
    memberCounts.set(member.teamId, (memberCounts.get(member.teamId) ?? 0) + 1);
  }
  for (const assignment of assignments) {
    agentCounts.set(
      assignment.teamId,
      (agentCounts.get(assignment.teamId) ?? 0) + 1,
    );
  }
  res.json(
    ListTeamsResponse.parse(
      rows.map((row) =>
        toTeam(
          row,
          memberCounts.get(row.id) ?? 0,
          agentCounts.get(row.id) ?? 0,
        ),
      ),
    ),
  );
});

router.post(
  "/teams",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const body = CreateTeamInput.parse(req.body);
    const [purpose] = await db
      .select()
      .from(purposes)
      .where(eq(purposes.id, body.purposeId));
    if (!purpose) {
      res.status(404).json({ error: "Purpose not found" });
      return;
    }

    const slug =
      body.slug ?? (slugifyTeamName(body.name) || `team-${Date.now()}`);
    try {
      const [created] = await db
        .insert(teams)
        .values({
          orgId: req.orgId!,
          name: body.name,
          slug,
          description: body.description,
          purposeId: body.purposeId,
        })
        .returning();
      res.status(201).json(toTeam(created!, 0, 0));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Team slug already exists" });
        return;
      }
      throw error;
    }
  },
);

router.get("/teams/:teamId", requireAuth, requireOrg, async (req, res) => {
  const { teamId } = TeamIdParams.parse(req.params);
  const team = await getTeam(teamId);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  res.json(team);
});

router.delete(
  "/teams/:teamId",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { teamId } = TeamIdParams.parse(req.params);
    const deleted = await db
      .delete(teams)
      .where(eq(teams.id, teamId))
      .returning({ id: teams.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    res.status(204).end();
  },
);

router.post(
  "/teams/:teamId/members",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { teamId } = TeamIdParams.parse(req.params);
    const body = TeamMemberInput.parse(req.body);
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    try {
      const [created] = await db
        .insert(teamMemberships)
        .values({
          teamId,
          memberId: body.memberId,
          memberName: body.memberName,
          role: body.role,
          decisionRights: normalizeDecisionRights(body.decisionRights),
        })
        .returning();
      res.status(201).json(toMember(created!));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Member already belongs to this team" });
        return;
      }
      throw error;
    }
  },
);

router.delete(
  "/teams/:teamId/members/:membershipId",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { teamId, membershipId } = TeamMemberParams.parse(req.params);
    const deleted = await db
      .delete(teamMemberships)
      .where(
        and(
          eq(teamMemberships.id, membershipId),
          eq(teamMemberships.teamId, teamId),
        ),
      )
      .returning({ id: teamMemberships.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Membership not found" });
      return;
    }
    res.status(204).end();
  },
);

router.post(
  "/teams/:teamId/agents",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { teamId } = TeamIdParams.parse(req.params);
    const body = AgentAssignmentInput.parse(req.body);
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, body.agentId));
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    try {
      const [created] = await db
        .insert(teamAgentAssignments)
        .values({
          teamId,
          agentId: body.agentId,
          assignmentRole: body.assignmentRole,
          responsibility: body.responsibility,
        })
        .returning();
      res.status(201).json(toAssignment(created!));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Agent already belongs to this team" });
        return;
      }
      throw error;
    }
  },
);

router.delete(
  "/teams/:teamId/agents/:assignmentId",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { teamId, assignmentId } = TeamAssignmentParams.parse(req.params);
    const deleted = await db
      .delete(teamAgentAssignments)
      .where(
        and(
          eq(teamAgentAssignments.id, assignmentId),
          eq(teamAgentAssignments.teamId, teamId),
        ),
      )
      .returning({ id: teamAgentAssignments.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Agent assignment not found" });
      return;
    }
    res.status(204).end();
  },
);

export default router;
