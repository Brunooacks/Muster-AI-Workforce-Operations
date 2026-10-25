// Contraste WCAG dos pares de tokens texto/fundo (roda no `make ci` via pnpm test).
// Falha quando um par de texto normal fica abaixo de 4,5:1.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MINIMO_TEXTO_NORMAL,
  conferirContraste,
  misturar,
  paraRgb,
  razaoContraste,
} from "./contrast.mjs";

const raiz = join(import.meta.dirname, "..", "..");

describe("razaoContraste", () => {
  it("preto sobre branco dá o máximo de 21:1", () => {
    expect(razaoContraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("aceita hex, HSL com e sem função", () => {
    expect(paraRgb("#1d1d1f")).toEqual([29, 29, 31]);
    for (const valor of ["240 3% 12%", "hsl(240 3% 12%)"]) {
      const [r, g, b] = paraRgb(valor);
      expect(Math.abs(r - 29)).toBeLessThanOrEqual(2);
      expect(Math.abs(g - 29)).toBeLessThanOrEqual(2);
      expect(Math.abs(b - 31)).toBeLessThanOrEqual(2);
    }
    const hsl = razaoContraste("0 0% 100%", "240 3% 12%");
    expect(hsl).toBeGreaterThan(16);
    expect(hsl).toBeLessThan(18);
  });

  it("rejeita cor que não dá para interpretar", () => {
    expect(() => paraRgb("banana")).toThrow(/cor não reconhecida/);
  });

  it("mistura a tinta do chip sobre o fundo", () => {
    expect(misturar("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(misturar("#ff0000", "#ffffff", 0)).toBe("#ffffff");
  });

  it("par fraco fica abaixo do mínimo de texto normal", () => {
    expect(razaoContraste("#777777", "#ffffff")).toBeLessThan(MINIMO_TEXTO_NORMAL);
  });
});

describe("pares de tokens do app", () => {
  const pares = conferirContraste(raiz);

  it("cobre os dois perfis e as quatro paletas", () => {
    const temas = [...new Set(pares.map((par) => par.tema))];
    expect(temas).toEqual(
      expect.arrayContaining(["claro", "noite", "mineral", "graphite", "dracula", "mocha"]),
    );
    expect(pares.length).toBeGreaterThanOrEqual(60);
  });

  it("todo par texto/fundo chega a 4,5:1", () => {
    const abaixo = pares.filter((par) => !par.passa);
    expect(
      abaixo.map((par) => `${par.tema}: ${par.texto} sobre ${par.fundo} = ${par.razao}:1`),
    ).toEqual([]);
  });

  it("chips de risco e atenção usam tokens de texto sobre a própria tinta", () => {
    const chips = pares.filter((par) => par.fundo.includes("+"));
    const temas = new Set(chips.map((par) => par.tema));
    for (const tema of ["claro", "noite", "mineral", "graphite", "dracula", "mocha"]) {
      expect(temas.has(tema)).toBe(true);
    }
    expect(chips.some((par) => par.texto === "wo-danger-text")).toBe(true);
    expect(chips.some((par) => par.texto === "chart-3-text")).toBe(true);
    expect(chips.every((par) => par.passa)).toBe(true);
  });

  it("cada par reportado tem razão coerente com o mínimo", () => {
    for (const par of pares) {
      expect(par.razao >= MINIMO_TEXTO_NORMAL).toBe(par.passa);
    }
  });
});
