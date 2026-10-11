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
