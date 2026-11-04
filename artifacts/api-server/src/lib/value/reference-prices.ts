import type { PriceTable } from "../outcome-layers";

/**
 * Tabela de preços de referência (camada 1 · modelo superdimensionado).
 * Preços públicos de lista por 1M tokens, convertidos para centavos de BRL
 * com câmbio fixo de referência (USD 1 = BRL 5,40) para não depender de
 * cotação em tempo real. Versionada: snapshots guardam a versão usada.
 */
const FX = 5.4;
const m = (model: string, inUsd: number, outUsd: number, vision: boolean, contextWindow: number) => ({
  model,
  inputCentsPerMTok: Math.round(inUsd * FX * 100),
  outputCentsPerMTok: Math.round(outUsd * FX * 100),
  currency: "BRL" as const,
  capabilities: { tools: true, vision, contextWindow },
});

export const REFERENCE_PRICE_TABLE: PriceTable = {
  version: "ref-2026-11",
  models: [
    m("gpt-5.1", 1.25, 10, true, 400_000),
    m("gpt-5-mini", 0.25, 2, true, 400_000),
    m("gpt-4.1", 2, 8, true, 1_000_000),
    m("claude-sonnet-4.5", 3, 15, true, 200_000),
    m("gemini-2.5-pro", 1.25, 10, true, 1_000_000),
    m("llama-3.3-70b", 0.6, 0.6, false, 128_000),
  ],
};

/** Tabela explícita prevalece; sem ela, vale a de referência versionada. */
export function resolvePriceTable(explicit: PriceTable | null | undefined): PriceTable {
  return explicit ?? REFERENCE_PRICE_TABLE;
}
