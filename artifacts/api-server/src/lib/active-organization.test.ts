import { describe, expect, it } from "vitest";
import { resolveActiveOrganizationId } from "./active-organization";

describe("resolveActiveOrganizationId", () => {
  it("prioriza a organização ativa resolvida pelo Clerk", () => {
    expect(
      resolveActiveOrganizationId("org_active", { org_id: "org_claim" }),
    ).toBe("org_active");
  });

  it("usa o claim org_id quando o SDK não expõe orgId", () => {
    expect(resolveActiveOrganizationId(null, { org_id: "org_claim" })).toBe(
      "org_claim",
    );
  });

  it("falha fechada sem organização ativa", () => {
    expect(resolveActiveOrganizationId(undefined, { sub: "user_1" })).toBeNull();
    expect(resolveActiveOrganizationId(undefined, null)).toBeNull();
  });
});
