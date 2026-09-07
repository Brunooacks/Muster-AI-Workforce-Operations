import { logger } from "./logger";
import { asc, eq, isNull } from "drizzle-orm";
import { agentGovernanceAssessments, agents, db } from "@workspace/db";
import {
  retryAvailableAt,
  shouldDeadLetter,
} from "./continuous-supervision";
import { reevaluateAgentFromTelemetry } from "./agent-telemetry-reevaluation";
import {
  claimTelemetryOutboxEvents,
  coalescePendingAgentTelemetry,
  completeOutboxEvent,
  failOutboxEvent,
  recoverStaleOutboxEvents,
  releaseOutboxEvent,
  withAgentAdvisoryLock,
  type ClaimedOutboxEvent,
} from "./event-outbox";
import {
  continuousTelemetryWorkerConfig,
  type ContinuousTelemetryWorkerConfig,
} from "./continuous-telemetry-config";

export { continuousTelemetryWorkerConfig } from "./continuous-telemetry-config";
export type { ContinuousTelemetryWorkerConfig } from "./continuous-telemetry-config";

export interface ContinuousTelemetryWorkerDiagnostics {
  enabled: boolean;
  running: boolean;
  startedAt: string | null;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  processed: number;
  failed: number;
  deadLettered: number;
  reclaimed: number;
  backfilled: number;
}

const diagnostics: ContinuousTelemetryWorkerDiagnostics = {
  enabled: false,
  running: false,
  startedAt: null,
  lastPollAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  processed: 0,
  failed: 0,
  deadLettered: 0,
  reclaimed: 0,
  backfilled: 0,
};

export function getContinuousTelemetryWorkerDiagnostics(): ContinuousTelemetryWorkerDiagnostics {
  return { ...diagnostics };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function processTelemetryEvent(
  event: ClaimedOutboxEvent,
  config: ContinuousTelemetryWorkerConfig,
): Promise<void> {
  const payloadAgentId = event.payload.agentId;
  if (
    event.aggregateType !== "agent" ||
    typeof payloadAgentId !== "string" ||
    payloadAgentId !== event.aggregateId
  ) {
    await failOutboxEvent({
      id: event.id,
      orgId: event.orgId,
      error: "Evento de telemetria inválido: aggregate/payload do agente divergem.",
      deadLetter: true,
      availableAt: new Date(),
    });
    diagnostics.deadLettered += 1;
    return;
  }

  const projectionStartedAt = new Date();
  const lock = await withAgentAdvisoryLock(
    event.orgId,
    event.aggregateId,
    async () =>
      reevaluateAgentFromTelemetry({
        orgId: event.orgId,
        agentId: event.aggregateId,
        projectionCauseEventId: event.id,
      }),
  );

  if (!lock.acquired) {
    await releaseOutboxEvent({
      id: event.id,
      orgId: event.orgId,
      availableAt: new Date(Date.now() + config.pollIntervalMs),
    });
    return;
  }
  if (!lock.result) {
    throw new Error("Agente não pertence à organização do evento.");
  }

  const completed = await completeOutboxEvent({
    id: event.id,
    orgId: event.orgId,
  });
  if (!completed) {
    throw new Error("Lease do evento expirou antes da conclusão.");
  }
  await coalescePendingAgentTelemetry({
    orgId: event.orgId,
    agentId: event.aggregateId,
    // Events committed after this projection started must remain pending. The
    // agent_events table has occurrence time, not ingestion time, so the
    // outbox creation timestamp is the reliable snapshot boundary.
    createdBefore: projectionStartedAt,
  });
  diagnostics.processed += 1;
  diagnostics.lastSuccessAt = new Date().toISOString();
}

async function backfillMissingGovernanceAssessments(limit: number): Promise<void> {
  if (limit <= 0) return;
  const missing = await db
    .select({ agentId: agents.id, orgId: agents.orgId })
    .from(agents)
    .leftJoin(
      agentGovernanceAssessments,
      eq(agentGovernanceAssessments.agentId, agents.id),
    )
    .where(isNull(agentGovernanceAssessments.agentId))
    .orderBy(asc(agents.createdAt))
    .limit(limit);

  for (const agent of missing) {
    const lock = await withAgentAdvisoryLock(agent.orgId, agent.agentId, () =>
      reevaluateAgentFromTelemetry({
        orgId: agent.orgId,
        agentId: agent.agentId,
      }),
    );
    if (lock.acquired && lock.result) diagnostics.backfilled += 1;
  }
}

export async function runContinuousTelemetryCycle(
  config: ContinuousTelemetryWorkerConfig,
): Promise<void> {
  diagnostics.lastPollAt = new Date().toISOString();
  diagnostics.reclaimed += await recoverStaleOutboxEvents(
    config.processingTimeoutMs,
  );
  const events = await claimTelemetryOutboxEvents(config.batchSize);
  for (const event of events) {
    try {
      await processTelemetryEvent(event, config);
    } catch (error) {
      diagnostics.failed += 1;
      diagnostics.lastErrorAt = new Date().toISOString();
      const deadLetter = shouldDeadLetter(event.attempts, config.maxAttempts);
      if (deadLetter) diagnostics.deadLettered += 1;
      await failOutboxEvent({
        id: event.id,
        orgId: event.orgId,
        error: errorMessage(error),
        deadLetter,
        availableAt: retryAvailableAt(
          new Date(),
          Math.max(0, event.attempts - 1),
          config.retryBaseMs,
          config.retryMaxMs,
        ),
      });
      logger.error(
        {
          err: error,
          outboxEventId: event.id,
          aggregateId: event.aggregateId,
          attempts: event.attempts,
          deadLetter,
        },
        "Continuous telemetry projection failed",
      );
    }
  }
  await backfillMissingGovernanceAssessments(
    Math.max(0, config.batchSize - events.length),
  );
}

export function startContinuousTelemetryWorker(
  config = continuousTelemetryWorkerConfig(),
): () => void {
  diagnostics.enabled = config.enabled;
  if (!config.enabled) {
    logger.info("Continuous telemetry worker disabled by environment");
    return () => undefined;
  }

  diagnostics.running = true;
  diagnostics.startedAt = new Date().toISOString();
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      void tick();
    }, config.pollIntervalMs);
    timer.unref();
  };
  const tick = async () => {
    try {
      await runContinuousTelemetryCycle(config);
    } catch (error) {
      diagnostics.lastErrorAt = new Date().toISOString();
      logger.error({ err: error }, "Continuous telemetry worker cycle failed");
    } finally {
      schedule();
    }
  };

  void tick();
  logger.info(
    { pollIntervalMs: config.pollIntervalMs, batchSize: config.batchSize },
    "Continuous telemetry worker started",
  );

  return () => {
    stopped = true;
    diagnostics.running = false;
    if (timer) clearTimeout(timer);
  };
}
