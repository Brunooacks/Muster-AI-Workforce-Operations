export interface ContinuousTelemetryWorkerConfig {
  enabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
  processingTimeoutMs: number;
}

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function envInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return parsed;
}

export function continuousTelemetryWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ContinuousTelemetryWorkerConfig {
  return {
    enabled: envBoolean(env.CONTINUOUS_TELEMETRY_WORKER_ENABLED, true),
    pollIntervalMs: envInteger(
      env.CONTINUOUS_TELEMETRY_POLL_MS,
      1_000,
      100,
      60_000,
      "CONTINUOUS_TELEMETRY_POLL_MS",
    ),
    batchSize: envInteger(
      env.CONTINUOUS_TELEMETRY_BATCH_SIZE,
      20,
      1,
      500,
      "CONTINUOUS_TELEMETRY_BATCH_SIZE",
    ),
    maxAttempts: envInteger(
      env.CONTINUOUS_TELEMETRY_MAX_ATTEMPTS,
      5,
      1,
      50,
      "CONTINUOUS_TELEMETRY_MAX_ATTEMPTS",
    ),
    retryBaseMs: envInteger(
      env.CONTINUOUS_TELEMETRY_RETRY_BASE_MS,
      1_000,
      100,
      300_000,
      "CONTINUOUS_TELEMETRY_RETRY_BASE_MS",
    ),
    retryMaxMs: envInteger(
      env.CONTINUOUS_TELEMETRY_RETRY_MAX_MS,
      300_000,
      1_000,
      3_600_000,
      "CONTINUOUS_TELEMETRY_RETRY_MAX_MS",
    ),
    processingTimeoutMs: envInteger(
      env.CONTINUOUS_TELEMETRY_PROCESSING_TIMEOUT_MS,
      60_000,
      5_000,
      3_600_000,
      "CONTINUOUS_TELEMETRY_PROCESSING_TIMEOUT_MS",
    ),
  };
}
