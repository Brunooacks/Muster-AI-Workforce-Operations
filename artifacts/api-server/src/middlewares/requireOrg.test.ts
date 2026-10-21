import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));
vi.mock("@workspace/db", () => ({
  db: {},
  organizations: {},
  organizationMembers: {},
}));

import { requireOrg } from "./requireOrg";

const getAuthMock = vi.mocked(getAuth);

function responseMock(): Response {
  const response = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}

describe("requireOrg", () => {
  beforeEach(() => getAuthMock.mockReset());

  it("retorna 401 sem sessão autenticada", async () => {
    getAuthMock.mockReturnValue({ userId: null } as never);
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    await requireOrg({} as Request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 403 para usuário autenticado sem organização ativa", async () => {
    getAuthMock.mockReturnValue({ userId: "user_1", orgId: null } as never);
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    await requireOrg({ userId: "user_1" } as Request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error:
        "Selecione uma organização ativa antes de acessar dados do tenant.",
      code: "ACTIVE_ORGANIZATION_REQUIRED",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
