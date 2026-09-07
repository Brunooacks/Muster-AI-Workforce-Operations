import { describe, expect, it } from "vitest";
import { CreateAgentBody } from "@workspace/api-zod";

describe("connector admission contract", () => {
  it("accepts a connector relation with the runtime external id", () => {
    const result = CreateAgentBody.safeParse({
      name: "Analista de operações",
      role: "Monitora exceções",
      platform: "langchain",
      bio: "Agente admitido a partir de uma origem autenticada.",
      externalId: "ops-agent-prod",
      connectorId: "connector-runtime-local",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.connectorId).toBe("connector-runtime-local");
      expect(result.data.externalId).toBe("ops-agent-prod");
    }
  });
});
