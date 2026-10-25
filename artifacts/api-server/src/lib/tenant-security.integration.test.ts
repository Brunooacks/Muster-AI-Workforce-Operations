import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agents,
  agentOwners,
  alerts,
  evaluations,
  externalEventReceipts,
  metricEvidence,
  metricPoints,
  organizationMembers,
  organizations,
  purposes,
  teams,
  verdicts,
} from "@workspace/db/schema";
import { byAgentsOf } from "./tenant-scope";

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

type WorkspaceDb = typeof import("@workspace/db");
let workspaceDb: WorkspaceDb;

const suffix = randomUUID().slice(0, 8);
const orgA = `org_test_a_${suffix}`;
const orgB = `org_test_b_${suffix}`;
const userId = `user_test_${suffix}`;
const purposeA = `purpose_a_${suffix}`;
const purposeB = `purpose_b_${suffix}`;
const teamA = `team_a_${suffix}`;
const teamB = `team_b_${suffix}`;
const agentA = `agent_a_${suffix}`;
const agentB = `agent_b_${suffix}`;

describe.skipIf(!runIntegration)("tenant security com duas organizações", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    const { db } = workspaceDb;
    await db.insert(organizations).values([
      { id: orgA, name: "Tenant Test A", slug: `tenant-test-a-${suffix}` },
      { id: orgB, name: "Tenant Test B", slug: `tenant-test-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values([
      { orgId: orgA, userId, role: "owner" },
      { orgId: orgB, userId, role: "member" },
    ]);
    await db.insert(purposes).values([
      { id: purposeA, orgId: orgA, key: "support", name: "Support A", domain: "support", outcome: "resolve" },
      { id: purposeB, orgId: orgB, key: "support", name: "Support B", domain: "support", outcome: "resolve" },
    ]);
    await db.insert(teams).values([
      { id: teamA, orgId: orgA, purposeId: purposeA, name: "Team A", slug: "support" },
      { id: teamB, orgId: orgB, purposeId: purposeB, name: "Team B", slug: "support" },
    ]);
    await db.insert(agents).values([
      { id: agentA, orgId: orgA, name: "Agent A", slug: "support-agent", role: "support", platform: "test" },
      { id: agentB, orgId: orgB, name: "Agent B", slug: "support-agent", role: "support", platform: "test" },
    ]);
  });

  afterAll(async () => {
    if (!workspaceDb) return;
    await workspaceDb.db
      .delete(organizations)
      .where(inArray(organizations.id, [orgA, orgB]));
  });

  it("isola evidence e rejeita referência de outro tenant", async () => {
    const { db } = workspaceDb;
    const { invalidEvidenceReferences } = await import("../routes/evidence");

    expect(
      await invalidEvidenceReferences(orgA, {
        agentId: agentA,
        teamId: teamA,
        purposeId: purposeA,
      }),
    ).toEqual([]);
    expect(
      await invalidEvidenceReferences(orgA, {
        agentId: agentB,
        teamId: teamB,
        purposeId: purposeB,
      }),
    ).toEqual(["agentId", "teamId", "purposeId"]);

    const evidenceBase = {
      metricKey: "success-rate",
      label: "Success rate",
      value: 95,
      unit: "%",
      kind: "observed",
      source: { type: "test" },
      lineage: [],
      confidence: 1,
      qualityFlags: [],
    };
    await db.insert(metricEvidence).values([
      { ...evidenceBase, orgId: orgA, agentId: agentA },
      { ...evidenceBase, orgId: orgB, agentId: agentB },
    ]);

    const visible = await db
      .select({ orgId: metricEvidence.orgId, agentId: metricEvidence.agentId })
      .from(metricEvidence)
      .where(eq(metricEvidence.orgId, orgA));
    expect(visible).toEqual([{ orgId: orgA, agentId: agentA }]);
  });

  it("deduplica dentro do tenant e aceita o mesmo evento em outro tenant", async () => {
    const { db } = workspaceDb;
    const eventId = `event_${suffix}`;
    const claim = async (orgId: string, agentId: string) =>
      db
        .insert(externalEventReceipts)
        .values({ orgId, agentId, platform: "zendesk", eventId })
        .onConflictDoNothing({
          target: [
            externalEventReceipts.orgId,
            externalEventReceipts.platform,
            externalEventReceipts.eventId,
          ],
        })
        .returning({ id: externalEventReceipts.id });

    expect(await claim(orgA, agentA)).toHaveLength(1);
    expect(await claim(orgA, agentA)).toHaveLength(0);
    expect(await claim(orgB, agentB)).toHaveLength(1);
  });

  it("resolve a mesma identidade com alçadas diferentes por organização", async () => {
    const { requireOrgAdmin } = await import("../middlewares/orgRole");
    const response = () => {
      const state = { statusCode: 200, body: undefined as unknown };
      return {
        state,
        status(code: number) {
          state.statusCode = code;
          return this;
        },
        json(body: unknown) {
          state.body = body;
          return this;
        },
      };
    };

    const nextA = vi.fn();
    const resA = response();
    await requireOrgAdmin(
      { userId, orgId: orgA } as never,
      resA as never,
      nextA,
    );
    expect(nextA).toHaveBeenCalledOnce();

    const nextB = vi.fn();
    const resB = response();
    await requireOrgAdmin(
      { userId, orgId: orgB } as never,
      resB as never,
      nextB,
    );
    expect(nextB).not.toHaveBeenCalled();
    expect(resB.state.statusCode).toBe(403);
  });

  it("filtra entidades filhas da fleet pelos agentes do tenant", async () => {
    const { db } = workspaceDb;
    await db.insert(agentOwners).values([
      { agentId: agentA, businessOwner: "Owner A" },
      { agentId: agentB, businessOwner: "Owner B" },
    ]);
    await db.insert(evaluations).values([{ agentId: agentA }, { agentId: agentB }]);
    await db.insert(metricPoints).values([{ agentId: agentA }, { agentId: agentB }]);
    await db.insert(alerts).values([
      { agentId: agentA, pattern: "A" },
      { agentId: agentB, pattern: "B" },
    ]);
    await db.insert(verdicts).values([{ agentId: agentA }, { agentId: agentB }]);

    const agentIds = [agentA];
    const [ownerRows, evaluationRows, pointRows, alertRows, verdictRows] = await Promise.all([
      db.select().from(agentOwners).where(byAgentsOf(agentOwners.agentId, agentIds)!),
      db.select().from(evaluations).where(byAgentsOf(evaluations.agentId, agentIds)!),
      db.select().from(metricPoints).where(byAgentsOf(metricPoints.agentId, agentIds)!),
      db.select().from(alerts).where(byAgentsOf(alerts.agentId, agentIds)!),
      db.select().from(verdicts).where(byAgentsOf(verdicts.agentId, agentIds)!),
    ]);

    for (const rows of [ownerRows, evaluationRows, pointRows, alertRows, verdictRows]) {
      expect(rows).toHaveLength(1);
      expect(rows[0]!.agentId).toBe(agentA);
    }
  });
});

// ── E1 · T1.9 · matriz 2 contas × 2 projetos × 2 ambientes ──────────────────
//
// 8 células, cada uma com 1 agente e 1 chave. Cada chave tenta ler e escrever
// nas 8 células (a própria + 7 alheias) por todas as rotas de chave de agente,
// contra um app Express real e Postgres real. Esperado (D-E1-4 + decisão em
// aberto 1): mesma célula 2xx; outra conta ou outro projeto 404; mesmo
// projeto, sandbox→prod 403 e prod→sandbox 404. Chave revogada e forjada: 401
// em todas as rotas. Qualquer código diferente falha o teste.

type Kind = "sandbox" | "prod";
interface Celula {
  rotulo: string;
  orgId: string;
  projectId: string;
  environmentId: string;
  kind: Kind;
  agentId: string;
  keyId: string;
  token: string;
}

const CONTAS = ["A", "B"] as const;
const PROJETOS = ["P1", "P2"] as const;
const AMBIENTES: Kind[] = ["sandbox", "prod"];

function esperado(chave: Celula, alvo: Celula): string {
  if (chave === alvo) return "2xx";
  if (chave.orgId !== alvo.orgId || chave.projectId !== alvo.projectId) return "404";
  return chave.kind === "sandbox" ? "403" : "404";
}

/** As 6 rotas de chave de agente, apontadas para a célula alvo. */
function operacoes(alvo: Celula): Array<{ nome: string; path: string; method: "GET" | "POST"; body?: unknown }> {
  const env = `environment=${alvo.kind}`;
  return [
    {
      nome: "ingest",
      method: "POST",
      path: `/agents/${alvo.agentId}/events`,
      body: { environment: alvo.kind, kind: "execution", success: true, durationMs: 5 },
    },
    {
      nome: "heartbeat",
      method: "POST",
      path: `/agents/${alvo.agentId}/heartbeat`,
      body: { environment: alvo.kind, status: "healthy" },
    },
    { nome: "listar agentes", method: "GET", path: `/runtime/agents?project=${alvo.projectId}&${env}` },
    { nome: "agente", method: "GET", path: `/runtime/agents/${alvo.agentId}?${env}` },
    { nome: "eventos/outbox", method: "GET", path: `/runtime/agents/${alvo.agentId}/events?${env}` },
    { nome: "chaves", method: "GET", path: `/runtime/agents/${alvo.agentId}/api-keys?${env}` },
  ];
}

function normalizar(status: number): string {
  return status >= 200 && status < 300 ? "2xx" : String(status);
}

describe.skipIf(!runIntegration)("isolamento 2×2×2 · conta × projeto × ambiente (E1)", () => {
  const e1 = randomUUID().slice(0, 8);
  const celulas: Celula[] = [];
  let revogada: Celula & { tokenRevogado: string };
  let server: import("node:http").Server;
  let baseUrl = "";
  const obtido = new Map<string, Map<string, string>>();
  const detalhesDivergentes: string[] = [];

  async function chamar(token: string, op: ReturnType<typeof operacoes>[number]) {
    const response = await fetch(`${baseUrl}/api${op.path}`, {
      method: op.method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: op.body === undefined ? undefined : JSON.stringify(op.body),
    });
    return { status: response.status, text: await response.text() };
  }

  beforeAll(async () => {
    workspaceDb ??= await import("@workspace/db");
    const { db } = workspaceDb;
    const schema = await import("@workspace/db/schema");
    const { generateAgentApiKey } = await import("./agent-api-key");

    for (const conta of CONTAS) {
      const orgId = `org_e1m_${conta.toLowerCase()}_${e1}`;
      await db.insert(organizations).values({ id: orgId, name: `Matriz ${conta}`, slug: `matriz-${conta.toLowerCase()}-${e1}` });
      // P1 = projeto Padrão (criado pelo trigger da conta); P2 criado agora.
      await db.insert(schema.projects).values({ orgId, name: "Segundo", slug: "segundo" });
      const projetos = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.orgId, orgId));
      for (const projeto of PROJETOS) {
        const linhaProjeto = projetos.find((p) => (projeto === "P1" ? p.isDefault : !p.isDefault))!;
        const envs = await db
          .select()
          .from(schema.environments)
          .where(eq(schema.environments.projectId, linhaProjeto.id));
        for (const kind of AMBIENTES) {
          const rotulo = `${conta}/${projeto}/${kind === "sandbox" ? "sbx" : "prod"}`;
          const agentId = `agent_e1m_${rotulo.replaceAll("/", "_").toLowerCase()}_${e1}`;
          await db.insert(agents).values({
            id: agentId,
            orgId,
            projectId: linhaProjeto.id,
            name: `Agente ${rotulo}`,
            slug: `agente-${rotulo.replaceAll("/", "-").toLowerCase()}`,
            role: "support",
            platform: "test",
          });
          const env = envs.find((e) => e.kind === kind)!;
          const key = generateAgentApiKey(kind);
          const [row] = await db
            .insert(schema.agentApiKeys)
            .values({
              orgId,
              agentId,
              projectId: linhaProjeto.id,
              environmentId: env.id,
              prefix: key.prefix,
              keyHash: key.keyHash,
            })
            .returning({ id: schema.agentApiKeys.id });
          celulas.push({
            rotulo,
            orgId,
            projectId: linhaProjeto.id,
            environmentId: env.id,
            kind,
            agentId,
            keyId: row!.id,
            token: key.plaintext,
          });
        }
      }
    }

    // Uma chave revogada na célula A/P1/prod.
    const base = celulas.find((c) => c.rotulo === "A/P1/prod")!;
    const key = generateAgentApiKey("prod");
    await db.insert(schema.agentApiKeys).values({
      orgId: base.orgId,
      agentId: base.agentId,
      projectId: base.projectId,
      environmentId: base.environmentId,
      prefix: key.prefix,
      keyHash: key.keyHash,
      revokedAt: new Date(),
    });
    revogada = { ...base, tokenRevogado: key.plaintext };

    const express = (await import("express")).default;
    const { default: router } = await import("../routes");
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste indisponível");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!workspaceDb || celulas.length === 0) return;
    const { db } = workspaceDb;
    const { eventOutbox } = await import("@workspace/db/schema");
    const orgs = [...new Set(celulas.map((c) => c.orgId))];
    await db.delete(eventOutbox).where(inArray(eventOutbox.orgId, orgs));
    await db.delete(organizations).where(inArray(organizations.id, orgs));

    const arquivo = process.env.E1_MATRIX_OUT;
    if (arquivo && obtido.size > 0) {
      const { writeFileSync } = await import("node:fs");
      const largura = 14;
      const cab = ["chave \\ alvo".padEnd(largura), ...celulas.map((c) => c.rotulo.padEnd(largura))].join("");
      const linhas = celulas.map((chave) =>
        [
          chave.rotulo.padEnd(largura),
          ...celulas.map((alvo) => {
            const e = esperado(chave, alvo);
            const o = obtido.get(chave.rotulo)?.get(alvo.rotulo) ?? "?";
            return `${e}/${o}`.padEnd(largura);
          }),
        ].join(""),
      );
      writeFileSync(
        arquivo,
        [
          "Matriz 8×8 · esperado/obtido (6 rotas por célula; 2xx = 200 nas leituras e 202 nas escritas)",
          cab,
          ...linhas,
          "",
          `Divergências: ${detalhesDivergentes.length}`,
          ...detalhesDivergentes,
        ].join("\n") + "\n",
      );
    }
  });

  it("8×8 células × 6 rotas: cada código bate com o esperado", async () => {
    expect(celulas).toHaveLength(8);
    for (const chave of celulas) {
      const linha = new Map<string, string>();
      for (const alvo of celulas) {
        const e = esperado(chave, alvo);
        const codigos = new Set<string>();
        for (const op of operacoes(alvo)) {
          const r = await chamar(chave.token, op);
          const n = normalizar(r.status);
          codigos.add(n);
          if (n !== e) detalhesDivergentes.push(`${chave.rotulo} → ${alvo.rotulo} · ${op.nome}: esperado ${e}, obtido ${r.status}`);
        }
        linha.set(alvo.rotulo, codigos.size === 1 ? [...codigos][0]! : [...codigos].join("|"));
      }
      obtido.set(chave.rotulo, linha);
    }
    expect(detalhesDivergentes, detalhesDivergentes.join("\n")).toEqual([]);
  }, 120_000);

  it("nenhuma escrita cruzada: cada agente só tem os eventos da própria chave", async () => {
    const { db } = workspaceDb;
    const { agentEvents, eventOutbox } = await import("@workspace/db/schema");
    for (const celula of celulas) {
      const eventos = await db
        .select({ kind: agentEvents.kind })
        .from(agentEvents)
        .where(eq(agentEvents.agentId, celula.agentId));
      expect(eventos.map((e) => e.kind).sort(), celula.rotulo).toEqual(["execution", "heartbeat"]);
      const outbox = await db
        .select({ projectId: eventOutbox.projectId, environmentId: eventOutbox.environmentId })
        .from(eventOutbox)
        .where(and(eq(eventOutbox.orgId, celula.orgId), eq(eventOutbox.aggregateId, celula.agentId)));
      expect(outbox, celula.rotulo).toEqual([
        { projectId: celula.projectId, environmentId: celula.environmentId },
      ]);
    }
  });

  it("leituras 2xx só devolvem dados da própria célula", async () => {
    for (const celula of celulas) {
      const env = `environment=${celula.kind}`;
      const lista = JSON.parse(
        (await chamar(celula.token, { nome: "", method: "GET", path: `/runtime/agents?project=${celula.projectId}&${env}` })).text,
      ) as Array<{ projectId: string }>;
      // O agente é do projeto (D-E1-1): a lista traz os 2 agentes do projeto, e só eles.
      expect(lista.map((a) => a.projectId), celula.rotulo).toEqual([celula.projectId, celula.projectId]);
      const eventos = JSON.parse(
        (await chamar(celula.token, { nome: "", method: "GET", path: `/runtime/agents/${celula.agentId}/events?${env}` })).text,
      ) as Array<{ projectId: string; environment: string }>;
      expect(eventos.length, celula.rotulo).toBe(1);
      expect(eventos.every((e) => e.projectId === celula.projectId && e.environment === celula.kind)).toBe(true);
      const chaves = JSON.parse(
        (await chamar(celula.token, { nome: "", method: "GET", path: `/runtime/agents/${celula.agentId}/api-keys?${env}` })).text,
      ) as Array<{ id: string; environment: string }>;
      const esperadas = celula.rotulo === "A/P1/prod" ? 2 : 1; // + a revogada
      expect(chaves.length, celula.rotulo).toBe(esperadas);
      expect(chaves.every((k) => k.environment === celula.kind)).toBe(true);
      expect(chaves.map((k) => k.id)).toContain(celula.keyId);
    }
  });

  it("404 de outra célula é byte a byte igual ao de inexistente", async () => {
    const chave = celulas.find((c) => c.rotulo === "A/P1/prod")!;
    const alheio = celulas.find((c) => c.rotulo === "B/P1/prod")!;
    const outroProjeto = celulas.find((c) => c.rotulo === "A/P2/prod")!;
    const inexistente = await chamar(chave.token, { nome: "", method: "GET", path: `/runtime/agents/nao-existe-${e1}` });
    for (const alvo of [alheio, outroProjeto]) {
      const r = await chamar(chave.token, { nome: "", method: "GET", path: `/runtime/agents/${alvo.agentId}` });
      expect(r.status).toBe(404);
      expect(Buffer.from(r.text)).toEqual(Buffer.from(inexistente.text));
    }
  });

  it("chave revogada e chave forjada recebem 401 em todas as rotas", async () => {
    const { generateAgentApiKey } = await import("./agent-api-key");
    const real = celulas.find((c) => c.rotulo === "A/P1/prod")!;
    const [, , prefixoReal] = real.token.split("_");
    const forjadas = [
      revogada.tokenRevogado,
      generateAgentApiKey("prod").plaintext, // prefixo que não existe
      generateAgentApiKey("sandbox").plaintext,
      `msk_live_${prefixoReal}_${"0".repeat(48)}`, // prefixo real, segredo errado
      real.token.replace(/^msk_live_/, "msk_sbx_"), // rótulo de ambiente trocado
    ];
    for (const token of forjadas) {
      for (const op of operacoes(revogada)) {
        const r = await chamar(token, op);
        expect(r.status, `${op.nome} · ${token.slice(0, 12)}…`).toBe(401);
      }
    }
  });
});
