import app from "./app";
import { logger } from "./lib/logger";
import { ensureSeed } from "./lib/seed";
import { backfillAgentScores } from "./lib/reevaluate";

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

ensureSeed()
  .catch((err) => {
    logger.error({ err }, "Failed to seed database");
  })
  .then(() => backfillAgentScores())
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
