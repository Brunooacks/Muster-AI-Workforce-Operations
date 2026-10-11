import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

const { syncAllLangfuseConnectors } = vi.hoisted(() => ({
  syncAllLangfuseConnectors: vi.fn(),
}));

vi.mock("../lib/connectors/langfuse/sync", () => ({ syncAllLangfuseConnectors }));

import router from "./internal-cron";

describe("cron interno Langfuse", () => {
  afterEach(() => {
    delete process.env.MUSTER_INTERNAL_CRON_TOKEN;
    vi.clearAllMocks();
  });

  it("recusa disparos sem o token interno", async () => {
    process.env.MUSTER_INTERNAL_CRON_TOKEN = "cron-test-token";
    const response = responseMock();

    await cronHandler()({ get: () => undefined } as unknown as Request, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(syncAllLangfuseConnectors).not.toHaveBeenCalled();
  });

  it.each([
    ["com token incorreto de mesmo tamanho", "Bearer cron-test-tokex"],
    ["com token incorreto de tamanho diferente", "Bearer curto"],
    ["sem header de autorização", undefined],
  ])("recusa disparos %s", async (_description, authorization) => {
    process.env.MUSTER_INTERNAL_CRON_TOKEN = "cron-test-token";
    const response = responseMock();

    await cronHandler()({ get: () => authorization } as unknown as Request, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Não autorizado." });
    expect(syncAllLangfuseConnectors).not.toHaveBeenCalled();
  });

  it("recusa disparos quando o token interno não está configurado", async () => {
    const response = responseMock();

    await cronHandler()({ get: () => "Bearer cron-test-token" } as unknown as Request, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Não autorizado." });
    expect(syncAllLangfuseConnectors).not.toHaveBeenCalled();
  });

  it("dispara a função compartilhada e expõe falhas parciais", async () => {
    process.env.MUSTER_INTERNAL_CRON_TOKEN = "cron-test-token";
    syncAllLangfuseConnectors.mockResolvedValue({
      completed: [{ connectorId: "connector-1" }],
      failed: [{ connectorId: "connector-2", error: "credencial inválida" }],
    });
    const response = responseMock();

    await cronHandler()({ get: () => "Bearer cron-test-token" } as unknown as Request, response);

    expect(response.status).toHaveBeenCalledWith(207);
    expect(response.json).toHaveBeenCalledWith({
      completed: 1,
      failed: [{ connectorId: "connector-2", error: "credencial inválida" }],
    });
  });

  it("responde genericamente e registra somente o tipo quando a sincronização falha", async () => {
    process.env.MUSTER_INTERNAL_CRON_TOKEN = "cron-test-token";
    syncAllLangfuseConnectors.mockRejectedValue(new Error("falha com dados da conexão"));
    const response = responseMock();
    const error = vi.fn();

    await cronHandler()(
      {
        body: { token: "não-registre-este-corpo" },
        get: () => "Bearer cron-test-token",
        log: { error },
      } as unknown as Request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ error: "Falha ao sincronizar conectores Langfuse." });
    expect(error).toHaveBeenCalledWith(
      { errorType: "Error" },
      "Falha na sincronização interna do Langfuse.",
    );
  });
});

function cronHandler(): (req: Request, res: Response) => Promise<void> {
  const layer = (router as unknown as {
    stack: Array<{ route?: { path: string; stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }> } }>;
  }).stack.find(({ route }) => route?.path === "/internal/cron/langfuse-ingestion");
  if (!layer?.route) throw new Error("Rota de cron Langfuse não encontrada.");
  return layer.route.stack.at(-1)!.handle;
}

function responseMock(): Response {
  const response = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}
