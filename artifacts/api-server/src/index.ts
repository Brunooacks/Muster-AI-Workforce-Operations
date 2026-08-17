import app from "./app";
import { logger } from "./lib/logger";
import { ensureSeed } from "./lib/seed";
import { ensureCatalogSeed } from "./lib/catalog-seed";
import { backfillAgentScores } from "./lib/reevaluate";
import { seededEvaluationsAllowed } from "./lib/evaluation-policy";

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

(allowSeeded
  ? ensureSeed()
  : Promise.resolve().then(() => {
      logger.info("Demo fleet seed disabled; starting without fabricated agent data.");
    }))
  .catch((err) => {
    logger.error({ err }, "Failed to seed database");
  })
  .then(() => ensureCatalogSeed())
  .catch((err) => {
    logger.error({ err }, "Failed to seed metric catalog");
  })
  .then(() => (allowSeeded ? backfillAgentScores() : undefined))
  .catch((err) => {
    logger.error({ err }, "Failed to backfill agent scores");
  })
  .finally(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  });
