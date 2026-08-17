import { z } from "zod";

export const PurposeRiskTier = z.enum(["low", "medium", "high", "critical"]);
export const TeamStatus = z.enum(["active", "archived"]);
export const TeamMemberRole = z.enum([
  "owner",
  "supervisor",
  "operator",
  "observer",
]);
export const AgentAssignmentRole = z.enum(["primary", "supporting", "reviewer"]);
export const AgentAssignmentStatus = z.enum(["active", "paused", "ended"]);

export const PurposeInput = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  domain: z.string().trim().min(1).max(80),
  outcome: z.string().trim().min(1).max(500),
  riskTier: PurposeRiskTier.default("medium"),
});

export const Purpose = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  domain: z.string(),
  outcome: z.string(),
  riskTier: PurposeRiskTier,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateTeamInput = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(500).default(""),
  purposeId: z.string().min(1),
});

export const Team = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  purposeId: z.string(),
  status: TeamStatus,
  memberCount: z.number().int().nonnegative(),
  agentCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TeamMemberInput = z.object({
  memberId: z.string().trim().min(1).max(160),
  memberName: z.string().trim().min(1).max(160),
  role: TeamMemberRole.default("operator"),
  decisionRights: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
});

export const TeamMember = TeamMemberInput.extend({
  id: z.string(),
  teamId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AgentAssignmentInput = z.object({
  agentId: z.string().min(1),
  assignmentRole: AgentAssignmentRole.default("supporting"),
  responsibility: z.string().trim().max(500).default(""),
});

export const AgentAssignment = AgentAssignmentInput.extend({
  id: z.string(),
  teamId: z.string(),
  status: AgentAssignmentStatus,
  assignedAt: z.string(),
  endedAt: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TeamDetail = Team.extend({
  purpose: Purpose,
  members: z.array(TeamMember),
  assignments: z.array(AgentAssignment),
});

export const PurposeIdParams = z.object({ purposeId: z.string().min(1) });
export const TeamIdParams = z.object({ teamId: z.string().min(1) });
export const TeamMemberParams = z.object({
  teamId: z.string().min(1),
  membershipId: z.string().min(1),
});
export const TeamAssignmentParams = z.object({
  teamId: z.string().min(1),
  assignmentId: z.string().min(1),
});

export const ListPurposesResponse = z.array(Purpose);
export const ListTeamsResponse = z.array(Team);

