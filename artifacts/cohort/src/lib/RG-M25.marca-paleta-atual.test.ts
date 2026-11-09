// RG-M25 (04/11/2026): arquivos de marca (public/brand, logo.svg, favicon.svg)
// usam a paleta atual (grafite + ciano) e Outfit; nada do verde antigo nem serifa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pub = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");
const antigos = ["#233e34", "#3a5746", "#56724f", "#8aa07f", "#c4d0bd", "#f1ede3", "#1c2420", "#4d8567", "#5f6b62", "#7fb89a", "#8fa094", "#efe9da"];
const arquivos = [
  ...readdirSync(resolve(pub, "brand")).filter((f) => f.endsWith(".svg")).map((f) => resolve(pub, "brand", f)),
  resolve(pub, "logo.svg"),
  resolve(pub, "favicon.svg"),
];

test("marca sem verde antigo e sem fonte serifada", () => {
  for (const f of arquivos) {
    const s = readFileSync(f, "utf8").toLowerCase();
    for (const c of antigos) assert.ok(!s.includes(c), `${f} usa ${c}`);
    assert.ok(!/iowan|palatino|georgia|[^-]serif/.test(s), `${f} usa serifa`);
    if (s.includes("<text")) assert.ok(s.includes("outfit"), `${f} sem Outfit`);
  }
});
