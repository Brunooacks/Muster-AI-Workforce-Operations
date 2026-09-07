import { describe, expect, it } from "vitest";
import { assessContinuousGovernance } from "./continuous-governance";
import { summarizeEvents, type AgentEventRow } from "./telemetry";

function releaseEvents(input: {
  releaseId: string;
  startDay: number;
  successEvery: number;
  durationMs: number;
  grounded: boolean;
}): AgentEventRow[] {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `${input.releaseId}-${index}`,
    agentId: "agent-1",
    ts: new Date(Date.UTC(2026, 7, input.startDay, 0, index)),
    kind: "execution" as const,
    durationMs: input.durationMs,
    costCents: input.releaseId === "release-2" ? 30 : 15,
    tokensIn: 100,
    tokensOut: 30,
    success: index % input.successEvery !== 0,
    metadata: {
      muster: {
        release: { releaseId: input.releaseId },
        input: { taskClass: "support", domain: "billing", complexity: "medium" },
        context: {
          captureMode: "metadata_only",
          sources: [{ type: "retrieval", status: "available" }],
        },
        evaluation: {
          grounded: input.grounded,
          hallucinationFlag: !input.grounded,
        },
      },
    },
  }));
}

describe("continuous governance", () => {
  it("detects attributable regression and hallucination risk", () => {
    const events = [
      ...releaseEvents({
        releaseId: "release-1",
        startDay: 1,
        successEvery: 20,
        durationMs: 1_000,
        grounded: true,
      }),
      ...releaseEvents({
        releaseId: "release-2",
        startDay: 16,
        successEvery: 3,
        durationMs: 2_000,
        grounded: false,
      }),
    ];

    const assessment = assessContinuousGovernance({
      events,
      summary: summarizeEvents(events, 30),
      agentVersion: "2.0.0",
      hasPurpose: true,
      hasOwner: true,
      hasMetricContracts: true,
      evidenceCount: 8,
    });

    expect(assessment.status).toBe("critical");
    expect(assessment.regression.status).toBe("regression");
    expect(assessment.regression.attributable).toBe(true);
    expect(assessment.hallucinationStatus).toBe("critical");
    expect(assessment.contextHealthScore).toBe(100);
    expect(assessment.recommendations.join(" ")).toContain("rollback");
  });

  it("reports insufficient evidence instead of inventing safety", () => {
    const events = releaseEvents({
      releaseId: "release-1",
      startDay: 1,
      successEvery: 20,
      durationMs: 1_000,
      grounded: true,
    }).slice(0, 5).map((event) => ({ ...event, metadata: null }));
    const assessment = assessContinuousGovernance({
      events,
      summary: summarizeEvents(events, 30),
      agentVersion: "1.0.0",
      hasPurpose: false,
      hasOwner: false,
      hasMetricContracts: false,
      evidenceCount: 0,
    });

    expect(assessment.status).toBe("insufficient_data");
    expect(assessment.hallucinationStatus).toBe("not_measured");
    expect(assessment.contextHealthScore).toBeNull();
    expect(assessment.directionScore).toBe(0);
  });
});
