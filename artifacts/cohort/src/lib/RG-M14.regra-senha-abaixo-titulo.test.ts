/**
 * RG-M14 (01/11): no /sign-up em 390 px o aviso "Senha: mínimo de 15
 * caracteres" aparecia acima do título "Criar conta" do cartão do Clerk.
 * O aviso deve vir depois do título, nunca antes.
 * 
 * Com a solução via Clerk localization (signUp.start.subtitle), a regra
 * aparece no subtitle do Clerk, que fica abaixo do título e acima dos campos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const authShellSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "muster", "auth", "auth-shell.tsx"), "utf8");
const clerkConfigSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "muster", "auth", "clerk-config.ts"), "utf8");

test("RG-M14: regra de senha não aparece antes do cartão do Clerk", () => {
  // Não deve haver elemento password-rule antes de {children} no auth-shell
  const filhos = authShellSrc.indexOf("{children}");
  const regra = authShellSrc.indexOf('data-testid="password-rule"');
  
  if (regra > 0) {
    // Se o elemento existe, deve estar depois de {children}
    assert.ok(regra > filhos, "password-rule element aparece antes de {children}");
  }
  
  // A regra deve estar na configuração do Clerk (signUp.start.subtitle)
  assert.match(clerkConfigSrc, /signUp:.*start:.*subtitle:.*passwordRule/s, "password rule must be in Clerk's signUp.start.subtitle");
});
