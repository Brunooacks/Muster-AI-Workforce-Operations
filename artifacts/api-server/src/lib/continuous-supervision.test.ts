import { describe, expect, it } from "vitest";
import {
  retryAvailableAt,
  retryDelayMs,
  shouldDeadLetter,
  supervisionDispatchFor,
} from "./continuous-supervision";

describe("continuous supervision policy", () => {
  it("reevaluates failures immediately with the highest priority", () => {
    expect(supervisionDispatchFor("error")).toEqual({
      shouldReevaluate: true,
      priority: "critical",
      debounceMs: 0,
    });
    expect(supervisionDispatchFor("escalation").debounceMs).toBe(0);
  });

  it("debounces successful executions and ignores heartbeats for scoring", () => {
    expect(supervisionDispatchFor("execution")).toMatchObject({
      shouldReevaluate: true,
      priority: "normal",
      debounceMs: 5_000,
    });
    expect(supervisionDispatchFor("heartbeat").shouldReevaluate).toBe(false);
  });

  it("applies bounded exponential backoff", () => {
    expect(retryDelayMs(0)).toBe(1_000);
    expect(retryDelayMs(3)).toBe(8_000);
    expect(retryDelayMs(20)).toBe(300_000);
    expect(retryAvailableAt(new Date("2026-08-23T12:00:00Z"), 2)).toEqual(
      new Date("2026-08-23T12:00:04Z"),
    );
  });

  it("dead-letters poison events after the configured limit", () => {
    expect(shouldDeadLetter(4)).toBe(false);
    expect(shouldDeadLetter(5)).toBe(true);
  });
});
