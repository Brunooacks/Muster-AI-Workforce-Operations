import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  agentApiKeys: {},
  organizations: {},
  organizationMembers: {},
}));

import { requireAgentCredential } from "./requireAgentCredential";

describe("requireAgentCredential", () => {
  it("rejects anonymous machine ingestion without an agent API key", async () => {
    const request = {
      header: vi.fn().mockReturnValue(undefined),
      params: { agentId: "agent_123" },
    } as unknown as Request;
    const response = {
      status: vi.fn(),
      json: vi.fn(),
    } as unknown as Response;
    vi.mocked(response.status).mockReturnValue(response);
    const next = vi.fn() as NextFunction;

    await requireAgentCredential(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: "Credencial do agente ausente.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
