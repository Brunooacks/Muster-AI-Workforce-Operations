/**
 * RG-M14 (01/11): no /sign-up em 390 px o aviso "Senha: mínimo de 15
 * caracteres" aparecia acima do título "Criar conta" do cartão do Clerk.
 * O aviso deve vir depois do cartão (children), nunca antes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "muster", "auth", "auth-shell.tsx"), "utf8");

test("RG-M14: regra de senha renderizada depois do cartão de cadastro", () => {
  const filhos = src.indexOf("{children}");
  const regra = src.indexOf('data-testid="password-rule"');
  assert.ok(filhos > 0 && regra > 0);
  assert.ok(regra > filhos, "aviso de senha antes do título do cartão");
});
