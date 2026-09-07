import test from "node:test";
import assert from "node:assert/strict";
import type { PreAssessResult } from "@workspace/api-client-react";
import { summarizeFastAssessment } from "./fast-assessment";

function result(overrides: Partial<PreAssessResult> = {}): PreAssessResult {
  return {
    platform: "langchain",
    signals: [
      "runtime:docker",
      "runtime:config-env",
      "execution:agent-loop",
      "execution:tools",
      "execution:task-catalog",
      "observability:telemetry",
      "discovery:capabilities",
    ],
    fieldConfidence: {
      role: 80,
      shouldDo: 80,
      shouldNotDo: 80,
      autonomyLevel: 75,
    },
    draft: {
      name: "Revisor",
      role: "Revisão técnica",
      tagline: "",
      bio: "",
      shouldDo: ["Revisar mudanças"],
      shouldNotDo: ["Não publicar sem aprovação"],
      autonomyLevel: "escalates",
      limits: [],
      businessCase: { baseline: "", targetPayback: "", description: "" },
      proposedMetrics: [
        ["efficacy", "Acurácia"],
        ["efficiency", "Latência"],
        ["adoption", "Uso"],
        ["governance", "Guardrails"],
        ["value", "Escopo"],
      ].map(([layer, label]) => ({
        layer: layer as "efficacy" | "efficiency" | "adoption" | "governance" | "value",
        label,
        unit: "%",
        target: "≥ 80%",
        rationale: "Extraído do repositório.",
      })),
      summary: "",
      confidence: 84,
    },
    ...overrides,
  };
}

test("pre-qualifica código instrumentado com métricas declaradas", () => {
  const summary = summarizeFastAssessment(result());

  assert.equal(summary.status, "ready");
  assert.equal(summary.declaredMetrics, 5);
  assert.ok(summary.telemetryReadiness >= 80);
  assert.ok(summary.score >= 72);
});

test("mantém em revisão quando métricas e telemetria são apenas sugeridas", () => {
  const weak = result({
    platform: null,
    signals: ["execution:tools"],
    fieldConfidence: { role: 45, shouldDo: 35, shouldNotDo: 30, autonomyLevel: 30 },
    draft: {
      ...result().draft,
      confidence: 48,
      proposedMetrics: result().draft.proposedMetrics.map((metric) => ({
        ...metric,
        rationale: "Sugerida do catálogo — camada ausente.",
      })),
    },
  });
  const summary = summarizeFastAssessment(weak);

  assert.notEqual(summary.status, "ready");
  assert.equal(summary.declaredMetrics, 0);
  assert.ok(summary.gaps.includes("telemetry"));
  assert.ok(summary.gaps.includes("metrics"));
});
