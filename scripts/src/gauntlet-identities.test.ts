import { describe, expect, it } from "vitest";
import {
  gauntletAgentName,
  gauntletExternalId,
  gauntletRuntimeStatus,
} from "./gauntlet-identities";

describe("gauntlet identities", () => {
  it("separa a identidade operacional de cada perfil", () => {
    expect(gauntletAgentName("Atlas", "baseline")).toBe(
      "[gauntlet-real] v3 · Atlas · Operação saudável",
    );
    expect(gauntletAgentName("Atlas", "stress")).toBe(
      "[gauntlet-real] v3 · Atlas · Carga alta",
    );
    expect(gauntletAgentName("Atlas", "chaos")).toBe(
      "[gauntlet-real] v3 · Atlas · Falha controlada",
    );
  });

  it("mantém um external id estável e auditável", () => {
    expect(gauntletExternalId("support-triage", "chaos")).toBe(
      "local:gauntlet:v3:support-triage:chaos",
    );
  });

  it("sinaliza caos como runtime degradado", () => {
    expect(gauntletRuntimeStatus("baseline")).toBe("healthy");
    expect(gauntletRuntimeStatus("stress")).toBe("healthy");
    expect(gauntletRuntimeStatus("chaos")).toBe("degraded");
  });
});
