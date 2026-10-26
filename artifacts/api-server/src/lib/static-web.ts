import path from "node:path";
import type { RequestHandler } from "express";

export function resolveStaticWebRoot(value = process.env.WEB_STATIC_DIR): string | null {
  const normalized = value?.trim();
  return normalized ? path.resolve(normalized) : null;
}

/**
 * SPA fallback: any GET/HEAD outside /api whose last segment has no file
 * extension gets index.html. It no longer depends on the Accept header, so
 * curl, link previews, crawlers and uptime checks see 200 on /sign-in, /en,
 * /visao-geral like a browser does. Missing assets (/assets/x.js) still 404.
 */
export function shouldServeSpaNavigation(
  method: string,
  pathname: string,
  _acceptHeader?: string,
): boolean {
  const m = method.toUpperCase();
  if ((m !== "GET" && m !== "HEAD") || pathname === "/api" || pathname.startsWith("/api/")) {
    return false;
  }
  const last = pathname.split("/").pop() ?? "";
  return !last.includes(".");
}

export function spaFallback(staticWebRoot: string): RequestHandler {
  return (req, res, next) => {
    if (!shouldServeSpaNavigation(req.method, req.path, req.get("accept"))) {
      next();
      return;
    }
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(staticWebRoot, "index.html"));
  };
}
