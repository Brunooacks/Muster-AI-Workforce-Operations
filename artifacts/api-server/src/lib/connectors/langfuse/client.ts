import dns from "node:dns/promises";
import https from "node:https";
import type { LookupFunction } from "node:net";
import type { LangfuseCredential } from "./credential";
import { isOfficialLangfuseHost } from "./credential";
import { isBlockedHostname } from "../../fetch-source";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const MAX_PAGES = 100;
// Grupos de campos permitidos. `trace_context` traz traceName (usado na
// descoberta e no mapeador); `io` e `metadata` são proibidos (LGPD).
export const OBSERVATION_FIELDS = "core,basic,usage,model,metrics,trace_context";
export const SCORE_FIELDS = "subject,annotation,details";

type FetchImpl = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;
type ResolvedAddress = { address: string; family: number };
type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

export interface LangfuseReadableClient {
  listProjects(): Promise<LangfuseProject[]>;
  listObservations(input: { from: Date; to: Date }): AsyncGenerator<LangfuseObservation[]>;
  listScores(input: { from: Date; to: Date }): AsyncGenerator<LangfuseScore[]>;
}

export interface LangfuseProject {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface LangfuseObservation {
  id: string;
  traceId?: string;
  traceName?: string;
  [key: string]: unknown;
}

export interface LangfuseScore {
  id: string;
  subject?: {
    kind?: string;
    id?: string;
    traceId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class LangfuseClientError extends Error {
  constructor(
    public readonly code: "langfuse_unauthorized" | "langfuse_request_failed" | "langfuse_unsafe_host",
    public readonly status?: number,
  ) {
    super(
      code === "langfuse_unauthorized"
        ? "Chaves do Langfuse inválidas ou sem acesso ao projeto."
        : code === "langfuse_unsafe_host"
          ? "Esse endereço não é permitido."
        : "Não foi possível consultar o Langfuse.",
    );
    this.name = "LangfuseClientError";
  }
}

export function createLangfuseClient({
  credential,
  fetchImpl,
  sleep = defaultSleep,
  resolveHost = resolveSafeHost,
  requestImpl = https.request,
}: {
  credential: LangfuseCredential;
  fetchImpl?: FetchImpl;
  sleep?: Sleep;
  resolveHost?: ResolveHost;
  requestImpl?: typeof https.request;
}): LangfuseReadableClient {
  const baseUrl = credential.baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, query?: URLSearchParams): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of query ?? []) url.searchParams.set(key, value);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        const init: RequestInit = {
          headers: new Headers({
            Authorization: `Basic ${Buffer.from(`${credential.publicKey}:${credential.secretKey}`).toString("base64")}`,
          }),
          signal: controller.signal,
          redirect: "error",
        };
        response = isOfficialLangfuseHost(url.hostname)
          ? await (fetchImpl ?? fetch)(url.toString(), init)
          : await fetchWithResolvedHost(url, init, await resolveHost(url.hostname), requestImpl);

        if (response.status === 401 || response.status === 403) {
          throw new LangfuseClientError("langfuse_unauthorized", response.status);
        }
        if (response.ok) return (await response.json()) as T;

        if ((response.status === 429 || response.status >= 500) && attempt + 1 < MAX_ATTEMPTS) {
          const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response.headers.get("retry-after")) : undefined;
          clearTimeout(timeout);
          await sleep(retryAfterMs ?? backoffMs(attempt));
          continue;
        }
        throw new LangfuseClientError("langfuse_request_failed", response.status);
      } catch (error) {
        if (error instanceof LangfuseClientError) throw error;
        if (attempt + 1 < MAX_ATTEMPTS) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new LangfuseClientError("langfuse_request_failed");
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new LangfuseClientError("langfuse_request_failed");
  }

  return {
    async listProjects(): Promise<LangfuseProject[]> {
      const result = await request<{ data?: LangfuseProject[] }>("/api/public/projects");
      return result.data ?? [];
    },

    async *listObservations({ from, to }: { from: Date; to: Date }): AsyncGenerator<LangfuseObservation[]> {
      yield* listPages<LangfuseObservation>("/api/public/v2/observations", (cursor) => {
        const query = new URLSearchParams({
          fields: OBSERVATION_FIELDS,
          fromStartTime: from.toISOString(),
          toStartTime: to.toISOString(),
          limit: "1000",
        });
        if (cursor) query.set("cursor", cursor);
        return query;
      });
    },

    async *listScores({ from, to }: { from: Date; to: Date }): AsyncGenerator<LangfuseScore[]> {
      yield* listPages<LangfuseScore>("/api/public/v3/scores", (cursor) => {
        const query = new URLSearchParams({
          fields: SCORE_FIELDS,
          fromTimestamp: from.toISOString(),
          toTimestamp: to.toISOString(),
          limit: "100",
        });
        if (cursor) query.set("cursor", cursor);
        return query;
      });
    },
  };

  async function* listPages<T>(
    path: string,
    createQuery: (cursor: string | undefined) => URLSearchParams,
  ): AsyncGenerator<T[]> {
    let cursor: string | undefined;
    const seenCursors = new Set<string>();

    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) {
        throw new Error(`A paginação do Langfuse excedeu o limite de ${MAX_PAGES} páginas.`);
      }
      const result = await request<{ data?: T[]; meta?: { cursor?: string } }>(path, createQuery(cursor));
      const nextCursor = result.meta?.cursor || undefined;
      if (nextCursor && seenCursors.has(nextCursor)) {
        throw new Error("A paginação do Langfuse recebeu um cursor repetido.");
      }
      yield result.data ?? [];
      if (!nextCursor) return;
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
  }
}

async function resolveSafeHost(hostname: string): Promise<ResolvedAddress[]> {
  let addresses: ResolvedAddress[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new LangfuseClientError("langfuse_request_failed");
  }
  if (!addresses.length || addresses.some(({ address }) => isBlockedHostname(address))) {
    throw new LangfuseClientError("langfuse_unsafe_host");
  }
  return addresses;
}

function fetchWithResolvedHost(
  url: URL,
  init: RequestInit,
  addresses: ResolvedAddress[],
  requestImpl: typeof https.request,
): Promise<Response> {
  const address = addresses[0];
  if (!address || addresses.some(({ address }) => isBlockedHostname(address))) {
    return Promise.reject(new LangfuseClientError("langfuse_unsafe_host"));
  }

  return new Promise((resolve, reject) => {
    const request = requestImpl(url, {
      method: init.method ?? "GET",
      headers: Object.fromEntries(new Headers(init.headers)),
      signal: init.signal ?? undefined,
      agent: false,
      lookup: fixedLookup(address),
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer | Uint8Array | string) => chunks.push(Buffer.from(chunk)));
      response.on("error", reject);
      response.on("end", () => {
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode ?? 502,
          headers: responseHeaders(response.headers),
        }));
      });
    });
    request.on("error", reject);
    request.end();
  });
}

function fixedLookup(address: ResolvedAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address]);
      return;
    }
    callback(null, address.address, address.family);
  };
}

function responseHeaders(headers: Record<string, string | string[] | undefined>): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value) {
      result.set(name, value);
    }
  }
  return result;
}

function backoffMs(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 8_000);
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
