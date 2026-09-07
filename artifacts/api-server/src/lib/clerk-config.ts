type ClerkEnvironment = Partial<Pick<
  NodeJS.ProcessEnv,
  "CLERK_SECRET_KEY" | "CLERK_PUBLISHABLE_KEY"
>>;

export interface ClerkRuntimeConfig {
  secretKey: string;
  publishableKey: string;
}

export function clerkRuntimeConfig(
  environment: ClerkEnvironment = process.env,
): ClerkRuntimeConfig {
  const secretKey = environment.CLERK_SECRET_KEY?.trim();
  const publishableKey = environment.CLERK_PUBLISHABLE_KEY?.trim();
  if (!secretKey || !publishableKey) {
    const missing = [
      !secretKey ? "CLERK_SECRET_KEY" : null,
      !publishableKey ? "CLERK_PUBLISHABLE_KEY" : null,
    ].filter((name): name is string => name !== null);
    throw new Error(
      `Clerk authentication is required. Missing environment variables: ${missing.join(", ")}.`,
    );
  }

  return { secretKey, publishableKey };
}
