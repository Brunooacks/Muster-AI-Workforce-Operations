// RG-M27 (04/11/2026, gate local): "Regressão: warning" aparecia cru em
// Alertas/Pendências e o prontuário dizia "fechado em snapshot".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { humanizarCodigos } from "./humanizar-codigos";

test("status warning é traduzido", () => {
  assert.equal(humanizarCodigos("Regressão: warning · Fundamentação: not_measured"), "Regressão: em alerta · Fundamentação: não medido");
});

test("prontuário sem 'snapshot'", () => {
  const s = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "./agent-outcome-view.ts"), "utf8");
  assert.ok(!/snapshot/i.test(s.match(/period_not_closed:[^\n]*/)![0]));
});
