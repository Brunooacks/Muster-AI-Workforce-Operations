// Regressão RG-N03 (e RG-M11): no onboarding, "Connect and map" sem conector
// manda para /conectores; o OnboardingGate redirecionava de volta para
// /onboarding (loop). Durante o onboarding, as telas de conector precisam abrir.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as routing from "./auth-routing";

const allows = (routing as Record<string, unknown>).onboardingGateAllows as ((p: string) => boolean) | undefined;

test("RG-N03 gate libera conectores durante o onboarding", () => {
  assert.equal(typeof allows, "function", "auth-routing deve exportar onboardingGateAllows");
  for (const p of ["/conectores", "/conectores/openai-assistants", "/conectores?from=onboarding", "/ops/conectores", "/onboarding", "/onboarding/passo-2"]) {
    assert.equal(allows!(p), true, p);
  }
});

test("RG-N03 gate continua segurando o resto do app até concluir", () => {
  for (const p of ["/visao-geral", "/board", "/ops/custos", "/conectoresx", "/agentes/1"]) {
    assert.equal(allows!(p), false, p);
  }
});

test("RG-N03 OnboardingGate usa a regra (sem loop)", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const gate = app.slice(app.indexOf("function OnboardingGate"), app.indexOf("function ProtectedRoute"));
  assert.match(gate, /onboardingGateAllows\(/);
});
