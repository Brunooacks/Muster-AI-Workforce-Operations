import { describe, expect, it } from "vitest";
import { allowedCorsOrigins, isCorsOriginAllowed } from "./cors-config";

describe("CORS allowlist", () => {
  it("combines and normalizes the configured web origins", () => {
    expect(
      allowedCorsOrigins({
        NODE_ENV: "production",
        WEB_APP_URL: "https://app.muster.example/path",
        CORS_ALLOWED_ORIGINS:
          "https://admin.muster.example, https://app.muster.example/",
      }),
    ).toEqual([
      "https://app.muster.example",
      "https://admin.muster.example",
    ]);
  });

  it("allows localhost explicitly only in development", () => {
    expect(
      allowedCorsOrigins({
        NODE_ENV: "development",
        WEB_APP_URL: undefined,
        CORS_ALLOWED_ORIGINS: undefined,
      }),
    ).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
    expect(
      allowedCorsOrigins({
        NODE_ENV: "production",
        WEB_APP_URL: undefined,
        CORS_ALLOWED_ORIGINS: undefined,
      }),
    ).toEqual([]);
  });

  it("accepts same-origin clients and rejects unknown browser origins", () => {
    const allowlist = ["https://app.muster.example"];
    expect(isCorsOriginAllowed(undefined, allowlist)).toBe(true);
    expect(
      isCorsOriginAllowed("https://app.muster.example", allowlist),
    ).toBe(true);
    expect(isCorsOriginAllowed("https://evil.example", allowlist)).toBe(false);
  });
});
