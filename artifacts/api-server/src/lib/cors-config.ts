type CorsEnvironment = Partial<Pick<
  NodeJS.ProcessEnv,
  "NODE_ENV" | "WEB_APP_URL" | "CORS_ALLOWED_ORIGINS"
>>;

function normalizeOrigin(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported CORS origin protocol: ${url.protocol}`);
  }
  return url.origin;
}

export function allowedCorsOrigins(
  environment: CorsEnvironment = process.env,
): string[] {
  const configured = environment.CORS_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
  const candidates = [
    environment.WEB_APP_URL?.trim(),
    ...configured,
    ...(environment.NODE_ENV === "development"
      ? ["http://localhost:5173", "http://127.0.0.1:5173"]
      : []),
  ].filter((origin): origin is string => Boolean(origin));

  return [...new Set(candidates.map(normalizeOrigin))];
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  return origin === undefined || allowedOrigins.includes(origin);
}
