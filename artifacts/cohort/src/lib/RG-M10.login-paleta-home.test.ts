/**
 * RG-M10 (31/10): entrar, criar conta e boas-vindas no visual da home.
 * Bruno (t545u): o verde musgo (#07110d, #8ce0b5…) não faz mais sentido.
 * Falha se a paleta verde antiga voltar ou se as telas deixarem de usar
 * os tokens e o fundo da home.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f: string) => readFileSync(join(raiz, f), "utf8");
const telas = [
  "src/muster/auth/auth-shell.tsx",
  "src/muster/auth/clerk-config.ts",
  "src/muster/auth/auth-card-preview.tsx",
  "src/pages/onboarding.tsx",
];
const VERDE = /#(8ce0b5|07110d|0b1712|6dd3a0|a1eac4|b6f0d0|9aaba1|f2f1e8)\b|rgba\(140,\s*224,\s*181/i;

test("RG-M10: nenhuma tela de acesso usa o verde musgo antigo", () => {
  for (const f of telas) assert.doesNotMatch(ler(f), VERDE, f);
});

test("RG-M10: boas-vindas sem fonte serifada (Outfit da home)", () => {
  assert.doesNotMatch(ler("src/pages/onboarding.tsx"), /font-serif/);
});

test("RG-M10: login reaproveita fundo e faixa de logos da home", () => {
  const s = ler("src/muster/auth/auth-shell.tsx");
  assert.match(s, /<HomeBackdrop\s*\/>/);
  assert.match(s, /<HomeLogos\b/);
});

test("RG-M10: Clerk usa os tokens da home (tinta/ciano) e a Outfit", () => {
  const s = ler("src/muster/auth/clerk-config.ts");
  assert.match(s, /colorPrimary:\s*"hsl\(var\(--primary\)\)"/);
  assert.match(s, /fontFamily:\s*"var\(--app-font-sans\)"/);
  assert.match(s, /rounded-full/);
});
