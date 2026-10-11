import { Router, type IRouter } from "express";
import { syncAllLangfuseConnectors } from "../lib/connectors/langfuse/sync";

const router: IRouter = Router();

router.post("/internal/cron/langfuse-ingestion", async (req, res) => {
  const token = process.env.MUSTER_INTERNAL_CRON_TOKEN;
  if (!token || req.get("authorization") !== `Bearer ${token}`) {
    res.status(401).json({ error: "Não autorizado." });
    return;
  }

  const result = await syncAllLangfuseConnectors();
  res.status(result.failed.length === 0 ? 200 : 207).json({
    completed: result.completed.length,
    failed: result.failed,
  });
});

export default router;
