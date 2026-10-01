import test from "node:test";
import assert from "node:assert/strict";
import { workforcePalettes } from "../pages/workforce-os-lab";

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function token(theme: React.CSSProperties, key: string): string {
  const value = (theme as Record<string, string>)[key];
  assert.ok(value, `token ${key} ausente`);
  return value;
}

test("temas possuem contraste executivo para texto e informação secundária", () => {
  for (const [name, theme] of Object.entries(workforcePalettes)) {
    const background = token(theme, "--wo-bg");
    const text = token(theme, "--wo-text");
    const muted = token(theme, "--wo-muted");

    assert.ok(contrast(text, background) >= 7, `${name}: contraste principal`);
    assert.ok(contrast(muted, background) >= 4.5, `${name}: contraste secundário`);
  }
});

test("cores de ação mantêm texto legível", () => {
  for (const [name, theme] of Object.entries(workforcePalettes)) {
    const accent = token(theme, "--wo-accent");
    const accentInk = token(theme, "--wo-accent-ink");
    assert.ok(contrast(accentInk, accent) >= 4.5, `${name}: contraste da ação`);
  }
});
