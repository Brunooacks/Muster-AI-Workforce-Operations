import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Local-dev auth bypass: with AUTH_DEV_BYPASS=true every request runs as a
// fixed "dev-user", skipping Clerk entirely. Hard-gated on NODE_ENV so the
// flag is inert in production. Pair with VITE_AUTH_DEV_BYPASS on the web app.
export const authDevBypass =
  process.env.AUTH_DEV_BYPASS === "true" &&
  process.env.NODE_ENV !== "production";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (authDevBypass) {
    req.userId = "dev-user";
    next();
    return;
  }
  const auth = getAuth(req);
  const userId =
    (auth?.sessionClaims?.userId as string | undefined) || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}
