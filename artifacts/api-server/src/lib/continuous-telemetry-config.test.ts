import { describe, expect, it } from "vitest";
import { continuousTelemetryWorkerConfig } from "./continuous-telemetry-config";

describe("continuous telemetry worker config", () => {
  it("starts enabled with bounded operational defaults", () => {
    expect(continuousTelemetryWorkerConfig({})).toEqual({
      enabled: true,
      pollIntervalMs: 1_000,
      batchSize: 20,
      maxAttempts: 5,
      retryBaseMs: 1_000,
      retryMaxMs: 300_000,
      processingTimeoutMs: 60_000,
    });
  });

  it("supports explicit opt-out", () => {
    expect(
      continuousTelemetryWorkerConfig({
        CONTINUOUS_TELEMETRY_WORKER_ENABLED: "false",
      }).enabled,
    ).toBe(false);
  });

  it("accepts tuning and rejects unsafe values", () => {
    const config = continuousTelemetryWorkerConfig({
      CONTINUOUS_TELEMETRY_POLL_MS: "500",
      CONTINUOUS_TELEMETRY_BATCH_SIZE: "50",
      CONTINUOUS_TELEMETRY_MAX_ATTEMPTS: "8",
    });
    expect(config).toMatchObject({
      pollIntervalMs: 500,
      batchSize: 50,
      maxAttempts: 8,
    });
    expect(() =>
      continuousTelemetryWorkerConfig({
        CONTINUOUS_TELEMETRY_BATCH_SIZE: "0",
      }),
    ).toThrow("CONTINUOUS_TELEMETRY_BATCH_SIZE");
  });
});
