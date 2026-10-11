import assert from "node:assert/strict";
import test from "node:test";
import { inviteContactUrl, inviteOnlyEnabled } from "./invite-only";

test("modo convite fica ativo quando a variável não está definida", () => {
  assert.equal(inviteOnlyEnabled(undefined), true);
});

test("modo convite só é desativado com o valor explícito false", () => {
  assert.equal(inviteOnlyEnabled("false"), false);
  assert.equal(inviteOnlyEnabled(" FALSE "), false);
  assert.equal(inviteOnlyEnabled(" true "), true);
  assert.equal(inviteOnlyEnabled(""), true);
  assert.equal(inviteOnlyEnabled("0"), true);
});

test("contato de convite não possui URL padrão", () => {
  assert.equal(inviteContactUrl("  "), null);
  assert.equal(inviteContactUrl(undefined), null);
  assert.equal(
    inviteContactUrl("https://contato.example/acesso"),
    "https://contato.example/acesso",
  );
});
