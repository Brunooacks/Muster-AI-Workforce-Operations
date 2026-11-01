/**
 * RG-M19 (01/11): org nova abria Relatórios com GET
 * /executive-reports/monthly/2026-11 → 404 no console. Só busca o período
 * quando a lista de relatórios gerados diz que ele existe.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deveBuscarRelatorio, periodoParaExibir } from "./relatorio-periodo";

test("RG-M19: lista vazia ou ainda carregando não busca o período", () => {
  assert.equal(deveBuscarRelatorio("2026-11", []), false);
  assert.equal(deveBuscarRelatorio("2026-11", undefined), false);
  assert.equal(deveBuscarRelatorio("2026-11", ["2026-11", "2026-10"]), true);
});

test("RG-M19: sem o mês atual gerado, exibe o mais recente", () => {
  assert.equal(periodoParaExibir("2026-11", ["2026-10"], false), "2026-10");
  assert.equal(periodoParaExibir("2026-11", [], false), "2026-11");
});

test("RG-M19: a tela usa o gate antes de buscar", () => {
  const src = readFileSync(new URL("../pages/executive-reports-workforce.tsx", import.meta.url), "utf8");
  assert.match(src, /enabled: operational && deveBuscarRelatorio\(selectedPeriod, periodosGerados\)/);
});
