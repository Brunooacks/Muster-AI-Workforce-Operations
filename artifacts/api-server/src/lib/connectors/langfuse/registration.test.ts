import { describe, expect, it } from "vitest";
import { CONNECTOR_CAPABILITIES } from "../capabilities";
import { formatRealPlatforms, getConnectorImpl, realPlatforms } from "../registry";
import { langfuseConnector } from "./connector";

describe("registro do conector Langfuse", () => {
  it("expõe o conector real na lista usada pela rota de registro", () => {
    expect(getConnectorImpl("langfuse")).toBe(langfuseConnector);
    expect(realPlatforms()).toEqual(["github", "langfuse"]);
    expect(formatRealPlatforms()).toBe("Disponível: github, langfuse.");
  });

  it("declara descoberta ao vivo sem prometer coleta de telemetria", () => {
    expect(CONNECTOR_CAPABILITIES).toContainEqual({
      platform: "langfuse",
      label: "Langfuse",
      mode: "live",
      capabilities: expect.objectContaining({
        testConnection: true,
        discoverAgents: true,
        collectTelemetry: false,
      }),
      transport: ["REST polling"],
      note: "Lê traces e scores para descoberta; a coleta de telemetria entra em uma próxima fatia.",
    });
  });
});
