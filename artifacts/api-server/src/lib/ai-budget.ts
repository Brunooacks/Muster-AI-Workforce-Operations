import { and, eq, gte, lt, sql } from "drizzle-orm";
import { aiUsageDaily } from "@workspace/db/schema";

const MAX_RESERVED_INPUT_TOKENS = 150_000;

export type AiInsightAvailability = "available" | "unavailable";

export type AiBudgetLimits = {
  maxOutputTokens: number;
};

type AiUsage = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
};

export type AiUsageResponse = {
  usage?: AiUsage | null;
};

type AiBudgetConfig = AiBudgetLimits & {
  monthlyBudgetUsd: number;
  dailyCallsPerOrg: number;
  priceInputPerMTok: number;
  priceOutputPerMTok: number;
};

export type AiUsageStore = {
  reserve(input: {
    orgId: string;
    feature: string;
    day: string;
    monthStart: string;
    nextMonthStart: string;
    dailyCallsPerOrg: number;
    monthlyBudgetUsd: number;
    reservedInputTokens: number;
    reservedOutputTokens: number;
    reservedCostUsd: number;
  }): Promise<boolean>;
  settle(input: {
    orgId: string;
    feature: string;
    day: string;
    reservedInputTokens: number;
    reservedOutputTokens: number;
    reservedCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    actualCostUsd: number;
  }): Promise<void>;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function configuredBudget(): AiBudgetConfig | null {
  const monthlyBudgetUsd = positiveNumber(process.env.AI_MONTHLY_BUDGET_USD);
  const priceInputPerMTok = positiveNumber(process.env.AI_PRICE_INPUT_PER_MTOK);
  const priceOutputPerMTok = positiveNumber(process.env.AI_PRICE_OUTPUT_PER_MTOK);
  if (
    !monthlyBudgetUsd ||
    !priceInputPerMTok ||
    !priceOutputPerMTok ||
    !process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    !process.env.AI_INTEGRATIONS_OPENAI_MODEL
  ) {
    return null;
  }
  return {
    monthlyBudgetUsd,
    priceInputPerMTok,
    priceOutputPerMTok,
    dailyCallsPerOrg: positiveInteger(process.env.AI_DAILY_CALLS_PER_ORG, 50),
    maxOutputTokens: positiveInteger(process.env.AI_MAX_OUTPUT_TOKENS, 800),
  };
}

function dayBounds(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const monthStart = `${day.slice(0, 7)}-01`;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    day,
    monthStart,
    nextMonthStart: next.toISOString().slice(0, 10),
  };
}

function costUsd(inputTokens: number, outputTokens: number, config: AiBudgetConfig): number {
  return (
    (inputTokens * config.priceInputPerMTok + outputTokens * config.priceOutputPerMTok) /
    1_000_000
  );
}

async function postgresUsageStore(): Promise<AiUsageStore> {
  const { db } = await import("@workspace/db");
  return {
    async reserve(input) {
      return db.transaction(async (tx) => {
        // Serializing reservations per organization makes the monthly check and
        // the upsert one atomic decision, even when features run concurrently.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.orgId}))`);
        const [monthly] = await tx
          .select({ total: sql<number>`coalesce(sum(${aiUsageDaily.estCostUsd}), 0)::double precision` })
          .from(aiUsageDaily)
          .where(and(
            eq(aiUsageDaily.orgId, input.orgId),
            gte(aiUsageDaily.day, input.monthStart),
            lt(aiUsageDaily.day, input.nextMonthStart),
          ));
        if ((monthly?.total ?? 0) + input.reservedCostUsd > input.monthlyBudgetUsd) {
          return false;
        }
        const rows = await tx
          .insert(aiUsageDaily)
          .values({
            orgId: input.orgId,
            day: input.day,
            feature: input.feature,
            calls: 1,
            inputTokens: input.reservedInputTokens,
            outputTokens: input.reservedOutputTokens,
            estCostUsd: input.reservedCostUsd,
          })
          .onConflictDoUpdate({
            target: [aiUsageDaily.orgId, aiUsageDaily.day, aiUsageDaily.feature],
            set: {
              calls: sql`${aiUsageDaily.calls} + 1`,
              inputTokens: sql`${aiUsageDaily.inputTokens} + ${input.reservedInputTokens}`,
              outputTokens: sql`${aiUsageDaily.outputTokens} + ${input.reservedOutputTokens}`,
              estCostUsd: sql`${aiUsageDaily.estCostUsd} + ${input.reservedCostUsd}`,
            },
            where: sql`${aiUsageDaily.calls} < ${input.dailyCallsPerOrg}`,
          })
          .returning({ calls: aiUsageDaily.calls });
        return rows.length === 1;
      });
    },
    async settle(input) {
      await db
        .update(aiUsageDaily)
        .set({
          inputTokens: sql`${aiUsageDaily.inputTokens} - ${input.reservedInputTokens} + ${input.inputTokens}`,
          outputTokens: sql`${aiUsageDaily.outputTokens} - ${input.reservedOutputTokens} + ${input.outputTokens}`,
          estCostUsd: sql`${aiUsageDaily.estCostUsd} - ${input.reservedCostUsd} + ${input.actualCostUsd}`,
        })
        .where(and(
          eq(aiUsageDaily.orgId, input.orgId),
          eq(aiUsageDaily.day, input.day),
          eq(aiUsageDaily.feature, input.feature),
        ));
    },
  };
}

export async function withAiBudgetUsingStore<T extends AiUsageResponse>(
  store: AiUsageStore,
  orgId: string,
  feature: string,
  fn: (limits: AiBudgetLimits) => Promise<T>,
): Promise<{ aiInsight: AiInsightAvailability; value?: T }> {
  const config = configuredBudget();
  if (!config) return { aiInsight: "unavailable" };

  const { day, monthStart, nextMonthStart } = dayBounds();
  const reservedInputTokens = MAX_RESERVED_INPUT_TOKENS;
  const reservedOutputTokens = config.maxOutputTokens;
  const reservedCostUsd = costUsd(reservedInputTokens, reservedOutputTokens, config);
  const reserved = await store.reserve({
    orgId,
    feature,
    day,
    monthStart,
    nextMonthStart,
    dailyCallsPerOrg: config.dailyCallsPerOrg,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
    reservedInputTokens,
    reservedOutputTokens,
    reservedCostUsd,
  });
  if (!reserved) return { aiInsight: "unavailable" };

  const value = await fn({ maxOutputTokens: config.maxOutputTokens });
  const inputTokens = Math.max(0, value.usage?.prompt_tokens ?? reservedInputTokens);
  const outputTokens = Math.max(0, value.usage?.completion_tokens ?? reservedOutputTokens);
  await store.settle({
    orgId,
    feature,
    day,
    reservedInputTokens,
    reservedOutputTokens,
    reservedCostUsd,
    inputTokens,
    outputTokens,
    actualCostUsd: costUsd(inputTokens, outputTokens, config),
  });
  return { aiInsight: "available", value };
}

export async function withAiBudget<T extends AiUsageResponse>(
  orgId: string,
  feature: string,
  fn: (limits: AiBudgetLimits) => Promise<T>,
): Promise<{ aiInsight: AiInsightAvailability; value?: T }> {
  const config = configuredBudget();
  if (!config) return { aiInsight: "unavailable" };
  return withAiBudgetUsingStore(await postgresUsageStore(), orgId, feature, fn);
}
