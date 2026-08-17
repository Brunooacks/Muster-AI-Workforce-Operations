import { describe, expect, it } from "vitest";
import { supervisionFromHeartbeat } from "./supervision";

const now = new Date("2026-08-12T12:00:00.000Z");

describe("agent supervision freshness", () => {
  it("marks a recent heartbeat live", () => {
    expect(
      supervisionFromHeartbeat(now, {
        capturedAt: new Date("2026-08-12T11:59:40.000Z"),
        intervalSeconds: 30,
        runtime: "docker",
      }),
    ).toMatchObject({ status: "live", isStale: false, ageSeconds: 20 });
  });

  it("distinguishes delayed and stale runtimes", () => {
    expect(
      supervisionFromHeartbeat(now, {
        capturedAt: new Date("2026-08-12T11:58:30.000Z"),
        intervalSeconds: 30,
      }).status,
    ).toBe("delayed");
    expect(
      supervisionFromHeartbeat(now, {
        capturedAt: new Date("2026-08-12T11:57:00.000Z"),
        intervalSeconds: 30,
      }).status,
    ).toBe("stale");
  });

  it("reports unknown when no heartbeat exists", () => {
    expect(supervisionFromHeartbeat(now, null)).toMatchObject({
      status: "unknown",
      isStale: true,
      ageSeconds: -1,
    });
  });
});
