import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import path from "node:path";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkRuntimeConfig } from "./lib/clerk-config";
import { allowedCorsOrigins, isCorsOriginAllowed } from "./lib/cors-config";
import {
  auditMutations,
  requestId,
  requestLogProperties,
  requestSerializer,
  responseSerializer,
} from "./lib/observability";
import {
  resolveStaticWebRoot,
  shouldServeSpaNavigation,
} from "./lib/static-web";

const app: Express = express();
const clerkConfig = clerkRuntimeConfig();
const corsOrigins = allowedCorsOrigins();
const staticWebRoot = resolveStaticWebRoot();

app.use("/api", clerkMiddleware(clerkConfig));

app.use(
  pinoHttp({
    logger,
    genReqId: requestId,
    customProps(req) {
      return requestLogProperties(req as Request);
    },
    serializers: {
      req: requestSerializer,
      res: responseSerializer,
    },
  }),
);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      callback(null, isCorsOriginAllowed(origin, corsOrigins));
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", auditMutations, router);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

if (staticWebRoot) {
  app.use(express.static(staticWebRoot, { index: "index.html" }));
  app.get("/{*path}", (req, res, next) => {
    if (!shouldServeSpaNavigation(req.method, req.path, req.get("accept"))) {
      next();
      return;
    }
    res.sendFile(path.join(staticWebRoot, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.redirect(302, process.env.WEB_APP_URL ?? "http://localhost:5173");
  });
}

// Centralized error handler: normalize validation errors to 400 and
// everything else to a stable 500 JSON shape.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    return;
  }
  const isZodError =
    err != null &&
    typeof err === "object" &&
    (err as { name?: string }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues);
  if (isZodError) {
    req.log.warn({ err }, "Validation error");
    res.status(400).json({
      error: "Validation failed",
      issues: (err as { issues: unknown }).issues,
    });
    return;
  }
  // Honor client errors raised by middleware (e.g. body-parser's 400 on
  // malformed JSON) instead of masking them as 500.
  const status =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    req.log.warn({ err }, "Client error");
    res.status(status).json({ error: "Bad request" });
    return;
  }
  req.log.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
