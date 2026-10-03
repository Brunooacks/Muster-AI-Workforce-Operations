import type { Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/continuous-telemetry-worker", () => ({
  getContinuousTelemetryWorkerDiagnostics: vi.fn(),
}));
vi.mock("../lib/event-outbox", () => ({ readOutboxHealthSnapshot: vi.fn() }));

import healthRouter, { healthCheckPayload } from "./health";

describe("health check", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes the package version and the image git SHA", () => {
    vi.stubEnv("GIT_SHA", "abc123");

    const app = express();
    app.use(healthRouter);
    const server = app.listen(0) as Server;

    return new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", async () => {
        try {
          const address = server.address();
          if (!address || typeof address === "string") {
            throw new Error("Health test server unavailable");
          }
          const response = await fetch(
            `http://127.0.0.1:${address.port}/healthz`,
          );
          expect(response.status).toBe(200);
          expect(await response.json()).toEqual({
            status: "ok",
            version: "0.0.0",
            sha: "abc123",
          });
          server.close(() => resolve());
        } catch (error) {
          server.close(() => reject(error));
        }
      });
    });
  });

  it("uses unknown when the image SHA was not provided", () => {
    vi.stubEnv("GIT_SHA", "");

    expect(healthCheckPayload()).toMatchObject({ sha: "unknown" });
  });
});
