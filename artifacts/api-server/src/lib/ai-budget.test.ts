import { afterEach, describe, expect, it, vi } from "vitest";
import {
  withAiBudgetUsingStore,
  type AiUsageStore,
} from "./ai-budget";

const envKeys = [
  "AI_MONTHLY_BUDGET_USD",
  "AI_DAILY_CALLS_PER_ORG",
  "AI_MAX_OUTPUT_TOKENS",
  "AI_PRICE_INPUT_PER_MTOK",
  "AI_PRICE_OUTPUT_PER_MTOK",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_OPENAI_MODEL",
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function enableAi(overrides: Partial<Record<(typeof envKeys)[number], string>> = {}) {
  Object.assign(process.env, {
    AI_MONTHLY_BUDGET_USD: "20",
    AI_DAILY_CALLS_PER_ORG: "50",
    AI_MAX_OUTPUT_TOKENS: "800",
    AI_PRICE_INPUT_PER_MTOK: "0.15",
    AI_PRICE_OUTPUT_PER_MTOK: "0.60",
    AI_INTEGRATIONS_OPENAI_API_KEY: "test-key",
    AI_INTEGRATIONS_OPENAI_BASE_URL: "https://example.test/v1",
    AI_INTEGRATIONS_OPENAI_MODEL: "test-model",
    ...overrides,
  });
}

function memoryStore(): AiUsageStore {
  let reservations = 0;
  return {
    reserve: async ({ dailyCallsPerOrg, monthlyBudgetUsd, reservedCostUsd }) => {
      if (reservations >= dailyCallsPerOrg || reservedCostUsd > monthlyBudgetUsd) return false;
      reservations += 1;
      return true;
    },
    settle: async () => undefined,
  };
}

describe("withAiBudget", () => {
  it("abaixo do limite chama o modelo e aplica o máximo de saída configurado", async () => {
    enableAi();
    const model = vi.fn(async () => ({ usage: { prompt_tokens: 11, completion_tokens: 7 } }));

    const result = await withAiBudgetUsingStore(memoryStore(), "org-a", "agent-analysis", model);

    expect(result.aiInsight).toBe("available");
    expect(model).toHaveBeenCalledWith({ maxOutputTokens: 800 });
  });

  it("acima do teto degrada sem chamar o modelo", async () => {
    enableAi({ AI_MONTHLY_BUDGET_USD: "0.01" });
    const model = vi.fn(async () => ({ usage: { prompt_tokens: 11, completion_tokens: 7 } }));

    const result = await withAiBudgetUsingStore(memoryStore(), "org-a", "agent-analysis", model);

    expect(result).toEqual({ aiInsight: "unavailable" });
    expect(model).not.toHaveBeenCalled();
  });

  it("sem chave degrada sem chamar o modelo", async () => {
    enableAi();
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const model = vi.fn(async () => ({ usage: { prompt_tokens: 11, completion_tokens: 7 } }));

    const result = await withAiBudgetUsingStore(memoryStore(), "org-a", "agent-analysis", model);

    expect(result).toEqual({ aiInsight: "unavailable" });
    expect(model).not.toHaveBeenCalled();
  });
});
