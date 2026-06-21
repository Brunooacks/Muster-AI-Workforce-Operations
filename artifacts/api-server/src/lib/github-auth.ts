import { logger } from "./logger";

// Resolves a GitHub access token for authenticated source imports (private
// repos). Credentials are NEVER hardcoded: we read them either from the
// Replit-managed GitHub connector at request time, or from a GITHUB_TOKEN
// secret as a fallback. Returns null when no credential is available so the
// caller can fall back to the unauthenticated (public-only) path and surface a
// clear "connect GitHub" message.

const CONNECTOR_TIMEOUT_MS = 8_000;

function envToken(): string | null {
  const t =
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    process.env.GITHUB_ACCESS_TOKEN;
  return t && t.trim() ? t.trim() : null;
}

// Fetch the token from the Replit connectors proxy. Mirrors the official
// Replit GitHub integration snippet: tokens are short-lived and resolved fresh
// per request (never cached). All failures degrade to null.
async function connectorToken(): Promise<string | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) return null;

  const xReplitToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!xReplitToken) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECTOR_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=github`,
      {
        headers: {
          Accept: "application/json",
          X_REPLIT_TOKEN: xReplitToken,
        },
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{
        settings?: { access_token?: string; oauth?: { credentials?: { access_token?: string } } };
      }>;
    };
    const settings = data.items?.[0]?.settings;
    const token =
      settings?.access_token ?? settings?.oauth?.credentials?.access_token;
    return token && token.trim() ? token.trim() : null;
  } catch (err) {
    logger.warn({ err }, "Failed to resolve GitHub connector token");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getGitHubAccessToken(): Promise<string | null> {
  const fromConnector = await connectorToken();
  if (fromConnector) return fromConnector;
  return envToken();
}
