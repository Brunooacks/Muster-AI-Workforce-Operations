import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AUTH_REDIRECT,
  DEFAULT_ONBOARDING_REDIRECT,
  authFallbackFromLocation,
  authRoute,
  locationWithBrowserSearch,
  onboardingFallbackFromLocation,
  onboardingRoute,
  requestedAuthRedirect,
  safeInternalRedirect,
  signedOutSignInPath,
} from "./auth-routing";

test("recompõe a query que o roteador omite da localização", () => {
  assert.equal(
    locationWithBrowserSearch("/sign-up", "?redirect_url=%2Fjornadas"),
    "/sign-up?redirect_url=%2Fjornadas",
  );
  assert.equal(locationWithBrowserSearch("/sign-in", ""), "/sign-in");
});

test("rotas protegidas preservam o destino no login", () => {
  assert.equal(
    signedOutSignInPath("/jornadas#journey-performance"),
    "/sign-in?redirect_url=%2Fjornadas%23journey-performance",
  );
  assert.equal(
    requestedAuthRedirect("/sign-in?redirect_url=%2Fmetricas"),
    "/metricas",
  );
  assert.equal(
    authFallbackFromLocation("/sign-in?redirect_url=%2Fagentes%2Fvega"),
    "/agentes/vega",
  );
});

test("redirecionamento de autenticação rejeita destinos externos e loops", () => {
  assert.equal(safeInternalRedirect("https://example.com"), null);
  assert.equal(safeInternalRedirect("//example.com"), null);
  assert.equal(safeInternalRedirect("/sign-in"), null);
  assert.equal(safeInternalRedirect("/sign-up/verify"), null);
  assert.equal(authRoute("sign-in", "https://example.com"), "/sign-in");
  assert.equal(authFallbackFromLocation("/sign-in?redirect_url=https://example.com"), DEFAULT_AUTH_REDIRECT);
});

test("onboarding preserva a rota protegida sem permitir loops", () => {
  assert.equal(onboardingRoute("/equipes?view=active"), "/onboarding?redirect_url=%2Fequipes%3Fview%3Dactive");
  assert.equal(onboardingFallbackFromLocation("/onboarding?redirect_url=%2Fequipes"), "/equipes");
  assert.equal(onboardingRoute("/onboarding"), "/onboarding");
  assert.equal(
    onboardingFallbackFromLocation("/onboarding?redirect_url=%2Fonboarding"),
    DEFAULT_ONBOARDING_REDIRECT,
  );
});
