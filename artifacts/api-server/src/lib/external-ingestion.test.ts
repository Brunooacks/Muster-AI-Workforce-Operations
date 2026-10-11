import { describe, expect, it, vi } from "vitest";
import { ingestExternalAgentEnvelope } from "./external-ingestion";

const { column, db } = vi.hoisted(() => ({
  column: {},
  db: { select: vi.fn(), transaction: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

vi.mock("@workspace/db", () => ({
  db,
  agents: { id: column, externalId: column },
  agentEvents: { id: column, agentId: column, taskRunId: column, ts: column, kind: column },
  externalEventReceipts: { id: column, orgId: column, agentId: column, platform: column, eventId: column },
  eventOutbox: { id: column },
  metricEvidence: { id: column },
  connectors: { id: column, platform: column, status: column, health: column, lastEventAt: column },
  agentConnectorLinks: { agentId: column, connectorId: column, externalId: column, orgId: column },
}));

vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), inArray: vi.fn() }));

describe("ingestExternalAgentEnvelope", () => {
  it("materializa um envelope v2 pelo caminho interno da ingestão", async () => {
    const agent = { id: "agent-42", externalId: "external-42" };
    db.select
      .mockReturnValueOnce(queryResult([{ id: "connector-42", platform: "langfuse" }]))
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([agent]));
    db.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) });
    db.insert.mockReturnValue({ values: () => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }) });
    const values = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: "event-42", ts: new Date() }]),
    }));
    db.transaction.mockImplementationOnce((callback) => callback({ insert: vi.fn(() => ({ values })) }));

    const result = await ingestExternalAgentEnvelope({
      orgId: "org-42",
      envelope: {
        contractVersion: "muster.agent-ingestion.v2",
        source: { platform: "langfuse", connectorId: "connector-42" },
        agent: { externalId: "external-42", name: "Agente" },
        execution: { taskRunId: "run-42", status: "success", costCents: 10 },
      },
    });

    expect(result).toMatchObject({ status: 202, body: { accepted: true, mapped: true, eventsAccepted: 1 } });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ taskRunId: "run-42" }));
  });
});

function queryResult<T>(rows: T[]) {
  const where = () => ({ limit: vi.fn().mockResolvedValue(rows) });
  return { from: () => ({ where, innerJoin: () => ({ where }) }) };
}
