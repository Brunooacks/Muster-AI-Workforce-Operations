import { describe, expect, it } from "vitest";
import { redactConnectorMetadata } from "./redaction";

describe("redactConnectorMetadata", () => {
  it("redacts sensitive keys and known credential formats recursively", () => {
    const input = {
      connectorId: "connector_01",
      token: "github_pat_sensitive",
      nested: {
        apiKey: "secret-api-key",
        detail: "Authorization: Bearer top-secret",
        envelope: "mustercred:v1:nonce:tag:ciphertext",
      },
      list: [{ client_secret: "client-secret" }],
    };

    const redacted = redactConnectorMetadata(input);

    expect(redacted).toEqual({
      connectorId: "connector_01",
      token: "[REDACTED]",
      nested: {
        apiKey: "[REDACTED]",
        detail: "Authorization: Bearer [REDACTED]",
        envelope: "[REDACTED]",
      },
      list: [{ client_secret: "[REDACTED]" }],
    });
    expect(input.token).toBe("github_pat_sensitive");
  });

  it("redacts secrets embedded in errors and buffers", () => {
    const error = new Error("request failed with Bearer top-secret");
    const redacted = redactConnectorMetadata({
      error,
      payload: Buffer.from("secret"),
    });

    expect(redacted.error).toMatchObject({
      name: "Error",
      message: "request failed with Bearer [REDACTED]",
    });
    expect(redacted.payload).toBe("[REDACTED]");
  });
});
