import { describe, expect, it } from "vitest";
import { resolveImportSource } from "./import-source";

const catalogCandidate = {
  externalId: "demo/agent",
  name: "Demo Agent",
  role: "Agente demonstrativo",
  signals: ["sig:volume"],
};

describe("resolveImportSource", () => {
  it("prefers a live connector candidate over the demo catalog", () => {
    expect(
      resolveImportSource(
        {
          externalId: "org/live-agent",
          name: "Live Agent",
          description: "Agente de suporte",
          stack: "langchain",
          url: "https://github.com/org/live-agent",
          signals: ["dep:langchain"],
          confidence: 82,
        },
        catalogCandidate,
      ),
    ).toMatchObject({
      externalId: "org/live-agent",
      role: "Agente de suporte",
      isReal: true,
    });
  });

  it("falls back to the catalog for demo platforms", () => {
    expect(resolveImportSource(undefined, catalogCandidate)).toEqual({
      ...catalogCandidate,
      isReal: false,
    });
  });

  it("returns null when discovery has no matching candidate", () => {
    expect(resolveImportSource(undefined, undefined)).toBeNull();
  });
});
