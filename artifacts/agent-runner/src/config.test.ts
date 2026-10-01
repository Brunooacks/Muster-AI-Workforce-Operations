import { describe, expect, it } from "vitest";
import { parseRunnerConfig } from "./config";

const authenticatedDryRun = {
  AGENT_MODE: "dry-run",
  MUSTER_AGENT_ID: "agent-123",
  MUSTER_AUTH_TOKEN: "agent-secret",
};

describe("runner configuration", () => {
  it("requires an explicit agent identity in dry-run", () => {
    expect(() => parseRunnerConfig({
      AGENT_MODE: "dry-run",
      MUSTER_AUTH_TOKEN: "agent-secret",
    })).toThrow("MUSTER_AGENT_ID");
  });

  it("requires the agent API key in dry-run", () => {
    expect(() => parseRunnerConfig({
      AGENT_MODE: "dry-run",
      MUSTER_AGENT_ID: "agent-123",
    })).toThrow("MUSTER_AUTH_TOKEN");
  });

  it("does not require an LLM credential in authenticated dry-run", () => {
    expect(parseRunnerConfig(authenticatedDryRun)).toMatchObject({
      agentId: "agent-123",
      authToken: "agent-secret",
      mode: "dry-run",
      backend: "local",
      llmApiKey: "dry-run",
    });
  });

  it("requires a provider credential in live mode", () => {
    expect(() => parseRunnerConfig({
      MUSTER_AGENT_ID: "agent-123",
      MUSTER_AUTH_TOKEN: "agent-secret",
    })).toThrow("AI_INTEGRATIONS_OPENAI_API_KEY");
  });

  it("accepts an OpenAI-compatible provider configuration", () => {
    expect(parseRunnerConfig({
      MUSTER_AGENT_ID: "agent-123",
      MUSTER_AUTH_TOKEN: "agent-secret",
      OPENAI_API_KEY: "provider-secret",
      OPENAI_BASE_URL: "https://llm.internal/v1/",
    })).toMatchObject({
      mode: "live",
      llmApiKey: "provider-secret",
      llmBaseUrl: "https://llm.internal/v1",
    });
  });

  it("rejects invalid modes, backends and numeric limits", () => {
    expect(() => parseRunnerConfig({
      ...authenticatedDryRun,
      AGENT_MODE: "anonymous",
    })).toThrow("AGENT_MODE");
    expect(() => parseRunnerConfig({
      ...authenticatedDryRun,
      MUSTER_EXECUTION_BACKEND: "shell",
    })).toThrow("MUSTER_EXECUTION_BACKEND");
    expect(() => parseRunnerConfig({
      ...authenticatedDryRun,
      MUSTER_TASK_TIMEOUT_MS: "NaN",
    })).toThrow("inteiro positivo");
  });
});
