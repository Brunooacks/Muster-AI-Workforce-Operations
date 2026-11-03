// RG-M23 (03/11/2026): o contrato do agente mostrava o id cru do Clerk
// ("user_3LT…") como dono. Agora mostra o nome da pessoa ou o papel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../components/agent-contract.tsx"), "utf8");

test("contrato não renderiza userId cru", () => {
  assert.ok(!src.includes("${o.userId} · ${o.role}"));
  assert.ok(!src.includes("{o.userId} · {o.role}"));
  assert.ok(src.includes("membro da organização"));
});
