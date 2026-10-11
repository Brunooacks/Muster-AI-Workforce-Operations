import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { column, stepColumns, db } = vi.hoisted(() => ({
  column: {},
  stepColumns: {
    id: {},
    orgId: {},
    agentId: {},
    agentEventId: {},
    stepKey: {},
    inputFingerprint: {},
    outputHash: {},
    path: {},
    shadow: {},
    costCents: {},
    currency: {},
    occurredAt: {},
  },
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
  agentEventSteps: stepColumns,
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
  gte: vi.fn(),
  inArray: vi.fn(),
}));

import telemetryRouter from "./telemetry";
import { eq, gte } from "drizzle-orm";

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

describe("leitura de passos repetidos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockReset();
  });

  it("isola a organização e retorna somente agregados com recomendação", async () => {
    const stableSteps = Array.from({ length: 200 }, (_, index) => ({
      stepKey: "classify.ticket.v1",
      inputFingerprint: index % 2 === 0 ? "fingerprint-a" : "fingerprint-b",
      outputHash: index % 2 === 0 ? "hash-a" : "hash-b",
      path: "model" as const,
      shadow: false,
      costCents: 10,
      currency: "BRL",
    }));
    db.select.mockReturnValueOnce(stepQueryResult([
      ...stableSteps,
      ...Array.from({ length: 100 }, () => ({
        stepKey: "other.step.v1",
        inputFingerprint: "other-fingerprint",
        outputHash: "other-hash",
        path: "model" as const,
        shadow: false,
        costCents: 60,
        currency: "BRL",
      })),
    ]));
    const response = responseMock();

    await repeatedStepsHandler()({ orgId: "org-42" } as Request, response);

    expect(eq).toHaveBeenCalledWith(stepColumns.orgId, "org-42");
    expect(gte).toHaveBeenCalledWith(stepColumns.occurredAt, expect.any(Date));
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({
        stepKey: "classify.ticket.v1",
        currency: "BRL",
        sampleSize: 200,
        totalCostCents: 2_000,
        recommendation: {
          action: "distill_step",
          label: "Certificar como código",
        },
      }), expect.objectContaining({
        stepKey: "other.step.v1",
        recommendation: null,
      })]),
    }));
    const responseBody = vi.mocked(response.json).mock.calls[0]![0] as { items: unknown[] };
    expect(JSON.stringify(responseBody.items)).not.toContain("fingerprint");
    expect(JSON.stringify(responseBody.items)).not.toContain("hash-a");
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

function repeatedStepsHandler(): (req: Request, res: Response) => Promise<void> {
  const router = telemetryRouter as unknown as {
    stack: Array<{
      route?: {
        path: string;
        stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
      };
    }>;
  };
  const layer = router.stack.find(
    ({ route }) => route?.path === "/telemetry/repeated-steps",
  );
  if (!layer?.route) throw new Error("Rota de passos repetidos não encontrada.");
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

function stepQueryResult<T>(rows: T[]) {
  return {
    from: () => ({
      where: vi.fn().mockResolvedValue(rows),
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
