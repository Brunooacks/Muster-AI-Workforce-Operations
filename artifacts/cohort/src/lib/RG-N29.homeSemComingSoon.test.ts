// RG-N29 (28/10/2026): a home do Muster não mostra "em breve"/"coming soon",
// não publica preço sem decisão, o CTA secundário diz o que faz (/sign-up =
// criar conta) e o login não promete GitHub (só Google está ativo no Clerk).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(SRC, p), "utf8");

test("RG-N29 home sem badge soon renderizado", () => {
  for (const f of ["home-decisao.tsx", "home-cobertura.tsx", "home-integracoes.tsx"]) {
    const s = read(`components/home/${f}`);
    assert.ok(!/<Badge variant="soon"[^>]*>\s*\{t\.soon\}/.test(s) || /filter\(\(c\) => !c\.soon\)/.test(s), f);
  }
  assert.match(read("components/home/home-integracoes.tsx"), /CONNECTORS\.filter\(\(c\) => !c\.soon\)/);
});
test("RG-N29 preços fora da home até decisão", () => {
  assert.doesNotMatch(read("pages/landing.tsx"), /<HomePrecos \/>/);
});
test("RG-N29 CTA secundário para /sign-up diz criar conta", () => {
  const s = read("components/home/home-fechamento.tsx");
  assert.doesNotMatch(s, /Talk to our team|Falar com a equipe|Hablar con el equipo/);
});
test("RG-N29 login sem promessa de GitHub nos subtítulos", () => {
  const s = read("muster/auth/auth-copy.ts");
  assert.doesNotMatch(s, /(Subtitle|sameMethod):[^\n]*GitHub/);
});
