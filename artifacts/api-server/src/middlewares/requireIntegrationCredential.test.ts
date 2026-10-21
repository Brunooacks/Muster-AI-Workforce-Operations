import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateConnectorApiKey } from "../lib/connector-api-key";
import { requireIntegrationCredential } from "./requireIntegrationCredential";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: { select: mocks.select, update: mocks.update },
  connectorApiKeys: {
    id: "col:id",
    prefix: "col:prefix",
    revokedAt: "col:revokedAt",
    keyHash: "col:keyHash",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  isNull: (column: unknown) => ({ isNull: column }),
}));

function responseMock(): Response {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}

function requestMock(authorization?: string): Request {
  return {
    header: vi.fn().mockReturnValue(authorization),
  } as unknown as Request;
}

interface StoredKeyRow {
  id: string;
  orgId: string;
  connectorId: string;
  prefix: string;
  keyHash: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

function rowOf(key: { prefix: string; keyHash: string }): StoredKeyRow {
  return {
    id: "key_1",
    orgId: "org_1",
    connectorId: "conn_1",
    prefix: key.prefix,
    keyHash: key.keyHash,
    lastUsedAt: null,
    revokedAt: null,
  };
}

beforeEach(() => {
  mocks.select.mockReset();
  mocks.where.mockReset();
  mocks.limit.mockReset();
  mocks.update.mockReset();
  mocks.set.mockReset();
  mocks.updateWhere.mockReset();
  mocks.select.mockReturnValue({ from: () => ({ where: mocks.where }) });
  mocks.where.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue([]);
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.updateWhere });
  mocks.updateWhere.mockResolvedValue(undefined);
});

describe("requireIntegrationCredential", () => {
  it("responde 401 de credencial ausente quando não há header Authorization", async () => {
    const request = requestMock();
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    await requireIntegrationCredential(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: "Credencial da integração ausente.",
    });
    expect(next).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("responde 401 sem consultar o banco quando o token tem formato inválido", async () => {
    const request = requestMock("Bearer token-sem-formato-de-chave");
    const response = responseMock();
    const next = vi.fn() as NextFunction;

    await requireIntegrationCredential(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: "Credencial da integração inválida ou revogada.",
    });
    expect(next).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("responde 401 quando o token é válido mas não há linha correspondente", async () => {
    const key = generateConnectorApiKey();
    const request = requestMock(`Bearer ${key.plaintext}`);
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([]);

    await requireIntegrationCredential(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: "Credencial da integração inválida ou revogada.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("busca pelo prefixo do token exigindo revokedAt nulo e limitando a 1 linha", async () => {
    const key = generateConnectorApiKey();
    const request = requestMock(`Bearer ${key.plaintext}`);
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([rowOf(key)]);

    await requireIntegrationCredential(request, response, next);

    expect(mocks.where).toHaveBeenCalledWith({
      and: [{ eq: ["col:prefix", key.prefix] }, { isNull: "col:revokedAt" }],
    });
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("responde 401 quando a linha existe mas o hash não corresponde", async () => {
    const key = generateConnectorApiKey();
    const outra = generateConnectorApiKey();
    const request = requestMock(`Bearer ${key.plaintext}`);
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([rowOf(outra)]);

    await requireIntegrationCredential(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: "Credencial da integração inválida ou revogada.",
    });
    expect(next).not.toHaveBeenCalled();
    expect(request.orgId).toBeUndefined();
  });

  it("libera a requisição, chama next sem argumentos e anexa a identidade do conector", async () => {
    const key = generateConnectorApiKey();
    const record = rowOf(key);
    const request = requestMock(`Bearer ${key.plaintext}`);
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([record]);

    await requireIntegrationCredential(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(request.connectorCredentialId).toBe(record.id);
    expect(request.integrationConnectorId).toBe(record.connectorId);
    expect(request.userId).toBe(`connector:${record.connectorId}`);
    expect(request.orgId).toBe(record.orgId);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("marca o último uso da credencial com a data do update", async () => {
    const key = generateConnectorApiKey();
    const record = rowOf(key);
    const request = requestMock(`Bearer ${key.plaintext}`);
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([record]);

    await requireIntegrationCredential(request, response, next);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "col:id" }),
    );
    expect(mocks.set).toHaveBeenCalledOnce();
    const [payload] = mocks.set.mock.calls[0] as [{ lastUsedAt: unknown }];
    expect(payload.lastUsedAt).toBeInstanceOf(Date);
    expect(mocks.updateWhere).toHaveBeenCalledWith({
      eq: ["col:id", record.id],
    });
  });

  it("não propaga a falha do update de último uso e segue com next", async () => {
    const key = generateConnectorApiKey();
    const record = rowOf(key);
    const request = requestMock(`Bearer ${key.plaintext}`);
    const response = responseMock();
    const next = vi.fn() as NextFunction;
    mocks.limit.mockResolvedValue([record]);
    mocks.updateWhere.mockRejectedValue(new Error("falha ao marcar uso"));

    await requireIntegrationCredential(request, response, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(request.connectorCredentialId).toBe(record.id);
    expect(response.status).not.toHaveBeenCalled();
  });
});
