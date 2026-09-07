import { pool } from "@workspace/db";
import type { OutboxPriority, OutboxStatus } from "@workspace/db";
import { AGENT_TELEMETRY_EVENT_TYPE } from "./agent-telemetry-reevaluation";

export interface ClaimedOutboxEvent {
  id: string;
  orgId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  priority: OutboxPriority;
  availableAt: Date;
  attempts: number;
  status: OutboxStatus;
  processedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OutboxDatabaseRow {
  id: string;
  org_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  priority: OutboxPriority;
  available_at: Date;
  attempts: number;
  status: OutboxStatus;
  processed_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapOutboxRow(row: OutboxDatabaseRow): ClaimedOutboxEvent {
  return {
    id: row.id,
    orgId: row.org_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payload: row.payload,
    priority: row.priority,
    availableAt: row.available_at,
    attempts: row.attempts,
    status: row.status,
    processedAt: row.processed_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function recoverStaleOutboxEvents(
  processingTimeoutMs: number,
): Promise<number> {
  const result = await pool.query(
    `UPDATE event_outbox
       SET status = 'pending',
           available_at = now(),
           last_error = 'Processing lease expired; event reclaimed.',
           updated_at = now()
     WHERE status = 'processing'
       AND updated_at < now() - ($1::int * interval '1 millisecond')`,
    [processingTimeoutMs],
  );
  return result.rowCount ?? 0;
}

export async function claimTelemetryOutboxEvents(
  limit: number,
): Promise<ClaimedOutboxEvent[]> {
  const result = await pool.query(
    `WITH candidates AS (
       SELECT id
       FROM event_outbox
       WHERE status = 'pending'
         AND event_type = $2
         AND available_at <= now()
       ORDER BY
         CASE priority
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'normal' THEN 2
           ELSE 3
         END,
         available_at,
         created_at
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE event_outbox AS outbox
        SET status = 'processing',
            attempts = outbox.attempts + 1,
            updated_at = now()
       FROM candidates
      WHERE outbox.id = candidates.id
     RETURNING outbox.*`,
    [limit, AGENT_TELEMETRY_EVENT_TYPE],
  );
  return (result.rows as OutboxDatabaseRow[]).map(mapOutboxRow);
}

export async function completeOutboxEvent(input: {
  id: string;
  orgId: string;
}): Promise<boolean> {
  const result = await pool.query(
    `UPDATE event_outbox
        SET status = 'completed',
            processed_at = now(),
            last_error = NULL,
            updated_at = now()
      WHERE id = $1
        AND org_id = $2
        AND status = 'processing'`,
    [input.id, input.orgId],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function coalescePendingAgentTelemetry(input: {
  orgId: string;
  agentId: string;
  createdBefore: Date;
}): Promise<number> {
  const result = await pool.query(
    `UPDATE event_outbox
        SET status = 'completed',
            processed_at = now(),
            last_error = NULL,
            updated_at = now()
      WHERE org_id = $1
        AND aggregate_type = 'agent'
        AND aggregate_id = $2
        AND event_type = $3
        AND status = 'pending'
        AND created_at <= $4`,
    [
      input.orgId,
      input.agentId,
      AGENT_TELEMETRY_EVENT_TYPE,
      input.createdBefore,
    ],
  );
  return result.rowCount ?? 0;
}

export async function releaseOutboxEvent(input: {
  id: string;
  orgId: string;
  availableAt: Date;
}): Promise<void> {
  await pool.query(
    `UPDATE event_outbox
        SET status = 'pending',
            attempts = GREATEST(attempts - 1, 0),
            available_at = $3,
            updated_at = now()
      WHERE id = $1
        AND org_id = $2
        AND status = 'processing'`,
    [input.id, input.orgId, input.availableAt],
  );
}

export async function failOutboxEvent(input: {
  id: string;
  orgId: string;
  error: string;
  deadLetter: boolean;
  availableAt: Date;
}): Promise<void> {
  await pool.query(
    `UPDATE event_outbox
        SET status = $3,
            available_at = $4,
            processed_at = CASE WHEN $3 = 'dead-letter' THEN now() ELSE NULL END,
            last_error = $5,
            updated_at = now()
      WHERE id = $1
        AND org_id = $2
        AND status = 'processing'`,
    [
      input.id,
      input.orgId,
      input.deadLetter ? "dead-letter" : "pending",
      input.availableAt,
      input.error.slice(0, 2_000),
    ],
  );
}

export async function withAgentAdvisoryLock<T>(
  orgId: string,
  agentId: string,
  task: () => Promise<T>,
): Promise<{ acquired: boolean; result?: T }> {
  const client = await pool.connect();
  const lockKey = `${orgId}:${agentId}`;
  let acquired = false;
  try {
    const lock = await client.query(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked",
      [lockKey],
    );
    acquired = (lock.rows[0] as { locked?: boolean } | undefined)?.locked === true;
    if (!acquired) return { acquired: false };
    return { acquired: true, result: await task() };
  } finally {
    if (acquired) {
      await client
        .query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [lockKey])
        .catch(() => undefined);
    }
    client.release();
  }
}

export interface OutboxActivity {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  priority: OutboxPriority;
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

function activityFromRow(row: OutboxDatabaseRow): OutboxActivity {
  const mapped = mapOutboxRow(row);
  return {
    id: mapped.id,
    aggregateType: mapped.aggregateType,
    aggregateId: mapped.aggregateId,
    eventType: mapped.eventType,
    payload: mapped.payload,
    priority: mapped.priority,
    status: mapped.status,
    attempts: mapped.attempts,
    availableAt: mapped.availableAt,
    processedAt: mapped.processedAt,
    lastError: mapped.lastError,
    createdAt: mapped.createdAt,
  };
}

export async function listOutboxActivity(input: {
  orgId: string;
  afterId?: string;
  limit: number;
}): Promise<OutboxActivity[]> {
  if (input.afterId) {
    const result = await pool.query(
      `WITH cursor AS (
         SELECT created_at, id
           FROM event_outbox
          WHERE org_id = $1 AND id = $2
       )
       SELECT outbox.*
         FROM event_outbox AS outbox
         CROSS JOIN cursor
        WHERE outbox.org_id = $1
          AND (outbox.created_at, outbox.id) > (cursor.created_at, cursor.id)
        ORDER BY outbox.created_at ASC, outbox.id ASC
        LIMIT $3`,
      [input.orgId, input.afterId, input.limit],
    );
    return (result.rows as OutboxDatabaseRow[]).map(activityFromRow);
  }

  const result = await pool.query(
    `SELECT *
       FROM event_outbox
      WHERE org_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [input.orgId, input.limit],
  );
  return (result.rows as OutboxDatabaseRow[]).map(activityFromRow).reverse();
}

export interface OutboxHealthSnapshot {
  pending: number;
  processing: number;
  deadLetter: number;
  oldestPendingAgeSeconds: number | null;
}

export async function readOutboxHealthSnapshot(): Promise<OutboxHealthSnapshot> {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
       COUNT(*) FILTER (WHERE status = 'processing')::text AS processing,
       COUNT(*) FILTER (WHERE status = 'dead-letter')::text AS dead_letter,
       EXTRACT(EPOCH FROM (
         now() - MIN(available_at) FILTER (
           WHERE status = 'pending' AND available_at <= now()
         )
       ))::text
         AS oldest_pending_age_seconds
     FROM event_outbox`,
  );
  const row = result.rows[0] as
    | {
        pending?: string;
        processing?: string;
        dead_letter?: string;
        oldest_pending_age_seconds?: string | null;
      }
    | undefined;
  return {
    pending: Number(row?.pending ?? 0),
    processing: Number(row?.processing ?? 0),
    deadLetter: Number(row?.dead_letter ?? 0),
    oldestPendingAgeSeconds:
      row?.oldest_pending_age_seconds == null
        ? null
        : Math.max(0, Number(row.oldest_pending_age_seconds)),
  };
}
