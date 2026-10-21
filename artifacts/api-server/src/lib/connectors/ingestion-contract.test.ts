import { describe, expect, it } from "vitest";
import { IngestExternalAgentEnvelopeBody } from "@workspace/api-zod";
import {
  MUSTER_AGENT_INGESTION_CONTRACT_VERSION,
  MUSTER_CONNECTOR_CONTRACT_VERSION,
} from "./types";

const source = { platform: "webhook" };
const agent = { externalId: "agent-42", name: "Agente de suporte" };

describe("contrato de ingestão externa v2", () => {
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
