/**
 * RG-N20 (Muster) — /design-system não existe no build de produção.
 * O import da página só pode acontecer sob import.meta.env.DEV (o Vite remove
 * o ramo e o chunk no build de prod) e toda rota usa o componente guardado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname, "../App.tsx"), "utf8");

test("RG-N20 import da página de design-system só em DEV", () => {
  const decl = app.match(/const DesignSystemPage\s*=([^;]+);/);
  assert.ok(decl, "declaração de DesignSystemPage");
  assert.match(decl[1]!, /import\.meta\.env\.DEV\s*\?/);
  assert.match(decl[1]!, /:\s*null\s*$/);
});

test("RG-N20 rotas /design-system condicionadas ao componente DEV", () => {
  const usos = [...app.matchAll(/[^\n]*path="\/design-system"[^\n]*/g)].map((m) => m[0]);
  assert.ok(usos.length >= 1);
  for (const u of usos) assert.match(u, /DesignSystemPage\s*&&/, u.trim());
});
