import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "./requireAuth";
import { requireOrgAdmin, requireOrgOperator, requireOrgRole } from "./orgRole";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: { select: mocks.select },
  organizationMembers: {
    orgId: "col:orgId",
    userId: "col:userId",
    role: "col:role",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  and: (...conditions: unknown[]) => ({ and: conditions }),
}));

function responseMock(): Response {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}

function requestMock(fields: Partial<AuthenticatedRequest> = {}) {
  return fields as AuthenticatedRequest;
}

beforeEach(() => {
  mocks.select.mockReset();
  mocks.where.mockReset();
  mocks.limit.mockReset();
  mocks.select.mockReturnValue({ from: () => ({ where: mocks.where }) });
  mocks.where.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue([]);
});

describe("requireOrgRole", () => {
  it("responde 401 quando não há usuário autenticado na requisição", async () => {
    const request = requestMock();
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    await requireOrgRole("owner", "admin")(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("responde 403 quando a organização não foi resolvida", async () => {
    const request = requestMock({ userId: "user_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    await requireOrgRole("owner", "admin")(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "Organização não resolvida.",
    });
    expect(next).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("filtra a consulta pela organização e pelo usuário, isolando tenants", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([{ role: "owner" }]);

    await requireOrgRole("owner", "admin")(request, response, next);

    expect(mocks.select).toHaveBeenCalledWith({ role: "col:role" });
    expect(mocks.where).toHaveBeenCalledWith({
      and: [{ eq: ["col:orgId", "org_1"] }, { eq: ["col:userId", "user_1"] }],
    });
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("nega member em rota de owner/admin com o status do authorizeOrgRole", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([{ role: "member" }]);

    await requireOrgRole("owner", "admin")(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "Forbidden",
      reason: "Permissão insuficiente nesta organização.",
    });
    expect(next).not.toHaveBeenCalled();
    expect(request.orgRole).toBeUndefined();
  });

  it("nega usuário sem vínculo com a organização com 403", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([]);

    await requireOrgRole("owner", "admin")(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "Forbidden",
      reason: "Permissão insuficiente nesta organização.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("libera owner, chama next sem argumentos e anexa orgRole", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([{ role: "owner" }]);

    await requireOrgRole("owner", "admin")(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(request.orgRole).toBe("owner");
    expect(response.status).not.toHaveBeenCalled();
  });
});

describe("requireOrgAdmin", () => {
  it("libera admin e chama next sem resposta de erro", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([{ role: "admin" }]);

    await requireOrgAdmin(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.orgRole).toBe("admin");
    expect(response.status).not.toHaveBeenCalled();
  });

  it("nega member com 403", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([{ role: "member" }]);

    await requireOrgAdmin(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "Forbidden",
      reason: "Permissão insuficiente nesta organização.",
    });
    expect(next).not.toHaveBeenCalled();
    expect(request.orgRole).toBeUndefined();
  });
});

describe("requireOrgOperator", () => {
  it("libera member e anexa orgRole member", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([{ role: "member" }]);

    await requireOrgOperator(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.orgRole).toBe("member");
    expect(response.status).not.toHaveBeenCalled();
  });
});

describe("requireOrgRole com falha de banco", () => {
  it("encaminha o erro para next sem responder na resposta", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    const failure = new Error("db down");
    mocks.limit.mockRejectedValue(failure);

    await requireOrgOperator(request, response, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
    expect(request.orgRole).toBeUndefined();
  });
});
