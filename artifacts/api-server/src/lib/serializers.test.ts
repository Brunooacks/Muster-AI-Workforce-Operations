import { describe, it, expect, vi } from "vitest";

// `@workspace/db` cria um Pool real e exige DATABASE_URL no import; os
// serializers puros nunca tocam no banco, então o módulo é mockado inteiro.
vi.mock("@workspace/db", () => ({
  db: {},
  agents: {},
  areas: {},
  agentIdentities: {},
  agentOwners: {},
  agentDrafts: {},
  evaluations: {},
  verdicts: {},
}));

import {
  toAgentDraftRecord,
  toAgentSummary,
  toEvaluation,
  toVerdict,
} from "./serializers";

type DraftRow = Parameters<typeof toAgentDraftRecord>[0];
type AgentRow = Parameters<typeof toAgentSummary>[0];
type EvaluationRow = Parameters<typeof toEvaluation>[0];
type VerdictRow = Parameters<typeof toVerdict>[0];

const CREATED_AT = new Date("2026-01-15T10:30:00.000Z");
const UPDATED_AT = new Date("2026-02-20T08:05:09.123Z");

const BUSINESS_CASE = {
  baseline: "12 tickets/turno",
  targetPayback: "4 meses",
  description: "Reduzir o tempo de resolução",
};

const PROPOSED_METRICS = [
  {
    catalogMetricKey: "resolution_rate",
    layer: "efficiency" as const,
    label: "Taxa de resolução",
    unit: "%",
    target: "≥ 85%",
  },
];

const HEADLINE_KPIS = [
  {
    label: "Resolução",
    value: 91,
    unit: "%",
    trend: 4.2,
    direction: "up" as const,
  },
];

const LAYERS = [
  {
    key: "efficiency" as const,
    label: "Eficiência",
    score: 82,
    severity: "stable" as const,
    metrics: HEADLINE_KPIS,
  },
];

const NEXT_ACTIONS = [
  { action: "Revisar prompt", owner: "tech_lead", due: "2026-03-01" },
];

// Colunas ausentes ficam de fora do fixture de propósito: o valor recebido é
// `undefined`, e o fallback `?? null` precisa virar `null` mesmo assim.
function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft_1",
    orgId: "org_1",
    runId: "run_1",
    source: "manual",
    name: "Agente de Triagem",
    role: "operador de triagem",
    platform: "chat",
    tagline: "Triagem em tempo real",
    bio: "Recebe tickets e classifica.",
    shouldDo: ["classificar ticket"],
    shouldNotDo: ["fechar ticket"],
    autonomyLevel: "escalates",
    limits: ["sem acesso a dados sensíveis"],
    businessCase: BUSINESS_CASE,
    proposedMetrics: PROPOSED_METRICS,
    summary: "Rascunho aguardando revisão.",
    confidence: 0.72,
    enrichmentStatus: "complete",
    reviewStatus: "pending",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  } as unknown as DraftRow;
}

function agentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent_1",
    orgId: "org_1",
    name: "Agente de Triagem",
    slug: "agente-de-triagem",
    role: "operador de triagem",
    platform: "chat",
    version: "2.1.0",
    status: "active",
    bio: "Recebe tickets e classifica.",
    tagline: "Triagem em tempo real",
    monthlyVolume: 18400,
    headlineKpis: HEADLINE_KPIS,
    currentVerdict: "promote",
    verdictConfidence: 0.81,
    severity: "stable",
    healthScore: 88.5,
    activeAlerts: 2,
    monthlyValue: 96000,
    monthlyCost: 12300,
    admittedAt: CREATED_AT,
    lastEvaluatedAt: UPDATED_AT,
    createdAt: CREATED_AT,
    ...overrides,
  } as unknown as AgentRow;
}

function evaluationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "eval_1",
    agentId: "agent_1",
    evaluatedAt: UPDATED_AT,
    window: "30d",
    layers: LAYERS,
    verdict: "mentor",
    verdictConfidence: 0.63,
    rationale: "Ganha em eficiência, perde em adoção.",
    ...overrides,
  } as unknown as EvaluationRow;
}

function verdictRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "verdict_1",
    agentId: "agent_1",
    verdict: "promote",
    confidence: 0.81,
    executionWindow: "90d",
    suggestedSponsor: "sponsor_1",
    nextActions: NEXT_ACTIONS,
    rationale: "Payback dentro do alvo.",
    decision: "pending",
    createdAt: CREATED_AT,
    ...overrides,
  } as unknown as VerdictRow;
}

describe("toAgentDraftRecord", () => {
  it("serializes createdAt and updatedAt as ISO strings", () => {
    const record = toAgentDraftRecord(draftRow());

    expect(record.createdAt).toBe("2026-01-15T10:30:00.000Z");
    expect(record.updatedAt).toBe("2026-02-20T08:05:09.123Z");
  });

  it("falls back to null for absent nullable columns", () => {
    const record = toAgentDraftRecord(
      draftRow({
        externalId: null,
        autonomyNotes: undefined,
        promotedAgentId: null,
        reviewNote: undefined,
      }),
    );

    expect(record.externalId).toBeNull();
    expect(record.autonomyNotes).toBeNull();
    expect(record.promotedAgentId).toBeNull();
    expect(record.reviewNote).toBeNull();
  });

  it("keeps nullable columns when they carry a value", () => {
    const record = toAgentDraftRecord(
      draftRow({
        externalId: "ext_42",
        autonomyNotes: "escala ao time humano",
        promotedAgentId: "agent_9",
        reviewNote: "aprovado pelo comitê",
      }),
    );

    expect(record.externalId).toBe("ext_42");
    expect(record.autonomyNotes).toBe("escala ao time humano");
    expect(record.promotedAgentId).toBe("agent_9");
    expect(record.reviewNote).toBe("aprovado pelo comitê");
  });

  it("passes the remaining fields through unchanged", () => {
    const record = toAgentDraftRecord(draftRow());

    expect(record.id).toBe("draft_1");
    expect(record.runId).toBe("run_1");
    expect(record.source).toBe("manual");
    expect(record.name).toBe("Agente de Triagem");
    expect(record.role).toBe("operador de triagem");
    expect(record.platform).toBe("chat");
    expect(record.tagline).toBe("Triagem em tempo real");
    expect(record.bio).toBe("Recebe tickets e classifica.");
    expect(record.shouldDo).toEqual(["classificar ticket"]);
    expect(record.shouldNotDo).toEqual(["fechar ticket"]);
    expect(record.autonomyLevel).toBe("escalates");
    expect(record.limits).toEqual(["sem acesso a dados sensíveis"]);
    expect(record.businessCase).toEqual(BUSINESS_CASE);
    expect(record.proposedMetrics).toEqual(PROPOSED_METRICS);
    expect(record.summary).toBe("Rascunho aguardando revisão.");
    expect(record.confidence).toBe(0.72);
    expect(record.enrichmentStatus).toBe("complete");
    expect(record.reviewStatus).toBe("pending");
  });

  it("exposes only the draft contract, without leaking row columns", () => {
    const record = toAgentDraftRecord(draftRow());

    expect(Object.keys(record).sort()).toEqual(
      [
        "autonomyLevel",
        "autonomyNotes",
        "bio",
        "businessCase",
        "confidence",
        "createdAt",
        "enrichmentStatus",
        "externalId",
        "id",
        "limits",
        "name",
        "platform",
        "proposedMetrics",
        "promotedAgentId",
        "reviewNote",
        "reviewStatus",
        "role",
        "runId",
        "shouldDo",
        "shouldNotDo",
        "source",
        "summary",
        "tagline",
        "updatedAt",
      ].sort(),
    );
    expect(record).not.toHaveProperty("orgId");
  });
});

describe("toAgentSummary", () => {
  it("serializes admittedAt and lastEvaluatedAt as ISO strings", () => {
    const summary = toAgentSummary(agentRow());

    expect(summary.admittedAt).toBe("2026-01-15T10:30:00.000Z");
    expect(summary.lastEvaluatedAt).toBe("2026-02-20T08:05:09.123Z");
  });

  it("falls back to null for absent areaId and avatarUrl", () => {
    const summary = toAgentSummary(agentRow({ areaId: null }));

    expect(summary.areaId).toBeNull();
    expect(summary.avatarUrl).toBeNull();
  });

  it("keeps areaId and avatarUrl when they carry a value", () => {
    const summary = toAgentSummary(
      agentRow({ areaId: "area_1", avatarUrl: "https://cdn/avatar.png" }),
    );

    expect(summary.areaId).toBe("area_1");
    expect(summary.avatarUrl).toBe("https://cdn/avatar.png");
  });

  it("defaults targetMetrics to [] and areaName to null", () => {
    const summary = toAgentSummary(agentRow());

    expect(summary.targetMetrics).toEqual([]);
    expect(summary.areaName).toBeNull();
  });

  it("returns the given targetMetrics and areaName as-is", () => {
    const targetMetrics = [
      {
        label: "Resolução",
        value: 91,
        unit: "%",
        trend: 4.2,
        direction: "up" as const,
      },
    ];
    const summary = toAgentSummary(agentRow(), targetMetrics, "Operações");

    expect(summary.targetMetrics).toBe(targetMetrics);
    expect(summary.areaName).toBe("Operações");
  });

  it("defaults owner fields to empty strings when owners is null or omitted", () => {
    for (const summary of [
      toAgentSummary(agentRow(), [], null, null),
      toAgentSummary(agentRow()),
    ]) {
      expect(summary.businessOwner).toBe("");
      expect(summary.technicalOwner).toBe("");
      expect(summary.governanceSponsor).toBe("");
    }
  });

  it("copies the owner fields when owners is provided", () => {
    const summary = toAgentSummary(agentRow(), [], null, {
      businessOwner: "bia@acme.com",
      technicalOwner: "teo@acme.com",
      governanceSponsor: "gabi@acme.com",
    });

    expect(summary.businessOwner).toBe("bia@acme.com");
    expect(summary.technicalOwner).toBe("teo@acme.com");
    expect(summary.governanceSponsor).toBe("gabi@acme.com");
  });

  it("passes the remaining fields through unchanged", () => {
    const summary = toAgentSummary(agentRow());

    expect(summary.id).toBe("agent_1");
    expect(summary.name).toBe("Agente de Triagem");
    expect(summary.slug).toBe("agente-de-triagem");
    expect(summary.role).toBe("operador de triagem");
    expect(summary.platform).toBe("chat");
    expect(summary.version).toBe("2.1.0");
    expect(summary.status).toBe("active");
    expect(summary.bio).toBe("Recebe tickets e classifica.");
    expect(summary.tagline).toBe("Triagem em tempo real");
    expect(summary.monthlyVolume).toBe(18400);
    expect(summary.headlineKpis).toEqual(HEADLINE_KPIS);
    expect(summary.currentVerdict).toBe("promote");
    expect(summary.verdictConfidence).toBe(0.81);
    expect(summary.severity).toBe("stable");
    expect(summary.healthScore).toBe(88.5);
    expect(summary.activeAlerts).toBe(2);
    expect(summary.monthlyValue).toBe(96000);
    expect(summary.monthlyCost).toBe(12300);
  });

  it("exposes only the summary contract, without leaking row columns", () => {
    const summary = toAgentSummary(agentRow());

    expect(Object.keys(summary).sort()).toEqual(
      [
        "activeAlerts",
        "admittedAt",
        "areaId",
        "areaName",
        "avatarUrl",
        "bio",
        "businessOwner",
        "currentVerdict",
        "governanceSponsor",
        "healthScore",
        "headlineKpis",
        "id",
        "lastEvaluatedAt",
        "monthlyCost",
        "monthlyValue",
        "monthlyVolume",
        "name",
        "platform",
        "role",
        "severity",
        "slug",
        "status",
        "tagline",
        "targetMetrics",
        "technicalOwner",
        "verdictConfidence",
        "version",
      ].sort(),
    );
    expect(summary).not.toHaveProperty("orgId");
    expect(summary).not.toHaveProperty("createdAt");
  });
});

describe("toEvaluation", () => {
  it("serializes evaluatedAt as an ISO string", () => {
    const evaluation = toEvaluation(evaluationRow());

    expect(evaluation.evaluatedAt).toBe("2026-02-20T08:05:09.123Z");
  });

  it("passes every field through unchanged", () => {
    const evaluation = toEvaluation(evaluationRow());

    expect(evaluation.id).toBe("eval_1");
    expect(evaluation.agentId).toBe("agent_1");
    expect(evaluation.window).toBe("30d");
    expect(evaluation.layers).toEqual(LAYERS);
    expect(evaluation.verdict).toBe("mentor");
    expect(evaluation.verdictConfidence).toBe(0.63);
    expect(evaluation.rationale).toBe("Ganha em eficiência, perde em adoção.");
  });

  it("exposes only the evaluation contract, without leaking row columns", () => {
    const evaluation = toEvaluation(evaluationRow());

    expect(Object.keys(evaluation).sort()).toEqual(
      [
        "agentId",
        "evaluatedAt",
        "id",
        "layers",
        "rationale",
        "verdict",
        "verdictConfidence",
        "window",
      ].sort(),
    );
  });
});

describe("toVerdict", () => {
  it("serializes createdAt as an ISO string", () => {
    const verdict = toVerdict(verdictRow());

    expect(verdict.createdAt).toBe("2026-01-15T10:30:00.000Z");
  });

  it("falls back to null for decidedBy and decidedAt when missing", () => {
    const verdict = toVerdict(
      verdictRow({ decidedBy: null, decidedAt: undefined }),
    );

    expect(verdict.decidedBy).toBeNull();
    expect(verdict.decidedAt).toBeNull();
  });

  it("serializes decidedAt as an ISO string when present", () => {
    const verdict = toVerdict(
      verdictRow({ decidedBy: "bia@acme.com", decidedAt: UPDATED_AT }),
    );

    expect(verdict.decidedBy).toBe("bia@acme.com");
    expect(verdict.decidedAt).toBe("2026-02-20T08:05:09.123Z");
  });

  it("passes every field through unchanged", () => {
    const verdict = toVerdict(verdictRow());

    expect(verdict.id).toBe("verdict_1");
    expect(verdict.agentId).toBe("agent_1");
    expect(verdict.verdict).toBe("promote");
    expect(verdict.confidence).toBe(0.81);
    expect(verdict.executionWindow).toBe("90d");
    expect(verdict.suggestedSponsor).toBe("sponsor_1");
    expect(verdict.nextActions).toEqual(NEXT_ACTIONS);
    expect(verdict.rationale).toBe("Payback dentro do alvo.");
    expect(verdict.decision).toBe("pending");
  });

  it("exposes only the verdict contract, without leaking row columns", () => {
    const verdict = toVerdict(verdictRow());

    expect(Object.keys(verdict).sort()).toEqual(
      [
        "agentId",
        "confidence",
        "createdAt",
        "decidedAt",
        "decidedBy",
        "decision",
        "executionWindow",
        "id",
        "nextActions",
        "rationale",
        "suggestedSponsor",
        "verdict",
      ].sort(),
    );
  });
});
