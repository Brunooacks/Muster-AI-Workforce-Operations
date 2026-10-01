export type OnboardingBatteryEventKind =
  | "execution"
  | "error"
  | "escalation"
  | "feedback";

export interface OnboardingBatteryEvent {
  kind: OnboardingBatteryEventKind;
  ts: string;
  success?: boolean;
  durationMs?: number;
  costCents?: number;
  tokensIn?: number;
  tokensOut?: number;
  metadata: Record<string, unknown>;
}
export interface OnboardingBattery {
  runId: string;
  baselineExecutions: number;
  candidateExecutions: number;
  events: OnboardingBatteryEvent[];
}

function timestamp(now: Date, daysAgo: number, minuteOffset: number): string {
  return new Date(
    now.getTime() - daysAgo * 86_400_000 - minuteOffset * 60_000,
  ).toISOString();
}

function contextMetadata(input: {
  runId: string;
  cycle: "baseline" | "candidate";
  releaseId: string;
  agentVersion: string;
  promptVersion: string;
  index: number;
}) {
  return {
    battery: "onboarding-operational",
    cycle: input.cycle,
    muster: {
      schemaVersion: "1.0",
      runId: `${input.runId}-${input.cycle}-${input.index + 1}`,
      releaseId: input.releaseId,
      agentVersion: input.agentVersion,
      environment: "local-docker",
      deploymentId: `atena-${input.releaseId}`,
      model: {
        provider: "openai",
        name: "gpt-5.4",
        snapshot: input.cycle === "baseline" ? "stable" : "candidate",
      },
      prompt: { version: input.promptVersion },
      input: {
        class: "pull-request-review",
        domain: "engineering",
        complexity: input.index % 5 === 0 ? "high" : "medium",
        captureMode: "metadata_only",
      },
      context: {
        policyVersion:
          input.cycle === "baseline" ? "review-policy-v1" : "review-policy-v2",
        freshness: input.cycle === "baseline" ? "fresh" : "aging",
        requiredSources: ["diff", "test-report", "repository-policy"],
      },
    },
  };
}

export function buildOnboardingBattery(
  now = new Date(),
): OnboardingBattery {
  const runId = `atena-${now.toISOString().replace(/[:.]/g, "-")}`;
  const events: OnboardingBatteryEvent[] = [];
  const executionsPerCycle = 48;

  for (let index = 0; index < executionsPerCycle; index += 1) {
    const metadata = contextMetadata({
      runId,
      cycle: "baseline",
      releaseId: "release-1.0.0",
      agentVersion: "1.0.0",
      promptVersion: "review-v1",
      index,
    });
    events.push({
      kind: "execution",
      ts: timestamp(now, 13 - Math.floor(index / 8), index * 7),
      success: index % 16 !== 0,
      durationMs: 920 + (index % 8) * 85,
      costCents: 8 + (index % 4),
      tokensIn: 1_100 + (index % 7) * 130,
      tokensOut: 260 + (index % 5) * 45,
      metadata,
    });
  }

  for (let index = 0; index < executionsPerCycle; index += 1) {
    const metadata = contextMetadata({
      runId,
      cycle: "candidate",
      releaseId: "release-1.1.0",
      agentVersion: "1.1.0",
      promptVersion: "review-v2",
      index,
    });
    const success = index % 4 !== 0;
    const occurredAt = timestamp(now, 6 - Math.floor(index / 8), index * 9);
    events.push({
      kind: "execution",
      ts: occurredAt,
      success,
      durationMs: 2_100 + (index % 10) * 230,
      costCents: 14 + (index % 6),
      tokensIn: 1_700 + (index % 7) * 180,
      tokensOut: 410 + (index % 5) * 70,
      metadata,
    });
    if (!success) {
      events.push({
        kind: "error",
        ts: occurredAt,
        durationMs: 3_400 + (index % 5) * 310,
        costCents: 9 + (index % 4),
        metadata: { ...metadata, reason: "regression-risk-not-grounded" },
      });
    }
    if (index % 6 === 0) {
      events.push({
        kind: "escalation",
        ts: occurredAt,
        metadata: { ...metadata, reason: "insufficient-test-evidence" },
      });
    }
    if (index % 10 === 0) {
      events.push({
        kind: "feedback",
        ts: occurredAt,
        success: false,
        metadata: { ...metadata, reason: "human-review-correction" },
      });
    }
  }

  return {
    runId,
    baselineExecutions: executionsPerCycle,
    candidateExecutions: executionsPerCycle,
    events,
  };
}
