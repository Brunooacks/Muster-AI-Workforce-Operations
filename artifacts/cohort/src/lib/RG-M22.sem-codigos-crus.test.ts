// RG-M22 (03/11/2026): alertas, pendências e prontuário mostravam códigos crus
// (continuous-governance, insufficient_data, not_measured, mentor, task_id) e
// rótulos em inglês (Direction/Protection/Proof) na versão em português.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { humanizarCodigos, rotuloCodigo } from "./humanizar-codigos";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(here, p), "utf8");

test("humaniza o texto do alerta de governança", () => {
  const t = humanizarCodigos("Regressão: insufficient_data · Fundamentação: not_measured · Contexto: não medido");
  assert.equal(t, "Regressão: dados insuficientes · Fundamentação: não medido · Contexto: não medido");
  assert.equal(rotuloCodigo("continuous-governance"), "Governança contínua");
  assert.equal(rotuloCodigo("mentor"), "acompanhar");
});

test("telas não renderizam código cru", () => {
  const alerts = read("../pages/alerts.tsx");
  assert.ok(!alerts.includes("{alert.patternType ||"));
  assert.ok(!alerts.includes("{alert.hypothesis}"));
  const detail = read("../pages/agent-detail.tsx");
  assert.ok(!detail.includes(">{alert.patternType}<"));
  assert.ok(!detail.includes("Veredito: ${outcome.verdict}"));
  assert.ok(!read("../components/agent-outcome.tsx").includes("task_id"));
  assert.ok(!read("./visao-geral.ts").includes("task_id"));
});

test("rótulos pt-BR do painel de governança", () => {
  const src = read("../components/mission-control/realtime-governance-panel.tsx");
  const pt = src.slice(src.indexOf("  pt: {"), src.indexOf("  en: {"));
  assert.ok(!/"Direction"|"Protection"|"Proof"/.test(pt));
});

test("backend grava hipótese sem código cru", () => {
  const be = read("../../../api-server/src/lib/agent-telemetry-reevaluation.ts");
  assert.ok(!be.includes("`Fundamentação: ${governanceAssessment.hallucinationStatus}`"));
});
