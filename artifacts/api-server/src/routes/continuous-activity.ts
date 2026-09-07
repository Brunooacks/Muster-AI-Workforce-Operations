import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { listOutboxActivity, type OutboxActivity } from "../lib/event-outbox";

const router: IRouter = Router();
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SSE_POLL_MS = 1_000;
const SSE_HEARTBEAT_MS = 15_000;

function requestedLimit(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : DEFAULT_LIMIT;
  if (!Number.isInteger(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

export function serializeActivity(activity: OutboxActivity) {
  return {
    ...activity,
    availableAt: activity.availableAt.toISOString(),
    processedAt: activity.processedAt?.toISOString() ?? null,
    createdAt: activity.createdAt.toISOString(),
  };
}

router.get(
  "/telemetry/activity",
  requireAuth,
  requireOrg,
  async (req, res) => {
    const activities = await listOutboxActivity({
      orgId: req.orgId!,
      afterId: typeof req.query.after === "string" ? req.query.after : undefined,
      limit: requestedLimit(req.query.limit),
    });
    const items = activities.map(serializeActivity);
    res.json({
      items,
      nextCursor: items.at(-1)?.id ?? null,
      freshness: {
        serverTime: new Date().toISOString(),
        pollingRecommendedMs: 2_000,
        projectionTargetSeconds: 10,
      },
    });
  },
);

router.get(
  "/telemetry/activity/stream",
  requireAuth,
  requireOrg,
  async (req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(`retry: ${SSE_POLL_MS * 2}\n\n`);

    let cursor =
      req.header("last-event-id") ??
      (typeof req.query.after === "string" ? req.query.after : undefined);
    let closed = false;
    let lastHeartbeatAt = Date.now();
    req.on("close", () => {
      closed = true;
    });

    while (!closed) {
      const activities = await listOutboxActivity({
        orgId: req.orgId!,
        afterId: cursor,
        limit: DEFAULT_LIMIT,
      });
      for (const activity of activities) {
        const serialized = serializeActivity(activity);
        res.write(`id: ${activity.id}\n`);
        res.write("event: activity\n");
        res.write(`data: ${JSON.stringify(serialized)}\n\n`);
        cursor = activity.id;
      }
      if (Date.now() - lastHeartbeatAt >= SSE_HEARTBEAT_MS) {
        res.write(`: keep-alive ${new Date().toISOString()}\n\n`);
        lastHeartbeatAt = Date.now();
      }
      await new Promise<void>((resolve) => setTimeout(resolve, SSE_POLL_MS));
    }
    res.end();
  },
);

export default router;
