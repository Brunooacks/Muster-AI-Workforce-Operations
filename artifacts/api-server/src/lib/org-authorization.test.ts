import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeOrgRole } from "./org-authorization";

describe("org-level authorization", () => {
  it("separa configuração administrativa de operação cotidiana", () => {
    expect(authorizeOrgRole("owner", ["owner", "admin"]).authorized).toBe(true);
    expect(authorizeOrgRole("admin", ["owner", "admin"]).authorized).toBe(true);
    expect(authorizeOrgRole("member", ["owner", "admin"]).authorized).toBe(false);
    expect(
      authorizeOrgRole("member", ["owner", "admin", "member"]).authorized,
    ).toBe(true);
  });

  it("falha fechada sem membership", () => {
    expect(authorizeOrgRole(null, ["owner", "admin"])).toEqual({
      authorized: false,
      status: 403,
      reason: "forbidden",
    });
  });

  it("mantém RBAC nas escritas sensíveis", () => {
    const routesDir = join(import.meta.dirname, "..", "routes");
    const expectations = [
      { file: "agent-keys.ts", middleware: "requireOrgAdmin", uses: 2 },
      { file: "areas.ts", middleware: "requireOrgAdmin", uses: 4 },
      { file: "catalog.ts", middleware: "requireOrgAdmin", uses: 3 },
      { file: "connectors.ts", middleware: "requireOrgAdmin", uses: 6 },
      { file: "executive-reports.ts", middleware: "requireOrgAdmin", uses: 1 },
      { file: "verdict-actions.ts", middleware: "requireOrgOperator", uses: 1 },
      { file: "fleet.ts", middleware: "requireOrgOperator", uses: 1 },
    ];

    for (const expected of expectations) {
      const source = readFileSync(join(routesDir, expected.file), "utf8");
      const occurrences = source.split(expected.middleware).length - 1;
      // Uma ocorrência é o import; as demais precisam estar nos handlers.
      expect(occurrences, expected.file).toBe(expected.uses + 1);
    }
  });
});
