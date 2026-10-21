import { createHash } from "node:crypto";

/**
 * Esqueleto do conector OTLP GenAI (docs/CONECTOR-OTLP-GENAI.md).
 *
 * Função pura: recebe um ExportTraceServiceRequest em OTLP/HTTP JSON e devolve
 * só os campos da allowlist. Conteúdo de prompt/resposta, argumentos de
 * ferramenta e span events são descartados aqui, antes de qualquer
 * persistência ou log (LGPD). Ainda não há rota usando esta função.
 */

type OtlpAnyValue = {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values?: OtlpAnyValue[] };
  kvlistValue?: { values?: OtlpKeyValue[] };
};
type OtlpKeyValue = { key: string; value?: OtlpAnyValue };

export interface OtlpSpan {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: OtlpKeyValue[];
  events?: unknown[];
  status?: { code?: number | string; message?: string };
}

export interface OtlpExportTraceRequest {
  resourceSpans?: Array<{
    resource?: { attributes?: OtlpKeyValue[] };
    scopeSpans?: Array<{ spans?: OtlpSpan[] }>;
  }>;
}

export type GenAiOperation =
  | "invoke_agent"
  | "create_agent"
  | "chat"
  | "text_completion"
  | "generate_content"
  | "embeddings"
  | "execute_tool";

export interface GenAiSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  operation: GenAiOperation;
  serviceName: string | null;
  serviceVersion: string | null;
  environment: string | null;
  provider: string | null;
  requestModel: string | null;
  responseModel: string | null;
  agentId: string | null;
  agentName: string | null;
  toolName: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  conversationIdHash: string | null;
  error: boolean;
  startTimeMs: number | null;
  endTimeMs: number | null;
}

export interface ExtractGenAiSpansResult {
  spans: GenAiSpan[];
  /** Spans sem gen_ai.operation.name reconhecido (não são GenAI). */
  ignoredSpans: number;
  /** Spans GenAI inválidos (sem ids). */
  rejectedSpans: number;
  /** Atributos/eventos de conteúdo descartados, para orientar o cliente. */
  droppedContentAttributes: number;
}

const OPERATIONS = new Set<GenAiOperation>([
  "invoke_agent",
  "create_agent",
  "chat",
  "text_completion",
  "generate_content",
  "embeddings",
  "execute_tool",
]);

const SPAN_ALLOWLIST = new Set([
  "gen_ai.operation.name",
  "gen_ai.provider.name",
  "gen_ai.system",
  "gen_ai.request.model",
  "gen_ai.response.model",
  "gen_ai.usage.input_tokens",
  "gen_ai.usage.output_tokens",
  "gen_ai.usage.prompt_tokens",
  "gen_ai.usage.completion_tokens",
  "gen_ai.agent.id",
  "gen_ai.agent.name",
  "gen_ai.tool.name",
  "gen_ai.conversation.id",
  "error.type",
]);

const CONTENT_ATTRIBUTE = [
  /^gen_ai\.(input|output)\.messages$/,
  /^gen_ai\.system_instructions$/,
  /^gen_ai\.tool\.call\.(arguments|result)$/,
  /^gen_ai\.(prompt|completion)(\.|$)/,
  /^llm\.(input|output)_messages/,
  /^(input|output)\.value$/,
];

function scalar(value: OtlpAnyValue | undefined): string | number | boolean | null {
  if (!value) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined) return Number(value.intValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  return null;
}

function readAllowed(
  attributes: OtlpKeyValue[] | undefined,
  allow: Set<string>,
  counter: { dropped: number },
): Map<string, string | number | boolean> {
  const out = new Map<string, string | number | boolean>();
  for (const attribute of attributes ?? []) {
    if (CONTENT_ATTRIBUTE.some((pattern) => pattern.test(attribute.key))) {
      counter.dropped += 1;
      continue;
    }
    if (!allow.has(attribute.key)) continue;
    const value = scalar(attribute.value);
    if (value !== null) out.set(attribute.key, value);
  }
  return out;
}

function text(map: Map<string, string | number | boolean>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = map.get(key);
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function count(map: Map<string, string | number | boolean>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = map.get(key);
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.round(value);
    }
  }
  return null;
}

function nanosToMs(value: string | number | undefined): number | null {
  if (value === undefined || value === "" || value === 0 || value === "0") return null;
  try {
    return Number(BigInt(value) / 1_000_000n);
  } catch {
    return null;
  }
}

function hashId(value: string | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

const RESOURCE_ALLOWLIST = new Set([
  "service.name",
  "service.version",
  "deployment.environment",
  "deployment.environment.name",
]);

export function extractGenAiSpans(request: OtlpExportTraceRequest): ExtractGenAiSpansResult {
  const counter = { dropped: 0 };
  const spans: GenAiSpan[] = [];
  let ignoredSpans = 0;
  let rejectedSpans = 0;

  for (const resourceSpan of request.resourceSpans ?? []) {
    const resource = readAllowed(resourceSpan.resource?.attributes, RESOURCE_ALLOWLIST, counter);
    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      for (const span of scopeSpan.spans ?? []) {
        counter.dropped += span.events?.length ?? 0;
        const attributes = readAllowed(span.attributes, SPAN_ALLOWLIST, counter);
        const operation = text(attributes, "gen_ai.operation.name");
        if (!operation || !OPERATIONS.has(operation as GenAiOperation)) {
          ignoredSpans += 1;
          continue;
        }
        if (!span.traceId || !span.spanId) {
          rejectedSpans += 1;
          continue;
        }
        const statusCode = span.status?.code;
        spans.push({
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId ? span.parentSpanId : null,
          operation: operation as GenAiOperation,
          serviceName: text(resource, "service.name"),
          serviceVersion: text(resource, "service.version"),
          environment: text(resource, "deployment.environment.name", "deployment.environment"),
          provider: text(attributes, "gen_ai.provider.name", "gen_ai.system"),
          requestModel: text(attributes, "gen_ai.request.model"),
          responseModel: text(attributes, "gen_ai.response.model"),
          agentId: text(attributes, "gen_ai.agent.id"),
          agentName: text(attributes, "gen_ai.agent.name"),
          toolName: text(attributes, "gen_ai.tool.name"),
          inputTokens: count(attributes, "gen_ai.usage.input_tokens", "gen_ai.usage.prompt_tokens"),
          outputTokens: count(attributes, "gen_ai.usage.output_tokens", "gen_ai.usage.completion_tokens"),
          conversationIdHash: hashId(text(attributes, "gen_ai.conversation.id")),
          error:
            statusCode === 2 ||
            statusCode === "STATUS_CODE_ERROR" ||
            text(attributes, "error.type") !== null,
          startTimeMs: nanosToMs(span.startTimeUnixNano),
          endTimeMs: nanosToMs(span.endTimeUnixNano),
        });
      }
    }
  }

  spans.sort((a, b) =>
    a.traceId === b.traceId ? a.spanId.localeCompare(b.spanId) : a.traceId.localeCompare(b.traceId),
  );
  return { spans, ignoredSpans, rejectedSpans, droppedContentAttributes: counter.dropped };
}
