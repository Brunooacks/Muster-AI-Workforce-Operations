import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export type AuthenticatedRequest = Request & { userId?: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
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
