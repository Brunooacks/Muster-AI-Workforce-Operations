import { describe, expect, it } from "vitest";
import {
  authorizeMixedTeamManagement,
  authorizeMixedTeamRole,
} from "./mixed-team-auth";

const FORBIDDEN = {
  authorized: false,
  status: 403,
  reason: "forbidden",
} as const;

const INVALID_ROLE_CASES: Array<[string, unknown]> = [
  ["papel inexistente", "superuser"],
  ["papel undefined", undefined],
  ["papel null", null],
  ["papel numérico", 42],
  ["papel em objeto", { role: "owner" }],
];

describe("autorização por papel de time misto", () => {
  it("autoriza o owner do time quando o papel é permitido", () => {
    expect(authorizeMixedTeamRole("owner", ["owner", "supervisor"])).toEqual({
      authorized: true,
      role: "owner",
    });
  });

  it("autoriza o supervisor do time quando o papel é permitido", () => {
    expect(authorizeMixedTeamRole("supervisor", ["supervisor"])).toEqual({
      authorized: true,
      role: "supervisor",
    });
  });

  it("autoriza o operator do time quando o papel é permitido", () => {
    expect(
      authorizeMixedTeamRole("operator", ["operator", "observer"]),
    ).toEqual({
      authorized: true,
      role: "operator",
    });
  });

  it("nega um papel válido que está fora de allowedRoles", () => {
    expect(authorizeMixedTeamRole("operator", ["owner", "supervisor"])).toEqual(
      FORBIDDEN,
    );
  });

  it.each(INVALID_ROLE_CASES)("nega %s com 403 forbidden", (_label, role) => {
    expect(authorizeMixedTeamRole(role, ["owner", "supervisor"])).toEqual(
      FORBIDDEN,
    );
  });

  it("nega qualquer papel quando allowedRoles está vazio", () => {
    expect(authorizeMixedTeamRole("owner", [])).toEqual(FORBIDDEN);
  });

  it("permite gestão pelo owner da organização mesmo com teamRole inválido", () => {
    expect(
      authorizeMixedTeamManagement("owner", "superuser", ["observer"]),
    ).toEqual({ authorized: true, role: "owner" });
  });

  it("permite gestão pelo admin da organização mesmo com teamRole ausente", () => {
    expect(
      authorizeMixedTeamManagement("admin", undefined, ["observer"]),
    ).toEqual({ authorized: true, role: "owner" });
  });

  it("faz o membro da organização cair na regra do time e autoriza", () => {
    expect(
      authorizeMixedTeamManagement("member", "supervisor", ["supervisor"]),
    ).toEqual({ authorized: true, role: "supervisor" });
  });

  it("faz a organização sem papel cair na regra do time e nega", () => {
    expect(
      authorizeMixedTeamManagement(null, "observer", ["owner", "supervisor"]),
    ).toEqual(FORBIDDEN);
  });
});
