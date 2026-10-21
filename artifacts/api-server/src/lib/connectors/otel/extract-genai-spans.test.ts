import { describe, expect, it } from "vitest";
import { extractGenAiSpans, type OtlpExportTraceRequest, type OtlpSpan } from "./extract-genai-spans";

const TRACE = "5b8efff798038103d269b633813fc60c";
const CPF = "123.456.789-09";
const EMAIL = "maria.ficticia@example.com";

function str(key: string, value: string) {
  return { key, value: { stringValue: value } };
}
function int(key: string, value: number) {
  return { key, value: { intValue: String(value) } };
}

function request(spans: OtlpSpan[]): OtlpExportTraceRequest {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            str("service.name", "agente-cobranca"),
            str("service.version", "1.4.0"),
            str("deployment.environment.name", "prod"),
            str("host.name", "maquina-interna-do-cliente"),
          ],
        },
        scopeSpans: [{ spans }],
      },
    ],
  };
}

describe("extractGenAiSpans (esqueleto OTLP GenAI)", () => {
  it("extrai um span invoke_agent com tokens, modelo, agente e duração", () => {
    const result = extractGenAiSpans(
      request([
        {
          traceId: TRACE,
          spanId: "aaaaaaaaaaaaaaaa",
          name: "invoke_agent cobranca",
          startTimeUnixNano: "1760140800000000000",
          endTimeUnixNano: "1760140801500000000",
          attributes: [
            str("gen_ai.operation.name", "invoke_agent"),
            str("gen_ai.provider.name", "openai"),
            str("gen_ai.request.model", "gpt-4.1"),
            str("gen_ai.agent.id", "agt_123"),
            str("gen_ai.agent.name", "Cobrança"),
            int("gen_ai.usage.input_tokens", 1200),
            int("gen_ai.usage.output_tokens", 300),
          ],
        },
      ]),
    );

    expect(result.spans).toHaveLength(1);
    expect(result.spans[0]).toMatchObject({
      traceId: TRACE,
      spanId: "aaaaaaaaaaaaaaaa",
      parentSpanId: null,
      operation: "invoke_agent",
      serviceName: "agente-cobranca",
      serviceVersion: "1.4.0",
      environment: "prod",
      provider: "openai",
      requestModel: "gpt-4.1",
      agentId: "agt_123",
      agentName: "Cobrança",
      inputTokens: 1200,
      outputTokens: 300,
      error: false,
      startTimeMs: 1760140800000,
      endTimeMs: 1760140801500,
    });
  });

  it("descarta prompts, respostas, argumentos de ferramenta e span events (LGPD)", () => {
    const result = extractGenAiSpans(
      request([
        {
          traceId: TRACE,
          spanId: "bbbbbbbbbbbbbbbb",
          parentSpanId: "aaaaaaaaaaaaaaaa",
          attributes: [
            str("gen_ai.operation.name", "chat"),
            str("gen_ai.input.messages", `[{"role":"user","content":"meu CPF é ${CPF}"}]`),
            str("gen_ai.output.messages", `[{"role":"assistant","content":"enviei para ${EMAIL}"}]`),
            str("gen_ai.system_instructions", "seja educado"),
            str("gen_ai.prompt.0.content", CPF),
            str("gen_ai.completion.0.content", EMAIL),
            str("gen_ai.tool.call.arguments", `{"email":"${EMAIL}"}`),
            str("input.value", CPF),
          ],
          events: [{ name: "gen_ai.user.message", attributes: [str("content", CPF)] }],
        },
      ]),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(CPF);
    expect(serialized).not.toContain(EMAIL);
    expect(serialized).not.toContain("seja educado");
    expect(serialized).not.toContain("maquina-interna-do-cliente");
    expect(result.droppedContentAttributes).toBe(8);
    expect(result.spans[0]?.parentSpanId).toBe("aaaaaaaaaaaaaaaa");
  });

  it("guarda o id de conversa só como hash", () => {
    const result = extractGenAiSpans(
      request([
        {
          traceId: TRACE,
          spanId: "cccccccccccccccc",
          attributes: [str("gen_ai.operation.name", "chat"), str("gen_ai.conversation.id", "conv-cliente-42")],
        },
      ]),
    );

    expect(result.spans[0]?.conversationIdHash).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(result)).not.toContain("conv-cliente-42");
  });

  it("aceita nomes legados da convenção (gen_ai.system e prompt/completion_tokens)", () => {
    const result = extractGenAiSpans(
      request([
        {
          traceId: TRACE,
          spanId: "dddddddddddddddd",
          attributes: [
            str("gen_ai.operation.name", "chat"),
            str("gen_ai.system", "anthropic"),
            int("gen_ai.usage.prompt_tokens", 10),
            int("gen_ai.usage.completion_tokens", 5),
          ],
        },
      ]),
    );

    expect(result.spans[0]).toMatchObject({ provider: "anthropic", inputTokens: 10, outputTokens: 5 });
  });

  it("marca erro por status ERROR ou error.type", () => {
    const result = extractGenAiSpans(
      request([
        { traceId: TRACE, spanId: "eeeeeeeeeeeeeee1", attributes: [str("gen_ai.operation.name", "chat")], status: { code: 2 } },
        { traceId: TRACE, spanId: "eeeeeeeeeeeeeee2", attributes: [str("gen_ai.operation.name", "chat"), str("error.type", "timeout")] },
        { traceId: TRACE, spanId: "eeeeeeeeeeeeeee3", attributes: [str("gen_ai.operation.name", "chat")], status: { code: 1 } },
      ]),
    );

    expect(result.spans.map((span) => span.error)).toEqual([true, true, false]);
  });

  it("ignora spans que não são GenAI e rejeita spans GenAI sem ids", () => {
    const result = extractGenAiSpans(
      request([
        { traceId: TRACE, spanId: "ffffffffffffffff", name: "GET /health", attributes: [str("http.method", "GET")] },
        { traceId: TRACE, spanId: "ffffffffffffff00", attributes: [str("gen_ai.operation.name", "operacao_inventada")] },
        { spanId: "ffffffffffffff01", attributes: [str("gen_ai.operation.name", "chat")] },
      ]),
    );

    expect(result).toMatchObject({ spans: [], ignoredSpans: 2, rejectedSpans: 1 });
  });

  it("não confia em tokens negativos ou não numéricos", () => {
    const result = extractGenAiSpans(
      request([
        {
          traceId: TRACE,
          spanId: "1111111111111111",
          attributes: [
            str("gen_ai.operation.name", "chat"),
            int("gen_ai.usage.input_tokens", -5),
            str("gen_ai.usage.output_tokens", "muitos"),
          ],
        },
      ]),
    );

    expect(result.spans[0]).toMatchObject({ inputTokens: null, outputTokens: null });
  });

  it("devolve vazio para requisição vazia e é determinístico", () => {
    expect(extractGenAiSpans({})).toEqual({ spans: [], ignoredSpans: 0, rejectedSpans: 0, droppedContentAttributes: 0 });
    const spans = [
      { traceId: "b".repeat(32), spanId: "2".repeat(16), attributes: [str("gen_ai.operation.name", "chat")] },
      { traceId: "a".repeat(32), spanId: "1".repeat(16), attributes: [str("gen_ai.operation.name", "chat")] },
    ];
    const first = extractGenAiSpans(request(spans));
    expect(first.spans.map((span) => span.traceId)).toEqual(["a".repeat(32), "b".repeat(32)]);
    expect(extractGenAiSpans(request([...spans].reverse()))).toEqual(first);
  });
});
