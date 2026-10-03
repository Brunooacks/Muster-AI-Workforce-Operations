import type { ExecutiveMonthlyReport } from "./executive-reporting";
import { withAiBudget } from "./ai-budget";

export const EXECUTIVE_NARRATIVE_PROMPT_VERSION = "executive-monthly-v1";

type NarrativePayload = {
  executiveSummary?: unknown;
  sectionSummaries?: unknown;
};

function numericTokens(value: string): string[] {
  return value.match(/\d+(?:[.,]\d+)?/g)?.map((token) => token.replace(",", ".")) ?? [];
}

export function narrativeUsesOnlyKnownNumbers(
  narrative: string,
  factualPayload: unknown,
): boolean {
  const allowed = new Set(numericTokens(JSON.stringify(factualPayload)));
  return numericTokens(narrative).every((token) => allowed.has(token));
}

function cleanText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized && normalized.length <= maximum ? normalized : null;
}

export async function enrichExecutiveNarrative(
  orgId: string,
  report: ExecutiveMonthlyReport,
  templateId: string,
): Promise<ExecutiveMonthlyReport> {
  const model = process.env.AI_INTEGRATIONS_OPENAI_MODEL;
  const facts = {
    period: report.period,
    previousPeriod: report.previousPeriod,
    metrics: report.metrics,
    layers: report.layerComparison,
    portfolio: report.portfolio,
    quality: report.quality,
    deterministicInsights: report.insights,
  };
  const budget = await withAiBudget(orgId, "executive-narrative", async (limits) => {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    if (!model) throw new Error("Modelo de IA não configurado.");
    return openai.chat.completions.create({
      model,
      max_completion_tokens: limits.maxOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Você redige relatórios executivos sobre uma força de trabalho de agentes de IA.",
            "Use exclusivamente os fatos JSON fornecidos; não calcule nem invente números.",
            "Valor financeiro é apenas uma dimensão possível. Priorize propósito, qualidade, confiabilidade, adoção, governança e decisões.",
            "Mantenha limitações de cobertura e confiança explícitas.",
            "Retorne JSON com executiveSummary e sectionSummaries, um objeto indexado pelas chaves de seção recebidas.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({ templateId, facts, sections: report.sections }),
        },
      ],
    });
  });
  if (!budget.value) return { ...report, aiInsight: "unavailable" };

  const completion = budget.value;
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Modelo não retornou narrativa executiva.");
  const payload = JSON.parse(content) as NarrativePayload;
  const executiveSummary = cleanText(payload.executiveSummary, 1_500);
  const sectionSummaries = payload.sectionSummaries && typeof payload.sectionSummaries === "object"
    ? payload.sectionSummaries as Record<string, unknown>
    : {};
  const candidateSections = report.sections.map((section) => ({
    ...section,
    summary: cleanText(sectionSummaries[section.key], 800) ?? section.summary,
  }));
  const candidateNarrative = [
    executiveSummary ?? report.executiveSummary,
    ...candidateSections.map((section) => section.summary),
  ].join(" ");
  if (!narrativeUsesOnlyKnownNumbers(candidateNarrative, { facts, sections: report.sections })) {
    throw new Error("Narrativa de IA introduziu números sem origem factual.");
  }
  return {
    ...report,
    executiveSummary: executiveSummary ?? report.executiveSummary,
    sections: candidateSections,
    narrativeSource: "ai-assisted",
    narrativeModel: model,
    promptVersion: EXECUTIVE_NARRATIVE_PROMPT_VERSION,
    aiInsight: budget.aiInsight,
  };
}
