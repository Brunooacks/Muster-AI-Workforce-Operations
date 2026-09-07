import app from "./app";
import { logger } from "./lib/logger";
import { ensureSeed } from "./lib/seed";
import { ensureCatalogSeed } from "./lib/catalog-seed";
import { backfillAgentScores } from "./lib/reevaluate";
import { seededEvaluationsAllowed } from "./lib/evaluation-policy";
import { startContinuousTelemetryWorker } from "./lib/continuous-telemetry-worker";
import { runStartupMigrations } from "./lib/startup-migrations";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const allowSeeded = seededEvaluationsAllowed();

async function initializeApplication(): Promise<void> {
  await runStartupMigrations();

  try {
    if (allowSeeded) {
      await ensureSeed();
    } else {
      logger.info("Demo fleet seed disabled; starting without fabricated agent data.");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed database");
  }

  try {
    await ensureCatalogSeed();
  } catch (err) {
    logger.error({ err }, "Failed to seed metric catalog");
  }

  if (allowSeeded) {
    try {
      await backfillAgentScores();
    } catch (err) {
      logger.error({ err }, "Failed to backfill agent scores");
    }
  }
}

initializeApplication()
  .then(() => {
    app.listen(port, (err) => {
      if (err) throw err;
      logger.info({ port }, "Server listening");
      startContinuousTelemetryWorker();
    });
  })
  .catch((err) => {
    logger.fatal({ err }, "Application startup failed");
    process.exit(1);
  });
