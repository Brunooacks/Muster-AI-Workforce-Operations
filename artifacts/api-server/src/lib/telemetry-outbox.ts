import { eventOutbox, type AgentEventKind } from "@workspace/db";
import { AGENT_TELEMETRY_EVENT_TYPE } from "./agent-telemetry-reevaluation";
import { supervisionDispatchFor } from "./continuous-supervision";

export function telemetryOutboxEntry(input: {
  orgId: string;
  agentId: string;
  agentEventId: string;
  kind: AgentEventKind;
  occurredAt: Date;
}): typeof eventOutbox.$inferInsert | null {
  const dispatch = supervisionDispatchFor(input.kind);
  if (!dispatch.shouldReevaluate) return null;
  return {
    orgId: input.orgId,
    aggregateType: "agent",
    aggregateId: input.agentId,
    eventType: AGENT_TELEMETRY_EVENT_TYPE,
    priority: dispatch.priority,
    availableAt: new Date(Date.now() + dispatch.debounceMs),
    payload: {
      agentId: input.agentId,
      agentEventId: input.agentEventId,
      kind: input.kind,
      occurredAt: input.occurredAt.toISOString(),
      debounceMs: dispatch.debounceMs,
    },
  };
}
