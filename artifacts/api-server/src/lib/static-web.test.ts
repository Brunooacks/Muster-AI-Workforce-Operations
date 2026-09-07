import { describe, expect, it } from "vitest";
import { resolveStaticWebRoot, shouldServeSpaNavigation } from "./static-web";

describe("static web production host", () => {
  it("keeps static hosting opt-in", () => {
    expect(resolveStaticWebRoot("")).toBeNull();
    expect(resolveStaticWebRoot(" ./public ")).toMatch(/public$/);
  });

  it("serves only browser navigations and never masks API routes", () => {
    expect(shouldServeSpaNavigation("GET", "/jornadas", "text/html,application/xhtml+xml")).toBe(true);
    expect(shouldServeSpaNavigation("GET", "/api/agents", "text/html")).toBe(false);
    expect(shouldServeSpaNavigation("POST", "/jornadas", "text/html")).toBe(false);
    expect(shouldServeSpaNavigation("GET", "/assets/app.js", "application/javascript")).toBe(false);
  });
});
