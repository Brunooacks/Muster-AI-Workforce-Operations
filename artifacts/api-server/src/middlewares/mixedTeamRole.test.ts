import { describe, expect, it } from "vitest";
import {
  authorizeMixedTeamManagement,
  authorizeMixedTeamRole,
} from "../lib/mixed-team-auth";
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

  it("never elevates an observer to a management role", () => {
    expect(authorizeMixedTeamRole("observer", ["owner", "supervisor"])).toEqual({
      authorized: false,
      status: 403,
      reason: "forbidden",
    });
  });

  it("permite que owner e admin da organização estruturem equipes", () => {
    expect(
      authorizeMixedTeamManagement("owner", null, ["owner", "supervisor"]),
    ).toEqual({ authorized: true, role: "owner" });
    expect(
      authorizeMixedTeamManagement("admin", "observer", [
        "owner",
        "supervisor",
      ]),
    ).toEqual({ authorized: true, role: "owner" });
  });

  it("limita membros comuns à alçada explícita da equipe", () => {
    expect(
      authorizeMixedTeamManagement("member", "supervisor", [
        "owner",
        "supervisor",
      ]),
    ).toEqual({ authorized: true, role: "supervisor" });
    expect(
      authorizeMixedTeamManagement("member", "operator", [
        "owner",
        "supervisor",
      ]),
    ).toEqual({ authorized: false, status: 403, reason: "forbidden" });
  });
});
