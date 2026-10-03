import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  agents,
  agentEvents,
  externalEventReceipts,
  eventOutbox,
  metricEvidence,
  connectors,
  agentConnectorLinks,
} from "@workspace/db";
import type { AgentEventKind } from "@workspace/db";
import {
  IngestAgentEventBody,
  GetAgentTelemetryResponse,
  ReevaluateAgentResponse,
  PreAssessAgentSourceBody,
  PreAssessAgentSourceResponse,
  ReportAgentHeartbeatBody,
  ReadAgentSupervisionResponse,
  IngestExternalAgentEnvelopeBody,
} from "@workspace/api-zod";
import type { ExternalAgentEnvelope } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { ofOrg } from "../lib/tenant-scope";
import { requireAgentCredential } from "../middlewares/requireAgentCredential";
import { requireIntegrationCredential } from "../middlewares/requireIntegrationCredential";
import {
  summarizeEvents,
  type AgentEventRow,
} from "../lib/telemetry";
import { fetchAgentSourceFromUrl, FetchSourceError } from "../lib/fetch-source";
import { preAssess } from "../lib/pre-assessment";
import { supervisionFromHeartbeat } from "../lib/supervision";
import { normalizeExternalObservation } from "../lib/connectors/ingestion";
import { MUSTER_AGENT_INGESTION_CONTRACT_VERSION } from "../lib/connectors/types";
import {
  AGENT_TELEMETRY_EVENT_TYPE,
  loadAgentEvents,
  reevaluateAgentFromTelemetry,
} from "../lib/agent-telemetry-reevaluation";
import { supervisionDispatchFor } from "../lib/continuous-supervision";

const router: IRouter = Router();

const WINDOW_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const DIRECT_AGENT_EVENT_PLATFORM = "muster-direct-agent-v1";

function telemetryOutboxEntry(input: {
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

// ── Ingest: agents report execution events here (fire-and-forget SDK) ──────
router.post("/agents/:agentId/events", requireAgentCredential, async (req, res) => {
  const agentId = req.params.agentId as string;
  const body = IngestAgentEventBody.parse(req.body);

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
    .limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  // Optional occurrence time: agents that batch/replay events report the real
  // execution time; invalid dates are rejected instead of silently becoming now.
  let ts: Date | undefined;
  if (body.ts !== undefined) {
    ts = new Date(body.ts);
    if (Number.isNaN(ts.getTime())) {
      res.status(400).json({ error: "Campo ts inválido — use ISO 8601." });
      return;
    }
  }

  const kind = (body.kind ?? "execution") as AgentEventRow["kind"];
  const result = await db.transaction(async (transaction) => {
    // Agent credentials are expected to retry after transport failures. Claim
    // the key in the same transaction as the event so a replay cannot create
    // a second event or outbox entry.
    if (body.idempotencyKey) {
      const claimed = await transaction
        .insert(externalEventReceipts)
        .values({
          orgId: req.orgId!,
          agentId,
          platform: DIRECT_AGENT_EVENT_PLATFORM,
          // The receipt index is organization-scoped; include the agent so a
          // caller can use a local sequence safely for separate agents.
          eventId: `${agentId}:${body.idempotencyKey}`,
        })
        .onConflictDoNothing({
          target: [
            externalEventReceipts.orgId,
            externalEventReceipts.platform,
            externalEventReceipts.eventId,
          ],
        })
        .returning({ id: externalEventReceipts.id });
      if (claimed.length === 0) return { duplicate: true };
    }

    const [event] = await transaction
      .insert(agentEvents)
      .values({
        agentId,
        ...(ts ? { ts } : {}),
        kind,
        durationMs:
          body.durationMs != null ? Math.round(body.durationMs) : null,
        costCents: body.costCents != null ? Math.round(body.costCents) : null,
        tokensIn: body.tokensIn != null ? Math.round(body.tokensIn) : null,
        tokensOut: body.tokensOut != null ? Math.round(body.tokensOut) : null,
        success: body.success === undefined ? null : body.success ? 1 : 0,
        metadata:
          (body.metadata as Record<string, unknown> | undefined) ?? null,
      })
      .returning({ id: agentEvents.id, ts: agentEvents.ts });
    if (!event) throw new Error("Falha ao persistir evento do agente.");
    const outbox = telemetryOutboxEntry({
      orgId: req.orgId!,
      agentId,
      agentEventId: event.id,
      kind,
      occurredAt: event.ts,
    });
    if (outbox) await transaction.insert(eventOutbox).values(outbox);
    return { duplicate: false };
  });

  res.status(202).json({ accepted: true, duplicate: result.duplicate });
});

router.post("/agents/:agentId/heartbeat", requireAgentCredential, async (req, res) => {
  const agentId = req.params.agentId as string;
  const body = ReportAgentHeartbeatBody.parse(req.body ?? {});
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
    .limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const observedAt = new Date();
  await db.insert(agentEvents).values({
    agentId,
    ts: observedAt,
    kind: "heartbeat",
    success: body.status === "stopped" ? 0 : 1,
    metadata: {
      ...(body.metadata ?? {}),
      ...(body.runtime ? { runtime: body.runtime } : {}),
      ...(body.version ? { version: body.version } : {}),
      ...(body.intervalSeconds != null
        ? { intervalSeconds: body.intervalSeconds }
        : {}),
      ...(body.status ? { status: body.status } : {}),
    },
  });

  res.status(202).json({ accepted: true, observedAt });
});

router.post("/integrations/agent-events", requireIntegrationCredential, async (req, res) => {
  const body = IngestExternalAgentEnvelopeBody.parse(req.body) as ExternalAgentEnvelope;
  if (body.contractVersion !== MUSTER_AGENT_INGESTION_CONTRACT_VERSION) {
    res.status(400).json({ error: "Versão de contrato não suportada." });
    return;
  }

  const requestedConnectorId = body.source.connectorId;
  const authenticatedConnectorId = req.integrationConnectorId;
  if (
    authenticatedConnectorId &&
    requestedConnectorId &&
    requestedConnectorId !== authenticatedConnectorId
  ) {
    res.status(401).json({ error: "A credencial não pertence ao conector informado." });
    return;
  }
  const connectorId = authenticatedConnectorId ?? requestedConnectorId;
  if (connectorId) {
    const [connector] = await db
      .select({ id: connectors.id, platform: connectors.platform })
      .from(connectors)
      .where(and(eq(connectors.id, connectorId), ofOrg(connectors, req.orgId!)))
      .limit(1);
    if (!connector) {
      res.status(404).json({ error: "Conector não encontrado nesta organização." });
      return;
    }
    if (connector.platform !== body.source.platform) {
      res.status(400).json({
        error: `A origem ${body.source.platform} não corresponde ao conector ${connector.platform}.`,
      });
      return;
    }
    await db
      .update(connectors)
      .set({
        status: "connected",
        health: "healthy",
        lastEventAt: new Date(),
      })
      .where(and(eq(connectors.id, connector.id), ofOrg(connectors, req.orgId!)));
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
            eq(agentConnectorLinks.orgId, req.orgId!),
            ofOrg(agents, req.orgId!),
          ),
        )
        .limit(1)
    : [];

  const [legacyAgent] = linkedAgent
    ? []
    : await db
        .select({ id: agents.id, externalId: agents.externalId })
        .from(agents)
        .where(and(eq(agents.externalId, body.agent.externalId), ofOrg(agents, req.orgId!)))
        .limit(1);
  const agent = linkedAgent ?? legacyAgent;

  if (!agent) {
    res.status(202).json({
        accepted: true,
        mapped: false,
        agentExternalId: body.agent.externalId,
        agentId: null,
        eventsAccepted: 0,
        observationsAccepted: 0,
        nextAction: "Descobrir/importar o agente antes de materializar telemetria e evidências.",
      });
    return;
  }

  if (connectorId && !linkedAgent) {
    await db
      .insert(agentConnectorLinks)
      .values({
        orgId: req.orgId!,
        agentId: agent.id,
        connectorId,
        externalId: body.agent.externalId,
        role: "telemetry",
      })
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
        .values({
          orgId: req.orgId!,
          agentId: agent.id,
          platform: body.source.platform,
          eventId: body.eventId,
        })
        .onConflictDoNothing({
          target: [
            externalEventReceipts.orgId,
            externalEventReceipts.platform,
            externalEventReceipts.eventId,
          ],
        })
        .returning({ id: externalEventReceipts.id });
      if (claimed.length === 0) {
        return { duplicate: true, eventsAccepted: 0, observationsAccepted: 0 };
      }
    }

    let eventsAccepted = 0;
    if (body.execution) {
      const execution = body.execution;
      const kind =
        execution.status === "error"
          ? "error"
          : execution.status === "escalated"
            ? "escalation"
            : "execution";
      const startedAt = execution.startedAt ? new Date(execution.startedAt) : null;
      const [event] = await tx
        .insert(agentEvents)
        .values({
          agentId: agent.id,
          ...(startedAt && !Number.isNaN(startedAt.getTime())
            ? { ts: startedAt }
            : {}),
          kind,
          durationMs:
            execution.durationMs != null
              ? Math.round(execution.durationMs)
              : null,
          costCents:
            execution.costCents != null
              ? Math.round(execution.costCents)
              : null,
          tokensIn:
            execution.tokensIn != null ? Math.round(execution.tokensIn) : null,
          tokensOut:
            execution.tokensOut != null
              ? Math.round(execution.tokensOut)
              : null,
          success:
            execution.status === "running"
              ? null
              : execution.status === "success"
                ? 1
                : 0,
          metadata: {
            ...(execution.metadata ?? {}),
            source,
            ...(body.eventId ? { externalEventId: body.eventId } : {}),
            ...(execution.id ? { externalExecutionId: execution.id } : {}),
          },
        })
        .returning({ id: agentEvents.id, ts: agentEvents.ts });
      if (!event) throw new Error("Falha ao persistir execução externa.");
      const outbox = telemetryOutboxEntry({
        orgId: req.orgId!,
        agentId: agent.id,
        agentEventId: event.id,
        kind,
        occurredAt: event.ts,
      });
      if (outbox) await tx.insert(eventOutbox).values(outbox);
      eventsAccepted += 1;
    }

    if (body.feedback) {
      const [event] = await tx
        .insert(agentEvents)
        .values({
          agentId: agent.id,
          kind: "feedback",
          success: body.feedback.kind === "negative" ? 0 : 1,
          metadata: {
            ...body.feedback,
            source,
            ...(body.eventId ? { externalEventId: body.eventId } : {}),
          },
        })
        .returning({ id: agentEvents.id, ts: agentEvents.ts });
      if (!event) throw new Error("Falha ao persistir feedback externo.");
      const outbox = telemetryOutboxEntry({
        orgId: req.orgId!,
        agentId: agent.id,
        agentEventId: event.id,
        kind: "feedback",
        occurredAt: event.ts,
      });
      if (outbox) await tx.insert(eventOutbox).values(outbox);
      eventsAccepted += 1;
    }

    for (const input of body.observations ?? []) {
      const observation = normalizeExternalObservation(input, source);
      await tx.insert(metricEvidence).values({
        orgId: req.orgId!,
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

    return {
      duplicate: false,
      eventsAccepted,
      observationsAccepted: body.observations?.length ?? 0,
    };
  });

  if (materialized.duplicate) {
    res.status(202).json({
      accepted: true,
      mapped: true,
      agentExternalId: body.agent.externalId,
      agentId: agent.id,
      eventsAccepted: 0,
      observationsAccepted: 0,
      nextAction: "Envelope já processado nesta organização; nenhuma duplicidade foi criada.",
    });
    return;
  }

  const accepted = {
    accepted: true,
    mapped: true,
    agentExternalId: body.agent.externalId,
    agentId: agent.id,
    eventsAccepted: materialized.eventsAccepted,
    observationsAccepted: materialized.observationsAccepted,
    nextAction:
      "A reavaliação foi enfileirada; acompanhe a atividade contínua para métricas e decisão atualizadas.",
  };
  res.status(202).json(accepted);
});

router.get("/agents/:agentId/supervision", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
    .limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const [heartbeat] = await db
    .select({ ts: agentEvents.ts, metadata: agentEvents.metadata })
    .from(agentEvents)
    .where(and(eq(agentEvents.agentId, agentId), eq(agentEvents.kind, "heartbeat")))
    .orderBy(desc(agentEvents.ts))
    .limit(1);
  const metadata = (heartbeat?.metadata ?? {}) as Record<string, unknown>;
  const result = supervisionFromHeartbeat(new Date(), heartbeat ? {
    capturedAt: heartbeat.ts,
    intervalSeconds: typeof metadata.intervalSeconds === "number" ? metadata.intervalSeconds : undefined,
    runtime: typeof metadata.runtime === "string" ? metadata.runtime : undefined,
    version: typeof metadata.version === "string" ? metadata.version : undefined,
    reportedStatus: typeof metadata.status === "string" ? metadata.status : undefined,
  } : null);
  res.json(ReadAgentSupervisionResponse.parse({ agentId, ...result }));
});

// ── Telemetry summary ───────────────────────────────────────────────────────
router.get(
  "/agents/:agentId/telemetry/:window",
  requireAuth, requireOrg,
  async (req, res) => {
    const agentId = req.params.agentId as string;
    const windowDays = WINDOW_DAYS[req.params.window as string] ?? 30;
    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
      .limit(1);
    if (!agent) {
      res.status(404).json({ error: "Agente não encontrado." });
      return;
    }
    const events = await loadAgentEvents(agentId, windowDays);
    const summary = summarizeEvents(events, windowDays);
    res.json(GetAgentTelemetryResponse.parse(summary));
  },
);

// ── Reevaluate: telemetry-first, seeded fallback ────────────────────────────
// The real core of R6: when the agent has telemetry, the 5-layer evaluation is
// computed from actual executions and the verdict comes from the explicit,
// auditable decision rules. Seeded scoring remains only as demo fallback.
router.post("/agents/:agentId/reevaluate", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const result = await reevaluateAgentFromTelemetry({
    agentId,
    orgId: req.orgId!,
  });
  if (!result) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }
  res.json(ReevaluateAgentResponse.parse(result));
});

// ── Pre-assessment (R4): repo → carteira draft, no AI key needed ────────────
router.post("/discovery/pre-assess", requireAuth, requireOrg, async (req, res) => {
  const body = PreAssessAgentSourceBody.parse(req.body);
  try {
    const fetched = await fetchAgentSourceFromUrl(body.url);
    const result = preAssess(fetched.content, body.nameHint);
    res.json(
      PreAssessAgentSourceResponse.parse({
        draft: result.draft,
        fieldConfidence: result.fieldConfidence,
        platform: result.platform,
        signals: result.signals,
      }),
    );
  } catch (err) {
    if (err instanceof FetchSourceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Pre-assessment failed");
    res
      .status(502)
      .json({ error: "Não foi possível pré-avaliar o repositório." });
  }
});

export default router;
