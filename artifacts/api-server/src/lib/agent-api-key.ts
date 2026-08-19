import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Agent API keys (R7 · gauntlet rodada 3) — the credential a RUNNING agent uses
 * to report telemetry. Deliberately separate from the human session: an agent
 * deployed in the customer's infrastructure must never carry a user session.
 *
 * Shape: `msk_live_<prefix>_<secret>`
 *  - `msk_live_` marks the token in logs, secret scanners and support tickets.
 *  - `prefix` is public and indexed — it turns validation into one indexed
 *    lookup instead of a table scan comparing every hash.
 *  - `secret` is the only sensitive part. Only its SHA-256 is persisted, so a
 *    database dump cannot be replayed against the ingest endpoint.
 *
 * Everything here is pure: no database, no clock, no env. That keeps the
 * security-critical logic unit-testable in isolation.
 */

export const AGENT_KEY_PREFIX_LABEL = "msk_live";
const PREFIX_BYTES = 6; // 12 hex chars — public, non-secret
const SECRET_BYTES = 24; // 48 hex chars — the actual secret

export interface GeneratedAgentApiKey {
  /** Full token, shown to the human exactly once and never persisted. */
  plaintext: string;
  /** Public lookup handle, safe to store and display. */
  prefix: string;
  /** SHA-256 of the full token — what goes to the database. */
  keyHash: string;
}

export function generateAgentApiKey(): GeneratedAgentApiKey {
  const prefix = randomBytes(PREFIX_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  const plaintext = `${AGENT_KEY_PREFIX_LABEL}_${prefix}_${secret}`;
  return { plaintext, prefix, keyHash: hashAgentApiKey(plaintext) };
}

export function hashAgentApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/**
 * Extracts the public prefix from a token without trusting its shape. Returns
 * null for anything that is not a well-formed Muster agent key, so callers
 * never run a lookup on garbage.
 */
export function parseAgentApiKey(
  token: string | undefined | null,
): { prefix: string } | null {
  if (!token) return null;
  const parts = token.trim().split("_");
  // ["msk", "live", prefix, secret]
  if (parts.length !== 4) return null;
  const [scheme, env, prefix, secret] = parts;
  if (`${scheme}_${env}` !== AGENT_KEY_PREFIX_LABEL) return null;
  if (!prefix || !secret) return null;
  if (prefix.length !== PREFIX_BYTES * 2 || secret.length !== SECRET_BYTES * 2) return null;
  if (!/^[0-9a-f]+$/.test(prefix) || !/^[0-9a-f]+$/.test(secret)) return null;
  return { prefix };
}

/** Reads a bearer token from an Authorization header value. */
export function bearerFrom(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/**
 * Constant-time comparison of the presented token against the stored hash.
 * Timing-safe on purpose: a byte-by-byte early return would leak the hash one
 * character at a time to an attacker measuring response time.
 */
export function agentApiKeyMatches(plaintext: string, storedHash: string): boolean {
  const presented = Buffer.from(hashAgentApiKey(plaintext), "hex");
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (presented.length !== stored.length || stored.length === 0) return false;
  return timingSafeEqual(presented, stored);
}

/** Display form for UIs and logs — never reveals the secret. */
export function maskAgentApiKey(prefix: string): string {
  return `${AGENT_KEY_PREFIX_LABEL}_${prefix}_${"•".repeat(8)}`;
}
