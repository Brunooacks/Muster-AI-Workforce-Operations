import { EventEmitter } from "node:events";
import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  auditMutations,
  requestId,
  requestSerializer,
  responseSerializer,
} from "./observability";

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));

const getAuthMock = vi.mocked(getAuth);

describe("observability", () => {
  beforeEach(() => {
    getAuthMock.mockReset();
  });

  it("preserves a valid incoming request id and returns it in the response", () => {
    const setHeader = vi.fn();
    const id = requestId(
      { get: vi.fn().mockReturnValue("request-123") } as unknown as Request,
      { setHeader } as unknown as Response,
    );

    expect(id).toBe("request-123");
    expect(setHeader).toHaveBeenCalledWith("x-request-id", "request-123");
  });

  it("replaces an invalid incoming request id", () => {
    const setHeader = vi.fn();
    const id = requestId(
      { get: vi.fn().mockReturnValue("invalid\nvalue") } as unknown as Request,
      { setHeader } as unknown as Response,
    );

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith("x-request-id", id);
  });

  it("serializes neither authorization, cookies, body nor query", () => {
    const request = {
      id: "request-123",
      method: "POST",
      url: "/api/agents?access_token=secret",
      headers: { authorization: "Bearer secret", cookie: "session=secret" },
      body: { secret: "secret" },
    } as unknown as Request;

    const serialized = requestSerializer(request);

    expect(serialized).toEqual({
      id: "request-123",
      method: "POST",
      url: "/api/agents",
    });
    expect(
      JSON.stringify({
        req: serialized,
        res: responseSerializer({ statusCode: 201 }),
      }),
    ).not.toMatch(/authorization|cookie|secret|access_token/i);
  });

  it("writes one audit record for an authenticated mutation using the route pattern", () => {
    getAuthMock.mockReturnValue({
      userId: "user_123",
      orgId: "org_clerk",
    } as never);
    const response = Object.assign(new EventEmitter(), {
      statusCode: 201,
    }) as unknown as Response;
    const info = vi.fn();
    const request = {
      id: "request-123",
      method: "PATCH",
      baseUrl: "/api",
      route: { path: "/agents/:agentId" },
      orgId: "org_123",
      log: { info },
    } as unknown as Request;
    const next = vi.fn() as NextFunction;

    auditMutations(request, response, next);
    (response as unknown as EventEmitter).emit("finish");

    expect(next).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "request-123",
        orgId: "org_123",
        userId: "user_123",
        method: "PATCH",
        route: "/api/agents/:agentId",
        status: 201,
        ms: expect.any(Number),
      }),
      "audit",
    );
  });
});
