// RG-M24 (03/11/2026): a área logada não cita a Veltrix (ex.: "tabela de
// preços da Veltrix ainda não disponível" no prontuário do agente).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(here, p), "utf8");

test("rótulos de indisponibilidade do resultado não citam Veltrix", () => {
  assert.ok(!/veltrix/i.test(read("./agent-outcome-view.ts")));
  for (const f of ["../components/agent-outcome.tsx", "../components/agent-contract.tsx", "../pages/entregas.tsx", "./visao-geral.ts"]) {
    assert.ok(!/veltrix/i.test(read(f)), f);
  }
});
