import { describe, expect, it } from "vitest";
import {
  ACCESS_PERMISSIONS,
  accessGrantMatchesScope,
  canAccess,
  effectivePermissions,
  normalizeAccessPermissions,
} from "./access-policy";

describe("access policy", () => {
  it("gives owners and admins every permission", () => {
    expect(effectivePermissions("owner", [])).toEqual(ACCESS_PERMISSIONS);
    expect(canAccess("admin", [], "governance:manage")).toBe(true);
  });

  it("limits member grants to the matching scope", () => {
    const grants = [
      {
        scopeType: "team" as const,
        scopeId: "team-a",
        permissions: ["teams:manage" as const],
      },
    ];

    expect(
      canAccess("member", grants, "teams:manage", {
        type: "team",
        id: "team-a",
      }),
    ).toBe(true);
    expect(
      canAccess("member", grants, "teams:manage", {
        type: "team",
        id: "team-b",
      }),
    ).toBe(false);
    expect(canAccess("member", grants, "teams:manage")).toBe(false);
  });

  it("lets organization grants apply to every scoped resource", () => {
    expect(
      accessGrantMatchesScope(
        { scopeType: "organization", scopeId: null },
        { type: "area", id: "finance" },
      ),
    ).toBe(true);
  });

  it("drops unknown and duplicate permissions", () => {
    expect(
      normalizeAccessPermissions([
        "agents:read",
        "agents:read",
        "root:everything",
        null,
      ]),
    ).toEqual(["agents:read"]);
  });
});
