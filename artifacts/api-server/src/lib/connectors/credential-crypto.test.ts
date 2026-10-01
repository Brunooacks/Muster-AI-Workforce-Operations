import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  CONNECTOR_CREDENTIAL_KEY_ENV,
  ConnectorCredentialError,
  LEGACY_MIGRATION_ENV,
  decryptConnectorCredential,
  encryptConnectorCredential,
  isEncryptedConnectorCredential,
  materializeConnectorCredentialForAdapter,
  parseConnectorCredentialEncryptionKey,
} from "./credential-crypto";

const connectorId = "connector_01";

describe("connector credential encryption", () => {
  it("roundtrips AES-256-GCM envelopes with base64 and hex keys", () => {
    const rawKey = randomBytes(32);
    for (const encodedKey of [
      rawKey.toString("base64"),
      rawKey.toString("hex"),
    ]) {
      const key = parseConnectorCredentialEncryptionKey(encodedKey);
      const encrypted = encryptConnectorCredential(
        "github_pat_sensitive",
        connectorId,
        key,
      );

      expect(isEncryptedConnectorCredential(encrypted)).toBe(true);
      expect(encrypted).not.toContain("github_pat_sensitive");
      expect(decryptConnectorCredential(encrypted, connectorId, key)).toBe(
        "github_pat_sensitive",
      );
    }
  });

  it("uses a fresh random nonce for every encryption", () => {
    const key = randomBytes(32);
    const first = encryptConnectorCredential("same-secret", connectorId, key);
    const second = encryptConnectorCredential("same-secret", connectorId, key);

    expect(first).not.toBe(second);
    expect(first.split(":")[2]).not.toBe(second.split(":")[2]);
  });

  it("rejects missing, malformed, and incorrectly-sized keys", () => {
    for (const value of [
      undefined,
      "",
      "not-base64",
      Buffer.alloc(16).toString("base64"),
    ]) {
      expect(() => parseConnectorCredentialEncryptionKey(value)).toThrow(
        ConnectorCredentialError,
      );
    }
  });

  it("detects ciphertext tampering and connector swaps", () => {
    const key = randomBytes(32);
    const encrypted = encryptConnectorCredential("sensitive", connectorId, key);
    const parts = encrypted.split(":");
    const ciphertext = Buffer.from(parts[4]!, "base64url");
    ciphertext[0] = ciphertext[0]! ^ 1;
    parts[4] = ciphertext.toString("base64url");

    expect(() =>
      decryptConnectorCredential(parts.join(":"), connectorId, key),
    ).toThrow(/integridade/);
    expect(() =>
      decryptConnectorCredential(encrypted, "connector_other", key),
    ).toThrow(/integridade/);
  });

  it("blocks plaintext legacy values unless migration is explicitly enabled", async () => {
    const key = randomBytes(32).toString("base64");
    await expect(
      materializeConnectorCredentialForAdapter({
        storedCredential: "legacy-secret",
        connectorId,
        environment: { [CONNECTOR_CREDENTIAL_KEY_ENV]: key },
      }),
    ).rejects.toMatchObject({ code: "connector_legacy_credential_blocked" });
  });

  it("never mistakes an unsupported encrypted envelope for legacy plaintext", async () => {
    const key = randomBytes(32).toString("base64");
    await expect(
      materializeConnectorCredentialForAdapter({
        storedCredential: "mustercred:v2:opaque-envelope",
        connectorId,
        environment: {
          [CONNECTOR_CREDENTIAL_KEY_ENV]: key,
          [LEGACY_MIGRATION_ENV]: "true",
        },
        migrateLegacy: async () => true,
      }),
    ).rejects.toMatchObject({ code: "connector_credential_corrupted" });
  });

  it("migrates plaintext before releasing it to the adapter", async () => {
    const key = randomBytes(32).toString("base64");
    const migrateLegacy = vi.fn(
      async (_encryptedCredential: string): Promise<boolean> => true,
    );
    const plaintext = await materializeConnectorCredentialForAdapter({
      storedCredential: "legacy-secret",
      connectorId,
      environment: {
        [CONNECTOR_CREDENTIAL_KEY_ENV]: key,
        [LEGACY_MIGRATION_ENV]: "true",
      },
      migrateLegacy,
    });

    expect(plaintext).toBe("legacy-secret");
    expect(migrateLegacy).toHaveBeenCalledOnce();
    const persisted = migrateLegacy.mock.calls[0]![0];
    expect(persisted).not.toContain("legacy-secret");
    expect(isEncryptedConnectorCredential(persisted)).toBe(true);
  });
});
