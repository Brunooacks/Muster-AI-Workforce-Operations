import assert from "node:assert/strict";
import test from "node:test";
import { formatCents, roleRateBody, toCents } from "./rates-form";

test("valor digitado vira centavos; vazio não vira zero", () => {
  assert.equal(toCents("90,50"), 9050);
  assert.equal(toCents("120"), 12000);
  assert.equal(toCents(""), null);
  assert.equal(toCents("-3"), null);
  assert.equal(toCents("abc"), null);
});

test("formata centavos na moeda", () => {
  assert.match(formatCents(9050, "BRL"), /90,50/);
  assert.match(formatCents(9050, "USD"), /90\.50/);
});

test("custo-hora sem valor ou sem vigência é recusado; completo gera corpo", () => {
  const base = { role: "analista", areaId: "", hourly: "", currency: "BRL" as const, validFrom: "", validTo: "" };
  assert.deepEqual(roleRateBody(base).errors, ["Custo-hora precisa ser um número ≥ 0.", "Informe o início da vigência."]);
  assert.deepEqual(roleRateBody({ ...base, hourly: "95", validFrom: "2026-01-01" }).body, {
    role: "analista",
    areaId: null,
    hourlyCostCents: 9500,
    currency: "BRL",
    validFrom: "2026-01-01",
    validTo: null,
  });
});
