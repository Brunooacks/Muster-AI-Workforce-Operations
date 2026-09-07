import type { ExecutiveMonthlyReport } from "./executive-reporting";

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
  report: ExecutiveMonthlyReport,
  templateId: string,
): Promise<ExecutiveMonthlyReport> {
  const { openai } = await import("@workspace/integrations-openai-ai-server");
  const model = process.env.AI_INTEGRATIONS_OPENAI_MODEL ?? "gpt-5.4";
  const facts = {
    period: report.period,
    previousPeriod: report.previousPeriod,
    metrics: report.metrics,
    layers: report.layerComparison,
    portfolio: report.portfolio,
    quality: report.quality,
    deterministicInsights: report.insights,
  };
  const completion = await openai.chat.completions.create({
    model,
    max_completion_tokens: 2_500,
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
  };
}
