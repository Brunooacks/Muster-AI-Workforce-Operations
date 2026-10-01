import { OrganizationSwitcher, useAuth, useClerk } from "@clerk/react";
import { syncActiveOrganization } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  createTenantScopeKey,
  hasTenantScopeChanged,
} from "@/lib/tenant-scope";

type BootstrapStatus = "idle" | "syncing" | "ready" | "error";

interface BootstrapState {
  scopeKey: string | null;
  status: BootstrapStatus;
  error: string | null;
}

const initialState: BootstrapState = {
  scopeKey: null,
  status: "idle",
  error: null,
};

export function TenantBootstrapBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, orgId } = useAuth();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [state, setState] = useState<BootstrapState>(initialState);
  const runIdRef = useRef(0);
  const previousScopeKeyRef = useRef<string | null | undefined>(undefined);
  const scopeKey = createTenantScopeKey(userId, orgId);

  useEffect(() => {
    if (!isLoaded) return;

    const runId = ++runIdRef.current;
    const controller = new AbortController();
    const isCurrentRun = () =>
      runIdRef.current === runId && !controller.signal.aborted;

    setState({
      scopeKey,
      status: scopeKey && isSignedIn ? "syncing" : "idle",
      error: null,
    });

    void (async () => {
      if (hasTenantScopeChanged(previousScopeKeyRef.current, scopeKey)) {
        await queryClient.cancelQueries();
        if (!isCurrentRun()) return;

        queryClient.clear();
        previousScopeKeyRef.current = scopeKey;
      }

      if (!isSignedIn || !userId || !orgId || !scopeKey) return;

      try {
        await syncActiveOrganization({ signal: controller.signal });
        if (!isCurrentRun()) return;

        setState({ scopeKey, status: "ready", error: null });
      } catch (error) {
        if (!isCurrentRun()) return;

        setState({
          scopeKey,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível preparar a organização ativa.",
        });
      }
    })();

    return () => controller.abort();
  }, [
    isLoaded,
    isSignedIn,
    orgId,
    queryClient,
    retryAttempt,
    scopeKey,
    userId,
  ]);

  if (!isLoaded) return <TenantLoadingState />;
  if (!isSignedIn) return <>{children}</>;

  if (!userId) {
    return (
      <TenantErrorState
        message="A sessão foi autenticada, mas o identificador do usuário não está disponível."
        onRetry={() => setRetryAttempt((attempt) => attempt + 1)}
      />
    );
  }

  if (!orgId || !scopeKey) {
    return (
      <TenantStateCard
        icon={<Building2 className="h-5 w-5" />}
        eyebrow="Organização necessária"
        title="Escolha onde você vai operar"
        description="Selecione ou crie uma organização. O Muster separa agentes, métricas, jornadas e decisões por tenant."
      >
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <OrganizationSwitcher hidePersonal skipInvitationScreen />
          <Button
            variant="ghost"
            onClick={() =>
              signOut({ redirectUrl: import.meta.env.BASE_URL || "/" })
            }
          >
            <LogOut className="mr-2 h-4 w-4" />
            Trocar conta
          </Button>
        </div>
      </TenantStateCard>
    );
  }

  if (
    state.scopeKey !== scopeKey ||
    state.status === "idle" ||
    state.status === "syncing"
  ) {
    return <TenantLoadingState />;
  }

  if (state.status === "error") {
    return (
      <TenantErrorState
        message={
          state.error ?? "Não foi possível preparar a organização ativa."
        }
        onRetry={() => setRetryAttempt((attempt) => attempt + 1)}
      />
    );
  }

  return <>{children}</>;
}

function TenantLoadingState() {
  return (
    <TenantStateCard
      icon={<Loader2 className="h-5 w-5 animate-spin" />}
      eyebrow="Preparando ambiente"
      title="Sincronizando sua organização"
      description="Validando vínculo, provisionando o tenant e isolando os dados antes de abrir o painel."
    />
  );
}

function TenantErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <TenantStateCard
      icon={<ShieldCheck className="h-5 w-5" />}
      eyebrow="Bootstrap interrompido"
      title="Não foi possível liberar este tenant"
      description={message}
    >
      <Button onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Tentar novamente
      </Button>
    </TenantStateCard>
  );
}

function TenantStateCard({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-xl rounded-2xl border border-card-border bg-card p-8 shadow-lg">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          {icon}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-serif text-2xl font-medium tracking-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {children ? <div className="mt-6">{children}</div> : null}
      </section>
    </main>
  );
}
