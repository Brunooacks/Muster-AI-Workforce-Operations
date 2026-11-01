/**
 * RG-M15 (01/11): org nova via "Lumen Logística S.A. · setembro/2026".
 * Entrada pós-login (/visao-geral e cia.) eram telas de protótipo com dados
 * estáticos de demo (muster/demo/lumen.json). Usuário logado entra na Visão
 * geral real (/comando) e as rotas de protótipo só existem no build de demo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_AUTH_REDIRECT, DEFAULT_ONBOARDING_REDIRECT } from "./auth-routing";
import { SHELL_NAV } from "./shell-nav";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const logado = app.slice(app.indexOf("function ClerkProviderWithRoutes"));

test("RG-M15: pós-login vai para a Visão geral real", () => {
  assert.equal(DEFAULT_AUTH_REDIRECT, SHELL_NAV[0]!.path);
  assert.equal(DEFAULT_ONBOARDING_REDIRECT, SHELL_NAV[0]!.path);
  assert.doesNotMatch(app.slice(app.indexOf("function HomeRedirect"), app.indexOf("function HomeRedirect") + 400), /"\/visao-geral"/);
});

test("RG-M15: app logado não monta telas de protótipo com dados da Lumen", () => {
  for (const pagina of ["VisaoGeralPage", "DirecionamentoPage", "BaselinePage", "HistoricoPage", "SquadsPage", "AprendizadosPage", "BoardPage", "FichaAgentePage"]) {
    assert.doesNotMatch(logado, new RegExp(`component=\\{${pagina}\\}`), pagina);
  }
});
