import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const CONNECTOR_KEY_PREFIX_LABEL = "mck_live";
const PREFIX_BYTES = 6;
const SECRET_BYTES = 24;

export interface GeneratedConnectorApiKey {
  plaintext: string;
  prefix: string;
  keyHash: string;
}
export function generateConnectorApiKey(): GeneratedConnectorApiKey {
  const prefix = randomBytes(PREFIX_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  const plaintext = `${CONNECTOR_KEY_PREFIX_LABEL}_${prefix}_${secret}`;
  return {
    plaintext,
    prefix,
    keyHash: hashConnectorApiKey(plaintext),
  };
}

export function hashConnectorApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function parseConnectorApiKey(
  token: string | undefined | null,
): { prefix: string } | null {
  if (!token) return null;
  const parts = token.trim().split("_");
  if (parts.length !== 4) return null;
  const [scheme, environment, prefix, secret] = parts;
  if (`${scheme}_${environment}` !== CONNECTOR_KEY_PREFIX_LABEL) return null;
  if (!prefix || !secret) return null;
  if (prefix.length !== PREFIX_BYTES * 2 || secret.length !== SECRET_BYTES * 2) {
    return null;
  }
  if (!/^[0-9a-f]+$/.test(prefix) || !/^[0-9a-f]+$/.test(secret)) return null;
  return { prefix };
}

export function connectorApiKeyMatches(
  plaintext: string,
  storedHash: string,
): boolean {
  const presented = Buffer.from(hashConnectorApiKey(plaintext), "hex");
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (presented.length !== stored.length || stored.length === 0) return false;
  return timingSafeEqual(presented, stored);
}
