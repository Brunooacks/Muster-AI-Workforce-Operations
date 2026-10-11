import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { column, db, eq, gte, lte } = vi.hoisted(() => ({
  column: {},
  db: { select: vi.fn() },
  eq: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
  lte: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@workspace/db", () => ({
  db,
  agents: { id: column, orgId: column },
  agentEvents: {
    id: column,
    taskRunId: column,
    currency: column,
    kind: column,
    costCents: column,
    ts: column,
    metadata: column,
    agentId: column,
  },
  areas: {},
  agentIdentities: {},
  agentOwners: {},
  evaluations: {},
  verdicts: {},
  metricPoints: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  eq,
  inArray: vi.fn(),
  gte,
  lte,
}));

import agentsRouter from "./agents";

describe("GET /agents/:agentId/value", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockReset();
  });

  it("devolve a métrica por moeda do agente na janela solicitada", async () => {
    db.select
      .mockReturnValueOnce(queryResult([{ id: "agent-1" }]))
      .mockReturnValueOnce(queryResult([
        {
          id: "execution-1",
          taskRunId: "run-1",
          currency: "BRL",
          kind: "execution",
          costCents: 120,
          ts: new Date("2026-10-11T10:00:00.000Z"),
          metadata: {},
        },
        {
          id: "feedback-1",
          taskRunId: "run-1",
          currency: "BRL",
          kind: "feedback",
          costCents: null,
          ts: new Date("2026-10-11T10:01:00.000Z"),
          metadata: { validation: { status: "validated", source: "connector" } },
        },
      ]));
    const response = responseMock();

    await valueHandler()(
      request({ from: "2026-10-11T00:00:00.000Z", to: "2026-10-11T23:59:59.999Z" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      metrics: {
        BRL: expect.objectContaining({
          status: "available",
          totalCost: expect.objectContaining({ cents: 120, currency: "BRL" }),
        }),
      },
      validationByStatus: { validated: 1, rejected: 0, unvalidated: 0 },
      tasksWithoutCurrency: { count: 0, taskRunIds: [] },
    }));
  });

  it("oculta agente de outra organização com 404", async () => {
    db.select.mockReturnValueOnce(queryResult([]));
    const response = responseMock();

    await valueHandler()(
      request({ from: "2026-10-11T00:00:00.000Z", to: "2026-10-11T23:59:59.999Z" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: "Agent not found" });
    expect(eq).toHaveBeenCalledWith(column, "org-1");
  });

  it("aplica limites inclusivos da janela à busca de eventos", async () => {
    db.select
      .mockReturnValueOnce(queryResult([{ id: "agent-1" }]))
      .mockReturnValueOnce(queryResult([]));
    const response = responseMock();

    await valueHandler()(
      request({ from: "2026-10-11T08:00:00.000Z", to: "2026-10-11T12:00:00.000Z" }),
      response,
    );

    expect(gte).toHaveBeenCalledWith(column, new Date("2026-10-11T08:00:00.000Z"));
    expect(lte).toHaveBeenCalledWith(column, new Date("2026-10-11T12:00:00.000Z"));
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it.each([
    ["ausente", { to: "2026-10-11T23:59:59.999Z" }],
    ["inválida", { from: "não-é-data", to: "2026-10-11T23:59:59.999Z" }],
  ])("rejeita data inicial %s", async (_caseName, query) => {
    const response = responseMock();

    await valueHandler()(request(query), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "Informe datas from e to válidas.",
    });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("rejeita janela cujo início é posterior ao fim", async () => {
    const response = responseMock();

    await valueHandler()(
      request({ from: "2026-10-12T00:00:00.000Z", to: "2026-10-11T00:00:00.000Z" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "A data from deve ser anterior ou igual a to.",
    });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("rejeita janela superior a 92 dias", async () => {
    const response = responseMock();

    await valueHandler()(
      request({ from: "2026-07-11T00:00:00.000Z", to: "2026-10-12T00:00:00.000Z" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "A janela máxima é de 92 dias.",
    });
    expect(db.select).not.toHaveBeenCalled();
  });
});

function valueHandler(): (req: Request, res: Response) => Promise<void> {
  const router = agentsRouter as unknown as {
    stack: Array<{
      route?: {
        path: string;
        stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
      };
    }>;
  };
  const layer = router.stack.find(({ route }) => route?.path === "/agents/:agentId/value");
  if (!layer?.route) throw new Error("Rota de valor do agente não encontrada.");
  return layer.route.stack.at(-1)!.handle;
}

function request(query: Record<string, string | undefined>): Request {
  return {
    params: { agentId: "agent-1" },
    query,
    orgId: "org-1",
  } as unknown as Request;
}

function queryResult<T>(rows: T[]) {
  return {
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve),
      }),
    }),
  };
}

function responseMock(): Response {
  const response = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}
