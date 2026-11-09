import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EnvelopeError,
  TaskEnvelope,
  VELTRIX_FIELD_HEADERS,
  toEnvelope,
  type AgentEventEnvelopeSource,
} from "@workspace/api-zod";

/** Paridade evento ↔ envelope da E3 (cunha · C1.5). */

const root = join(import.meta.dirname, "../../../..");
const envelopeSchema = JSON.parse(readFileSync(join(root, "lib/api-spec/task-envelope.schema.json"), "utf8")) as {
  properties: Record<string, unknown>;
};
const sdk = readFileSync(join(root, "lib/telemetry-reporter/src/index.ts"), "utf8");
const eventContract = JSON.parse(readFileSync(join(root, "specs/004-cunha/contracts/agent-event.v2.json"), "utf8")) as {
  properties: Record<string, { description?: string }>;
};

const base: AgentEventEnvelopeSource = {
  id: "evt_1",
  agentId: "agent_1",
  orgId: "org_1",
  projectId: "prj_1",
  environmentKind: "prod",
  kind: "execution",
  ts: new Date("2026-10-24T12:00:00.000Z"),
  taskId: "task_1",
  runId: "run_1",
  attempt: 1,
  retryOf: null,
};

const fixtures: AgentEventEnvelopeSource[] = [
  base,
  { ...base, id: "evt_2", kind: "error", runId: "run_2", attempt: 2, retryOf: "run_1", environmentKind: "sandbox" },
  { ...base, id: "evt_3", kind: "human_review", runId: "run_2", attempt: 2 },
  { ...base, id: "evt_4", kind: "feedback", runId: null, attempt: null, ts: "2026-10-24T12:01:00.000Z" },
];

describe("toEnvelope (C1.5)", () => {
  it.each(fixtures.map((f) => [f.id, f] as const))("%s com task_id valida no schema do envelope", (_id, row) => {
    const envelope = toEnvelope(row);
    expect(TaskEnvelope.safeParse(envelope).success).toBe(true);
    expect(envelope).toMatchObject({
      task_id: row.taskId,
      org_id: row.orgId,
      project_id: row.projectId,
      environment: row.environmentKind,
      agent_id: row.agentId,
      attempt: row.attempt ?? 1,
    });
    expect(envelope.payload).toMatchObject({ event_id: row.id, run_id: row.runId, retry_of: row.retryOf });
    // Só campos do JSON Schema (o envelope é estrito).
    expect(Object.keys(envelope).every((k) => k in envelopeSchema.properties)).toBe(true);
  });

  it("evento sem task_id ou sem tenant completo não vira envelope", () => {
    expect(() => toEnvelope({ ...base, taskId: null })).toThrow(EnvelopeError);
    expect(() => toEnvelope({ ...base, environmentKind: null })).toThrow(EnvelopeError);
    expect(() => toEnvelope({ ...base, orgId: null })).toThrow(EnvelopeError);
  });

  it("nomes iguais aos headers x-veltrix-* (quebra se um divergir)", () => {
    for (const [campo, header] of Object.entries(VELTRIX_FIELD_HEADERS)) {
      // x-veltrix-task → task_id; x-veltrix-run → run_id.
      expect(`${header.replace(/^x-veltrix-/, "")}_id`).toBe(campo);
    }
    // task_id é campo do envelope; run_id vai no payload.
    expect(envelopeSchema.properties).toHaveProperty("task_id");
    expect(toEnvelope(base).payload).toHaveProperty("run_id");
    // SDK e contrato v2 usam os mesmos headers.
    expect(sdk).toContain(`VELTRIX_TASK_HEADER = "${VELTRIX_FIELD_HEADERS.task_id}"`);
    expect(sdk).toContain(`VELTRIX_RUN_HEADER = "${VELTRIX_FIELD_HEADERS.run_id}"`);
    expect(eventContract.properties.taskId!.description).toBe(VELTRIX_FIELD_HEADERS.task_id);
    expect(eventContract.properties.runId!.description).toBe(VELTRIX_FIELD_HEADERS.run_id);
  });
});
