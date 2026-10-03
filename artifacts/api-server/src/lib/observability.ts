import { randomUUID } from "node:crypto";
import { getAuth } from "@clerk/express";
import type { Request, RequestHandler, Response } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type SessionClaims = Record<string, unknown> | null | undefined;

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sessionContext(req: Request): { orgId?: string; userId?: string } {
  const auth = getAuth(req);
  const claims = auth?.sessionClaims as SessionClaims;
  const userId = readString(auth?.userId) ?? readString(claims?.userId);
  const orgId =
    req.orgId ?? readString(auth?.orgId) ?? readString(claims?.org_id);
  return {
    ...(orgId ? { orgId } : {}),
    ...(userId ? { userId } : {}),
  };
}

export function requestId(req: Request, res: Response): string {
  const incoming = req.get("x-request-id");
  const id =
    incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.setHeader("x-request-id", id);
  return id;
}

export function requestSerializer(req: Pick<Request, "id" | "method" | "url">) {
  return {
    id: typeof req.id === "string" ? req.id : undefined,
    method: req.method,
    url: req.url?.split("?")[0],
  };
}

export function responseSerializer(res: Pick<Response, "statusCode">) {
  return { statusCode: res.statusCode };
}

export function requestLogProperties(req: Request) {
  return sessionContext(req);
}

function routePattern(req: Request): string | undefined {
  const path = req.route?.path;
  if (typeof path !== "string") return undefined;
  return `${req.baseUrl}${path}`;
}

export const auditMutations: RequestHandler = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const session = sessionContext(req);
  if (!session.userId) {
    next();
    return;
  }

  const startedAt = performance.now();
  res.on("finish", () => {
    const route = routePattern(req);
    if (!route) return;
    const ms = Math.round((performance.now() - startedAt) * 1000) / 1000;
    req.log.info(
      {
        requestId: req.id,
        orgId: req.orgId ?? session.orgId,
        userId: session.userId,
        method: req.method,
        route,
        status: res.statusCode,
        ms,
      },
      "audit",
    );
  });
  next();
};
