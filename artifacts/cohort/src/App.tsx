import { useEffect, useState } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useAuth,
  useUser,
} from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  Switch,
  Route,
  useLocation,
  Router as WouterRouter,
  Redirect,
} from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TenantBootstrapBoundary } from "@/components/tenant-bootstrap";
import { AppShellProvider } from "@/lib/app-shell";
import { LangProvider, useLang } from "@/lib/i18n";
import { AuthShell } from "@/muster/auth/auth-shell";
import { musterClerkAppearance, musterClerkLocalization } from "@/muster/auth/clerk-config";

import LandingPage from "@/pages/landing";
import DesignLabPage from "@/pages/design-lab";
import WorkforceOsLabPage from "@/pages/workforce-os-lab";
import OnboardingPage from "@/pages/onboarding";
import NotFound from "@/pages/not-found";
import { isOnboardingComplete } from "@/lib/onboarding";
import { WORKFORCE_STATIC_PATHS } from "@/lib/workforce-routing";
import VisaoGeralPage from "@/muster/pages/visao-geral";
import DirecionamentoPage from "@/muster/pages/direcionamento";
import BaselinePage from "@/muster/pages/baseline";
import HistoricoPage from "@/muster/pages/historico";
import SquadsPage from "@/muster/pages/squads";
import AprendizadosPage from "@/muster/pages/aprendizados";
import BoardPage from "@/muster/pages/board";
import {
  authFallbackFromLocation,
  authRoute,
  locationWithBrowserSearch,
  onboardingRoute,
  requestedAuthRedirect,
  signedOutSignInPath,
} from "@/lib/auth-routing";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

const clerkAppearance = musterClerkAppearance(basePath);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SignInPage() {
  const [location] = useLocation();
  const authLocation = locationWithBrowserSearch(location, window.location.search);
  const requestedRedirect = requestedAuthRedirect(authLocation);
  return (
    <AuthShell mode="sign-in" homeHref="/" switchHref={authRoute("sign-up", requestedRedirect)}>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}${authRoute("sign-up", requestedRedirect)}`}
        fallbackRedirectUrl={`${basePath}${authFallbackFromLocation(authLocation)}`}
      />
    </AuthShell>
  );
}

function SignUpPage() {
  const [location] = useLocation();
  const authLocation = locationWithBrowserSearch(location, window.location.search);
  const requestedRedirect = requestedAuthRedirect(authLocation);
  return (
    <AuthShell mode="sign-up" homeHref="/" switchHref={authRoute("sign-in", requestedRedirect)}>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}${authRoute("sign-in", requestedRedirect)}`}
        fallbackRedirectUrl={`${basePath}${authFallbackFromLocation(authLocation)}`}
      />
    </AuthShell>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/visao-geral" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

type ApiAuthState = "loading" | "signed-in" | "signed-out";

function ClerkApiAuthBoundary({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [configuredState, setConfiguredState] =
    useState<ApiAuthState>("loading");
  const currentState: ApiAuthState = !isLoaded
    ? "loading"
    : isSignedIn
      ? "signed-in"
      : "signed-out";

  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(isSignedIn ? () => getToken() : null);
    setConfiguredState(isSignedIn ? "signed-in" : "signed-out");
    return () => setAuthTokenGetter(null);
  }, [getToken, isLoaded, isSignedIn]);

  if (!isLoaded || configuredState !== currentState) return null;
  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, user } = useUser();
  const { orgId } = useAuth();
  const [location] = useLocation();
  if (!isLoaded) return null;
  if (user && !isOnboardingComplete(user.id, orgId)) {
    return <Redirect to={onboardingRoute(locationWithBrowserSearch(location, window.location.search))} />;
  }
  return <>{children}</>;
}

function ProtectedRoute({
  component: Component,
  requireOnboarding = true,
}: {
  component: React.ComponentType;
  requireOnboarding?: boolean;
}) {
  return (
    <>
      <Show when="signed-in">
        {requireOnboarding ? (
          <OnboardingGate>
            <Component />
          </OnboardingGate>
        ) : (
          <Component />
        )}
      </Show>
      <Show when="signed-out">
        <SignedOutRedirect />
      </Show>
    </>
  );
}

function SignedOutRedirect() {
  const [location] = useLocation();
  return <Redirect to={signedOutSignInPath(location)} />;
}

function WorkforceOsProductionPage() {
  return <WorkforceOsLabPage labMode={false} />;
}

function ClerkProviderWithRoutes({
  publishableKey,
}: {
  publishableKey: string;
}) {
  const [, setLocation] = useLocation();
  const { lang } = useLang();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={clerkAppearance as never}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={musterClerkLocalization(lang) as never}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkApiAuthBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <TenantBootstrapBoundary>
              <AppShellProvider>
                <Switch>
                  <Route path="/" component={HomeRedirect} />
                  <Route path="/sign-in/*?" component={SignInPage} />
                  <Route path="/sign-up/*?" component={SignUpPage} />

                  <Route path="/visao-geral"><ProtectedRoute component={VisaoGeralPage} /></Route>
                  <Route path="/direcionamento"><ProtectedRoute component={DirecionamentoPage} /></Route>
                  <Route path="/baseline"><ProtectedRoute component={BaselinePage} /></Route>
                  <Route path="/historico"><ProtectedRoute component={HistoricoPage} /></Route>
                  <Route path="/squads"><ProtectedRoute component={SquadsPage} /></Route>
                  <Route path="/aprendizados"><ProtectedRoute component={AprendizadosPage} /></Route>
                  <Route path="/board"><ProtectedRoute component={BoardPage} /></Route>
                  <Route path="/agentes/:id/conectar">
                    <ProtectedRoute component={WorkforceOsProductionPage} />
                  </Route>
                  {WORKFORCE_STATIC_PATHS.map((path) => (
                    <Route key={path} path={path}>
                      <ProtectedRoute component={WorkforceOsProductionPage} />
                    </Route>
                  ))}
                  <Route path="/agentes/:id">
                    <ProtectedRoute component={WorkforceOsProductionPage} />
                  </Route>
                  <Route path="/prototipos/workforce-os">
                    <ProtectedRoute
                      component={WorkforceOsLabPage}
                      requireOnboarding={false}
                    />
                  </Route>
                  <Route path="/prototipos">
                    <ProtectedRoute
                      component={DesignLabPage}
                      requireOnboarding={false}
                    />
                  </Route>
                  <Route path="/onboarding">
                    <ProtectedRoute
                      component={OnboardingPage}
                      requireOnboarding={false}
                    />
                  </Route>

                  <Route component={NotFound} />
                </Switch>
              </AppShellProvider>
            </TenantBootstrapBoundary>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkApiAuthBoundary>
    </ClerkProvider>
  );
}

function MissingClerkConfiguration() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
      <section className="max-w-xl rounded-2xl border border-destructive/40 bg-card p-8 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
          Configuração obrigatória
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Clerk não configurado</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Defina <code>VITE_CLERK_PUBLISHABLE_KEY</code> no ambiente de build e
          reinicie o frontend. O Muster não libera rotas protegidas sem uma
          identidade real.
        </p>
      </section>
    </main>
  );
}

function App() {
  if (!clerkPubKey) return <MissingClerkConfiguration />;
  return (
    <LangProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes publishableKey={clerkPubKey} />
      </WouterRouter>
    </LangProvider>
  );
}

export default App;
