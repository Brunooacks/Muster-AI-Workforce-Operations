import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { authDevBypass } from "./middlewares/requireAuth";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// With the local-dev auth bypass active, Clerk is skipped entirely (it needs
// a publishable key and would reject every request). requireAuth stamps a
// fixed dev user instead. Inert in production — see requireAuth.ts.
if (authDevBypass) {
  logger.warn(
    "AUTH_DEV_BYPASS is active — all /api requests run as 'dev-user'. Never use this outside local development.",
  );
} else {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

app.use("/api", router);

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
  const status = (err as { status?: number; statusCode?: number })?.status ??
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
