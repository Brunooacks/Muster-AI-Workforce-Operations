import { getAuth } from "@clerk/express";
import { organizationMembers } from "@workspace/db";
import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "./requireAuth";
import { DEFAULT_ORG_ID, requireOrg } from "./requireOrg";

type AuthResult = ReturnType<typeof getAuth>;

const mocks = vi.hoisted(() => {
  const queryQueue: unknown[][] = [];
  const limit = vi.fn(async () => queryQueue.shift() ?? []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { queryQueue, limit, where, from, select };
});

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));

vi.mock("@workspace/db", () => ({
  db: { select: mocks.select },
  organizations: {
    id: "col:organizations.id",
    externalId: "col:organizations.externalId",
  },
  organizationMembers: {
    id: "col:organizationMembers.id",
    orgId: "col:organizationMembers.orgId",
    userId: "col:organizationMembers.userId",
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

function requestMock(
  fields: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest {
  return fields as AuthenticatedRequest;
}

function authMock(fields: {
  orgId?: string;
  sessionClaims?: Record<string, unknown>;
}): AuthResult {
  return fields as unknown as AuthResult;
}

function enqueue(...results: unknown[][]): void {
  mocks.queryQueue.push(...results);
}

beforeEach(() => {
  mocks.queryQueue.length = 0;
  mocks.select.mockClear();
  mocks.from.mockClear();
  mocks.where.mockClear();
  mocks.limit.mockClear();
  vi.mocked(getAuth).mockReset();
});

describe("requireOrg", () => {
  it("libera a requisição que já carrega a organização, sem consultar o banco nem a sessão", async () => {
    const request = requestMock({ userId: "user_1", orgId: "org_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    await requireOrg(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(getAuth).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("responde 401 quando a requisição não tem usuário autenticado", async () => {
    const request = requestMock();
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    await requireOrg(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
    expect(getAuth).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("usa a organização da sessão quando o claim casa com uma org e o usuário é membro", async () => {
    const request = requestMock({ userId: "user_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    vi.mocked(getAuth).mockReturnValue(authMock({ orgId: "org_ext_a" }));
    enqueue([{ id: "org_local_a" }], [{ id: "member_1" }]);

    await requireOrg(request, response, next);

    expect(mocks.select).toHaveBeenNthCalledWith(1, {
      id: "col:organizations.id",
    });
    expect(mocks.select).toHaveBeenNthCalledWith(2, {
      id: "col:organizationMembers.id",
    });
    expect(mocks.where).toHaveBeenNthCalledWith(1, {
      eq: ["col:organizations.externalId", "org_ext_a"],
    });
    expect(mocks.where).toHaveBeenNthCalledWith(2, {
      and: [
        { eq: ["col:organizationMembers.orgId", "org_local_a"] },
        { eq: ["col:organizationMembers.userId", "user_1"] },
      ],
    });
    expect(mocks.limit).toHaveBeenCalledTimes(2);
    expect(request.orgId).toBe("org_local_a");
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("ignora o claim da sessão quando o usuário não é membro e adota o vínculo com outra org", async () => {
    const request = requestMock({ userId: "user_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    vi.mocked(getAuth).mockReturnValue(
      authMock({ sessionClaims: { org_id: "org_ext_a" } }),
    );
    enqueue([{ id: "org_local_a" }], [], [{ orgId: "org_local_b" }]);

    await requireOrg(request, response, next);

    expect(mocks.where).toHaveBeenNthCalledWith(2, {
      and: [
        { eq: ["col:organizationMembers.orgId", "org_local_a"] },
        { eq: ["col:organizationMembers.userId", "user_1"] },
      ],
    });
    expect(request.orgId).toBe("org_local_b");
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("cai para os vínculos quando a organização do claim não existe na base", async () => {
    const request = requestMock({ userId: "user_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    vi.mocked(getAuth).mockReturnValue(
      authMock({ orgId: "org_ext_inexistente" }),
    );
    enqueue([], [{ orgId: "org_local_b" }]);

    await requireOrg(request, response, next);

    expect(mocks.where).toHaveBeenNthCalledWith(1, {
      eq: ["col:organizations.externalId", "org_ext_inexistente"],
    });
    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect(request.orgId).toBe("org_local_b");
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("adota o vínculo único quando a sessão não declara organização", async () => {
    const request = requestMock({ userId: "user_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    vi.mocked(getAuth).mockReturnValue(authMock({}));
    enqueue([{ orgId: "org_local_c" }]);

    await requireOrg(request, response, next);

    expect(mocks.select).toHaveBeenCalledOnce();
    expect(request.orgId).toBe("org_local_c");
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("responde 409 e não adivinha quando o usuário tem mais de um vínculo", async () => {
    const request = requestMock({ userId: "user_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    vi.mocked(getAuth).mockReturnValue(authMock({}));
    enqueue([{ orgId: "org_local_a" }, { orgId: "org_local_b" }]);

    await requireOrg(request, response, next);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      error: "Usuário pertence a mais de uma organização; selecione uma.",
    });
    expect(next).not.toHaveBeenCalled();
    expect(request.orgId).toBeUndefined();
  });

  it("responde 403 quando o usuário não tem nenhum vínculo", async () => {
    const request = requestMock({ userId: "user_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    vi.mocked(getAuth).mockReturnValue(authMock({}));
    enqueue([]);

    await requireOrg(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "Usuário sem organização.",
    });
    expect(next).not.toHaveBeenCalled();
    expect(request.orgId).toBeUndefined();
  });

  it("limita a consulta de vínculos a dois e filtra pelo usuário autenticado", async () => {
    const request = requestMock({ userId: "user_1" });
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    vi.mocked(getAuth).mockReturnValue(authMock({}));
    enqueue([{ orgId: "org_local_a" }]);

    await requireOrg(request, response, next);

    expect(mocks.select).toHaveBeenCalledWith({
      orgId: "col:organizationMembers.orgId",
    });
    expect(mocks.from).toHaveBeenCalledWith(organizationMembers);
    expect(mocks.where).toHaveBeenCalledWith({
      eq: ["col:organizationMembers.userId", "user_1"],
    });
    expect(mocks.limit).toHaveBeenCalledWith(2);
  });
});

describe("DEFAULT_ORG_ID", () => {
  it("aponta para a organização de acolhimento criada pela migration 0009", () => {
    expect(DEFAULT_ORG_ID).toBe("org_default");
  });
});
