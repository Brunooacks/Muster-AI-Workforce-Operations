import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DOWN_0022,
  backfill0022Statements,
  createScratchDb,
  schemaSnapshot,
  type ScratchDb,
} from "./scratch-db.test.support";

/**
 * Backfill da 0022 (T1.3) num banco descartável migrado até a 0021 e povoado
 * com 3 contas, 7 agentes e 5 chaves. Roda com `pnpm test:integration`.
 */

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

const ORGS = ["org_bf_1", "org_bf_2", "org_bf_3"];
// org_bf_3 fica sem agentes: também precisa ganhar projeto.
const AGENTS: Array<[string, string]> = [
  ["ag_bf_1", "org_bf_1"],
  ["ag_bf_2", "org_bf_1"],
  ["ag_bf_3", "org_bf_1"],
  ["ag_bf_4", "org_bf_1"],
  ["ag_bf_5", "org_bf_2"],
  ["ag_bf_6", "org_bf_2"],
  ["ag_bf_7", "org_bf_2"],
];
const KEYS: Array<[string, string, string]> = [
  ["key_bf_1", "ag_bf_1", "org_bf_1"],
  ["key_bf_2", "ag_bf_1", "org_bf_1"],
  ["key_bf_3", "ag_bf_2", "org_bf_1"],
  ["key_bf_4", "ag_bf_5", "org_bf_2"],
  ["key_bf_5", "ag_bf_6", "org_bf_2"],
];
const OUTBOX: Array<[string, string, string]> = [
  ["ob_bf_1", "org_bf_1", "pending"],
  ["ob_bf_2", "org_bf_1", "completed"],
  ["ob_bf_3", "org_bf_2", "processing"],
  ["ob_bf_4", "org_bf_2", "dead-letter"],
];

async function seed0021(db: ScratchDb) {
  for (const org of ORGS) {
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, $1, $1)`, [org]);
  }
  for (const [id, org] of AGENTS) {
    await db.query(
      `INSERT INTO agents (id, org_id, name, slug, role, platform) VALUES ($1, $2, $1, $1, 'support', 'test')`,
      [id, org],
    );
  }
  for (const [id, agent, org] of KEYS) {
    await db.query(
      `INSERT INTO agent_api_keys (id, org_id, agent_id, prefix, key_hash) VALUES ($1, $3, $2, $1, repeat('0', 64))`,
      [id, agent, org],
    );
  }
  for (const [id, org, status] of OUTBOX) {
    await db.query(
      `INSERT INTO event_outbox (id, org_id, aggregate_type, aggregate_id, event_type, payload, status)
       VALUES ($1, $2, 'agent', 'x', 'test', '{}', $3)`,
      [id, org, status],
    );
  }
  for (const [org, day, cost] of [
    ["org_bf_1", "2026-10-01", 1.25],
    ["org_bf_1", "2026-10-02", 0.75],
    ["org_bf_2", "2026-10-01", 3.5],
  ] as const) {
    await db.query(
      `INSERT INTO ai_usage_daily (org_id, day, feature, calls, est_cost_usd) VALUES ($1, $2, 'agent-analysis', 1, $3)`,
      [org, day, cost],
    );
  }
}

async function usagePorOrg(db: ScratchDb) {
  return db.query(
    `SELECT org_id, sum(est_cost_usd)::float AS total, count(*)::int AS linhas
       FROM ai_usage_daily GROUP BY org_id ORDER BY org_id`,
  );
}

async function estadoDoEscopo(db: ScratchDb) {
  return {
    projects: await db.query(`SELECT id, org_id, slug, is_default FROM projects ORDER BY id`),
    environments: await db.query(`SELECT id, project_id, kind FROM environments ORDER BY id`),
    agents: await db.query(`SELECT id, project_id FROM agents ORDER BY id`),
    keys: await db.query(`SELECT id, project_id, environment_id FROM agent_api_keys ORDER BY id`),
    outbox: await db.query(`SELECT id, project_id, environment_id FROM event_outbox ORDER BY id`),
    usage: await db.query(`SELECT org_id, day, project_id FROM ai_usage_daily ORDER BY org_id, day`),
  };
}

describe.skipIf(!runIntegration)("0022 · backfill de projeto e ambiente", () => {
  let db: ScratchDb;
  let usageAntes: unknown[];
  // As migrações antigas já criam uma conta própria (0009); contamos a partir dela.
  let orgsDasMigracoes = 0;

  beforeAll(async () => {
    db = await createScratchDb("muster_bf0022");
    await db.migrateUntil("0021_premium_molten_man");
    const [base] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM organizations`);
    orgsDasMigracoes = base!.n;
    await seed0021(db);
    usageAntes = await usagePorOrg(db);
    await db.migrateUntil();
  }, 120_000);

  afterAll(async () => {
    if (db) await db.drop();
  });

  it("cria 1 projeto Padrão por conta, inclusive conta sem agentes, com 2 ambientes", async () => {
    const [counts] = await db.query<{ orgs: number; padrao: number; projetos: number; ambientes: number }>(`
      SELECT (SELECT count(*) FROM organizations)::int AS orgs,
             (SELECT count(*) FROM projects WHERE is_default AND slug = 'padrao')::int AS padrao,
             (SELECT count(*) FROM projects)::int AS projetos,
             (SELECT count(*) FROM environments)::int AS ambientes`);
    const orgs = orgsDasMigracoes + 3;
    expect(counts).toEqual({ orgs, padrao: orgs, projetos: orgs, ambientes: 2 * orgs });
    const semAgentes = await db.query(
      `SELECT e.kind FROM projects p JOIN environments e ON e.project_id = p.id
        WHERE p.org_id = 'org_bf_3' ORDER BY e.kind`,
    );
    expect(semAgentes).toEqual([{ kind: "prod" }, { kind: "sandbox" }]);
  });

  it("liga os 7 agentes ao projeto Padrão da própria conta", async () => {
    const rows = await db.query<{ total: number; certos: number }>(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE p.org_id = a.org_id AND p.is_default)::int AS certos
        FROM agents a JOIN projects p ON p.id = a.project_id`);
    expect(rows[0]).toEqual({ total: 7, certos: 7 });
  });

  it("100% das 5 chaves msk_live_ ficam no ambiente prod do projeto do agente", async () => {
    const rows = await db.query<{ total: number; prod: number }>(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE e.kind = 'prod' AND e.project_id = a.project_id)::int AS prod
        FROM agent_api_keys k
        JOIN environments e ON e.id = k.environment_id
        JOIN agents a ON a.id = k.agent_id`);
    expect(rows[0]).toEqual({ total: 5, prod: 5 });
  });

  it("outbox pendente vai para Padrão/prod e o processado fica NULL", async () => {
    const rows = await db.query<{ id: string; status: string; kind: string | null; default: boolean | null }>(`
      SELECT o.id, o.status, e.kind, p.is_default AS "default"
        FROM event_outbox o
        LEFT JOIN projects p ON p.id = o.project_id
        LEFT JOIN environments e ON e.id = o.environment_id
       ORDER BY o.id`);
    expect(rows).toEqual([
      { id: "ob_bf_1", status: "pending", kind: "prod", default: true },
      { id: "ob_bf_2", status: "completed", kind: null, default: null },
      { id: "ob_bf_3", status: "processing", kind: "prod", default: true },
      { id: "ob_bf_4", status: "dead-letter", kind: null, default: null },
    ]);
  });

  it("ai_usage_daily não recebe backfill e o total por conta não muda", async () => {
    expect(await usagePorOrg(db)).toEqual(usageAntes);
    const [nulos] = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ai_usage_daily WHERE project_id IS NOT NULL`,
    );
    expect(nulos!.n).toBe(0);
  });

  it("rodar o backfill de novo dá exatamente o mesmo estado", async () => {
    const antes = await estadoDoEscopo(db);
    for (const statement of backfill0022Statements()) await db.query(statement);
    expect(await estadoDoEscopo(db)).toEqual(antes);
  });

  it("depois da 0022, INSERT antigo sem projeto continua válido (triggers)", async () => {
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ('org_bf_4', 'x', 'org-bf-4')`);
    await db.query(
      `INSERT INTO agents (id, org_id, name, slug, role, platform) VALUES ('ag_bf_8', 'org_bf_4', 'x', 'x', 'r', 'p')`,
    );
    await db.query(
      `INSERT INTO agent_api_keys (id, org_id, agent_id, prefix, key_hash) VALUES ('key_bf_6', 'org_bf_4', 'ag_bf_8', 'key_bf_6', 'h')`,
    );
    const [row] = await db.query<{ is_default: boolean; kind: string; ambientes: number }>(`
      SELECT p.is_default, e.kind,
             (SELECT count(*) FROM environments x WHERE x.project_id = p.id)::int AS ambientes
        FROM agent_api_keys k
        JOIN agents a ON a.id = k.agent_id
        JOIN projects p ON p.id = a.project_id AND p.id = k.project_id
        JOIN environments e ON e.id = k.environment_id
       WHERE k.id = 'key_bf_6'`);
    expect(row).toEqual({ is_default: true, kind: "prod", ambientes: 2 });
  });

  it("FK composta recusa chave de projeto diferente do agente", async () => {
    await db.query(
      `INSERT INTO projects (id, org_id, name, slug) VALUES ('prj_bf_x', 'org_bf_1', 'Outro', 'outro')`,
    );
    const [env] = await db.query<{ id: string }>(
      `SELECT id FROM environments WHERE project_id = 'prj_bf_x' AND kind = 'prod'`,
    );
    await expect(
      db.query(
        `INSERT INTO agent_api_keys (id, org_id, agent_id, project_id, environment_id, prefix, key_hash)
         VALUES ('key_bf_x', 'org_bf_1', 'ag_bf_1', 'prj_bf_x', $1, 'key_bf_x', 'h')`,
        [env!.id],
      ),
    ).rejects.toThrow(/agent_api_keys_agent_project_fk/);
    await expect(
      db.query(
        `INSERT INTO agents (id, org_id, project_id, name, slug, role, platform)
         VALUES ('ag_bf_x', 'org_bf_2', 'prj_bf_x', 'x', 'x-x', 'r', 'p')`,
      ),
    ).rejects.toThrow(/agents_project_org_fk/);
  });

  it("ON CONFLICT de ai_usage_daily colide linhas sem projeto (NULLS NOT DISTINCT)", async () => {
    const upsert = `
      INSERT INTO ai_usage_daily (org_id, project_id, day, feature, calls)
      VALUES ('org_bf_3', NULL, '2026-10-24', 'x', 1)
      ON CONFLICT (org_id, project_id, day, feature)
      DO UPDATE SET calls = ai_usage_daily.calls + 1`;
    await db.query(upsert);
    await db.query(upsert);
    const rows = await db.query<{ calls: number }>(
      `SELECT calls FROM ai_usage_daily WHERE org_id = 'org_bf_3' AND day = '2026-10-24'`,
    );
    expect(rows).toEqual([{ calls: 2 }]);
  });
});

describe.skipIf(!runIntegration)("0022 · up → down → up", () => {
  let db: ScratchDb;
  let schema0021: string[];
  let schema0022: string[];

  async function dadosPreservados() {
    return {
      agents: await db.query(`SELECT id, org_id, name, slug FROM agents ORDER BY id`),
      keys: await db.query(`SELECT id, org_id, agent_id, prefix, key_hash, revoked_at FROM agent_api_keys ORDER BY id`),
      outbox: await db.query(`SELECT id, org_id, status FROM event_outbox ORDER BY id`),
      usage: await usagePorOrg(db),
    };
  }

  beforeAll(async () => {
    db = await createScratchDb("muster_down0022");
    await db.migrateUntil("0021_premium_molten_man");
    await seed0021(db);
    schema0021 = await schemaSnapshot(db);
    await db.migrateUntil();
    schema0022 = await schemaSnapshot(db);
  }, 120_000);

  afterAll(async () => {
    if (db) await db.drop();
  });

  it("down volta o schema exatamente ao da 0021 e preserva agentes, chaves e uso", async () => {
    // Uso por projeto no mesmo (org, dia, feature): o down precisa juntar.
    const [prj] = await db.query<{ id: string }>(
      `SELECT id FROM projects WHERE org_id = 'org_bf_1' AND is_default`,
    );
    await db.query(
      `INSERT INTO ai_usage_daily (org_id, project_id, day, feature, calls, est_cost_usd)
       VALUES ('org_bf_1', $1, '2026-10-01', 'agent-analysis', 2, 0.5)`,
      [prj!.id],
    );
    const antes = await dadosPreservados();

    await db.runSqlFile(DOWN_0022);

    expect(await schemaSnapshot(db)).toEqual(schema0021);
    const depois = await dadosPreservados();
    expect(depois.agents).toEqual(antes.agents);
    expect(depois.keys).toEqual(antes.keys);
    expect(depois.outbox).toEqual(antes.outbox);
    expect(depois.usage).toEqual([
      { org_id: "org_bf_1", total: 2.5, linhas: 2 },
      { org_id: "org_bf_2", total: 3.5, linhas: 1 },
    ]);
  });

  it("up de novo reaplica a 0022 com o mesmo schema e chaves em prod", async () => {
    await db.migrateUntil();
    expect(await schemaSnapshot(db)).toEqual(schema0022);
    const [row] = await db.query<{ total: number; prod: number }>(`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE e.kind = 'prod')::int AS prod
        FROM agent_api_keys k JOIN environments e ON e.id = k.environment_id`);
    expect(row).toEqual({ total: 5, prod: 5 });
  });
});
