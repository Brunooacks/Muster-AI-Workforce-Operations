/**
 * RG-X01 — isolamento entre organizações no requireOrg.
 * Duas orgs (org_a, org_b), usuários u_a (só org_a) e u_b (só org_b).
 * Nunca cai em org_default; claim de org alheia não dá acesso; sem vínculo = 403.
 */
import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ claim: null as string | null, queue: [] as unknown[][] }));

vi.mock("@clerk/express", () => ({ getAuth: () => ({ orgId: h.claim, sessionClaims: {} }) }));
vi.mock("../lib/active-organization", () => ({ resolveActiveOrganizationId: (o: string | null) => o ?? null }));
vi.mock("../lib/account-scope", () => ({ personalExternalId: (u: string) => `personal:${u}` }));
vi.mock("drizzle-orm", () => ({ eq: (...a: unknown[]) => ({ eq: a }), and: (...a: unknown[]) => ({ and: a }) }));

// Banco falso com duas orgs. Cada consulta do requireOrg é respondida pelo
// "resolvedor" da vez, olhando o estado abaixo.
const ORGS = [
  { id: "org_a", externalId: "clerk_org_a", kind: "company" },
  { id: "org_b", externalId: "clerk_org_b", kind: "company" },
  { id: "org_default", externalId: "default", kind: "company" },
];
const MEMBERS = [
  { orgId: "org_a", userId: "u_a" },
  { orgId: "org_b", userId: "u_b" },
];
let calls: string[] = [];
function chain(kind: string, resolve: () => unknown[]) {
  const c: any = {
    from: () => c, innerJoin: () => { kind += "+join"; return c; },
    where: () => c,
    limit: async () => { calls.push(kind); return resolve(); },
  };
  return c;
}
let ctx = { user: "", claim: null as string | null };
vi.mock("@workspace/db", () => ({
  organizations: {}, organizationMembers: {},
  db: {
    select: (shape: Record<string, unknown>) => {
      const keys = Object.keys(shape).join(",");
      // 1) org pelo claim
      if (keys === "id" && calls.length === 0 && ctx.claim)
        return chain("orgByClaim", () => ORGS.filter((o) => o.externalId === ctx.claim).map((o) => ({ id: o.id })));
      // 2) vínculo com a org do claim
      if (keys === "id" && calls.at(-1) === "orgByClaim") {
        const org = ORGS.find((o) => o.externalId === ctx.claim);
        return chain("member", () => MEMBERS.filter((m) => m.orgId === org?.id && m.userId === ctx.user).map(() => ({ id: 1 })));
      }
      // 3) conta pessoal (nenhuma neste cenário)
      if (keys === "id") return chain("personal", () => []);
      // 4) vínculos de empresa
      return chain("memberships", () =>
        MEMBERS.filter((m) => m.userId === ctx.user).map((m) => ({ orgId: m.orgId })).slice(0, 2));
    },
  },
}));

import { requireOrg, DEFAULT_ORG_ID } from "./requireOrg";

async function run(user: string | undefined, claim: string | null) {
  ctx = { user: user ?? "", claim };
  h.claim = claim;
  calls = [];
  const req = { userId: user } as unknown as Request;
  const res: any = { statusCode: 200, body: undefined };
  res.status = (s: number) => { res.statusCode = s; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  const next = vi.fn() as unknown as NextFunction;
  await requireOrg(req, res as Response, next);
  return { orgId: (req as any).orgId as string | undefined, status: res.statusCode, next };
}

beforeEach(() => { calls = []; });

describe("RG-X01 requireOrg com duas organizações", () => {
  it("u_a resolve org_a; u_b resolve org_b", async () => {
    expect((await run("u_a", null)).orgId).toBe("org_a");
    expect((await run("u_b", null)).orgId).toBe("org_b");
  });
  it("u_a com claim da org_b NÃO entra na org_b", async () => {
    const r = await run("u_a", "clerk_org_b");
    expect(r.orgId).not.toBe("org_b");
  });
  it("usuário sem vínculo: 403, nunca org_default", async () => {
    const r = await run("u_x", null);
    expect(r.status).toBe(403);
    expect(r.orgId).toBeUndefined();
    expect(r.next).not.toHaveBeenCalled();
  });
  it("sem usuário: 401", async () => {
    expect((await run(undefined, null)).status).toBe(401);
  });
  it("nenhum caminho atribui DEFAULT_ORG_ID", async () => {
    for (const [u, c] of [["u_a", null], ["u_b", "clerk_org_a"], ["u_x", "default"], ["u_x", null]] as const) {
      expect((await run(u, c)).orgId).not.toBe(DEFAULT_ORG_ID);
    }
  });
});
