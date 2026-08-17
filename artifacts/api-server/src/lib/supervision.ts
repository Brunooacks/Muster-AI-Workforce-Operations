export type SupervisionStatus = "live" | "delayed" | "stale" | "unknown";

export interface HeartbeatSnapshot {
  capturedAt: Date | null;
  intervalSeconds?: number;
  runtime?: string;
  version?: string;
  reportedStatus?: string;
}

export interface SupervisionResult {
  status: SupervisionStatus;
  isStale: boolean;
  intervalSeconds: number;
  ageSeconds: number;
  lastHeartbeatAt: string | null;
  runtime: string | null;
  version: string | null;
  reportedStatus: string | null;
}

export function supervisionFromHeartbeat(
  now: Date,
  heartbeat: HeartbeatSnapshot | null,
  fallbackIntervalSeconds = 30,
): SupervisionResult {
  const intervalSeconds = Math.max(
    5,
    Math.min(900, heartbeat?.intervalSeconds ?? fallbackIntervalSeconds),
  );
  if (!heartbeat?.capturedAt) {
    return {
      status: "unknown",
      isStale: true,
      intervalSeconds,
      ageSeconds: -1,
      lastHeartbeatAt: null,
      runtime: heartbeat?.runtime ?? null,
      version: heartbeat?.version ?? null,
      reportedStatus: heartbeat?.reportedStatus ?? null,
    };
  }

  const ageSeconds = Math.max(
    0,
    Math.round((now.getTime() - heartbeat.capturedAt.getTime()) / 1000),
  );
  const status: SupervisionStatus =
    ageSeconds <= intervalSeconds * 1.5
      ? "live"
      : ageSeconds <= intervalSeconds * 3
        ? "delayed"
        : "stale";

  return {
    status,
    isStale: status === "stale",
    intervalSeconds,
    ageSeconds,
    lastHeartbeatAt: heartbeat.capturedAt.toISOString(),
    runtime: heartbeat.runtime ?? null,
    version: heartbeat.version ?? null,
    reportedStatus: heartbeat.reportedStatus ?? null,
  };
}
