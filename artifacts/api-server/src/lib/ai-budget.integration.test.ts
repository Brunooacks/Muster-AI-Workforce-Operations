import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { aiUsageDaily, organizations } from "@workspace/db/schema";
import { withAiBudget } from "./ai-budget";

const runIntegration = process.env.RUN_AI_BUDGET_DB_TESTS === "true";
let workspaceDb: typeof import("@workspace/db");
const suffix = randomUUID().slice(0, 8);
const orgId = `org_ai_budget_${suffix}`;

describe.skipIf(!runIntegration)("AI budget PostgreSQL", () => {
  beforeAll(async () => {
    process.env.AI_MONTHLY_BUDGET_USD = "20";
    process.env.AI_DAILY_CALLS_PER_ORG = "1";
    process.env.AI_MAX_OUTPUT_TOKENS = "800";
    process.env.AI_PRICE_INPUT_PER_MTOK = "0.15";
    process.env.AI_PRICE_OUTPUT_PER_MTOK = "0.60";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://example.test/v1";
    process.env.AI_INTEGRATIONS_OPENAI_MODEL = "test-model";
    workspaceDb = await import("@workspace/db");
    await workspaceDb.db.insert(organizations).values({
      id: orgId,
      name: "AI Budget Test",
      slug: `ai-budget-test-${suffix}`,
    });
  });

  afterAll(async () => {
    if (workspaceDb) await workspaceDb.db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("duas reservas simultâneas não ultrapassam uma chamada diária", async () => {
    const model = vi.fn(async () => ({ usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    const [first, second] = await Promise.all([
      withAiBudget(orgId, "agent-analysis", model),
      withAiBudget(orgId, "agent-analysis", model),
    ]);

    expect([first, second].filter((result) => result.aiInsight === "available")).toHaveLength(1);
    expect(model).toHaveBeenCalledTimes(1);
    const day = new Date().toISOString().slice(0, 10);
    const [usage] = await workspaceDb.db
      .select()
      .from(aiUsageDaily)
      .where(and(
        eq(aiUsageDaily.orgId, orgId),
        eq(aiUsageDaily.day, day),
        eq(aiUsageDaily.feature, "agent-analysis"),
      ));
    expect(usage).toMatchObject({ calls: 1, inputTokens: 10, outputTokens: 5 });
  });
});
