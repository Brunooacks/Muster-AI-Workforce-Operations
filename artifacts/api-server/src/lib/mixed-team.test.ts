import { describe, expect, it } from "vitest";
import {
  canManageMixedTeam,
  normalizeDecisionRights,
  slugifyTeamName,
} from "./mixed-team";

describe("mixed team helpers", () => {
  it("creates stable slugs from team names", () => {
    expect(slugifyTeamName("Atendimento — Brasil & LATAM")).toBe(
      "atendimento-brasil-latam",
    );
  });

  it("removes empty and duplicate decision rights", () => {
    expect(normalizeDecisionRights(["approve", " ", "approve", "escalate"])).toEqual([
      "approve",
      "escalate",
    ]);
  });

  it("limits team management to owners and supervisors", () => {
    expect(canManageMixedTeam("owner")).toBe(true);
    expect(canManageMixedTeam("supervisor")).toBe(true);
    expect(canManageMixedTeam("operator")).toBe(false);
    expect(canManageMixedTeam("observer")).toBe(false);
  });
});

