import assert from "node:assert/strict";
import test from "node:test";
import { inviteContactUrl, inviteOnlyEnabled } from "./invite-only";

test("modo convite só é ativado explicitamente", () => {
  assert.equal(inviteOnlyEnabled(" true "), true);
  assert.equal(inviteOnlyEnabled("false"), false);
  assert.equal(inviteOnlyEnabled(undefined), false);
});

test("contato de convite não possui URL padrão", () => {
  assert.equal(inviteContactUrl("  "), null);
  assert.equal(inviteContactUrl(undefined), null);
  assert.equal(
    inviteContactUrl("https://contato.example/acesso"),
    "https://contato.example/acesso",
  );
});
