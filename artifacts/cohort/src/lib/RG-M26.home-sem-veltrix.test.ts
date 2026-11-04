// RG-M26 (04/11/2026): a home pública (rodapé home-fechamento) não cita a Veltrix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

test("rodapé da home sem card/texto da Veltrix", () => {
  const s = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../components/home/home-fechamento.tsx"), "utf8");
  const semUrls = s.replace(/https?:\/\/[^"]+/g, "");
  assert.ok(!/veltrix/i.test(semUrls));
  assert.ok(!s.includes('href="https://veltrixplatform.com"'));
});
