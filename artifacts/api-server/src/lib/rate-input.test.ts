import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { offInvoiceProblems, periodsOverlap, resolveHourlyRate, roleRateProblems, type RateRow } from "./rate-input";

vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: "user_admin", orgId: "org_x" }) }));

describe("custo-hora · validação", () => {
  it("valor em centavos inteiros ≥ 0, moeda, vigência", () => {
    expect(roleRateProblems({ role: "analista", hourlyCostCents: 9000, currency: "BRL", validFrom: "2026-01-01" })).toEqual([]);
    expect(roleRateProblems({ role: " ", hourlyCostCents: 90.5, currency: "EUR" as "BRL", validFrom: "2026-02-01", validTo: "2026-01-01" })).toEqual([
      "role é obrigatório.",
      "hourlyCostCents precisa ser inteiro ≥ 0.",
      "currency deve ser BRL ou USD.",
      "validTo deve ser YYYY-MM-DD e não anterior a validFrom.",
    ]);
  });

  it("custo fora da fatura: alocação por agente exige agentId; período coerente", () => {
    const base = { category: "license", amountCents: 50000, currency: "BRL", periodStart: "2026-10-01", periodEnd: "2026-10-31" } as const;
    expect(offInvoiceProblems({ ...base, allocation: "per_task" })).toEqual([]);
    expect(offInvoiceProblems({ ...base, allocation: "agent" })).toEqual(["allocation agent exige agentId."]);
    expect(offInvoiceProblems({ ...base, allocation: "project", periodEnd: "2026-09-01" })).toEqual([
      "periodStart/periodEnd devem ser YYYY-MM-DD com fim ≥ início.",
      "allocation project exige projectId.",
    ]);
  });

  it("vigências abertas e fechadas se cruzam corretamente", () => {
    expect(periodsOverlap("2026-01-01", null, "2027-01-01", null)).toBe(true);
    expect(periodsOverlap("2026-01-01", "2026-06-30", "2026-07-01", null)).toBe(false);
    expect(periodsOverlap("2026-01-01", "2026-06-30", "2026-06-30", "2026-12-31")).toBe(true);
  });
});

describe("resolveHourlyRate · sem default (R4)", () => {
  const rates: RateRow[] = [
    { areaId: null, role: "analista", hourlyCostCents: 8000, currency: "BRL", validFrom: "2026-01-01", validTo: "2026-06-30" },
    { areaId: null, role: "analista", hourlyCostCents: 9000, currency: "BRL", validFrom: "2026-07-01", validTo: null },
    { areaId: "area_sac", role: "analista", hourlyCostCents: 7000, currency: "BRL", validFrom: "2026-01-01", validTo: null },
  ];

  it("área vence a conta; vigência escolhe a linha certa", () => {
    expect(resolveHourlyRate(rates, { role: "analista", day: "2026-03-10" })?.hourlyCostCents).toBe(8000);
    expect(resolveHourlyRate(rates, { role: "analista", day: "2026-10-10" })?.hourlyCostCents).toBe(9000);
    expect(resolveHourlyRate(rates, { role: "analista", areaId: "area_sac", day: "2026-10-10" })?.hourlyCostCents).toBe(7000);
    expect(resolveHourlyRate(rates, { role: "analista", areaId: "area_outra", day: "2026-10-10" })?.hourlyCostCents).toBe(9000);
  });

  it("sem linha vigente devolve null — nunca um valor inventado", () => {
    expect(resolveHourlyRate(rates, { role: "gerente", day: "2026-10-10" })).toBeNull();
    expect(resolveHourlyRate(rates, { role: "analista", day: "2025-12-31" })).toBeNull();
    expect(resolveHourlyRate([], { role: "analista", day: "2026-10-10" })).toBeNull();
  });
});

describe("log de request das rotas de custo", () => {
  it("o audit de POST /rates/roles grava o padrão da rota, nunca o valor", async () => {
    const { auditMutations } = await import("./observability");
    const response = Object.assign(new EventEmitter(), { statusCode: 201 }) as unknown as Response;
    const info = vi.fn();
    const request = {
      id: "req-1",
      method: "POST",
      baseUrl: "/api",
      route: { path: "/rates/roles" },
      url: "/api/rates/roles",
      body: { role: "analista", hourlyCostCents: 987654, currency: "BRL", validFrom: "2026-01-01" },
      orgId: "org_x",
      log: { info },
    } as unknown as Request;
    auditMutations(request, response, vi.fn() as NextFunction);
    (response as unknown as EventEmitter).emit("finish");
    expect(info).toHaveBeenCalledOnce();
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/987654|hourlyCostCents/);
  });
});
