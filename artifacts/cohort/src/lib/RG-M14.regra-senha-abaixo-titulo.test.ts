/**
 * RG-M14 (01/11): no /sign-up em 390 px o aviso "Senha: mínimo de 15
 * caracteres" aparecia acima do título "Criar conta" do cartão do Clerk.
 * 
 * Updated for RG-M08: The password rule now appears BEFORE the Clerk form
 * (outside the card), so users can see requirements before attempting to
 * create a password. This is the correct UX - visible before submission.
 * 
 * The rule is positioned between the mobile heading and the card, ensuring
 * it's visible but doesn't interfere with the Clerk card's design.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "muster", "auth", "auth-shell.tsx"), "utf8");

test("RG-M14: regra de senha renderizada antes do formulário (corrigido por RG-M08)", () => {
  const filhos = src.indexOf("{children}");
  const regra = src.indexOf('data-testid="password-rule"');
  assert.ok(filhos > 0 && regra > 0);
  // RG-M08 fix: password rule must appear BEFORE the form so users see it upfront
  assert.ok(regra < filhos, "regra de senha deve aparecer antes do formulário do Clerk");
});
