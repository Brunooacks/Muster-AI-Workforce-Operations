import { describe, expect, it } from "vitest";
import { startupMigrationsEnabled } from "./startup-migrations";

describe("startup migrations", () => {
  it("requires an explicit production opt-in", () => {
    expect(startupMigrationsEnabled()).toBe(false);
    expect(startupMigrationsEnabled("false")).toBe(false);
    expect(startupMigrationsEnabled("TRUE")).toBe(true);
  });
});
