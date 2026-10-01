import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  db,
  journeys,
  organizationMembers,
  teamMemberships,
  teams,
  type OrgMemberRole,
  type TeamMemberRole,
} from "@workspace/db";
import type { AuthenticatedRequest } from "./requireAuth";
import { parseTeamMemberRole } from "../lib/mixed-team";
import { authorizeMixedTeamManagement } from "../lib/mixed-team-auth";
import { hasAccessPermission } from "../lib/access-control-service";

declare global {
  namespace Express {
    interface Request {
      mixedTeamRole?: TeamMemberRole;
    }
  }
}

async function resolveTeamId(req: Request): Promise<string | null> {
  if (typeof req.params.teamId === "string") return req.params.teamId;
  if (
    typeof req.body === "object" &&
    req.body !== null &&
    "teamId" in req.body &&
    typeof req.body.teamId === "string"
  ) {
    return req.body.teamId;
  }
  if (typeof req.params.journeyId === "string" && req.orgId) {
    const [journey] = await db
      .select({ teamId: journeys.teamId })
      .from(journeys)
      .where(
        and(eq(journeys.id, req.params.journeyId), eq(journeys.orgId, req.orgId)),
      )
      .limit(1);
    return journey?.teamId ?? null;
  }
  return null;
}

async function organizationRole(
  req: AuthenticatedRequest,
): Promise<OrgMemberRole | null> {
  if (!req.userId || !req.orgId) return null;
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, req.orgId),
        eq(organizationMembers.userId, req.userId),
      ),
    )
    .limit(1);
  return membership?.role ?? null;
}

async function teamRole(
  req: AuthenticatedRequest,
  teamId: string,
): Promise<TeamMemberRole | null> {
  if (!req.userId || !req.orgId) return null;
  const [membership] = await db
    .select({ role: teamMemberships.role })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(
      and(
        eq(teams.orgId, req.orgId),
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.memberId, req.userId),
      ),
    )
    .limit(1);
  return parseTeamMemberRole(membership?.role);
}

export function requireMixedTeamRole(
  ...allowedRoles: readonly TeamMemberRole[]
): RequestHandler {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const teamId = await resolveTeamId(req);
      if (!teamId || !req.orgId) {
        res.status(403).json({
          error: "Forbidden",
          reason: "A equipe não pertence à organização ativa.",
        });
        return;
      }
      const [team] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, teamId), eq(teams.orgId, req.orgId)))
        .limit(1);
      if (!team) {
        res.status(403).json({
          error: "Forbidden",
          reason: "A equipe não pertence à organização ativa.",
        });
        return;
      }
      const decision = authorizeMixedTeamManagement(
        await organizationRole(req),
        await teamRole(req, teamId),
        allowedRoles,
      );
      if (decision.authorized) {
        req.mixedTeamRole = decision.role;
        next();
        return;
      }
      const delegatedManagement = await hasAccessPermission(
            req.orgId,
            req.userId,
            "teams:manage",
            { type: "team", id: teamId },
          );
      if (!delegatedManagement) {
        res.status(decision.status).json({
          error: "Forbidden",
          reason: "É necessário ser gestor da equipe ou possuir teams:manage neste escopo.",
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireMixedTeamManager = requireMixedTeamRole(
  "owner",
  "supervisor",
);
