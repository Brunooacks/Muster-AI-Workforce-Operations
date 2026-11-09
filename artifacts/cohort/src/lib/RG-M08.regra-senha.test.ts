/** RG-M08: a regra de senha aparece no /sign-up antes do envio, nos 3 idiomas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as copy from "../muster/auth/auth-copy";

test("RG-M08 copy pt/en/es traz o mínimo de caracteres", () => {
  const c = copy as any;
  assert.equal(c.PASSWORD_MIN_LENGTH, 15);
  assert.match(c.AUTH_COPY.pt.passwordRule, /senha.*15 caracteres/i);
  assert.match(c.AUTH_COPY.en.passwordRule, /15 characters/);
  assert.match(c.AUTH_COPY.es.passwordRule, /15 caracteres/);
});

test("RG-M08 AuthShell mostra a regra no modo sign-up", () => {
  const src = readFileSync(new URL("../muster/auth/auth-shell.tsx", import.meta.url), "utf8");
  assert.match(src, /isSignIn \? null : \([\s\S]{0,200}t\.passwordRule/);
});
