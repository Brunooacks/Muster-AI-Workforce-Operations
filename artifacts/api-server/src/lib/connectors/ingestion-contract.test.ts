import { describe, expect, it } from "vitest";
import { IngestExternalAgentEnvelopeBody } from "@workspace/api-zod";
import {
  MUSTER_AGENT_INGESTION_CONTRACT_VERSION,
  MUSTER_CONNECTOR_CONTRACT_VERSION,
} from "./types";

const source = { platform: "webhook" };
const agent = { externalId: "agent-42", name: "Agente de suporte" };

describe("contrato de ingestão externa v2", () => {
  const validStep = {
    stepKey: "classify.ticket.v1",
    inputFingerprint: `sha256:${"a".repeat(64)}`,
    outputHash: `sha256:${"b".repeat(64)}`,
    path: "model",
    model: "gpt-5-mini",
    tokensIn: 1120,
    tokensOut: 96,
    costCents: 71,
    shadow: false,
  };

  it("mantém o payload v1 aceito sem taskRunId", () => {
    const result = IngestExternalAgentEnvelopeBody.safeParse({
      contractVersion: "muster.agent-ingestion.v1",
      source,
      agent,
      execution: { status: "success", costCents: 25 },
    });

    expect(result.success).toBe(true);
  });

  it("aceita uma execução v2 completa", () => {
    const result = IngestExternalAgentEnvelopeBody.safeParse({
      contractVersion: "muster.agent-ingestion.v2",
      source,
      agent,
      execution: {
        taskRunId: "run-42",
        currency: "USD",
        status: "success",
        costCents: 25,
      },
      feedback: {
        taskRunId: "run-42",
        currency: "USD",
        kind: "positive",
        validation: {
          status: "validated",
          source: "human_review",
          reviewerRef: "reviewer-7",
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("aceita passos v2 derivados sem conteúdo bruto", () => {
    const result = IngestExternalAgentEnvelopeBody.safeParse({
      contractVersion: "muster.agent-ingestion.v2",
      source,
      agent,
      execution: {
        taskRunId: "run-42",
        currency: "BRL",
        steps: [validStep],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.execution).toMatchObject({ steps: [validStep] });
    }
  });

  it("rejeita conteúdo bruto em qualquer nível de metadata de passo", () => {
    const result = IngestExternalAgentEnvelopeBody.safeParse({
      contractVersion: "muster.agent-ingestion.v2",
      source,
      agent,
      execution: {
        taskRunId: "run-42",
        steps: [{ ...validStep, metadata: { audit: { messages: ["segredo"] } } }],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejeita passos com limite, hashes, chaves e modelo inválidos", () => {
    const base = {
      contractVersion: "muster.agent-ingestion.v2",
      source,
      agent,
      execution: { taskRunId: "run-42" },
    };

    expect(IngestExternalAgentEnvelopeBody.safeParse({
      ...base,
      execution: { ...base.execution, steps: Array.from({ length: 101 }, (_, index) => ({ ...validStep, stepKey: `step-${index}` })) },
    }).success).toBe(false);
    expect(IngestExternalAgentEnvelopeBody.safeParse({
      ...base,
      execution: { ...base.execution, steps: [{ ...validStep, outputHash: "sha256:not-a-hash" }] },
    }).success).toBe(false);
    expect(IngestExternalAgentEnvelopeBody.safeParse({
      ...base,
      execution: { ...base.execution, steps: [validStep, validStep] },
    }).success).toBe(false);
    expect(IngestExternalAgentEnvelopeBody.safeParse({
      ...base,
      execution: { ...base.execution, steps: [{ ...validStep, path: "code", model: "gpt-5-mini" }] },
    }).success).toBe(false);
  });

  it("rejeita eventos v2 sem taskRunId", () => {
    const result = IngestExternalAgentEnvelopeBody.safeParse({
      contractVersion: "muster.agent-ingestion.v2",
      source,
      agent,
      execution: { status: "success", currency: "BRL" },
    });

    expect(result.success).toBe(false);
  });

  it("rejeita feedback v2 sem taskRunId", () => {
    const result = IngestExternalAgentEnvelopeBody.safeParse({
      contractVersion: "muster.agent-ingestion.v2",
      source,
      agent,
      feedback: {
        kind: "negative",
        validation: { status: "rejected", source: "human_review" },
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejeita currency fora do contrato", () => {
    const result = IngestExternalAgentEnvelopeBody.safeParse({
      contractVersion: "muster.agent-ingestion.v2",
      source,
      agent,
      execution: {
        taskRunId: "run-42",
        currency: "EUR",
        status: "success",
      },
    });

    expect(result.success).toBe(false);
  });

  it("expõe as versões v2 nos contratos públicos", () => {
    expect(MUSTER_CONNECTOR_CONTRACT_VERSION).toBe("muster.connector.v2");
    expect(MUSTER_AGENT_INGESTION_CONTRACT_VERSION).toBe(
      "muster.agent-ingestion.v2",
    );
  });
});
