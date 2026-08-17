import type { AlertStatus } from "@workspace/db";

export interface AlertWorkflowState {
  status: AlertStatus;
  assignedTo: string | null;
  dueAt: Date | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

export interface AlertWorkflowUpdate {
  status?: AlertStatus;
  assignedTo?: string | null;
  dueAt?: Date | null;
}

export function applyAlertUpdate(
  current: AlertWorkflowState,
  update: AlertWorkflowUpdate,
  now: Date,
): AlertWorkflowState {
  const status = update.status ?? current.status;

  return {
    status,
    assignedTo:
      update.assignedTo !== undefined ? update.assignedTo : current.assignedTo,
    dueAt: update.dueAt !== undefined ? update.dueAt : current.dueAt,
    acknowledgedAt:
      status === "acknowledged"
        ? current.acknowledgedAt ?? now
        : status === "active"
          ? null
          : current.acknowledgedAt,
    resolvedAt:
      status === "resolved"
        ? current.resolvedAt ?? now
        : status === "active"
          ? null
          : current.resolvedAt,
  };
}
