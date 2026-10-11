import {
  FetchSourceError,
  assertResolvedHostSafe,
  isBlockedHostname,
} from "../../fetch-source";

const DEFAULT_BASE_URL = "https://cloud.langfuse.com";
const OFFICIAL_HOSTS = new Set([
  "cloud.langfuse.com",
  "us.cloud.langfuse.com",
  "jp.cloud.langfuse.com",
  "hipaa.cloud.langfuse.com",
]);

export interface LangfuseCredential {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
}

export class LangfuseCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LangfuseCredentialError";
  }
}

export async function parseLangfuseCredential(
  token: string | null,
): Promise<LangfuseCredential> {
  if (!token?.trim()) {
    throw new LangfuseCredentialError("Informe as chaves do Langfuse.");
  }

  let value: unknown;
  try {
    value = JSON.parse(token);
  } catch {
    throw new LangfuseCredentialError("A credencial do Langfuse não é um JSON válido.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LangfuseCredentialError("A credencial do Langfuse tem formato inválido.");
  }

  const { publicKey, secretKey, baseUrl = DEFAULT_BASE_URL } = value as Record<string, unknown>;
  if (typeof publicKey !== "string" || !publicKey.startsWith("pk-lf-")) {
    throw new LangfuseCredentialError("A chave pública do Langfuse deve começar com pk-lf-.");
  }
  if (typeof secretKey !== "string" || !secretKey.startsWith("sk-lf-")) {
    throw new LangfuseCredentialError("A chave secreta do Langfuse deve começar com sk-lf-.");
  }
  if (typeof baseUrl !== "string") {
    throw new LangfuseCredentialError("A URL base do Langfuse é inválida.");
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl.trim());
  } catch {
    throw new LangfuseCredentialError("A URL base do Langfuse é inválida.");
  }
  if (parsedBaseUrl.protocol !== "https:") {
    throw new LangfuseCredentialError("A URL base do Langfuse deve usar HTTPS.");
  }
  const hostname = parsedBaseUrl.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname) || isBlockedIpv4MappedIpv6(hostname)) {
    throw new LangfuseCredentialError("Esse endereço não é permitido.");
  }

  if (!OFFICIAL_HOSTS.has(hostname.toLowerCase())) {
    try {
      await assertResolvedHostSafe(hostname);
    } catch (error) {
      if (error instanceof FetchSourceError) {
        throw new LangfuseCredentialError(error.message);
      }
      throw error;
    }
  }

  return {
    publicKey: publicKey.trim(),
    secretKey: secretKey.trim(),
    baseUrl: parsedBaseUrl.toString().replace(/\/$/, ""),
  };
}

function isBlockedIpv4MappedIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (!normalized.startsWith("::ffff:")) return false;
  const mapped = normalized.slice("::ffff:".length);
  if (mapped.includes(".")) return isBlockedHostname(mapped);

  const groups = mapped.split(":");
  if (groups.length !== 2) return false;
  const high = Number.parseInt(groups[0]!, 16);
  const low = Number.parseInt(groups[1]!, 16);
  if (!Number.isInteger(high) || !Number.isInteger(low) || high > 0xffff || low > 0xffff) {
    return false;
  }
  const ipv4 = `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  return isBlockedHostname(ipv4);
}
