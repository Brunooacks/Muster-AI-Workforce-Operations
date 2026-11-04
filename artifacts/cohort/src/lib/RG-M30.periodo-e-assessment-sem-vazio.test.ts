// RG-M30 (04/11/2026, gate prod): prontuário do mês corrente dizia "período ainda
// não fechado" como indisponível e /conectores mostrava "Nenhum assessment executado".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotCell } from "./agent-outcome-view";

test("mês aberto vira 'em andamento' com data de fechamento", () => {
  const c = snapshotCell("2026-11", { status: "unavailable", reason: "period_not_closed" } as never);
  assert.equal(c.unavailable, false);
  assert.equal(c.text, "Mês em andamento");
  assert.equal(c.hint, "fecha em 01/12/2026");
});

test("mês fechado mantém o hash", () => {
  const c = snapshotCell("2026-10", { status: "ok", value: { id: "x", inputsHash: "abcdef1234567890", createdAt: "2026-11-01T00:00:00Z" } });
  assert.equal(c.text, "abcdef123456");
});

test("conectores sem 'Nenhum assessment executado'", () => {
  const s = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../pages/connectors-workforce.tsx"), "utf8");
  assert.ok(!s.includes("Nenhum assessment executado"));
});
