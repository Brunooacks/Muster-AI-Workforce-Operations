import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { column, db } = vi.hoisted(() => ({
  column: {},
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@workspace/db", () => ({
  db,
  agents: { id: column, externalId: column },
  agentEvents: {
    id: column,
    agentId: column,
    taskRunId: column,
    ts: column,
    kind: column,
  },
  externalEventReceipts: { id: column, orgId: column, agentId: column, platform: column, eventId: column },
  eventOutbox: { id: column },
  metricEvidence: { id: column },
  connectors: { id: column, platform: column, status: column, health: column, lastEventAt: column },
  agentConnectorLinks: { agentId: column, connectorId: column, externalId: column, orgId: column },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));

import telemetryRouter from "./telemetry";

describe("ingestão externa de feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockReset();
    db.transaction.mockReset();
  });

  it("retorna 400 sem criar feedback quando taskRunId não pertence ao agente", async () => {
    const agent = { id: "agent-42", externalId: "external-42" };
    db.select
      .mockReturnValueOnce(queryResult([agent]))
      .mockReturnValueOnce(queryResult([]));
    const tx = {
      insert: vi.fn(() => insertResult()),
    };
    db.transaction.mockImplementationOnce((callback) => callback(tx));

    const response = responseMock();
    await externalIngestionHandler()(
      {
        orgId: "org-42",
        integrationConnectorId: undefined,
        body: {
          contractVersion: "muster.agent-ingestion.v2",
          source: { platform: "webhook" },
          agent: { externalId: "external-42", name: "Agente" },
          feedback: {
            taskRunId: "run-ausente",
            currency: "BRL",
            kind: "negative",
            validation: { status: "rejected", source: "human_review" },
          },
        },
      } as Request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "taskRunId não encontrado para este agente.",
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("mantém taskRunId e currency nulos ao persistir uma execução v1", async () => {
    const agent = { id: "agent-42", externalId: "external-42" };
    db.select.mockReturnValueOnce(queryResult([agent]));
    const values = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: "event-42", ts: new Date() }]),
    }));
    const insert = vi.fn(() => ({ values }));
    db.transaction.mockImplementationOnce((callback) => callback({ insert }));

    const response = responseMock();
    await externalIngestionHandler()(
      {
        orgId: "org-42",
        integrationConnectorId: undefined,
        body: {
          contractVersion: "muster.agent-ingestion.v1",
          source: { platform: "webhook" },
          agent: { externalId: "external-42", name: "Agente" },
          execution: { status: "success", costCents: 10 },
        },
      } as Request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ eventsAccepted: 1 }));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      taskRunId: null,
      currency: null,
    }));
  });
});

function externalIngestionHandler(): (req: Request, res: Response) => Promise<void> {
  const router = telemetryRouter as unknown as {
    stack: Array<{
      route?: {
        path: string;
        stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
      };
    }>;
  };
  const layer = router.stack.find(
    ({ route }) => route?.path === "/integrations/agent-events",
  );
  if (!layer?.route) throw new Error("Rota de ingestão externa não encontrada.");
  return layer.route.stack.at(-1)!.handle;
}

function queryResult<T>(rows: T[]) {
  return {
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function insertResult() {
  return {
    values: () => ({
      returning: vi.fn().mockResolvedValue([{ id: "event-42", ts: new Date() }]),
    }),
  };
}

function responseMock(): Response {
  const response = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}
