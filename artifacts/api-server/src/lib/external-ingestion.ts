import { and, eq, inArray } from "drizzle-orm";
import {
  agentConnectorLinks,
  agentEvents,
  agents,
  connectors,
  db,
  eventOutbox,
  externalEventReceipts,
  metricEvidence,
  type AgentEventKind,
} from "@workspace/db";
import {
  IngestExternalAgentEnvelopeBody,
  type ExternalAgentEnvelope,
} from "@workspace/api-zod";
import { telemetryOutboxEntry } from "./telemetry-outbox";
import { normalizeExternalObservation } from "./connectors/ingestion";
import { MUSTER_SUPPORTED_AGENT_INGESTION_CONTRACT_VERSIONS } from "./connectors/types";
import { ofOrg } from "./tenant-scope";

export interface ExternalIngestionInput {
  orgId: string;
  envelope: unknown;
  authenticatedConnectorId?: string;
}

export interface ExternalIngestionResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Materializa envelopes de conectores na fronteira v2. Rotas HTTP e coletores
 * internos usam este mesmo caminho para manter validação, idempotência e outbox.
 */
export async function ingestExternalAgentEnvelope({
  orgId,
  envelope,
  authenticatedConnectorId,
}: ExternalIngestionInput): Promise<ExternalIngestionResult> {
  const body = IngestExternalAgentEnvelopeBody.parse(envelope) as ExternalAgentEnvelope;
  if (!MUSTER_SUPPORTED_AGENT_INGESTION_CONTRACT_VERSIONS.includes(body.contractVersion)) {
    return { status: 400, body: { error: "Versão de contrato não suportada." } };
  }

  const requestedConnectorId = body.source.connectorId;
  if (
    authenticatedConnectorId &&
    requestedConnectorId &&
    requestedConnectorId !== authenticatedConnectorId
  ) {
    return { status: 401, body: { error: "A credencial não pertence ao conector informado." } };
  }
  const connectorId = authenticatedConnectorId ?? requestedConnectorId;
  if (connectorId) {
    const [connector] = await db
      .select({ id: connectors.id, platform: connectors.platform })
      .from(connectors)
      .where(and(eq(connectors.id, connectorId), ofOrg(connectors, orgId)))
      .limit(1);
    if (!connector) return { status: 404, body: { error: "Conector não encontrado nesta organização." } };
    if (connector.platform !== body.source.platform) {
      return {
        status: 400,
        body: { error: `A origem ${body.source.platform} não corresponde ao conector ${connector.platform}.` },
      };
    }
    await db
      .update(connectors)
      .set({ status: "connected", health: "healthy", lastEventAt: new Date() })
      .where(and(eq(connectors.id, connector.id), ofOrg(connectors, orgId)));
  }

  const [linkedAgent] = connectorId
    ? await db
        .select({ id: agents.id, externalId: agents.externalId })
        .from(agentConnectorLinks)
        .innerJoin(agents, eq(agents.id, agentConnectorLinks.agentId))
        .where(
          and(
            eq(agentConnectorLinks.connectorId, connectorId),
            eq(agentConnectorLinks.externalId, body.agent.externalId),
            eq(agentConnectorLinks.orgId, orgId),
            ofOrg(agents, orgId),
          ),
        )
        .limit(1)
    : [];
  const [legacyAgent] = linkedAgent
    ? []
    : await db
        .select({ id: agents.id, externalId: agents.externalId })
        .from(agents)
        .where(and(eq(agents.externalId, body.agent.externalId), ofOrg(agents, orgId)))
        .limit(1);
  const agent = linkedAgent ?? legacyAgent;

  if (!agent) {
    return {
      status: 202,
      body: {
        accepted: true,
        mapped: false,
        agentExternalId: body.agent.externalId,
        agentId: null,
        eventsAccepted: 0,
        observationsAccepted: 0,
        nextAction: "Descobrir/importar o agente antes de materializar telemetria e evidências.",
      },
    };
  }

  const feedbackTaskRunId = body.feedback?.taskRunId;
  const feedbackReferencesCurrentExecution =
    feedbackTaskRunId !== undefined && body.execution?.taskRunId === feedbackTaskRunId;
  if (feedbackTaskRunId && !feedbackReferencesCurrentExecution) {
    const [taskRun] = await db
      .select({ id: agentEvents.id })
      .from(agentEvents)
      .where(
        and(
          eq(agentEvents.agentId, agent.id),
          eq(agentEvents.taskRunId, feedbackTaskRunId),
          inArray(agentEvents.kind, ["execution", "error", "escalation"]),
        ),
      )
      .limit(1);
    if (!taskRun) return { status: 400, body: { error: "taskRunId não encontrado para este agente." } };
  }

  if (connectorId && !linkedAgent) {
    await db
      .insert(agentConnectorLinks)
      .values({ orgId, agentId: agent.id, connectorId, externalId: body.agent.externalId, role: "telemetry" })
      .onConflictDoNothing();
  }

  const source = {
    platform: body.source.platform,
    ...(connectorId ? { connectorId } : {}),
    ...(body.source.tenant ? { tenant: body.source.tenant } : {}),
    ...(body.source.reference ? { reference: body.source.reference } : {}),
  };
  const materialized = await db.transaction(async (tx) => {
    if (body.eventId) {
      const claimed = await tx
        .insert(externalEventReceipts)
        .values({ orgId, agentId: agent.id, platform: body.source.platform, eventId: body.eventId })
        .onConflictDoNothing({
          target: [externalEventReceipts.orgId, externalEventReceipts.platform, externalEventReceipts.eventId],
        })
        .returning({ id: externalEventReceipts.id });
      if (claimed.length === 0) return { duplicate: true, eventsAccepted: 0, observationsAccepted: 0 };
    }

    let eventsAccepted = 0;
    if (body.execution) {
      const execution = body.execution;
      const kind: AgentEventKind = execution.status === "error" ? "error" : execution.status === "escalated" ? "escalation" : "execution";
      const startedAt = execution.startedAt ? new Date(execution.startedAt) : null;
      const [event] = await tx
        .insert(agentEvents)
        .values({
          agentId: agent.id,
          ...(startedAt && !Number.isNaN(startedAt.getTime()) ? { ts: startedAt } : {}),
          kind,
          taskRunId: execution.taskRunId ?? null,
          currency: execution.currency ?? null,
          durationMs: execution.durationMs != null ? Math.round(execution.durationMs) : null,
          costCents: execution.costCents != null ? Math.round(execution.costCents) : null,
          tokensIn: execution.tokensIn != null ? Math.round(execution.tokensIn) : null,
          tokensOut: execution.tokensOut != null ? Math.round(execution.tokensOut) : null,
          success: execution.status === "running" ? null : execution.status === "success" ? 1 : 0,
          metadata: { ...(execution.metadata ?? {}), source, ...(body.eventId ? { externalEventId: body.eventId } : {}), ...(execution.id ? { externalExecutionId: execution.id } : {}) },
        })
        .returning({ id: agentEvents.id, ts: agentEvents.ts });
      if (!event) throw new Error("Falha ao persistir execução externa.");
      const outbox = telemetryOutboxEntry({ orgId, agentId: agent.id, agentEventId: event.id, kind, occurredAt: event.ts });
      if (outbox) await tx.insert(eventOutbox).values(outbox);
      eventsAccepted += 1;
    }

    if (body.feedback) {
      const { taskRunId, currency, ...feedbackMetadata } = body.feedback;
      const [event] = await tx
        .insert(agentEvents)
        .values({
          agentId: agent.id,
          kind: "feedback",
          taskRunId: taskRunId ?? null,
          currency: currency ?? null,
          success: body.feedback.kind === "negative" ? 0 : 1,
          metadata: { ...feedbackMetadata, source, ...(body.eventId ? { externalEventId: body.eventId } : {}) },
        })
        .returning({ id: agentEvents.id, ts: agentEvents.ts });
      if (!event) throw new Error("Falha ao persistir feedback externo.");
      const outbox = telemetryOutboxEntry({ orgId, agentId: agent.id, agentEventId: event.id, kind: "feedback", occurredAt: event.ts });
      if (outbox) await tx.insert(eventOutbox).values(outbox);
      eventsAccepted += 1;
    }

    for (const input of body.observations ?? []) {
      const observation = normalizeExternalObservation(input, source);
      await tx.insert(metricEvidence).values({
        orgId,
        metricKey: observation.metricKey,
        label: observation.label,
        agentId: agent.id,
        value: observation.value,
        unit: observation.unit,
        kind: observation.kind,
        source: { type: "connector", ...observation.source },
        lineage: observation.lineage,
        confidence: observation.confidence,
        sampleSize: observation.sampleSize ?? null,
        qualityFlags: [],
        capturedAt: new Date(observation.capturedAt),
      });
    }
    return { duplicate: false, eventsAccepted, observationsAccepted: body.observations?.length ?? 0 };
  });

  if (materialized.duplicate) {
    return {
      status: 202,
      body: {
        accepted: true, mapped: true, agentExternalId: body.agent.externalId, agentId: agent.id,
        eventsAccepted: 0, observationsAccepted: 0,
        nextAction: "Envelope já processado nesta organização; nenhuma duplicidade foi criada.",
      },
    };
  }
  return {
    status: 202,
    body: {
      accepted: true, mapped: true, agentExternalId: body.agent.externalId, agentId: agent.id,
      eventsAccepted: materialized.eventsAccepted, observationsAccepted: materialized.observationsAccepted,
      nextAction: "A reavaliação foi enfileirada; acompanhe a atividade contínua para métricas e decisão atualizadas.",
    },
  };
}
