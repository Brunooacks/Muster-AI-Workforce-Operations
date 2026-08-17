import { getAuth } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { db, teamMemberships, teams, type TeamMemberRole } from "@workspace/db";
import { authDevBypass, type AuthenticatedRequest } from "./requireAuth";
import { parseTeamMemberRole } from "../lib/mixed-team";
import { authorizeMixedTeamRole } from "../lib/mixed-team-auth";

declare global {
  namespace Express {
    interface Request {
      mixedTeamRole?: TeamMemberRole;
    }
  }
}

type ClaimsWithRole = {
  role?: unknown;
  publicMetadata?: { role?: unknown };
  metadata?: { role?: unknown };
};

function claimRole(req: Request): TeamMemberRole | null {
  const auth = getAuth(req);
  const claims = auth?.sessionClaims as ClaimsWithRole | undefined;
  return parseTeamMemberRole(
    claims?.role ?? claims?.publicMetadata?.role ?? claims?.metadata?.role,
  );
}

async function teamRole(
  req: AuthenticatedRequest,
): Promise<TeamMemberRole | null> {
  if (!req.userId) return null;

  const teamId =
    typeof req.params.teamId === "string" ? req.params.teamId : null;
  if (teamId) {
    const [membership] = await db
      .select({ role: teamMemberships.role })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .where(
        and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.memberId, req.userId),
        ),
      )
      .limit(1);
    return parseTeamMemberRole(membership?.role);
  }

  const claimedRole = claimRole(req);
  if (claimedRole) return claimedRole;

  const elevatedRoles: TeamMemberRole[] = ["owner", "supervisor"];
  const [membership] = await db
    .select({ role: teamMemberships.role })
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.memberId, req.userId),
        inArray(teamMemberships.role, elevatedRoles),
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

    if (authDevBypass) {
      req.mixedTeamRole = "owner";
      next();
      return;
    }

    try {
      const role = await teamRole(req);
      const decision = authorizeMixedTeamRole(role, allowedRoles);
      if (!decision.authorized) {
        res.status(decision.status).json({
          error: "Forbidden",
          reason: "A team owner or supervisor role is required",
        });
        return;
      }
      req.mixedTeamRole = decision.role;
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
