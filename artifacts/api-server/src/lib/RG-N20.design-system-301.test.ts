/**
 * RG-N20 (Muster) — /design-system era vitrine interna servida em produção
 * (200 pelo SPA fallback). Agora o servidor responde 301 para a home antes do
 * express.static/spaFallback, e o build do cohort nem inclui a página.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as staticWeb from "./static-web";

const retired = (staticWeb as Record<string, unknown>).retiredPathRedirect as ((p: string) => string | null) | undefined;

describe("RG-N20 /design-system 301 para a home", () => {
  it("regra de rotas aposentadas", () => {
    expect(typeof retired).toBe("function");
    for (const p of ["/design-system", "/design-system/", "/design-system/tokens"]) expect(retired!(p)).toBe("/");
    for (const p of ["/", "/design-systemx", "/visao-geral", "/api/design-system"]) expect(retired!(p)).toBeNull();
  });
  it("middleware responde 301 com Location /", async () => {
    const mw = (staticWeb as Record<string, any>).retiredPathsMiddleware;
    expect(typeof mw).toBe("function");
    const app = express();
    app.use(mw());
    app.use((_q, r) => r.status(200).send("spa"));
    const srv = app.listen(0);
    const port = (srv.address() as { port: number }).port;
    try {
      const r = await fetch(`http://127.0.0.1:${port}/design-system?x=1`, { redirect: "manual" });
      expect(r.status).toBe(301);
      expect(r.headers.get("location")).toBe("/");
      const ok = await fetch(`http://127.0.0.1:${port}/calculadora`, { redirect: "manual" });
      expect(ok.status).toBe(200);
    } finally { srv.close(); }
  });
  it("app.ts registra o middleware antes do static/spaFallback", () => {
    const app = readFileSync(resolve(__dirname, "../app.ts"), "utf8");
    const i = app.indexOf("retiredPathsMiddleware(");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(app.indexOf("express.static(staticWebRoot"));
  });
});
