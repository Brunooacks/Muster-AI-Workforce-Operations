// RG-M29 (04/11/2026, gate prod): os 6 prontuários mostravam "tabela de preços de
// referência ainda não disponível" porque nenhuma chamada passava priceTable.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REFERENCE_PRICE_TABLE, resolvePriceTable } from "./value/reference-prices";
import { selectReferenceModel } from "./outcome-layers";

describe("RG-M29 tabela de preços de referência", () => {
  it("carregador usa a tabela de referência quando nenhuma é passada", () => {
    const src = readFileSync(join(import.meta.dirname, "outcome-loader.ts"), "utf8");
    expect(src).toMatch(/priceTable:\s*resolvePriceTable\(input\.priceTable\)/);
    expect(resolvePriceTable(undefined).version).toBe("ref-2026-11");
  });
  it("modelo fixado no contrato encontra preço", () => {
    for (const model of ["gpt-5.1", "gpt-5-mini", "gpt-4.1", "claude-sonnet-4.5", "gemini-2.5-pro", "llama-3.3-70b"]) {
      const r = selectReferenceModel({ pinned: model, priceTable: REFERENCE_PRICE_TABLE, required: { tools: false, vision: false, contextWindow: 0 }, qualified: [] });
      expect(r.status === "ok" && r.value.price !== null).toBe(true);
    }
  });
});
