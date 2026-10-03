import { useEffect, useState } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp as ClerkSignUp,
  Show,
  useAuth,
  useUser,
} from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  Switch,
  Route,
  useLocation,
  Router as WouterRouter,
  Redirect,
  Link,
} from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  DatabaseZap,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TenantBootstrapBoundary } from "@/components/tenant-bootstrap";
import { AppShellProvider } from "@/lib/app-shell";
import { LangProvider } from "@/lib/i18n";

import LandingPage from "@/pages/landing";
import DesignLabPage from "@/pages/design-lab";
import WorkforceOsLabPage from "@/pages/workforce-os-lab";
import OnboardingPage from "@/pages/onboarding";
import NotFound from "@/pages/not-found";
import { isOnboardingComplete } from "@/lib/onboarding";
import { MusterMark } from "@/components/logo";
import { WORKFORCE_STATIC_PATHS } from "@/lib/workforce-routing";
import {
  authFallbackFromLocation,
  authRoute,
  locationWithBrowserSearch,
  onboardingRoute,
  requestedAuthRedirect,
  signedOutSignInPath,
} from "@/lib/auth-routing";
import { inviteOnlyEnabled } from "@/lib/invite-only";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
const inviteOnly = inviteOnlyEnabled(import.meta.env.VITE_MUSTER_INVITE_ONLY);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/brand/muster-lockup-on-dark.svg`,
  },
  variables: {
    colorPrimary: "hsl(148 29% 61%)",
    colorForeground: "hsl(43 38% 90%)",
    colorMutedForeground: "hsl(150 8% 57%)",
    colorDanger: "hsl(6 55% 55%)",
    colorBackground: "hsl(158 15% 9%)",
    colorInput: "hsl(156 12% 14%)",
    colorInputForeground: "hsl(43 38% 90%)",
    colorNeutral: "hsl(152 12% 22%)",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-card/95 rounded-3xl w-[480px] max-w-full overflow-hidden border border-primary/20 shadow-[0_32px_100px_hsl(var(--background)/0.72)] backdrop-blur",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle:
      "font-serif text-3xl font-medium tracking-tight !text-foreground",
    headerSubtitle: "text-sm text-muted-foreground",
    socialButtonsBlockButtonText: "!text-foreground font-medium",
    formFieldLabel: "text-sm font-medium !text-foreground",
    footerActionLink: "text-primary hover:text-primary/80 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText:
      "text-muted-foreground text-xs font-medium uppercase tracking-wider",
    identityPreviewEditButton: "text-primary hover:bg-secondary",
    formFieldSuccessText: "text-primary text-sm",
    alertText: "text-destructive text-sm",
    logoBox: "h-11 flex items-center justify-center mb-7",
    logoImage: "h-11 w-auto max-w-[220px]",
    socialButtonsBlockButton:
      "border border-card-border !bg-background/45 hover:!bg-secondary transition-colors !text-foreground",
    formButtonPrimary:
      "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors",
    formFieldInput:
      "!border !border-input !rounded-lg !bg-secondary/55 !text-foreground !caret-primary !opacity-100 focus:!ring-2 focus:!ring-primary focus:!border-transparent transition-shadow placeholder:!text-muted-foreground placeholder:!opacity-100",
    formFieldInputShowPasswordButton:
      "!text-muted-foreground hover:!text-foreground",
    footerAction: "mt-6",
    dividerLine: "bg-card-border",
    alert: "bg-destructive/10 border border-destructive/40 rounded-md p-3",
    otpCodeFieldInput: "border border-input focus:ring-2 focus:ring-primary",
    formFieldRow: "mb-4",
    main: "flex flex-col gap-4",
  },
};

const authProof = [
  { label: "Identidade e propósito", icon: CheckCircle2 },
  { label: "Telemetria e evidência", icon: DatabaseZap },
  { label: "Decisão e auditoria", icon: FileCheck2 },
];

function AuthShell({
  mode,
  children,
}: {
  mode: "sign-in" | "sign-up";
  children: React.ReactNode;
}) {
  const isSignIn = mode === "sign-in";
  const [location] = useLocation();
  const requestedRedirect = requestedAuthRedirect(
    locationWithBrowserSearch(location, window.location.search),
  );
  const existingAccountHref = `${basePath}${authRoute("sign-in", requestedRedirect)}`;
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsl(var(--primary)/0.13),transparent_34rem),radial-gradient(circle_at_88%_92%,hsl(var(--chart-5)/0.08),transparent_28rem)]" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Link
          href={basePath || "/"}
          className="flex items-center gap-2.5"
          aria-label="Muster — voltar à página inicial"
        >
          <MusterMark className="h-7 w-7" />
          <span className="font-serif text-lg font-medium">Muster</span>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            AI Workforce Operations
          </span>
        </Link>
        <Link
          href={basePath || "/"}
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao site
        </Link>
      </header>
      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-76px)] max-w-7xl lg:grid-cols-[1.02fr_.98fr]">
        <section className="hidden flex-col justify-center px-8 pb-16 pr-16 lg:flex">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            Enterprise access · identity-aware
          </p>
          <h1 className="mt-5 max-w-[13ch] font-serif text-5xl font-medium leading-[1.04] tracking-[-0.035em]">
            {isSignIn
              ? "Acesse a camada de gestão da sua força de trabalho de IA."
              : "Comece por um agente. Evolua para uma operação governável."}
          </h1>
          <p className="mt-5 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
            {isSignIn
              ? "Retome a supervisão contínua, revise decisões e acompanhe os compromissos de cada profissional digital."
              : "Conecte uma execução real, estabeleça o contrato de performance e produza a primeira revisão executiva com evidência."}
          </p>
          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            {authProof.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-card-border bg-card/55 p-3"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <strong className="mt-3 block text-[11px] font-medium">
                    {item.label}
                  </strong>
                </div>
              );
            })}
          </div>
          <div className="mt-8 max-w-xl rounded-2xl border border-primary/20 bg-card/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-primary">
                Governance chain
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.08em] text-primary">
                continuous
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 overflow-hidden font-mono text-[9px] text-muted-foreground">
              {["Runtime", "Evidência", "Avaliação", "Decisão", "Board"].map(
                (step, index) => (
                  <div
                    key={step}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <span className="min-w-0 flex-1 rounded-lg border border-card-border bg-background/60 px-2 py-2 text-center">
                      {step}
                    </span>
                    {index < 4 && <span className="text-primary">→</span>}
                  </div>
                ),
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> Sessões
              humanas autenticadas permanecem separadas das credenciais
              operacionais dos agentes.
            </div>
          </div>
        </section>
        <main className="flex items-center justify-center px-4 py-10 sm:px-8 lg:border-l lg:border-primary/15 lg:py-16">
          <div className="w-full max-w-[480px]">
            <div className="mb-5 lg:hidden">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">
                Muster secure access
              </span>
              <p className="mt-2 font-serif text-2xl font-medium">
                {isSignIn
                  ? "Continue de onde sua operação parou."
                  : "Construa uma força de trabalho governável."}
              </p>
            </div>
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              {isSignIn ? (
                <p>
                  Use o mesmo método da criação da conta. Se entrou com Google,
                  continue com Google; se criou uma senha, use o e-mail
                  cadastrado.
                </p>
              ) : (
                <p>
                  Este e-mail já possui uma conta?{" "}
                  <Link
                    href={existingAccountHref}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Entre na conta existente
                  </Link>
                  , em vez de criar outra.
                </p>
              )}
            </div>
            {children}
            <p className="mx-auto mt-5 max-w-md text-center text-[10px] leading-relaxed text-muted-foreground">
              A autenticação protege o acesso humano. Agentes conectados
              utilizam credenciais próprias, limitadas por organização e
              política.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function SignInPage() {
  const [location] = useLocation();
  const authLocation = locationWithBrowserSearch(
    location,
    window.location.search,
  );
  const requestedRedirect = requestedAuthRedirect(authLocation);
  return (
    <AuthShell mode="sign-in">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={
          inviteOnly
            ? undefined
            : `${basePath}${authRoute("sign-up", requestedRedirect)}`
        }
        fallbackRedirectUrl={`${basePath}${authFallbackFromLocation(authLocation)}`}
      />
    </AuthShell>
  );
}

function SignUpPage() {
  const [location] = useLocation();
  const authLocation = locationWithBrowserSearch(
    location,
    window.location.search,
  );
  const requestedRedirect = requestedAuthRedirect(authLocation);
  return (
    <AuthShell mode="sign-up">
      <ClerkSignUp
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
        <Redirect to="/comando" />
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
    return (
      <Redirect
        to={onboardingRoute(
          locationWithBrowserSearch(location, window.location.search),
        )}
      />
    );
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

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={inviteOnly ? undefined : `${basePath}/sign-up`}
      localization={{
        socialButtonsBlockButton: "Continuar com {{provider|titleize}}",
        dividerText: "ou",
        formFieldLabel__emailAddress: "E-mail corporativo",
        formFieldLabel__password: "Senha",
        formFieldInputPlaceholder__emailAddress: "nome@empresa.com",
        formFieldInputPlaceholder__password: "Digite sua senha",
        formFieldInputPlaceholder__signUpPassword: "Crie uma senha segura",
        formButtonPrimary: "Continuar",
        formFieldAction__forgotPassword: "Esqueci minha senha",
        unstable__errors: {
          form_identifier_exists:
            "Este dado já está associado a uma conta. Entre para continuar.",
          form_identifier_exists__email_address:
            "Este e-mail já possui uma conta. Entre para continuar.",
          form_password_or_identifier_incorrect:
            "E-mail ou senha incorretos. Revise os dados ou recupere sua senha.",
        },
        signIn: {
          start: {
            title: "Bem-vindo de volta",
            subtitle: "Acesse sua operação de agentes com segurança",
            actionText: "Ainda não possui uma conta?",
            actionLink: "Iniciar avaliação",
          },
        },
        signUp: {
          start: {
            title: "Inicie sua avaliação",
            subtitle:
              "Estruture o primeiro agente e valide o modelo operacional",
            actionText: "Já possui uma conta?",
            actionLink: "Entrar",
          },
        },
      }}
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
                  {!inviteOnly && (
                    <Route path="/sign-up/*?" component={SignUpPage} />
                  )}

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
