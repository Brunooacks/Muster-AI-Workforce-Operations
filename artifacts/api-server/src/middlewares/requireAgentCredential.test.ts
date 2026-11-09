import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O banco é uma fila de respostas: cada `select … limit()` consome a próxima.
 * Assim cada caso declara exatamente o que a chave e o agente "são" no banco.
 */
const respostas: unknown[][] = [];
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const cadeia = {
    from: () => cadeia,
    innerJoin: () => cadeia,
    where: () => cadeia,
    limit: async () => respostas.shift() ?? [],
  };
  return {
    ...schema,
    db: {
      select: () => cadeia,
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    },
  };
});

import {
  AGENTE_NAO_ENCONTRADO,
  CREDENCIAL_INVALIDA,
  SANDBOX_SEM_PROD,
  requireAgentCredential,
} from "./requireAgentCredential";
import { generateAgentApiKey } from "../lib/agent-api-key";
import type { EnvironmentKind } from "@workspace/db/schema";

function chaveNoBanco(kind: EnvironmentKind, overrides: Partial<{ revoked: boolean }> = {}) {
  const generated = generateAgentApiKey(kind);
  const registro = {
    key: {
      id: "key_1",
      orgId: "org_a",
      projectId: "prj_a1",
      environmentId: `env_a1_${kind}`,
      agentId: "agent_a1",
      keyHash: generated.keyHash,
      prefix: generated.prefix,
      revokedAt: overrides.revoked ? new Date() : null,
    },
    environmentKind: kind,
  };
  return { plaintext: generated.plaintext, registro };
}

function chamar(token: string | undefined, init: { agentId?: string; query?: object; body?: object } = {}) {
  const request = {
    header: vi.fn().mockReturnValue(token ? `Bearer ${token}` : undefined),
    params: init.agentId ? { agentId: init.agentId } : {},
    query: init.query ?? {},
    body: init.body,
  } as unknown as Request;
  const state = { status: 0, body: undefined as unknown };
  const response = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return {
    request,
    state,
    next,
    run: () => requireAgentCredential(request, response, next),
  };
}

beforeEach(() => {
  respostas.length = 0;
});

describe("requireAgentCredential", () => {
  it("rejects anonymous machine ingestion without an agent API key", async () => {
    const call = chamar(undefined, { agentId: "agent_123" });
    await call.run();
    expect(call.state).toEqual({ status: 401, body: { error: "Credencial do agente ausente." } });
    expect(call.next).not.toHaveBeenCalled();
  });

  it("chave antiga msk_live_ resolve projeto Padrão/prod e segue", async () => {
    const { plaintext, registro } = chaveNoBanco("prod");
    respostas.push([registro], [{ id: "agent_a1" }]);
    const call = chamar(plaintext, { agentId: "agent_a1" });
    await call.run();
    expect(call.next).toHaveBeenCalledOnce();
    expect(call.request).toMatchObject({
      orgId: "org_a",
      projectId: "prj_a1",
      environmentId: "env_a1_prod",
      environmentKind: "prod",
      agentCredentialAgentId: "agent_a1",
    });
  });

  it("revogada ou desconhecida → 401", async () => {
    const { plaintext } = chaveNoBanco("prod");
    respostas.push([]); // a busca filtra revoked_at IS NULL
    const call = chamar(plaintext, { agentId: "agent_a1" });
    await call.run();
    expect(call.state).toEqual({ status: 401, body: CREDENCIAL_INVALIDA });
  });

  it("prefixo com ambiente divergente do registro → 401", async () => {
    const { plaintext, registro } = chaveNoBanco("prod");
    // mesmo hash, mas o banco diz que a chave é de sandbox
    respostas.push([{ ...registro, environmentKind: "sandbox" }]);
    const call = chamar(plaintext, { agentId: "agent_a1" });
    await call.run();
    expect(call.state).toEqual({ status: 401, body: CREDENCIAL_INVALIDA });
  });

  it("sandbox pedindo prod → 403", async () => {
    const { plaintext, registro } = chaveNoBanco("sandbox");
    respostas.push([registro], [{ id: "agent_a1" }]);
    const call = chamar(plaintext, { agentId: "agent_a1", query: { environment: "prod" } });
    await call.run();
    expect(call.state).toEqual({ status: 403, body: SANDBOX_SEM_PROD });
  });

  it("prod pedindo sandbox → 404 (decisão em aberto 1)", async () => {
    const { plaintext, registro } = chaveNoBanco("prod");
    respostas.push([registro], [{ id: "agent_a1" }]);
    const call = chamar(plaintext, { agentId: "agent_a1", body: { environment: "sandbox" } });
    await call.run();
    expect(call.state).toEqual({ status: 404, body: AGENTE_NAO_ENCONTRADO });
  });

  it("agente de outro projeto/conta → 404 com corpo idêntico ao de inexistente", async () => {
    const { plaintext, registro } = chaveNoBanco("prod");
    respostas.push([registro], []); // fora do projeto da chave = não encontrado
    const outro = chamar(plaintext, { agentId: "agent_b1" });
    await outro.run();

    respostas.push([registro], []);
    const inexistente = chamar(plaintext, { agentId: "nao-existe" });
    await inexistente.run();

    expect(outro.state.status).toBe(404);
    expect(Buffer.from(JSON.stringify(outro.state.body))).toEqual(
      Buffer.from(JSON.stringify(inexistente.state.body)),
    );
  });

  it("outro agente do mesmo projeto → 404 (antes era 401)", async () => {
    const { plaintext, registro } = chaveNoBanco("prod");
    respostas.push([registro], [{ id: "agent_a2" }]);
    const call = chamar(plaintext, { agentId: "agent_a2" });
    await call.run();
    expect(call.state).toEqual({ status: 404, body: AGENTE_NAO_ENCONTRADO });
  });

  it("?project= de outro projeto → 404 antes de olhar ambiente", async () => {
    const { plaintext, registro } = chaveNoBanco("sandbox");
    respostas.push([registro]);
    const call = chamar(plaintext, { query: { project: "prj_b1", environment: "prod" } });
    await call.run();
    expect(call.state.status).toBe(404);
  });

  it("environment fora do enum → 400", async () => {
    const { plaintext, registro } = chaveNoBanco("prod");
    respostas.push([registro]);
    const call = chamar(plaintext, { query: { environment: "staging" } });
    await call.run();
    expect(call.state.status).toBe(400);
  });
});
