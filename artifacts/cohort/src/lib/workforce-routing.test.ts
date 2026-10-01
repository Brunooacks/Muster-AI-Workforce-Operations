import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFORCE_NAV_ITEMS,
  WORKFORCE_SPECIALIZED_ROUTES,
  WORKFORCE_STATIC_PATHS,
  APP_STATIC_PATHS,
  isKnownAppPath,
  isWorkforceScreen,
  navigationScreenForWorkforceScreen,
  resolveWorkforceRoute,
  routeForWorkforceScreen,
} from "./workforce-routing";

test("cada item do Workforce OS possui rota canônica única", () => {
  const items = [...WORKFORCE_NAV_ITEMS, ...WORKFORCE_SPECIALIZED_ROUTES];
  const paths = items.map((item) => item.path);
  const screens = items.map((item) => item.screen);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(new Set(screens).size, screens.length);
});

test("rotas canônicas resolvem para a tela declarada", () => {
  for (const item of [...WORKFORCE_NAV_ITEMS, ...WORKFORCE_SPECIALIZED_ROUTES]) {
    const resolved = resolveWorkforceRoute(item.path);
    assert.equal(resolved?.screen, item.screen, item.path);
  }
});

test("profissional preserva identidade na URL", () => {
  assert.equal(routeForWorkforceScreen("professional", "vega"), "/agentes/vega");
  assert.equal(
    routeForWorkforceScreen("professional", "agente local/01"),
    "/agentes/agente%20local%2F01",
  );
  assert.deepEqual(resolveWorkforceRoute("/agentes/vega?theme=graphite"), {
    screen: "professional",
    agentId: "vega",
  });
  assert.deepEqual(resolveWorkforceRoute("/agentes/agente%20local%2F01"), {
    screen: "professional",
    agentId: "agente local/01",
  });
});

test("frota e fluxos especializados resolvem dentro do Workforce OS", () => {
  assert.deepEqual(resolveWorkforceRoute("/frota"), { screen: "portfolio" });
  assert.deepEqual(resolveWorkforceRoute("/agentes/sofia/conectar"), {
    screen: "connection",
    agentId: "sofia",
  });
  assert.equal(routeForWorkforceScreen("connection", "agente local/01"), "/agentes/agente%20local%2F01/conectar");
  assert.ok(WORKFORCE_STATIC_PATHS.includes("/frota"));
});

test("parâmetro de protótipo aceita somente telas declaradas", () => {
  assert.equal(isWorkforceScreen("journeys"), true);
  assert.equal(isWorkforceScreen("dashboard-antigo"), false);
  assert.equal(isWorkforceScreen(null), false);
});

test("fluxos especializados mantêm contexto no item principal", () => {
  assert.equal(navigationScreenForWorkforceScreen("admission"), "connectors");
  assert.equal(navigationScreenForWorkforceScreen("connection"), "connectors");
  assert.equal(navigationScreenForWorkforceScreen("alerts"), "today");
  assert.equal(navigationScreenForWorkforceScreen("profile"), "settings");
});

test("Admin Console é uma rota corporativa de primeira classe", () => {
  assert.deepEqual(resolveWorkforceRoute("/admin"), { screen: "admin" });
  assert.equal(routeForWorkforceScreen("admin"), "/admin");
  assert.equal(isKnownAppPath("/admin"), true);
  assert.equal(
    WORKFORCE_NAV_ITEMS.some(
      (item) => item.screen === "admin" && item.group === "Administração",
    ),
    true,
  );
});

test("central de adoção permanece roteável sem ocupar a navegação operacional", () => {
  assert.equal(WORKFORCE_NAV_ITEMS.some((item) => item.screen === "onboarding"), false);
  assert.equal(
    WORKFORCE_SPECIALIZED_ROUTES.some((item) => item.screen === "onboarding" && item.path === "/guia"),
    true,
  );
  assert.deepEqual(resolveWorkforceRoute("/guia/novidades"), { screen: "onboarding" });
  assert.deepEqual(resolveWorkforceRoute("/guia/radar"), { screen: "onboarding" });
  assert.equal(isKnownAppPath("/guia/novidades"), true);
  assert.equal(isKnownAppPath("/guia/radar"), true);
});

test("catálogo reconhece apenas destinos internos registrados", () => {
  for (const path of APP_STATIC_PATHS) assert.equal(isKnownAppPath(path), true, path);
  assert.equal(isKnownAppPath("/agentes/vega"), true);
  assert.equal(isKnownAppPath("/agentes/vega/conectar?step=telemetry"), true);
  assert.equal(isKnownAppPath("/sign-in/factor-one"), true);
  assert.equal(isKnownAppPath("/rota-inexistente"), false);
  assert.equal(isKnownAppPath("https://example.com"), false);
  assert.equal(isKnownAppPath("//example.com"), false);
});
