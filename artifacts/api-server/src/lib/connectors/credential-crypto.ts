import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ENVELOPE_PREFIX = "mustercred:v1";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const HEX_KEY = /^[0-9a-fA-F]{64}$/;
const BASE64_KEY = /^[A-Za-z0-9+/]{43}=$/;

export const CONNECTOR_CREDENTIAL_KEY_ENV = "MUSTER_CREDENTIAL_ENCRYPTION_KEY";
export const LEGACY_MIGRATION_ENV = "MUSTER_ALLOW_LEGACY_CREDENTIAL_MIGRATION";

export type ConnectorCredentialErrorCode =
  | "connector_encryption_key_missing"
  | "connector_encryption_key_invalid"
  | "connector_credential_corrupted"
  | "connector_legacy_credential_blocked"
  | "connector_legacy_migration_failed";

export class ConnectorCredentialError extends Error {
  constructor(
    public readonly code: ConnectorCredentialErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConnectorCredentialError";
  }
}

export function parseConnectorCredentialEncryptionKey(
  value: string | undefined,
): Buffer {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ConnectorCredentialError(
      "connector_encryption_key_missing",
      `${CONNECTOR_CREDENTIAL_KEY_ENV} não está configurada. Defina uma chave de 32 bytes em base64 ou 64 caracteres hexadecimais antes de gravar credenciais de conectores.`,
    );
  }

  let key: Buffer;
  if (HEX_KEY.test(normalized)) {
    key = Buffer.from(normalized, "hex");
  } else if (BASE64_KEY.test(normalized)) {
    key = Buffer.from(normalized, "base64");
  } else {
    throw invalidKeyError();
  }

  if (key.length !== KEY_BYTES) {
    throw invalidKeyError();
  }
  return key;
}

export function connectorCredentialEncryptionKey(
  environment: NodeJS.ProcessEnv = process.env,
): Buffer {
  return parseConnectorCredentialEncryptionKey(
    environment[CONNECTOR_CREDENTIAL_KEY_ENV],
  );
}

export function encryptConnectorCredential(
  plaintext: string,
  connectorId: string,
  key: Buffer,
): string {
  assertKeyBuffer(key);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(aad(connectorId));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    nonce.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptConnectorCredential(
  envelope: string,
  connectorId: string,
  key: Buffer,
): string {
  assertKeyBuffer(key);
  const parts = envelope.split(":");
  if (
    parts.length !== 5 ||
    `${parts[0]}:${parts[1]}` !== ENVELOPE_PREFIX ||
    !parts[2] ||
    !parts[3] ||
    parts[4] == null
  ) {
    throw corruptedCredentialError();
  }

  try {
    const nonce = decodeBase64Url(parts[2], NONCE_BYTES);
    const authTag = decodeBase64Url(parts[3], AUTH_TAG_BYTES);
    const ciphertext = decodeBase64Url(parts[4]);
    const decipher = createDecipheriv(ALGORITHM, key, nonce, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(aad(connectorId));
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw corruptedCredentialError();
  }
}

export function isEncryptedConnectorCredential(value: string): boolean {
  return value.startsWith(`${ENVELOPE_PREFIX}:`);
}

interface MaterializeCredentialOptions {
  storedCredential: string | null | undefined;
  connectorId: string;
  environment?: NodeJS.ProcessEnv;
  migrateLegacy?: (encryptedCredential: string) => Promise<boolean>;
}

export async function materializeConnectorCredentialForAdapter({
  storedCredential,
  connectorId,
  environment = process.env,
  migrateLegacy,
}: MaterializeCredentialOptions): Promise<string | null> {
  if (storedCredential == null) return null;

  const key = connectorCredentialEncryptionKey(environment);
  if (isEncryptedConnectorCredential(storedCredential)) {
    return decryptConnectorCredential(storedCredential, connectorId, key);
  }
  if (storedCredential.startsWith("mustercred:")) {
    throw corruptedCredentialError();
  }

  if (environment[LEGACY_MIGRATION_ENV] !== "true" || !migrateLegacy) {
    throw new ConnectorCredentialError(
      "connector_legacy_credential_blocked",
      `Uma credencial legada em texto puro foi detectada e seu uso foi bloqueado. Defina ${LEGACY_MIGRATION_ENV}=true temporariamente para migrá-la no próximo uso e volte a flag para false em seguida.`,
    );
  }

  const encryptedCredential = encryptConnectorCredential(
    storedCredential,
    connectorId,
    key,
  );
  const migrated = await migrateLegacy(encryptedCredential);
  if (!migrated) {
    throw new ConnectorCredentialError(
      "connector_legacy_migration_failed",
      "A migração da credencial legada não foi confirmada; o conector permaneceu bloqueado.",
    );
  }
  return storedCredential;
}

function aad(connectorId: string): Buffer {
  return Buffer.from(`${ENVELOPE_PREFIX}:${connectorId}`, "utf8");
}

function decodeBase64Url(value: string, expectedBytes?: number): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw corruptedCredentialError();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw corruptedCredentialError();
  if (expectedBytes != null && decoded.length !== expectedBytes) {
    throw corruptedCredentialError();
  }
  return decoded;
}

function assertKeyBuffer(key: Buffer): void {
  if (key.length !== KEY_BYTES) throw invalidKeyError();
}

function invalidKeyError(): ConnectorCredentialError {
  return new ConnectorCredentialError(
    "connector_encryption_key_invalid",
    `${CONNECTOR_CREDENTIAL_KEY_ENV} deve conter exatamente 32 bytes codificados em base64 ou 64 caracteres hexadecimais. Gere uma chave com: openssl rand -base64 32`,
  );
}

function corruptedCredentialError(): ConnectorCredentialError {
  return new ConnectorCredentialError(
    "connector_credential_corrupted",
    "A credencial armazenada do conector falhou na verificação de integridade. Rotacione a credencial antes de reutilizar o conector.",
  );
}
