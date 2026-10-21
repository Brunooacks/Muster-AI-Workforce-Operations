import annotatedPass from "./fixtures/trace-annotated-pass.json";
import annotatedReject from "./fixtures/trace-annotated-reject.json";
import errorTrace from "./fixtures/trace-error.json";
import evalOnly from "./fixtures/trace-eval-only.json";
import multiAnnotation from "./fixtures/trace-multi-annotation.json";
import noScore from "./fixtures/trace-no-score.json";
import piiTrace from "./fixtures/trace-with-io-pii.json";
import { mapLangfuseToEnvelopeV2 } from "./map-to-envelope-v2";
import { describe, expect, it } from "vitest";

type MapInput = Parameters<typeof mapLangfuseToEnvelopeV2>[0];
const passInput = annotatedPass as unknown as MapInput;
const rejectInput = annotatedReject as unknown as MapInput;
const errorInput = errorTrace as unknown as MapInput;
const evalInput = evalOnly as unknown as MapInput;
const multiAnnotationInput = multiAnnotation as unknown as MapInput;
const noScoreInput = noScore as unknown as MapInput;
const piiInput = piiTrace as unknown as MapInput;

const options = {
  projectId: "project-fake",
  connectorId: "connector-fake",
  validation: { scoreName: "quality" },
} as const;

describe("mapLangfuseToEnvelopeV2", () => {
  it("cria execução e feedback positivo para anotação numérica no limiar", () => {
    const result = mapLangfuseToEnvelopeV2(passInput, {
      ...options,
      fx: { usdToBrl: 5, rateDate: "2026-10-10", source: "Banco Central" },
    });

    expect(result.warnings).toEqual([]);
    expect(result.envelopes).toHaveLength(2);
    expect(result.envelopes[0]).toMatchObject({
      contractVersion: "muster.agent-ingestion.v2",
      eventId: "langfuse:project-fake:trace-pass:execution",
      source: { platform: "langfuse", connectorId: "connector-fake", reference: "project-fake" },
      agent: {
        externalId: "langfuse:project-fake:Support trace",
        name: "Support trace",
        metadata: { source: "langfuse", projectId: "project-fake", environment: "prod", models: ["gpt-fake", "text-fake", "tool-model"] },
      },
      execution: {
        taskRunId: "langfuse:project-fake:trace-pass",
        startedAt: "2026-10-10T10:00:00.000Z",
        completedAt: "2026-10-10T10:00:06.000Z",
        durationMs: 6000,
        status: "success",
        tokensIn: 13,
        tokensOut: 5,
        currency: "BRL",
        costCents: 13,
        metadata: { langfuse: { traceId: "trace-pass", observationCount: 3, generationCount: 1, toolCount: 1, errorCount: 0 } },
      },
    });
    expect(result.envelopes[0]?.execution?.metadata?.fx).toEqual({
      fromCurrency: "USD", rate: 5, rateDate: "2026-10-10", source: "Banco Central", originalAmountUsd: 0.025,
    });
    expect(result.envelopes[1]).toMatchObject({
      eventId: "langfuse:project-fake:trace-pass:feedback",
      feedback: { taskRunId: "langfuse:project-fake:trace-pass", kind: "positive", score: 0.5, validation: { status: "validated", source: "human_review", reviewerRef: expect.stringMatching(/^langfuse-user:[a-f0-9]{16}$/) } },
    });
  });

  it("emite feedback negativo para anotação BOOLEAN falsa", () => {
    const result = mapLangfuseToEnvelopeV2(rejectInput, options);

    expect(result.envelopes[1]).toMatchObject({
      feedback: { kind: "negative", score: 0, validation: { status: "rejected", source: "human_review" } },
    });
  });

  it("converte custos USD sem câmbio e avisa sobre evidência insuficiente", () => {
    const result = mapLangfuseToEnvelopeV2(passInput, options);

    expect(result.envelopes[0]?.execution).toMatchObject({ currency: "USD", costCents: 3 });
    expect(result.warnings).toContain("missing_fx_rate");
  });

  it("só contabiliza tokens de GENERATION e EMBEDDING", () => {
    const result = mapLangfuseToEnvelopeV2(passInput, options);

    expect(result.envelopes[0]?.execution).toMatchObject({ tokensIn: 13, tokensOut: 5 });
  });

  it("marca execução como erro quando alguma observation tem nível ERROR", () => {
    const result = mapLangfuseToEnvelopeV2(errorInput, options);

    expect(result.envelopes[0]?.execution).toMatchObject({ status: "error", tokensIn: 4, tokensOut: 2 });
  });

  it("inclui EVAL/API numéricos somente como evidência inferida", () => {
    const result = mapLangfuseToEnvelopeV2(evalInput, options);

    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0]?.observations).toEqual([
      { metricKey: "langfuse.eval.quality", label: "quality", value: 0.9, unit: "score", kind: "inferred", confidence: 0.5, capturedAt: "2026-10-10T12:00:02.000Z", lineage: [{ stage: "source", name: "langfuse_eval", ref: "eval-number" }] },
      { metricKey: "langfuse.eval.guard", label: "guard", value: 1, unit: "score", kind: "inferred", confidence: 0.5, capturedAt: "2026-10-10T12:00:03.000Z", lineage: [{ stage: "source", name: "langfuse_eval", ref: "api-boolean" }] },
    ]);
    expect(result.warnings).toEqual(expect.arrayContaining(["eval_non_numeric", "insufficient_evidence:no_validation_score"]));
  });

  it("não cria feedback na ausência de anotação humana de validação", () => {
    const result = mapLangfuseToEnvelopeV2(noScoreInput, options);

    expect(result.envelopes).toHaveLength(1);
    expect(result.warnings).toContain("insufficient_evidence:no_validation_score");
  });

  it("prefere a anotação mais recente e faz rejeição vencer em empate", () => {
    const result = mapLangfuseToEnvelopeV2(multiAnnotationInput, options);

    expect(result.envelopes[1]?.feedback).toMatchObject({ kind: "negative", score: 0, validation: { status: "rejected" } });
  });

  it("não replica IO, metadata, statusMessage, comentários ou PII", () => {
    const result = mapLangfuseToEnvelopeV2(piiInput, options);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("123.456.789-09");
    expect(serialized).not.toContain("pessoa.teste@example.invalid");
    expect(serialized).not.toContain("unclear");
    expect(result.envelopes).toHaveLength(1);
    expect(result.warnings).toContain("insufficient_evidence:annotation_not_conclusive");
  });

  it("registra somente hasComment para anotação humana inconclusiva", () => {
    const result = mapLangfuseToEnvelopeV2(piiInput, options);

    expect(result.envelopes[0]?.execution?.metadata).toMatchObject({ langfuse: { traceId: "trace-pii" } });
    expect(result.envelopes[0]?.feedback).toBeUndefined();
  });

  it("usa o nome da raiz quando configurado e não inventa agente ausente", () => {
    const rootResult = mapLangfuseToEnvelopeV2(passInput, { ...options, agentKey: "rootObservationName" });
    const missingResult = mapLangfuseToEnvelopeV2({ traceId: "no-agent", observations: [{ id: "missing-agent", traceId: "no-agent", startTime: "2026-10-10T17:00:00.000Z", type: "EVENT" }], scores: [] }, options);

    expect(rootResult.envelopes[0]?.agent).toMatchObject({ externalId: "langfuse:project-fake:support-agent", name: "support-agent" });
    expect(missingResult).toEqual({ envelopes: [], warnings: ["missing_agent_name"] });
  });

  it("trata execução sem fim como running e sem duração", () => {
    const result = mapLangfuseToEnvelopeV2({ traceId: "trace-running", observations: [{ id: "obs-running", traceId: "trace-running", startTime: "2026-10-10T18:00:00.000Z", type: "AGENT", isRootObservation: true, name: "runner", traceName: "Running trace" }], scores: [] }, options);

    expect(result.envelopes[0]?.execution).toMatchObject({ status: "running", startedAt: "2026-10-10T18:00:00.000Z" });
    expect(result.envelopes[0]?.execution?.durationMs).toBeUndefined();
  });

  it("não cria custo se a trace não fornece nenhum custo", () => {
    const result = mapLangfuseToEnvelopeV2(noScoreInput, options);

    expect(result.envelopes[0]?.execution?.costCents).toBeUndefined();
    expect(result.warnings).not.toContain("missing_fx_rate");
  });

  it("respeita listas categóricas e ignora subjects que não pertencem à trace", () => {
    const result = mapLangfuseToEnvelopeV2({
      traceId: "trace-category",
      observations: [{ id: "obs-category", traceId: "trace-category", startTime: "2026-10-10T19:00:00.000Z", type: "AGENT", isRootObservation: true, name: "categorizer", traceName: "Category trace" }],
      scores: [
        { id: "foreign", name: "quality", source: "ANNOTATION", dataType: "CATEGORICAL", value: "pass", timestamp: "2026-10-10T19:00:02.000Z", subject: { kind: "trace", id: "another-trace" } },
        { id: "own", name: "quality", source: "ANNOTATION", dataType: "CATEGORICAL", value: "pass", timestamp: "2026-10-10T19:00:01.000Z", subject: { kind: "trace", id: "trace-category" } },
      ],
    }, { ...options, validation: { scoreName: "quality", categoricalPass: ["pass"], categoricalReject: ["fail"] } });

    expect(result.envelopes[1]?.feedback).toMatchObject({ kind: "positive", validation: { status: "validated" } });
  });

  it("é determinístico e usa hash truncado para sessionId", () => {
    const first = mapLangfuseToEnvelopeV2(passInput, options);
    const second = mapLangfuseToEnvelopeV2(passInput, options);

    expect(first).toEqual(second);
    expect(first.envelopes[0]?.execution?.metadata?.langfuse).toMatchObject({ sessionIdHash: expect.stringMatching(/^[a-f0-9]{16}$/) });
  });

  it("não expõe o id do revisor em claro", () => {
    const result = mapLangfuseToEnvelopeV2(passInput, options);

    expect(JSON.stringify(result)).not.toContain("reviewer-fake");
  });

  it("não trata EVENT sem endTime como execução em andamento", () => {
    const result = mapLangfuseToEnvelopeV2({
      traceId: "trace-event",
      observations: [
        { id: "root", traceId: "trace-event", startTime: "2026-10-10T20:00:00.000Z", endTime: "2026-10-10T20:00:02.000Z", type: "AGENT", isRootObservation: true, name: "agent", traceName: "Event trace" },
        { id: "event", traceId: "trace-event", startTime: "2026-10-10T20:00:01.000Z", type: "EVENT", name: "checkpoint" },
      ],
      scores: [],
    }, options);

    expect(result.envelopes[0]?.execution).toMatchObject({ status: "success", durationMs: 2000 });
  });

  it("usa o limiar configurado também no desempate entre anotações simultâneas", () => {
    const result = mapLangfuseToEnvelopeV2({
      traceId: "trace-threshold",
      observations: [{ id: "root", traceId: "trace-threshold", startTime: "2026-10-10T21:00:00.000Z", endTime: "2026-10-10T21:00:01.000Z", type: "AGENT", isRootObservation: true, name: "agent", traceName: "Threshold trace" }],
      scores: [
        { id: "a-pass", name: "quality", source: "ANNOTATION", dataType: "NUMERIC", value: 0.9, timestamp: "2026-10-10T21:00:05.000Z", subject: { kind: "trace", id: "trace-threshold" } },
        { id: "b-below", name: "quality", source: "ANNOTATION", dataType: "NUMERIC", value: 0.7, timestamp: "2026-10-10T21:00:05.000Z", subject: { kind: "trace", id: "trace-threshold" } },
      ],
    }, { ...options, validation: { scoreName: "quality", numericPassThreshold: 0.8 } });

    expect(result.envelopes[1]?.feedback).toMatchObject({ kind: "negative", score: 0.7, validation: { status: "rejected" } });
  });
});
