import test from "node:test";
import assert from "node:assert/strict";
import { APP_STATIC_PATHS, MUSTER_SCREEN_PATHS, isKnownAppPath } from "./workforce-routing";
import { DEFAULT_AUTH_REDIRECT, DEFAULT_ONBOARDING_REDIRECT } from "./auth-routing";

test("telas da fase 2 são rotas conhecidas do app", () => {
  for (const p of MUSTER_SCREEN_PATHS) {
    assert.ok((APP_STATIC_PATHS as readonly string[]).includes(p), p);
    assert.equal(isKnownAppPath(p), true, p);
  }
});

test("entrada padrão do app é a Visão geral", () => {
  assert.equal(DEFAULT_AUTH_REDIRECT, "/visao-geral");
  assert.equal(DEFAULT_ONBOARDING_REDIRECT, "/visao-geral");
});
