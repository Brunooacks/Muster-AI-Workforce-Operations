import { getAuth } from "@clerk/express";
import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuth, type AuthenticatedRequest } from "./requireAuth";

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));

const getAuthMock = vi.mocked(getAuth);

function responseMock(): Response {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}

describe("requireAuth", () => {
  beforeEach(() => {
    getAuthMock.mockReset();
  });

  it("rejects requests without a real Clerk session", () => {
    getAuthMock.mockReturnValue({ userId: null, sessionClaims: null } as never);
    const request = {} as AuthenticatedRequest;
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    requireAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
    expect(request.userId).toBeUndefined();
  });

  it("attaches the authenticated Clerk user", () => {
    getAuthMock.mockReturnValue({ userId: "user_clerk_123" } as never);
    const request = {} as AuthenticatedRequest;
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    requireAuth(request, response, next);

    expect(request.userId).toBe("user_clerk_123");
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });
});
