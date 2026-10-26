import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_ENVELOPE_MAX_ATTEMPTS_DEFAULT, TaskEnvelope } from "@workspace/api-zod";

const schema = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../../lib/api-spec/task-envelope.schema.json"), "utf8"),
) as {
  required: string[];
  additionalProperties: boolean;
  properties: Record<string, { enum?: string[]; default?: unknown }>;
};

const valido = {
  task_id: "task_1",
  org_id: "org_1",
  project_id: "prj_1",
  environment: "sandbox",
  agent_id: "agent_1",
  stage: "evaluate",
  attempt: 1,
  idempotency_key: "agent_1:evt_1",
  payload: { eventId: "evt_1" },
};

describe("envelope de tarefa (T1.8)", () => {
  it("aceita o envelope mínimo e preenche max_attempts = 8 (D-E3-1)", () => {
    const parsed = TaskEnvelope.parse(valido);
    expect(parsed.max_attempts).toBe(8);
    expect(TaskEnvelope.parse({ ...valido, environment: "prod", attempt: 8 }).attempt).toBe(8);
  });

  it.each([
    ["sem project_id", { ...valido, project_id: undefined }],
    ["project_id vazio", { ...valido, project_id: "" }],
    ["environment fora do enum", { ...valido, environment: "staging" }],
    ["attempt zero", { ...valido, attempt: 0 }],
    ["attempt fracionado", { ...valido, attempt: 1.5 }],
    ["attempt acima de max_attempts", { ...valido, attempt: 9 }],
    ["campo desconhecido", { ...valido, tenant: "x" }],
    ["payload não-objeto", { ...valido, payload: "x" }],
    ["idempotency_key longa demais", { ...valido, idempotency_key: "k".repeat(201) }],
  ])("recusa %s", (_caso, entrada) => {
    expect(TaskEnvelope.safeParse(entrada).success).toBe(false);
  });

  it("Zod e JSON Schema não divergem (obrigatórios, enum, default, estrito)", () => {
    const forma = (TaskEnvelope as unknown as { _def: { schema: { shape: Record<string, { isOptional(): boolean }> } } })
      ._def.schema.shape;
    const obrigatoriosZod = Object.entries(forma)
      .filter(([, campo]) => !campo.isOptional())
      .map(([nome]) => nome)
      .sort();
    expect(obrigatoriosZod).toEqual([...schema.required].sort());
    expect(Object.keys(forma).sort()).toEqual(Object.keys(schema.properties).sort());
    expect(schema.properties.environment!.enum).toEqual(["sandbox", "prod"]);
    expect(schema.properties.max_attempts!.default).toBe(TASK_ENVELOPE_MAX_ATTEMPTS_DEFAULT);
    expect(schema.additionalProperties).toBe(false);
  });
});
