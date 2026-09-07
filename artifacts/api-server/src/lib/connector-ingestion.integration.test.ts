import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentEvents,
  connectorApiKeys,
  connectors,
  organizations,
} from "@workspace/db/schema";
import { generateConnectorApiKey } from "./connector-api-key";

const runIntegration = process.env.RUN_CONNECTOR_INGESTION_DB_TESTS === "true";

type WorkspaceDb = typeof import("@workspace/db");
let workspaceDb: WorkspaceDb;
let server: Server;
let baseUrl = "";

const suffix = randomUUID().slice(0, 8);
const orgId = `org_connector_${suffix}`;
const connectorId = `connector_${suffix}`;
let agentId = "";
const externalId = `external_${suffix}`;
const key = generateConnectorApiKey();

describe.skipIf(!runIntegration)("connector ingestion PostgreSQL", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    await workspaceDb.db.insert(organizations).values({
      id: orgId,
      name: "Connector Test",
      slug: `connector-test-${suffix}`,
    });
    await workspaceDb.db.insert(connectors).values({
      id: connectorId,
      orgId,
      platform: "webhook",
      name: "Webhook Test",
      status: "configured",
      mode: "universal",
      health: "unverified",
    });
    await workspaceDb.db.insert(connectorApiKeys).values({
      orgId,
      connectorId,
      prefix: key.prefix,
      keyHash: key.keyHash,
    });
    const { admitAgent } = await import("./admission");
    agentId = await admitAgent({
      orgId,
      connectorId,
      externalId,
      name: "Observed Agent",
      role: "support",
      platform: "webhook",
      bio: "Agent used to validate connector-scoped ingestion.",
    });

    const { default: app } = await import("../app");
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server unavailable");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!workspaceDb) return;
    await workspaceDb.db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("accepts a connector key and proves the connection with a real event", async () => {
    const response = await fetch(`${baseUrl}/api/integrations/agent-events`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key.plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contractVersion: "muster.agent-ingestion.v1",
        eventId: `event-${suffix}`,
        source: { platform: "webhook", connectorId },
        agent: { externalId, name: "Observed Agent" },
        execution: {
          status: "success",
          durationMs: 420,
          costCents: 2,
          tokensIn: 300,
          tokensOut: 90,
        },
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      accepted: true,
      mapped: true,
      agentId,
      eventsAccepted: 1,
    });

    const [connector] = await workspaceDb.db
      .select({
        status: connectors.status,
        health: connectors.health,
        lastEventAt: connectors.lastEventAt,
      })
      .from(connectors)
      .where(eq(connectors.id, connectorId));
    expect(connector).toMatchObject({ status: "connected", health: "healthy" });
    expect(connector?.lastEventAt).toBeInstanceOf(Date);

    const events = await workspaceDb.db
      .select({ agentId: agentEvents.agentId, kind: agentEvents.kind })
      .from(agentEvents)
      .where(eq(agentEvents.agentId, agentId));
    expect(events).toContainEqual({ agentId, kind: "execution" });
  });

  it("rejects a platform that does not match the authenticated connector", async () => {
    const response = await fetch(`${baseUrl}/api/integrations/agent-events`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key.plaintext}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contractVersion: "muster.agent-ingestion.v1",
        source: { platform: "zendesk", connectorId },
        agent: { externalId, name: "Observed Agent" },
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects ingestion without a connector credential", async () => {
    const response = await fetch(`${baseUrl}/api/integrations/agent-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractVersion: "muster.agent-ingestion.v1",
        source: { platform: "webhook", connectorId },
        agent: { externalId, name: "Observed Agent" },
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: "Credencial da integração ausente.",
    });
  });

  it("does not accept a human bearer token as connector proof", async () => {
    const response = await fetch(`${baseUrl}/api/integrations/agent-events`, {
      method: "POST",
      headers: {
        authorization: "Bearer human-session-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contractVersion: "muster.agent-ingestion.v1",
        source: { platform: "webhook", connectorId },
        agent: { externalId, name: "Observed Agent" },
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: "Credencial da integração inválida ou revogada.",
    });
  });
});
