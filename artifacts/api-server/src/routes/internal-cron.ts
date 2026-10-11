import { timingSafeEqual } from "crypto";
import { Router, type IRouter } from "express";
import { syncAllLangfuseConnectors } from "../lib/connectors/langfuse/sync";

const router: IRouter = Router();

router.post("/internal/cron/langfuse-ingestion", async (req, res) => {
  const token = process.env.MUSTER_INTERNAL_CRON_TOKEN;
  const authorization = req.get("authorization");
  const expectedAuthorization = token ? `Bearer ${token}` : undefined;
  if (!expectedAuthorization || !authorization || !safeEqual(authorization, expectedAuthorization)) {
    res.status(401).json({ error: "Não autorizado." });
    return;
  }

  try {
    const result = await syncAllLangfuseConnectors();
    res.status(result.failed.length === 0 ? 200 : 207).json({
      completed: result.completed.length,
      failed: result.failed,
    });
  } catch (error) {
    req.log.error(
      { errorType: error instanceof Error ? error.name : typeof error },
      "Falha na sincronização interna do Langfuse.",
    );
    res.status(500).json({ error: "Falha ao sincronizar conectores Langfuse." });
  }
});

function safeEqual(presented: string, expected: string): boolean {
  const presentedBuffer = Buffer.from(presented, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return presentedBuffer.length === expectedBuffer.length
    && timingSafeEqual(presentedBuffer, expectedBuffer);
}

export default router;
