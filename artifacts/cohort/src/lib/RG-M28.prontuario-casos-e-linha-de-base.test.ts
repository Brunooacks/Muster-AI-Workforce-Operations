// RG-M28 (04/11/2026): o prontuário do Atlas mostrava "sem casos registrados"
// em toda meta (o adapter nunca preenchia `casos`) e "antes do agente —"
// (a linha de base era o texto do business case, não um número por meta).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptApiAgent } from "./workforce-agent-adapter";
import { bulletDaMeta } from "./agentes";
import type { Agent, AgentDetail } from "@workspace/api-client-react";

const base = {
  id: "a", name: "Atlas PR Reviewer", slug: "atlas", role: "r", platform: "p", version: "1", status: "active",
  bio: "", currentVerdict: "promote", verdictConfidence: 0.9, severity: "stable", healthScore: 90,
  admittedAt: "2026-09-01T00:00:00Z", lastEvaluatedAt: "2026-11-01T00:00:00Z", monthlyVolume: 11317,
  targetMetrics: [{ label: "Cobertura de revisão", value: 98.2, unit: "%", trend: 0, direction: "up", target: "≥ 90%" }],
} as unknown as Agent;
const detalhe = (contrato: Record<string, unknown>) => ({
  owners: { businessOwner: "Bruno" }, identity: { shouldDo: [], shouldNotDo: [], limits: [], businessCase: { baseline: "30 dias de execuções observadas antes da decisão.", metricContracts: [{ layer: "efficacy", label: "Cobertura de revisão", unit: "%", target: "≥ 90%", ...contrato }] } },
}) as unknown as AgentDetail;

test("meta observada leva as entregas do período como casos", () => {
  const m = adaptApiAgent(base, detalhe({})).metrics[0]!;
  assert.equal(m.casos, 11317);
  assert.equal(bulletDaMeta(m).casos, 11317);
});

test("linha de base numérica por meta é usada no 'antes do agente'", () => {
  const m = adaptApiAgent(base, detalhe({ baseline: "61%" })).metrics[0]!;
  assert.equal(bulletDaMeta(m).antes, 61);
});

test("sem linha de base por meta, a tela diz isso em vez de '—'", () => {
  const s = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../components/shell/agentes-graficos.tsx"), "utf8");
  assert.ok(/sem linha de base/.test(s));
  assert.ok(!s.includes("antes do agente {numero(bullet.antes, bullet.unidade)}"));
});
