import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShellProvider } from "@/lib/app-shell";

import LandingPage from "@/pages/landing";
import CommandPage from "@/pages/comando";
import DashboardPage from "@/pages/dashboard";
import AgentsPage from "@/pages/agents";
import AgentDetailPage from "@/pages/agent-detail";
import AdmissionPage from "@/pages/admission";
import ConnectorsPage from "@/pages/connectors";
import AlertsPage from "@/pages/alerts";
import GovernancePage from "@/pages/governanca";
import MetricasPage from "@/pages/metricas";
import BenchmarksPage from "@/pages/benchmarks";
import SettingsPage from "@/pages/configuracoes";
import ProfilePage from "@/pages/perfil";
import OnboardingPage from "@/pages/onboarding";
import NotFound from "@/pages/not-found";
import { isOnboardingComplete } from "@/lib/onboarding";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(158 27% 19%)",
    colorForeground: "hsl(30 15% 15%)",
    colorMutedForeground: "hsl(30 10% 45%)",
    colorDanger: "hsl(0 70% 50%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(40 10% 90%)",
    colorInputForeground: "hsl(30 15% 15%)",
    colorNeutral: "hsl(40 10% 90%)",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden border border-[hsl(40_10%_92%)] shadow-sm",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-semibold tracking-tight text-[hsl(30_15%_15%)]",
    headerSubtitle: "text-sm text-[hsl(30_10%_45%)]",
    socialButtonsBlockButtonText: "text-[hsl(30_15%_15%)] font-medium",
    formFieldLabel: "text-sm font-medium text-[hsl(30_15%_15%)]",
    footerActionLink: "text-[hsl(158_27%_19%)] hover:text-[hsl(158_30%_14%)] font-medium",
    footerActionText: "text-[hsl(30_10%_45%)]",
    dividerText: "text-[hsl(30_10%_45%)] text-xs font-medium uppercase tracking-wider",
    identityPreviewEditButton: "text-[hsl(158_27%_19%)] hover:bg-[hsl(40_15%_94%)]",
    formFieldSuccessText: "text-[hsl(158_27%_19%)] text-sm",
    alertText: "text-[hsl(0_70%_50%)] text-sm",
    logoBox: "h-8 flex items-center justify-center mb-6",
    logoImage: "h-full w-auto",
    socialButtonsBlockButton: "border border-[hsl(40_10%_90%)] hover:bg-[hsl(40_15%_95%)] transition-colors",
    formButtonPrimary: "bg-[hsl(158_27%_19%)] hover:bg-[hsl(158_30%_14%)] text-white shadow-sm transition-colors",
    formFieldInput: "border border-[hsl(40_10%_90%)] rounded-md focus:ring-2 focus:ring-[hsl(158_27%_19%)] focus:border-transparent transition-shadow placeholder:text-[hsl(30_10%_45%)]",
    footerAction: "mt-6",
    dividerLine: "bg-[hsl(40_10%_90%)]",
    alert: "bg-[hsl(0_70%_95%)] border border-[hsl(0_70%_80%)] rounded-md p-3",
    otpCodeFieldInput: "border border-[hsl(40_10%_90%)] focus:ring-2 focus:ring-[hsl(158_27%_19%)]",
    formFieldRow: "mb-4",
    main: "flex flex-col gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/comando" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, user } = useUser();
  if (!isLoaded) return null;
  if (user && !isOnboardingComplete(user.id)) {
    return <Redirect to="/onboarding" />;
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
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Bem-vindo de volta",
            subtitle: "Entre para acessar sua frota",
          },
        },
        signUp: {
          start: {
            title: "Crie sua conta",
            subtitle: "Comece a gerenciar seus agentes hoje",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <AppShellProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/comando">
              <ProtectedRoute component={CommandPage} />
            </Route>
            <Route path="/frota">
              <ProtectedRoute component={DashboardPage} />
            </Route>
            <Route path="/agentes">
              <ProtectedRoute component={AgentsPage} />
            </Route>
            <Route path="/agentes/:id">
              <ProtectedRoute component={AgentDetailPage} />
            </Route>
            <Route path="/admissao">
              <ProtectedRoute component={AdmissionPage} />
            </Route>
            <Route path="/conectores">
              <ProtectedRoute component={ConnectorsPage} />
            </Route>
            <Route path="/alertas">
              <ProtectedRoute component={AlertsPage} />
            </Route>
            <Route path="/governanca">
              <ProtectedRoute component={GovernancePage} />
            </Route>
            <Route path="/metricas">
              <ProtectedRoute component={MetricasPage} />
            </Route>
            <Route path="/benchmarks">
              <ProtectedRoute component={BenchmarksPage} />
            </Route>
            <Route path="/configuracoes">
              <ProtectedRoute component={SettingsPage} />
            </Route>
            <Route path="/perfil">
              <ProtectedRoute component={ProfilePage} />
            </Route>
            <Route path="/onboarding">
              <ProtectedRoute component={OnboardingPage} requireOnboarding={false} />
            </Route>
            
            <Route component={NotFound} />
          </Switch>
          </AppShellProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
