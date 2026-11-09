import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findJargon, GLOSSARY } from "./corporate-language";
import { UI_COPY } from "../components/muster/ui-copy";

test("glossary covers pt, en and es for every term", () => {
  for (const [key, row] of Object.entries(GLOSSARY)) {
    for (const lang of ["pt", "en", "es"] as const) {
      assert.ok(row[lang]?.trim(), `${key} missing ${lang}`);
    }
  }
});

test("base UI copy exists in all three languages with the same keys", () => {
  const keys = Object.keys(UI_COPY.pt).sort();
  assert.deepEqual(Object.keys(UI_COPY.en).sort(), keys);
  assert.deepEqual(Object.keys(UI_COPY.es).sort(), keys);
});

test("base UI copy has no AI jargon and no replacement framing", () => {
  for (const lang of ["pt", "en", "es"] as const) {
    for (const text of Object.values(UI_COPY[lang])) {
      assert.deepEqual(findJargon(text), [], `${lang}: ${text}`);
    }
  }
});

test("detects jargon and replacement framing", () => {
  assert.ok(findJargon("Consumo de tokens").length > 0);
  assert.ok(findJargon("Substituir a pessoa").length > 0);
  assert.deepEqual(findJargon("Devolver para a equipe"), []);
});

test("no forbidden names in the new base components", () => {
  for (const f of ["../components/muster/base.tsx", "../components/muster/ui-copy.ts", "./corporate-language.ts"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.doesNotMatch(src, /\bBruno\b|\bNTT\b|\bPix\b/i, f);
  }
});

test("menu labels are corporate, jargon-free and complete in pt, en and es", async () => {
  const src = readFileSync(new URL("../components/layout.tsx", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("export const NAV_LABELS"), src.indexOf("/** Atalho"));
  const labels = [...block.matchAll(/"\/[a-z]+": "([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(labels.length >= 36, `found ${labels.length}`);
  for (const l of labels) assert.deepEqual(findJargon(l), [], l);
});
