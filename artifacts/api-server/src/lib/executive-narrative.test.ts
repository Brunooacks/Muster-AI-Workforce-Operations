import { describe, expect, it } from "vitest";
import { narrativeUsesOnlyKnownNumbers } from "./executive-narrative";

describe("executive AI narrative guardrail", () => {
  const facts = { score: 84, delta: 9, coverage: 92.5, period: "2026-08" };

  it("aceita somente números presentes nos fatos", () => {
    expect(narrativeUsesOnlyKnownNumbers("Score 84, avanço de 9 e cobertura 92,5% em 2026-08.", facts)).toBe(true);
  });

  it("rejeita números sem proveniência", () => {
    expect(narrativeUsesOnlyKnownNumbers("O retorno projetado é 37%.", facts)).toBe(false);
  });
});
