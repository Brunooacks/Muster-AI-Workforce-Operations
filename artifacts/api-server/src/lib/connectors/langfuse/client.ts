import type { LangfuseCredential } from "./credential";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
// Grupos de campos permitidos. `trace_context` traz traceName (usado na
// descoberta e no mapeador); `io` e `metadata` são proibidos (LGPD).
export const OBSERVATION_FIELDS = "core,basic,usage,model,metrics,trace_context";
export const SCORE_FIELDS = "subject,annotation,details";

type FetchImpl = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

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
    public readonly code: "langfuse_unauthorized" | "langfuse_request_failed",
    public readonly status?: number,
  ) {
    super(
      code === "langfuse_unauthorized"
        ? "Chaves do Langfuse inválidas ou sem acesso ao projeto."
        : "Não foi possível consultar o Langfuse.",
    );
    this.name = "LangfuseClientError";
  }
}

export function createLangfuseClient({
  credential,
  fetchImpl = fetch,
  sleep = defaultSleep,
}: {
  credential: LangfuseCredential;
  fetchImpl?: FetchImpl;
  sleep?: Sleep;
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
        response = await fetchImpl(url.toString(), {
          headers: new Headers({
            Authorization: `Basic ${Buffer.from(`${credential.publicKey}:${credential.secretKey}`).toString("base64")}`,
          }),
          signal: controller.signal,
          redirect: "error",
        });
      } catch {
        clearTimeout(timeout);
        if (attempt + 1 < MAX_ATTEMPTS) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new LangfuseClientError("langfuse_request_failed");
      }
      clearTimeout(timeout);

      if (response.status === 401 || response.status === 403) {
        throw new LangfuseClientError("langfuse_unauthorized", response.status);
      }
      if (response.ok) return (await response.json()) as T;

      if ((response.status === 429 || response.status >= 500) && attempt + 1 < MAX_ATTEMPTS) {
        const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response.headers.get("retry-after")) : undefined;
        await sleep(
          retryAfterMs ?? backoffMs(attempt),
        );
        continue;
      }
      throw new LangfuseClientError("langfuse_request_failed", response.status);
    }

    throw new LangfuseClientError("langfuse_request_failed");
  }

  return {
    async listProjects(): Promise<LangfuseProject[]> {
      const result = await request<{ data?: LangfuseProject[] }>("/api/public/projects");
      return result.data ?? [];
    },

    async *listObservations({ from, to }: { from: Date; to: Date }): AsyncGenerator<LangfuseObservation[]> {
      let cursor: string | undefined;
      do {
        const query = new URLSearchParams({
          fields: OBSERVATION_FIELDS,
          fromStartTime: from.toISOString(),
          toStartTime: to.toISOString(),
          limit: "1000",
        });
        if (cursor) query.set("cursor", cursor);
        const result = await request<{ data?: LangfuseObservation[]; meta?: { cursor?: string } }>(
          "/api/public/v2/observations",
          query,
        );
        yield result.data ?? [];
        cursor = result.meta?.cursor || undefined;
      } while (cursor);
    },

    async *listScores({ from, to }: { from: Date; to: Date }): AsyncGenerator<LangfuseScore[]> {
      let cursor: string | undefined;
      do {
        const query = new URLSearchParams({
          fields: SCORE_FIELDS,
          fromTimestamp: from.toISOString(),
          toTimestamp: to.toISOString(),
          limit: "100",
        });
        if (cursor) query.set("cursor", cursor);
        const result = await request<{ data?: LangfuseScore[]; meta?: { cursor?: string } }>(
          "/api/public/v3/scores",
          query,
        );
        yield result.data ?? [];
        cursor = result.meta?.cursor || undefined;
      } while (cursor);
    },
  };
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
