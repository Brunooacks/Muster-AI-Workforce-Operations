import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LANG_PATHS, langFromPath } from "./i18n";

// RG-M05 — /en e /es abrem a home traduzida, não a página "Este destino não faz parte da operação atual".
test("RG-M05: /en e /es resolvem para o idioma da URL", () => {
  assert.equal(langFromPath("/en"), "en");
  assert.equal(langFromPath("/es/"), "es");
  assert.equal(langFromPath("/EN"), "en");
  assert.equal(langFromPath("/pt"), "pt");
  assert.equal(langFromPath("/calculadora"), null);
  assert.equal(langFromPath("/"), null);
});

test("RG-M05: App registra rotas de idioma nos dois roteadores (Clerk e demo)", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.deepEqual(Object.keys(LANG_PATHS).sort(), ["/en", "/es", "/pt"]);
  const usos = app.match(/LANG_ROUTES\.map/g) ?? [];
  assert.equal(usos.length, 2);
  // as rotas de idioma vêm antes do catch-all NotFound
  assert.ok(app.indexOf("LANG_ROUTES.map") < app.indexOf("<Route component={NotFound} />"));
});
