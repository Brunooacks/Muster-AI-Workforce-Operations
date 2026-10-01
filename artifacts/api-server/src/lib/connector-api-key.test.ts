import { describe, expect, it } from "vitest";
import {
  connectorApiKeyMatches,
  generateConnectorApiKey,
  hashConnectorApiKey,
  parseConnectorApiKey,
} from "./connector-api-key";

describe("connector ingestion API keys", () => {
  it("generates a parseable key and only persists its hash", () => {
    const key = generateConnectorApiKey();
    expect(key.plaintext).toMatch(/^mck_live_[0-9a-f]{12}_[0-9a-f]{48}$/);
    expect(parseConnectorApiKey(key.plaintext)).toEqual({ prefix: key.prefix });
    expect(key.keyHash).toBe(hashConnectorApiKey(key.plaintext));
    expect(key.keyHash).not.toContain(key.plaintext);
  });

  it("rejects malformed and mismatched keys", () => {
    const key = generateConnectorApiKey();
    const other = generateConnectorApiKey();
    expect(parseConnectorApiKey("Bearer invalid")).toBeNull();
    expect(parseConnectorApiKey(key.plaintext.slice(0, -1))).toBeNull();
    expect(connectorApiKeyMatches(key.plaintext, key.keyHash)).toBe(true);
    expect(connectorApiKeyMatches(other.plaintext, key.keyHash)).toBe(false);
  });
});
