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
  agentEventSteps: {
    id: column,
    orgId: column,
    agentId: column,
    agentEventId: column,
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

  it("materializa os passos v2 na transação do evento", async () => {
    const agent = { id: "agent-42", externalId: "external-42" };
    db.select.mockReturnValueOnce(queryResult([agent]));
    const eventValues = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: "event-42", ts: new Date("2026-10-11T00:00:00.000Z") }]),
    }));
    const stepValues = vi.fn().mockResolvedValue([]);
    const receiptValues = vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "receipt-42" }]),
      })),
    }));
    const tx = {
      insert: vi.fn()
        .mockReturnValueOnce({ values: receiptValues })
        .mockReturnValueOnce({ values: eventValues })
        .mockReturnValue({ values: stepValues }),
    };
    db.transaction.mockImplementationOnce((callback) => callback(tx));

    const response = responseMock();
    await externalIngestionHandler()(
      {
        orgId: "org-42",
        integrationConnectorId: undefined,
        body: {
          contractVersion: "muster.agent-ingestion.v2",
          eventId: "evt-42",
          source: { platform: "webhook" },
          agent: { externalId: "external-42", name: "Agente" },
          execution: {
            taskRunId: "run-42",
            currency: "BRL",
            steps: [{
              stepKey: "classify.ticket.v1",
              inputFingerprint: `sha256:${"a".repeat(64)}`,
              outputHash: `sha256:${"b".repeat(64)}`,
              path: "model",
              model: "gpt-5-mini",
              tokensIn: 12,
              tokensOut: 3,
              costCents: 7,
              shadow: false,
            }],
          },
        },
      } as Request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(202);
    expect(stepValues).toHaveBeenCalledWith([expect.objectContaining({
      orgId: "org-42",
      agentId: "agent-42",
      agentEventId: "event-42",
      taskRunId: "run-42",
      stepKey: "classify.ticket.v1",
      stepVersion: "v1",
      inputFingerprint: `sha256:${"a".repeat(64)}`,
      outputHash: `sha256:${"b".repeat(64)}`,
      path: "model",
      model: "gpt-5-mini",
      tokensIn: 12,
      tokensOut: 3,
      costCents: 7,
      currency: "BRL",
      shadow: false,
    })]);
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
