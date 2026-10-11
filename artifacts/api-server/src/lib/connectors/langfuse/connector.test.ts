import { describe, expect, it, vi } from "vitest";
import { LangfuseClientError, createLangfuseClient } from "./client";
import { langfuseConnector } from "./connector";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  createLangfuseClient: vi.fn(),
}));

const token = JSON.stringify({
  publicKey: "pk-lf-f2-public",
  secretKey: "sk-lf-f2-secret",
});

async function* pages<T>(...values: T[][]): AsyncGenerator<T[]> {
  yield* values;
}

describe("langfuseConnector", () => {
  it("confirma a conexão com o nome do projeto", async () => {
    vi.mocked(createLangfuseClient).mockReturnValue({
      listProjects: async () => [{ id: "project-f2", name: "Projeto F2" }],
      listObservations: () => pages([]),
      listScores: () => pages([]),
    });

    await expect(langfuseConnector.testConnection({ token })).resolves.toEqual({
      ok: true,
      message: "Conectado ao projeto Projeto F2",
    });
  });

  it("traduz 401 para a mensagem de chaves inválidas", async () => {
    vi.mocked(createLangfuseClient).mockReturnValue({
      listProjects: async () => {
        throw new LangfuseClientError("langfuse_unauthorized", 401);
      },
      listObservations: () => pages([]),
      listScores: () => pages([]),
    });

    await expect(langfuseConnector.testConnection({ token })).resolves.toEqual({
      ok: false,
      message: "Chaves do Langfuse inválidas ou sem acesso ao projeto.",
    });
  });

  it("descobre um candidato por traceName com a contagem de traces", async () => {
    vi.mocked(createLangfuseClient).mockReturnValue({
      listProjects: async () => [{ id: "project-f2", name: "Projeto F2" }],
      listObservations: () =>
        pages([
          { id: "obs-f2-1", traceId: "trace-f2-1", traceName: "Agente suporte" },
          { id: "obs-f2-2", traceId: "trace-f2-2", traceName: "Agente suporte" },
          { id: "obs-f2-3", traceId: "trace-f2-3" },
        ]),
      listScores: () => pages([]),
    });

    await expect(langfuseConnector.discoverAgents({ token })).resolves.toEqual([
      {
        externalId: "langfuse:project-f2:Agente suporte",
        name: "Agente suporte",
        description: "Trace Langfuse Agente suporte.",
        stack: "langfuse",
        url: null,
        signals: ["langfuse:trace-name", "traces:2"],
        confidence: 60,
      },
    ]);
  });
});
