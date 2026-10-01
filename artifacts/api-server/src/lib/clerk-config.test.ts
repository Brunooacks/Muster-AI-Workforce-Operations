import { describe, expect, it } from "vitest";
import { clerkRuntimeConfig } from "./clerk-config";

describe("clerkRuntimeConfig", () => {
  it("returns the configured Clerk keys", () => {
    expect(
      clerkRuntimeConfig({
        CLERK_SECRET_KEY: "  sk_test_example  ",
        CLERK_PUBLISHABLE_KEY: "  pk_test_example  ",
      }),
    ).toEqual({
      secretKey: "sk_test_example",
      publishableKey: "pk_test_example",
    });
  });

  it("fails closed when Clerk keys are missing", () => {
    expect(() =>
      clerkRuntimeConfig({
        CLERK_SECRET_KEY: "",
        CLERK_PUBLISHABLE_KEY: undefined,
      }),
    ).toThrow(
      "Clerk authentication is required. Missing environment variables: CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY.",
    );
  });
});
