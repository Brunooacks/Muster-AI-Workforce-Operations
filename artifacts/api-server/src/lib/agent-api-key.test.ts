import { describe, expect, it } from "vitest";
import {
  AGENT_KEY_PREFIX_LABEL,
  agentApiKeyMatches,
  bearerFrom,
  generateAgentApiKey,
  hashAgentApiKey,
  maskAgentApiKey,
  parseAgentApiKey,
} from "./agent-api-key";

describe("generateAgentApiKey", () => {
  it("produces a prefixed token whose hash is stored, not the token", () => {
    const key = generateAgentApiKey();
    expect(key.plaintext.startsWith(`${AGENT_KEY_PREFIX_LABEL}_`)).toBe(true);
    expect(key.plaintext).toContain(key.prefix);
    // the hash must not be derivable by reading it — different value, fixed width
    expect(key.keyHash).toHaveLength(64);
    expect(key.keyHash).not.toContain(key.plaintext);
    expect(key.keyHash).toBe(hashAgentApiKey(key.plaintext));
  });

  it("never repeats a token or a prefix", () => {
    const keys = Array.from({ length: 200 }, () => generateAgentApiKey());
    expect(new Set(keys.map((k) => k.plaintext)).size).toBe(200);
    expect(new Set(keys.map((k) => k.prefix)).size).toBe(200);
  });
});

describe("parseAgentApiKey", () => {
  it("extracts the public prefix from a valid token", () => {
    const key = generateAgentApiKey();
    expect(parseAgentApiKey(key.plaintext)).toEqual({ prefix: key.prefix });
  });

  it("rejects anything that is not a well-formed agent key", () => {
    const key = generateAgentApiKey();
    for (const bad of [
      undefined,
      null,
      "",
      "   ",
      "sk_live_deadbeef_cafe",
      "msk_test_" + key.prefix + "_" + "a".repeat(48),
      "msk_live_short_" + "a".repeat(48),
      `msk_live_${key.prefix}_tooshort`,
      `msk_live_${key.prefix}`,
      `msk_live_${"Z".repeat(12)}_${"a".repeat(48)}`, // non-hex
      key.plaintext + "_extra",
    ]) {
      expect(parseAgentApiKey(bad as string | undefined)).toBeNull();
    }
  });

  it("tolerates surrounding whitespace", () => {
    const key = generateAgentApiKey();
    expect(parseAgentApiKey(`  ${key.plaintext}  `)).toEqual({ prefix: key.prefix });
  });
});

describe("bearerFrom", () => {
  it("reads the token from an Authorization header", () => {
    expect(bearerFrom("Bearer abc123")).toBe("abc123");
    expect(bearerFrom("bearer   abc123  ")).toBe("abc123");
  });

  it("returns null when there is no usable bearer token", () => {
    expect(bearerFrom(undefined)).toBeNull();
    expect(bearerFrom("")).toBeNull();
    expect(bearerFrom("Basic abc123")).toBeNull();
    expect(bearerFrom("Bearer")).toBeNull();
    expect(bearerFrom("Bearer    ")).toBeNull();
  });
});

describe("agentApiKeyMatches", () => {
  it("accepts the exact token and rejects every variation", () => {
    const key = generateAgentApiKey();
    expect(agentApiKeyMatches(key.plaintext, key.keyHash)).toBe(true);

    const other = generateAgentApiKey();
    expect(agentApiKeyMatches(other.plaintext, key.keyHash)).toBe(false);
    expect(agentApiKeyMatches(key.plaintext.slice(0, -1), key.keyHash)).toBe(false);
    expect(agentApiKeyMatches(key.plaintext.toUpperCase(), key.keyHash)).toBe(false);
  });

  it("never throws on malformed stored hashes", () => {
    const key = generateAgentApiKey();
    for (const badHash of ["", "zzz", "abc", key.keyHash.slice(0, 32)]) {
      expect(agentApiKeyMatches(key.plaintext, badHash)).toBe(false);
    }
  });
});

describe("maskAgentApiKey", () => {
  it("shows the prefix and hides the secret", () => {
    const key = generateAgentApiKey();
    const masked = maskAgentApiKey(key.prefix);
    expect(masked).toContain(key.prefix);
    expect(masked).not.toContain(key.plaintext.split("_")[3]!);
  });
});
