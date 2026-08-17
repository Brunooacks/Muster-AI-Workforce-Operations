import { describe, expect, it } from "vitest";
import { authorizeMixedTeamRole } from "../lib/mixed-team-auth";
import {
  isRoleAllowed,
  isTeamMemberRole,
  parseTeamMemberRole,
} from "../lib/mixed-team";

describe("mixed team role authorization", () => {
  it.each(["owner", "supervisor", "operator", "observer"])(
    "recognizes the %s role",
    (role) => {
      expect(isTeamMemberRole(role)).toBe(true);
      expect(parseTeamMemberRole(role)).toBe(role);
    },
  );

  it.each([undefined, null, "admin", "OWNER", 1])(
    "rejects invalid role %s",
    (role) => {
      expect(isTeamMemberRole(role)).toBe(false);
      expect(parseTeamMemberRole(role)).toBeNull();
    },
  );

  it("allows only owners and supervisors to manage a team", () => {
    expect(isRoleAllowed("owner", ["owner", "supervisor"])).toBe(true);
    expect(isRoleAllowed("supervisor", ["owner", "supervisor"])).toBe(true);
    expect(isRoleAllowed("operator", ["owner", "supervisor"])).toBe(false);
    expect(isRoleAllowed("observer", ["owner", "supervisor"])).toBe(false);
  });

  it("returns a forbidden decision for a valid but insufficient role", () => {
    expect(authorizeMixedTeamRole("operator", ["owner", "supervisor"])).toEqual(
      {
        authorized: false,
        status: 403,
        reason: "forbidden",
      },
    );
  });

  it("returns a forbidden decision for an unknown role", () => {
    expect(authorizeMixedTeamRole("admin", ["owner", "supervisor"])).toEqual({
      authorized: false,
      status: 403,
      reason: "forbidden",
    });
  });

  it("keeps local development bypass enabled as owner", () => {
    expect(
      authorizeMixedTeamRole("observer", ["owner", "supervisor"], true),
    ).toEqual({
      authorized: true,
      role: "owner",
    });
  });
});
