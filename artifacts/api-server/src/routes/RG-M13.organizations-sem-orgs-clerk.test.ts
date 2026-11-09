/**
 * RG-M13 (01/11): usuário novo no Muster recebia 403 em GET /api/organizations.
 * Causa: Organizations desligado na instância Clerk de produção
 * (organization_settings.enabled=false); a chamada ao Clerk falha com 403 e o
 * handler de erro repassava o 403. Esperado: 200 com lista vazia.
 */
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, organizations: {}, organizationMembers: {} }));
vi.mock("../lib/catalog-seed", () => ({ ensureCatalogSeed: vi.fn() }));

import { createOrganizationRouteHandlers } from "./organizations";

function resposta(): Response {
  const r = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  vi.mocked(r.status).mockReturnValue(r);
  return r;
}

function handlers(erro: unknown) {
  return createOrganizationRouteHandlers({
    requireAuth: (_q, _s, n) => n(),
    readAuth: () => ({ userId: "user_novo", activeOrganizationId: null }),
    listMemberships: vi.fn().mockRejectedValue(erro),
    listLocalOrganizations: vi.fn().mockResolvedValue([]),
    provisionOrganization: vi.fn(),
  });
}

describe("RG-M13: GET /organizations sem Organizations no Clerk", () => {
  it("Clerk 403 (feature desligada) vira lista vazia, não 403", async () => {
    const res = resposta();
    const next = vi.fn();
    await handlers(Object.assign(new Error("Forbidden"), { status: 403 })).list({ userId: "user_novo" } as Request, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ organizations: [] });
  });

  it("outras falhas do Clerk continuam subindo", async () => {
    const erro = Object.assign(new Error("boom"), { status: 500 });
    await expect(
      handlers(erro).list({ userId: "user_novo" } as Request, resposta(), vi.fn()),
    ).rejects.toBe(erro);
  });
});
