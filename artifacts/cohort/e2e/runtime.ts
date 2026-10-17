const DEFAULT_E2E_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5443/muster";

export interface ClerkE2EEnvironment {
  publishableKey: string;
  secretKey: string;
  userEmail: string;
  organizationName: string;
}

function required(environment: NodeJS.ProcessEnv, name: string): string | null {
  const value = environment[name]?.trim();
  return value ? value : null;
}

/**
 * Usa nomes específicos de teste para impedir, inclusive no CI, que uma chave
 * de produção seja conectada acidentalmente à suíte descartável.
 */
export function clerkE2EEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ClerkE2EEnvironment {
  const publishableKey = required(environment, "CLERK_TEST_PUBLISHABLE_KEY");
  const secretKey = required(environment, "CLERK_TEST_SECRET_KEY");
  const userEmail = required(environment, "E2E_CLERK_USER_EMAIL");
  const organizationName = required(environment, "E2E_CLERK_ORG_NAME");
  const missing = [
    !publishableKey ? "CLERK_TEST_PUBLISHABLE_KEY" : null,
    !secretKey ? "CLERK_TEST_SECRET_KEY" : null,
    !userEmail ? "E2E_CLERK_USER_EMAIL" : null,
    !organizationName ? "E2E_CLERK_ORG_NAME" : null,
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new Error(
      `E2E autenticado requer variáveis de teste: ${missing.join(", ")}. ` +
        "Use somente uma instância Clerk de desenvolvimento/teste; valores não são lidos de .env.",
    );
  }
  if (!publishableKey.startsWith("pk_test_")) {
    throw new Error("CLERK_TEST_PUBLISHABLE_KEY deve ser uma chave Clerk pk_test_.");
  }
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("CLERK_TEST_SECRET_KEY deve ser uma chave Clerk sk_test_.");
  }
  if (!userEmail.includes("+clerk_test@")) {
    throw new Error(
      "E2E_CLERK_USER_EMAIL deve ser um e-mail de teste Clerk contendo +clerk_test@.",
    );
  }

  return { publishableKey, secretKey, userEmail, organizationName };
}

export function e2eDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.E2E_DATABASE_URL?.trim() || DEFAULT_E2E_DATABASE_URL;
}

export function isAuthenticatedPlaywrightRun(argv = process.argv): boolean {
  const projects = argv
    .flatMap((argument, index) => {
      if (argument.startsWith("--project=")) return [argument.slice("--project=".length)];
      if (argument === "--project") return [argv[index + 1] ?? ""];
      return [];
    })
    .filter(Boolean);

  return (
    projects.length === 0 ||
    projects.includes("authenticated-chromium") ||
    projects.includes("clerk-setup")
  );
}

export function applyClerkTestingEnvironment(environment = clerkE2EEnvironment()): void {
  // @clerk/testing lê estes nomes internamente para emitir o testing token e o
  // ticket de login. Eles vivem apenas no processo efêmero do Playwright.
  process.env.CLERK_PUBLISHABLE_KEY = environment.publishableKey;
  process.env.CLERK_SECRET_KEY = environment.secretKey;
}

export function scopedTestEmail(baseEmail: string, runId: string): string {
  const at = baseEmail.lastIndexOf("@");
  if (at < 1) throw new Error("E2E_CLERK_USER_EMAIL não é um e-mail válido.");
  return `${baseEmail.slice(0, at)}+muster-e2e-${runId}@${baseEmail.slice(at + 1)}`;
}
