import { describe, expect, it } from "vitest";
import {
  summarizeJourneyMonitoring,
  type JourneyMonitoringEvent,
  type JourneyMonitoringStep,
} from "./journey-monitoring";

const steps: JourneyMonitoringStep[] = [
  { id: "triage", name: "Triagem", agentId: "agent-1", sequence: 1 },
  { id: "resolution", name: "Resolução", agentId: "agent-2", sequence: 2 },
  { id: "review", name: "Revisão", agentId: "agent-3", sequence: 3 },
];

let eventSequence = 0;
function event(
  overrides: Partial<JourneyMonitoringEvent> = {},
): JourneyMonitoringEvent {
  eventSequence += 1;
  return {
    id: `event-${eventSequence}`,
    journeyId: "journey-1",
    runId: "run-1",
    kind: "journey_started",
    ts: new Date("2026-08-14T12:00:00.000Z"),
    ...overrides,
  };
}

describe("summarizeJourneyMonitoring", () => {
  it("returns stable empty values and preserves configured steps", () => {
    expect(
      summarizeJourneyMonitoring({ journeyId: "journey-1", steps, events: [] }),
    ).toEqual({
      totalRuns: 0,
      activeRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      completionRate: 0,
      avgDurationMs: null,
      p95DurationMs: null,
      totalCostCents: 0,
      avgCostCentsPerRun: null,
      handoffSuccessRate: null,
      bottleneckStepId: null,
      illusoryVictory: false,
      warnings: [],
      steps: [
        {
          id: "triage",
          name: "Triagem",
          agentId: "agent-1",
          sequence: 1,
          executions: 0,
          completedExecutions: 0,
          failedExecutions: 0,
          successRate: null,
          avgDurationMs: null,
          p95DurationMs: null,
          totalCostCents: 0,
          avgCostCentsPerExecution: null,
          judgedHandoffs: 0,
          handoffSuccessRate: null,
          illusoryVictory: false,
        },
        {
          id: "resolution",
          name: "Resolução",
          agentId: "agent-2",
          sequence: 2,
          executions: 0,
          completedExecutions: 0,
          failedExecutions: 0,
          successRate: null,
          avgDurationMs: null,
          p95DurationMs: null,
          totalCostCents: 0,
          avgCostCentsPerExecution: null,
          judgedHandoffs: 0,
          handoffSuccessRate: null,
          illusoryVictory: false,
        },
        {
          id: "review",
          name: "Revisão",
          agentId: "agent-3",
          sequence: 3,
          executions: 0,
          completedExecutions: 0,
          failedExecutions: 0,
          successRate: null,
          avgDurationMs: null,
          p95DurationMs: null,
          totalCostCents: 0,
          avgCostCentsPerExecution: null,
          judgedHandoffs: 0,
          handoffSuccessRate: null,
          illusoryVictory: false,
        },
      ],
      recentRuns: [],
    });
  });

  it("aggregates run status, terminal duration, derived duration and costs", () => {
    const events = [
      event({ runId: "completed-explicit", ts: new Date("2026-08-14T10:00:00Z") }),
      event({
        runId: "completed-explicit",
        kind: "step_started",
        stepId: "triage",
        ts: new Date("2026-08-14T10:00:01Z"),
        costCents: 10,
      }),
      event({
        runId: "completed-explicit",
        kind: "step_completed",
        stepId: "triage",
        ts: new Date("2026-08-14T10:00:03Z"),
        costCents: 5,
      }),
      event({
        runId: "completed-explicit",
        kind: "journey_completed",
        ts: new Date("2026-08-14T10:00:05Z"),
        durationMs: 4_500,
        costCents: 15,
      }),
      event({ runId: "failed-derived", ts: new Date("2026-08-14T11:00:00Z") }),
      event({
        runId: "failed-derived",
        kind: "journey_failed",
        ts: new Date("2026-08-14T11:00:09Z"),
        costCents: 6,
      }),
      event({ runId: "active", ts: new Date("2026-08-14T12:00:00Z") }),
      event({
        runId: "active",
        kind: "step_started",
        stepId: "resolution",
        ts: new Date("2026-08-14T12:00:04Z"),
        costCents: 3,
      }),
      event({
        journeyId: "another-journey",
        runId: "ignored",
        kind: "journey_completed",
        durationMs: 999_999,
        costCents: 999,
      }),
    ];

    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps,
      events,
    });

    expect(summary).toMatchObject({
      totalRuns: 3,
      activeRuns: 1,
      completedRuns: 1,
      failedRuns: 1,
      completionRate: 1 / 3,
      avgDurationMs: 6_750,
      p95DurationMs: 9_000,
      totalCostCents: 39,
      avgCostCentsPerRun: 13,
    });
    expect(summary.recentRuns.map((run) => run.runId)).toEqual([
      "active",
      "failed-derived",
      "completed-explicit",
    ]);
    expect(summary.recentRuns[0]).toMatchObject({
      status: "active",
      durationMs: null,
      endedAt: null,
      currentStepId: "resolution",
    });
    expect(summary.recentRuns[1]).toMatchObject({
      status: "failed",
      durationMs: 9_000,
    });
    expect(summary.recentRuns[2]).toMatchObject({
      status: "completed",
      durationMs: 4_500,
      costCents: 30,
    });
  });

  it("uses the latest terminal event to classify a corrected run", () => {
    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps: [],
      events: [
        event({ runId: "corrected", ts: new Date("2026-08-14T10:00:00Z") }),
        event({
          runId: "corrected",
          kind: "journey_failed",
          ts: new Date("2026-08-14T10:00:05Z"),
        }),
        event({
          runId: "corrected",
          kind: "journey_completed",
          ts: new Date("2026-08-14T10:00:08Z"),
        }),
      ],
    });

    expect(summary.completedRuns).toBe(1);
    expect(summary.failedRuns).toBe(0);
    expect(summary.recentRuns[0]).toMatchObject({
      status: "completed",
      durationMs: 8_000,
    });
  });

  it("computes journey p95 with nearest-rank", () => {
    const events = Array.from({ length: 20 }, (_, index) => [
      event({
        runId: `run-${index + 1}`,
        ts: new Date(`2026-08-14T10:${String(index).padStart(2, "0")}:00Z`),
      }),
      event({
        runId: `run-${index + 1}`,
        kind: "journey_completed",
        ts: new Date(`2026-08-14T10:${String(index).padStart(2, "0")}:30Z`),
        durationMs: (index + 1) * 100,
      }),
    ]).flat();

    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps: [],
      events,
    });

    expect(summary.p95DurationMs).toBe(1_900);
    expect(summary.avgDurationMs).toBe(1_050);
  });

  it("counts only judged handoffs in global and outgoing rates", () => {
    const events = [
      event({ kind: "handoff", fromStepId: "triage", toStepId: "resolution", success: true }),
      event({ kind: "handoff", fromStepId: "triage", toStepId: "resolution", success: false }),
      event({ kind: "handoff", fromStepId: "triage", toStepId: "resolution", success: null }),
      event({ kind: "handoff", fromStepId: "resolution", toStepId: "review", success: true }),
    ];

    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps,
      events,
    });

    expect(summary.handoffSuccessRate).toBeCloseTo(2 / 3, 10);
    expect(summary.steps[0]).toMatchObject({
      judgedHandoffs: 2,
      handoffSuccessRate: 0.5,
    });
    expect(summary.steps[1]).toMatchObject({
      judgedHandoffs: 1,
      handoffSuccessRate: 1,
    });
    expect(summary.steps[2]).toMatchObject({
      judgedHandoffs: 0,
      handoffSuccessRate: null,
    });
  });

  it("aggregates each step once per run and chooses the slowest as bottleneck", () => {
    const events = [
      event({ runId: "run-a", kind: "step_started", stepId: "triage", ts: new Date("2026-08-14T10:00:00Z"), costCents: 2 }),
      event({ runId: "run-a", kind: "step_completed", stepId: "triage", ts: new Date("2026-08-14T10:00:01Z"), costCents: 3 }),
      event({ runId: "run-a", kind: "step_started", stepId: "resolution", ts: new Date("2026-08-14T10:00:01Z") }),
      event({ runId: "run-a", kind: "step_completed", stepId: "resolution", ts: new Date("2026-08-14T10:00:06Z"), durationMs: 6_000, costCents: 5 }),
      event({ runId: "run-b", kind: "step_started", stepId: "triage", ts: new Date("2026-08-14T11:00:00Z") }),
      event({ runId: "run-b", kind: "step_failed", stepId: "triage", ts: new Date("2026-08-14T11:00:03Z"), success: false, costCents: 4 }),
      event({ runId: "run-b", kind: "step_started", stepId: "resolution", ts: new Date("2026-08-14T11:00:03Z") }),
      event({ runId: "run-b", kind: "step_completed", stepId: "resolution", ts: new Date("2026-08-14T11:00:07Z"), durationMs: 4_000, costCents: 6 }),
    ];

    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps,
      events,
    });

    expect(summary.bottleneckStepId).toBe("resolution");
    expect(summary.steps[0]).toMatchObject({
      executions: 2,
      completedExecutions: 1,
      failedExecutions: 1,
      successRate: 0.5,
      avgDurationMs: 2_000,
      p95DurationMs: 3_000,
      totalCostCents: 9,
      avgCostCentsPerExecution: 4.5,
    });
    expect(summary.steps[1]).toMatchObject({
      executions: 2,
      completedExecutions: 2,
      failedExecutions: 0,
      successRate: 1,
      avgDurationMs: 5_000,
      p95DurationMs: 6_000,
      totalCostCents: 11,
      avgCostCentsPerExecution: 5.5,
    });
  });

  it("uses the latest step terminal outcome within a run", () => {
    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps: [steps[0]!],
      events: [
        event({ kind: "step_started", stepId: "triage", ts: new Date("2026-08-14T10:00:00Z") }),
        event({ kind: "step_failed", stepId: "triage", ts: new Date("2026-08-14T10:00:01Z") }),
        event({ kind: "step_completed", stepId: "triage", ts: new Date("2026-08-14T10:00:02Z"), durationMs: 500 }),
      ],
    });

    expect(summary.steps[0]).toMatchObject({
      executions: 1,
      completedExecutions: 1,
      failedExecutions: 0,
      successRate: 1,
      avgDurationMs: 500,
    });
  });

  it("flags an illusory victory when journey completion trails local success by 20 points", () => {
    const events: JourneyMonitoringEvent[] = [];
    for (let index = 0; index < 10; index += 1) {
      const runId = `run-${index}`;
      events.push(
        event({ runId, kind: "step_started", stepId: "triage", ts: new Date(`2026-08-14T10:${String(index).padStart(2, "0")}:00Z`) }),
        event({ runId, kind: "step_completed", stepId: "triage", ts: new Date(`2026-08-14T10:${String(index).padStart(2, "0")}:01Z`) }),
      );
      if (index < 7) {
        events.push(
          event({ runId, kind: "journey_completed", ts: new Date(`2026-08-14T10:${String(index).padStart(2, "0")}:02Z`) }),
        );
      } else {
        events.push(
          event({ runId, kind: "journey_failed", ts: new Date(`2026-08-14T10:${String(index).padStart(2, "0")}:02Z`) }),
        );
      }
    }

    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps: [steps[0]!],
      events,
    });

    expect(summary.completionRate).toBe(0.7);
    expect(summary.illusoryVictory).toBe(true);
    expect(summary.steps[0]?.illusoryVictory).toBe(true);
    expect(summary.warnings).toEqual([
      "Vitória ilusória em Triagem: sucesso local de 100.0% e conclusão da jornada de 70.0%.",
    ]);
  });

  it("treats an exact 20-point gap as an illusory victory", () => {
    const events: JourneyMonitoringEvent[] = [];
    for (let index = 0; index < 5; index += 1) {
      const runId = `boundary-${index}`;
      events.push(event({ runId, kind: "step_completed", stepId: "triage" }));
      events.push(
        event({
          runId,
          kind: index < 4 ? "journey_completed" : "journey_failed",
        }),
      );
    }

    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps: [steps[0]!],
      events,
    });

    expect(summary.completionRate).toBe(0.8);
    expect(summary.illusoryVictory).toBe(true);
  });

  it("flags an illusory victory when the judged outgoing handoff is below 75%", () => {
    const events: JourneyMonitoringEvent[] = [];
    for (let index = 0; index < 4; index += 1) {
      const runId = `run-${index}`;
      events.push(
        event({ runId, kind: "step_completed", stepId: "triage", success: true }),
        event({
          runId,
          kind: "handoff",
          fromStepId: "triage",
          toStepId: "resolution",
          success: index < 2,
        }),
        event({ runId, kind: "journey_completed" }),
      );
    }

    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps: [steps[0]!],
      events,
    });

    expect(summary.completionRate).toBe(1);
    expect(summary.steps[0]).toMatchObject({
      successRate: 1,
      handoffSuccessRate: 0.5,
      illusoryVictory: true,
    });
    expect(summary.warnings).toEqual([
      "Vitória ilusória em Triagem: sucesso local de 100.0% e handoff de saída de 50.0%.",
    ]);
  });

  it("does not flag absent handoff evidence or a handoff exactly at 75%", () => {
    const events = [
      event({ runId: "run-1", kind: "step_completed", stepId: "triage" }),
      event({ runId: "run-1", kind: "handoff", fromStepId: "triage", success: true }),
      event({ runId: "run-2", kind: "step_completed", stepId: "triage" }),
      event({ runId: "run-2", kind: "handoff", fromStepId: "triage", success: true }),
      event({ runId: "run-3", kind: "step_completed", stepId: "triage" }),
      event({ runId: "run-3", kind: "handoff", fromStepId: "triage", success: true }),
      event({ runId: "run-4", kind: "step_completed", stepId: "triage" }),
      event({ runId: "run-4", kind: "handoff", fromStepId: "triage", success: false }),
      ...["run-1", "run-2", "run-3", "run-4"].map((runId) =>
        event({ runId, kind: "journey_completed" }),
      ),
    ];

    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps: [steps[0]!, { id: "no-evidence" }],
      events,
    });

    expect(summary.steps[0]?.handoffSuccessRate).toBe(0.75);
    expect(summary.steps[0]?.illusoryVictory).toBe(false);
    expect(summary.steps[1]?.handoffSuccessRate).toBeNull();
    expect(summary.illusoryVictory).toBe(false);
    expect(summary.warnings).toEqual([]);
  });

  it("deduplicates configured steps while preserving their first occurrence", () => {
    const summary = summarizeJourneyMonitoring({
      journeyId: "journey-1",
      steps: [steps[0]!, { id: "triage", name: "Duplicada" }],
      events: [],
    });

    expect(summary.steps).toHaveLength(1);
    expect(summary.steps[0]?.name).toBe("Triagem");
  });
});
