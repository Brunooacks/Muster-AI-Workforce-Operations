import { promises as dns } from "node:dns";

const OBSERVATION_FIELDS = "core,basic,metadata,usage,metrics,trace_context";
const MAX_OBSERVATION_LIMIT = 1_000;
const MAX_SCORE_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;

export interface LangfuseCredentialBundleV1 {
  version: 1;
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  environment?: string;
}

export interface LangfuseObservationPage {
  data: unknown[];
  meta?: Record<string, unknown>;
}

export interface LangfuseScorePage {
  data: unknown[];
  meta?: Record<string, unknown>;
}

export type LangfuseConnectionStatus =
  | "connected"
  | "empty_project"
  | "unauthorized"
  | "incompatible"
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "rejected_url";

export interface LangfuseConnectionResult {
  status: LangfuseConnectionStatus;
}

type LookupAddress = { address: string; family: number };
type Lookup = (hostname: string) => Promise<LookupAddress[]>;

export interface LangfusePublicClientOptions {
  fetch?: typeof fetch;
  lookup?: Lookup;
  allowLoopbackHttp?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

class LangfuseRequestError extends Error {
  constructor(
    readonly code: Exclude<LangfuseConnectionStatus, "connected" | "empty_project">,
  ) {
    super(code);
  }
}

export function parseLangfuseCredentialBundle(serialized: string): LangfuseCredentialBundleV1 {
  try {
    const candidate: unknown = JSON.parse(serialized);
    if (!isRecord(candidate) || candidate.version !== 1) {
      throw new Error("invalid");
    }

    if (
      typeof candidate.baseUrl !== "string" ||
      typeof candidate.publicKey !== "string" ||
      typeof candidate.secretKey !== "string" ||
      candidate.publicKey.trim().length === 0 ||
      candidate.secretKey.trim().length === 0 ||
      (candidate.environment !== undefined && typeof candidate.environment !== "string")
    ) {
      throw new Error("invalid");
    }

    return {
      version: 1,
      baseUrl: validateLangfuseBaseUrl(candidate.baseUrl),
      publicKey: candidate.publicKey.trim(),
      secretKey: candidate.secretKey.trim(),
      ...(candidate.environment?.trim() ? { environment: candidate.environment.trim() } : {}),
    };
  } catch {
    throw new Error("Invalid Langfuse credential bundle");
  }
}

export function validateLangfuseBaseUrl(
  raw: string,
  options: Pick<LangfusePublicClientOptions, "allowLoopbackHttp"> = {},
): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid Langfuse URL");
  }

  if (url.username || url.password) {
    throw new Error("Langfuse URL cannot contain credentials");
  }

  const hostname = url.hostname.toLowerCase();
  const isLoopbackHost = isLoopback(hostname);
  if (url.protocol !== "https:" && !(options.allowLoopbackHttp && isLoopbackHost && url.protocol === "http:")) {
    throw new Error("Langfuse URL must use HTTPS");
  }

  if (!url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/$/, "");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export class LangfusePublicClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly lookup: Lookup;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly allowLoopbackHttp: boolean;

  constructor(
    private readonly credentials: LangfuseCredentialBundleV1,
    options: LangfusePublicClientOptions = {},
  ) {
    this.allowLoopbackHttp = options.allowLoopbackHttp ?? false;
    this.baseUrl = validateLangfuseBaseUrl(credentials.baseUrl, {
      allowLoopbackHttp: this.allowLoopbackHttp,
    });
    this.fetchImpl = options.fetch ?? fetch;
    this.lookup = options.lookup ?? defaultLookup;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  async testConnection(now = new Date()): Promise<LangfuseConnectionResult> {
    const fromStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString();
    try {
      const page = await this.listObservations({
        fromStartTime,
        toStartTime: now.toISOString(),
        limit: 1,
      });
      return { status: page.data.length === 0 ? "empty_project" : "connected" };
    } catch (error) {
      if (error instanceof LangfuseRequestError) {
        return { status: error.code };
      }
      return { status: "unavailable" };
    }
  }

  async listObservations(input: {
    fromStartTime: string;
    toStartTime: string;
    limit?: number;
    cursor?: string;
  }): Promise<LangfuseObservationPage> {
    return this.request("/api/public/v2/observations", {
      fromStartTime: input.fromStartTime,
      toStartTime: input.toStartTime,
      limit: String(Math.min(input.limit ?? 100, MAX_OBSERVATION_LIMIT)),
      ...(input.cursor ? { cursor: input.cursor } : {}),
      fields: OBSERVATION_FIELDS,
    });
  }

  async listScores(input: {
    limit?: number;
    page?: number;
    observationId?: string;
  }): Promise<LangfuseScorePage> {
    return this.request("/api/public/v3/scores", {
      limit: String(Math.min(input.limit ?? 100, MAX_SCORE_LIMIT)),
      ...(input.page ? { page: String(input.page) } : {}),
      ...(input.observationId ? { observationId: input.observationId } : {}),
    });
  }

  async queryMetrics(input: { fromStartTime: string; toStartTime: string }): Promise<unknown> {
    return this.request("/api/public/v2/metrics", input);
  }

  private async request<T extends { data?: unknown[] }>(
    path: string,
    query: Record<string, string>,
  ): Promise<T> {
    await this.assertSafeTarget();

    const url = new URL(path.replace(/^\//, ""), `${this.baseUrl}/`);
    url.search = new URLSearchParams(query).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${this.credentials.publicKey}:${this.credentials.secretKey}`).toString("base64")}`,
        },
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        throw new LangfuseRequestError("rejected_url");
      }
      if (response.status === 401 || response.status === 403) {
        throw new LangfuseRequestError("unauthorized");
      }
      if (response.status === 404 || response.status === 405) {
        throw new LangfuseRequestError("incompatible");
      }
      if (response.status === 429) {
        throw new LangfuseRequestError("rate_limited");
      }
      if (!response.ok) {
        throw new LangfuseRequestError("unavailable");
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > this.maxResponseBytes) {
        throw new LangfuseRequestError("unavailable");
      }
      return JSON.parse(await readResponseText(response, this.maxResponseBytes)) as T;
    } catch (error) {
      if (error instanceof LangfuseRequestError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new LangfuseRequestError("timeout");
      }
      throw new LangfuseRequestError("unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async assertSafeTarget(): Promise<void> {
    const hostname = new URL(this.baseUrl).hostname.toLowerCase();
    if (this.allowLoopbackHttp && isLoopback(hostname)) {
      return;
    }
    if (isPrivateAddress(hostname)) {
      throw new LangfuseRequestError("rejected_url");
    }

    let addresses: LookupAddress[];
    try {
      addresses = await this.lookup(hostname);
    } catch {
      throw new LangfuseRequestError("rejected_url");
    }
    if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address.address))) {
      throw new LangfuseRequestError("rejected_url");
    }
  }
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new LangfuseRequestError("unavailable");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function defaultLookup(hostname: string): Promise<LookupAddress[]> {
  return dns.lookup(hostname, { all: true, verbatim: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function isLoopback(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "::1" || normalized.startsWith("127.");
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (isLoopback(normalized) || normalized === "0.0.0.0" || normalized === "::") {
    return true;
  }
  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized) || /^169\.254\./.test(normalized)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(normalized)) {
    return true;
  }
  return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}
