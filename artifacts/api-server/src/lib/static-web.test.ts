import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { resolveStaticWebRoot, shouldServeSpaNavigation, spaFallback } from "./static-web";

describe("static web production host", () => {
  it("keeps static hosting opt-in", () => {
    expect(resolveStaticWebRoot("")).toBeNull();
    expect(resolveStaticWebRoot(" ./public ")).toMatch(/public$/);
  });

  it("serves SPA navigations regardless of Accept and never masks API routes or assets", () => {
    expect(shouldServeSpaNavigation("GET", "/jornadas", "text/html,application/xhtml+xml")).toBe(true);
    expect(shouldServeSpaNavigation("GET", "/sign-in", "*/*")).toBe(true);
    expect(shouldServeSpaNavigation("HEAD", "/en", undefined)).toBe(true);
    expect(shouldServeSpaNavigation("GET", "/api/agents", "text/html")).toBe(false);
    expect(shouldServeSpaNavigation("POST", "/jornadas", "text/html")).toBe(false);
    expect(shouldServeSpaNavigation("GET", "/assets/app.js", "application/javascript")).toBe(false);
  });
});

describe("SPA fallback over HTTP", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "spa-"));
    fs.writeFileSync(path.join(root, "index.html"), "<!doctype html><div id=root></div>");
    const app = express();
    app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
    app.use(express.static(root, { index: "index.html" }));
    app.use(spaFallback(root));
    await new Promise<void>((r) => { server = app.listen(0, "127.0.0.1", () => r()); });
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  for (const route of ["/sign-in", "/en", "/visao-geral", "/admin", "/sign-in/factor-one"]) {
    it(`GET ${route} with curl-style Accept returns index.html`, async () => {
      const res = await fetch(base + route, { headers: { accept: "*/*" } });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('id=root');
    });
  }
  it("HEAD /sign-in returns 200", async () => {
    expect((await fetch(base + "/sign-in", { method: "HEAD" })).status).toBe(200);
  });
  it("missing asset and API still 404", async () => {
    expect((await fetch(base + "/assets/missing.js")).status).toBe(404);
    expect((await fetch(base + "/api/nope", { headers: { accept: "text/html" } })).status).toBe(404);
  });
});
