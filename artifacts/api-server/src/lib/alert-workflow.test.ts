import { describe, expect, it } from "vitest";
import { applyAlertUpdate, type AlertWorkflowState } from "./alert-workflow";

const now = new Date("2026-07-31T12:00:00.000Z");

function state(overrides: Partial<AlertWorkflowState> = {}): AlertWorkflowState {
  return {
    status: "active",
    assignedTo: null,
    dueAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe("applyAlertUpdate", () => {
  it("assigns an owner and deadline without changing status", () => {
    const dueAt = new Date("2026-08-05T23:59:59.999Z");
    expect(applyAlertUpdate(state(), { assignedTo: "Time de Growth", dueAt }, now)).toEqual({
      status: "active",
      assignedTo: "Time de Growth",
      dueAt,
      acknowledgedAt: null,
      resolvedAt: null,
    });
  });

  it("records acknowledgement time once", () => {
    const first = applyAlertUpdate(state(), { status: "acknowledged" }, now);
    const later = new Date("2026-08-01T12:00:00.000Z");
    expect(first.acknowledgedAt).toEqual(now);
    expect(applyAlertUpdate(first, { status: "acknowledged" }, later).acknowledgedAt).toEqual(now);
  });

  it("resolves while preserving acknowledgement and assignment", () => {
    const acknowledgedAt = new Date("2026-07-30T12:00:00.000Z");
    const current = state({
      status: "acknowledged",
      assignedTo: "Marina",
      acknowledgedAt,
    });
    const resolved = applyAlertUpdate(current, { status: "resolved" }, now);
    expect(resolved).toMatchObject({
      status: "resolved",
      assignedTo: "Marina",
      acknowledgedAt,
      resolvedAt: now,
    });
  });

  it("reopens an alert and clears lifecycle timestamps", () => {
    const reopened = applyAlertUpdate(
      state({
        status: "resolved",
        assignedTo: "Comitê de IA",
        dueAt: new Date("2026-07-30T23:59:59.999Z"),
        acknowledgedAt: new Date("2026-07-28T12:00:00.000Z"),
        resolvedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
      { status: "active" },
      now,
    );
    expect(reopened).toEqual({
      status: "active",
      assignedTo: "Comitê de IA",
      dueAt: new Date("2026-07-30T23:59:59.999Z"),
      acknowledgedAt: null,
      resolvedAt: null,
    });
  });
});
