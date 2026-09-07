import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getContinuousTelemetryWorkerDiagnostics } from "../lib/continuous-telemetry-worker";
import { readOutboxHealthSnapshot } from "../lib/event-outbox";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/worker", async (_req, res) => {
  try {
    const queue = await readOutboxHealthSnapshot();
    const worker = getContinuousTelemetryWorkerDiagnostics();
    const degraded =
      queue.deadLetter > 0 ||
      (queue.oldestPendingAgeSeconds ?? 0) > 60 ||
      (worker.enabled && !worker.running);
    res.status(degraded ? 503 : 200).json({
      status: degraded ? "degraded" : "ok",
      worker,
      queue,
    });
  } catch {
    res.status(503).json({
      status: "unavailable",
      worker: getContinuousTelemetryWorkerDiagnostics(),
      queue: null,
    });
  }
});

export default router;
