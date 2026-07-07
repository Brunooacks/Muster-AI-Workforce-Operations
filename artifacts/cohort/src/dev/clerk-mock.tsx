/**
 * Dev-mode mock of `@clerk/react` (and `@clerk/react/internal`).
 *
 * NEVER imported directly by app code. It is swapped in for the real package
 * by a Vite alias in vite.config.ts, only when `VITE_AUTH_DEV_BYPASS=true`
 * (see .env.example). This lets the app run fully signed-in on localhost
 * without a Clerk project — pair it with `AUTH_DEV_BYPASS=true` on the API.
 *
 * Only the symbols the app actually uses are implemented:
 * ClerkProvider, Show, SignIn, SignUp, useUser, useClerk,
 * publishableKeyFromHost (from /internal).
 */
import type { ReactNode } from "react";

const DEV_USER = {
  id: "dev-user",
  fullName: "Dev User",
  firstName: "Dev",
  lastName: "User",
  imageUrl: "",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  primaryEmailAddress: { emailAddress: "dev@localhost" },
};

export function ClerkProvider({
  children,
}: {
  children: ReactNode;
  [key: string]: unknown;
}) {
  return <>{children}</>;
}

/** Dev mode is always signed-in. */
export function Show({
  when,
  children,
}: {
  when: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return when === "signed-in" ? <>{children}</> : null;
}

function DevAuthNotice({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {label} desabilitado — modo <strong>AUTH_DEV_BYPASS</strong> ativo.
        Você já está autenticado como <strong>Dev User</strong>.
      </p>
      <a href="/comando" className="mt-3 inline-block text-sm font-medium underline">
        Ir para o Comando →
      </a>
    </div>
  );
}

export function SignIn(_props: Record<string, unknown>) {
  return <DevAuthNotice label="Sign-in" />;
}

export function SignUp(_props: Record<string, unknown>) {
  return <DevAuthNotice label="Sign-up" />;
}

export function useUser() {
  return { isLoaded: true, isSignedIn: true, user: DEV_USER } as const;
}

export function useClerk() {
  return {
    // App listens for user changes to clear the query cache — never fires in dev.
    addListener: (_cb: (payload: { user: typeof DEV_USER | null }) => void) => {
      return () => {};
    },
    signOut: async (opts?: { redirectUrl?: string }) => {
      window.location.href = opts?.redirectUrl || "/";
    },
  };
}

/** Mirror of `@clerk/react/internal`'s helper — any non-empty key satisfies App.tsx. */
export function publishableKeyFromHost(
  _host: string,
  fallback?: string,
): string {
  return fallback || "pk_test_dev-bypass";
}
