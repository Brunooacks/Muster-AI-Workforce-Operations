import { describe, expect, it } from "vitest";
import { normalizeExternalObservation } from "./ingestion";

describe("normalizeExternalObservation", () => {
  it("keeps lineage and clamps confidence for external evidence", () => {
    const result = normalizeExternalObservation(
      {
        metricKey: "task_success",
        label: "Taxa de sucesso",
        value: 94,
        unit: "%",
        confidence: 1.4,
        sampleSize: 42,
        capturedAt: "2026-08-12T12:00:00.000Z",
        lineage: [{ stage: "aggregate", name: "zendesk_ticket_export" }],
      },
      { platform: "zendesk", tenant: "acme", reference: "cursor-42" },
    );

    expect(result.confidence).toBe(1);
    expect(result.sampleSize).toBe(42);
    expect(result.source.platform).toBe("zendesk");
    expect(result.lineage[0]?.name).toBe("zendesk_ticket_export");
  });
});
