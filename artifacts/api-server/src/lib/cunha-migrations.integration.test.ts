import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createScratchDb,
  markedStatements,
  migrationFiles,
  schemaSnapshot,
  type ScratchDb,
} from "./scratch-db.test.support";

/**
 * Migrações da cunha (0023+) num banco descartável: backfill, CHECKs, triggers
 * e up → down → up com retrato de schema igual. Roda com `pnpm test:integration`.
 */

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

const M0022 = "0023_projects_envs";
const M0023 = "0024_agent_events_outcome";
const M0024 = "0025_agent_contracts";
const M0025 = "0026_rates_offinvoice";
const M0026 = "0027_outcome_snapshots";

// ag_c_3 fica num segundo projeto da org_c_1: o backfill precisa seguir o
// projeto do agente, não o Padrão da conta.
async function seed0022(db: ScratchDb) {
  for (const org of ["org_c_1", "org_c_2"]) {
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, $1, $1)`, [org]);
  }
  await db.query(`INSERT INTO projects (id, org_id, name, slug) VALUES ('prj_c_x', 'org_c_1', 'Outro', 'outro')`);
  for (const [id, org, project] of [
    ["ag_c_1", "org_c_1", null],
    ["ag_c_2", "org_c_2", null],
    ["ag_c_3", "org_c_1", "prj_c_x"],
  ] as const) {
    await db.query(
      `INSERT INTO agents (id, org_id, project_id, name, slug, role, platform)
       VALUES ($1, $2, $3, $1, $1, 'support', 'test')`,
      [id, org, project],
    );
  }
  for (const [id, agent, kind] of [
    ["ev_c_1", "ag_c_1", "execution"],
    ["ev_c_2", "ag_c_1", "error"],
    ["ev_c_3", "ag_c_2", "execution"],
    ["ev_c_4", "ag_c_2", "heartbeat"],
    ["ev_c_5", "ag_c_3", "feedback"],
  ] as const) {
    await db.query(
      `INSERT INTO agent_events (id, agent_id, kind, cost_cents, success) VALUES ($1, $2, $3, 7, 1)`,
      [id, agent, kind],
    );
  }
}

async function escopoDosEventos(db: ScratchDb) {
  return db.query(`
    SELECT ev.id, ev.org_id = a.org_id AS conta_ok, ev.project_id = a.project_id AS projeto_ok, e.kind AS ambiente
      FROM agent_events ev
      JOIN agents a ON a.id = ev.agent_id
      LEFT JOIN environments e ON e.id = ev.environment_id
     ORDER BY ev.id`);
}

describe.skipIf(!runIntegration)("0023 · agent_events no formato do envelope", () => {
  let db: ScratchDb;
  let eventosAntes = 0;

  beforeAll(async () => {
    db = await createScratchDb("muster_c0023");
    await db.migrateUntil(M0022);
    await seed0022(db);
    const [n] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM agent_events`);
    eventosAntes = n!.n;
    await db.migrateUntil(M0023);
  }, 120_000);

  afterAll(async () => {
    if (db) await db.drop();
  });

  it("backfill: 100% dos eventos com conta/projeto do agente e ambiente prod; contagem igual", async () => {
    const [n] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM agent_events`);
    expect(n!.n).toBe(eventosAntes);
    expect(await escopoDosEventos(db)).toEqual(
      ["ev_c_1", "ev_c_2", "ev_c_3", "ev_c_4", "ev_c_5"].map((id) => ({
        id,
        conta_ok: true,
        projeto_ok: true,
        ambiente: "prod",
      })),
    );
  });

  it("rodar o backfill de novo dá o mesmo estado", async () => {
    const antes = await escopoDosEventos(db);
    for (const statement of markedStatements(migrationFiles(M0023).up, "backfill-0023")) {
      await db.query(statement);
    }
    expect(await escopoDosEventos(db)).toEqual(antes);
  });

  it("INSERT antigo (sem conta/projeto) herda do agente e fica sem ambiente", async () => {
    await db.query(`INSERT INTO agent_events (id, agent_id, kind) VALUES ('ev_c_6', 'ag_c_3', 'execution')`);
    const [row] = await db.query(
      `SELECT org_id, project_id, environment_id FROM agent_events WHERE id = 'ev_c_6'`,
    );
    expect(row).toEqual({ org_id: "org_c_1", project_id: "prj_c_x", environment_id: null });
  });

  it("aceite auto sem accepted_rule_version falha no CHECK; com versão passa", async () => {
    await expect(
      db.query(
        `INSERT INTO agent_events (id, agent_id, task_id, attempt, accepted_by, accepted_by_kind, accepted_at)
         VALUES (gen_random_uuid()::text, 'ag_c_1', 't1', 1, 'regra:schema', 'auto', now())`,
      ),
    ).rejects.toThrow(/agent_events_auto_needs_rule_version/);
    await db.query(
      `INSERT INTO agent_events (id, agent_id, task_id, attempt, accepted_by, accepted_by_kind, accepted_rule_version, accepted_at)
       VALUES (gen_random_uuid()::text, 'ag_c_1', 't1', 1, 'regra:schema', 'auto', 'v3', now())`,
    );
    await expect(
      db.query(`INSERT INTO agent_events (id, agent_id, accepted_by_kind) VALUES (gen_random_uuid()::text, 'ag_c_1', 'robo')`),
    ).rejects.toThrow(/agent_events_accepted_by_kind_check/);
    await expect(
      db.query(`INSERT INTO agent_events (id, agent_id, task_id, attempt) VALUES (gen_random_uuid()::text, 'ag_c_1', 't0', 0)`),
    ).rejects.toThrow(/agent_events_attempt_check/);
  });

  it("um resultado terminal por (task, attempt); revisão humana pode anotar a mesma tentativa", async () => {
    await db.query(
      `INSERT INTO agent_events (id, agent_id, kind, task_id, run_id, attempt) VALUES (gen_random_uuid()::text, 'ag_c_2', 'execution', 't2', 'r1', 1)`,
    );
    await expect(
      db.query(
        `INSERT INTO agent_events (id, agent_id, kind, task_id, run_id, attempt) VALUES (gen_random_uuid()::text, 'ag_c_2', 'error', 't2', 'r1b', 1)`,
      ),
    ).rejects.toThrow(/agent_events_task_attempt_idx/);
    await db.query(
      `INSERT INTO agent_events (id, agent_id, kind, task_id, run_id, attempt, success, human_minutes, accepted_by, accepted_by_kind, accepted_at)
       VALUES (gen_random_uuid()::text, 'ag_c_2', 'human_review', 't2', 'r1', 1, 1, 4.5, 'ana', 'human', now())`,
    );
    // Mesma task em outra conta não colide.
    await db.query(
      `INSERT INTO agent_events (id, agent_id, kind, task_id, run_id, attempt) VALUES (gen_random_uuid()::text, 'ag_c_1', 'execution', 't2', 'r9', 1)`,
    );
  });

  it("FK composta recusa evento com conta/projeto diferentes do agente", async () => {
    const [padrao] = await db.query<{ id: string }>(
      `SELECT id FROM projects WHERE org_id = 'org_c_1' AND is_default`,
    );
    await expect(
      db.query(`INSERT INTO agent_events (id, agent_id, org_id, project_id) VALUES (gen_random_uuid()::text, 'ag_c_3', 'org_c_1', $1)`, [padrao!.id]),
    ).rejects.toThrow(/agent_events_agent_project_org_fk/);
    await expect(
      db.query(`INSERT INTO agent_events (id, agent_id, org_id, project_id) VALUES (gen_random_uuid()::text, 'ag_c_2', 'org_c_1', 'prj_c_x')`),
    ).rejects.toThrow(/agent_events_agent_project_org_fk/);
  });

  it("excluir o agente leva os eventos junto (cascata)", async () => {
    await db.query(`INSERT INTO agents (id, org_id, name, slug, role, platform) VALUES ('ag_c_9', 'org_c_2', 'x', 'x9', 'r', 'p')`);
    await db.query(`INSERT INTO agent_events (id, agent_id, task_id, attempt) VALUES (gen_random_uuid()::text, 'ag_c_9', 't9', 1)`);
    await db.query(`DELETE FROM agents WHERE id = 'ag_c_9'`);
    const [n] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM agent_events WHERE agent_id = 'ag_c_9'`);
    expect(n!.n).toBe(0);
  });
});

describe.skipIf(!runIntegration)("0024 · agent_contracts imutável e veredito com versão", () => {
  let db: ScratchDb;

  async function contrato(id: string, version: number, status: string, target: number) {
    await db.query(
      `INSERT INTO agent_contracts (id, org_id, project_id, agent_id, version, metric_key, unit, direction, baseline, target, deadline, owner_member_id, status, created_by, reference_human_minutes)
       SELECT $1, a.org_id, a.project_id, a.id, $2, 'custo', 'BRL', 'down', 10, $4, '2027-01-31', 'mem', $3, 'user', 15
         FROM agents a WHERE a.id = 'ag_c_1'`,
      [id, version, status, target],
    );
  }

  beforeAll(async () => {
    db = await createScratchDb("muster_c0024");
    await db.migrateUntil(M0022);
    await seed0022(db);
    await db.migrateUntil(M0024);
  }, 120_000);

  afterAll(async () => {
    if (db) await db.drop();
  });

  it("agentes existentes começam sem contrato (contrato pendente) e business_case não muda", async () => {
    const [n] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM agent_contracts`);
    expect(n!.n).toBe(0);
  });

  it("UPDATE em target ou reference_human_minutes falha; DELETE direto falha", async () => {
    await contrato("ct_1", 1, "active", 8);
    await expect(db.query(`UPDATE agent_contracts SET target = 7 WHERE id = 'ct_1'`)).rejects.toThrow(/imutável/);
    await expect(
      db.query(`UPDATE agent_contracts SET reference_human_minutes = 1 WHERE id = 'ct_1'`),
    ).rejects.toThrow(/imutável/);
    await expect(db.query(`DELETE FROM agent_contracts WHERE id = 'ct_1'`)).rejects.toThrow(/não pode ser apagada/);
  });

  it("veredito gravado herda a versão ativa; nova versão (mesma transação) não reescreve o antigo", async () => {
    await db.query(`INSERT INTO verdicts (id, agent_id) VALUES ('vd_1', 'ag_c_1')`);
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE agent_contracts SET status = 'superseded', superseded_at = now() WHERE agent_id = 'ag_c_1' AND status = 'active'`,
      );
      await client.query(
        `INSERT INTO agent_contracts (id, org_id, project_id, agent_id, version, metric_key, unit, direction, baseline, target, deadline, owner_member_id, status, created_by)
         SELECT 'ct_2', a.org_id, a.project_id, a.id, 2, 'custo', 'BRL', 'down', 10, 6, '2027-03-31', 'mem', 'active', 'user'
           FROM agents a WHERE a.id = 'ag_c_1'`,
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    await db.query(`INSERT INTO verdicts (id, agent_id) VALUES ('vd_2', 'ag_c_1')`);
    const rows = await db.query(
      `SELECT v.id, v.contract_version, c.target::float AS target
         FROM verdicts v JOIN agent_contracts c ON (c.id, c.version) = (v.contract_id, v.contract_version)
        WHERE v.agent_id = 'ag_c_1' ORDER BY v.id`,
    );
    expect(rows).toEqual([
      { id: "vd_1", contract_version: 1, target: 8 },
      { id: "vd_2", contract_version: 2, target: 6 },
    ]);
  });

  it("dois contratos ativos no mesmo agente violam o único parcial; superseded não volta a active", async () => {
    await expect(contrato("ct_3", 3, "active", 5)).rejects.toThrow(/agent_contracts_active_idx/);
    await expect(
      db.query(`UPDATE agent_contracts SET status = 'active' WHERE id = 'ct_1'`),
    ).rejects.toThrow(/transição de status inválida/);
  });

  it("excluir o agente leva os contratos (cascata passa pelo trigger)", async () => {
    await db.query(`DELETE FROM verdicts WHERE agent_id = 'ag_c_1'`);
    await db.query(`DELETE FROM agents WHERE id = 'ag_c_1'`);
    const [n] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM agent_contracts`);
    expect(n!.n).toBe(0);
  });
});

describe.skipIf(!runIntegration)("0025 · role_rates e off_invoice_costs", () => {
  let db: ScratchDb;

  beforeAll(async () => {
    db = await createScratchDb("muster_c0025");
    await db.migrateUntil(M0022);
    await seed0022(db);
    await db.migrateUntil(M0025);
  }, 120_000);

  afterAll(async () => {
    if (db) await db.drop();
  });

  it("nasce vazia: sem seed e sem default de custo-hora (R4)", async () => {
    const [n] = await db.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM role_rates) + (SELECT count(*) FROM off_invoice_costs) AS n`,
    );
    expect(Number(n!.n)).toBe(0);
  });

  it("CHECKs: valor negativo, vigência invertida, alocação sem alvo", async () => {
    const rate = (cents: number, from: string, to: string | null) =>
      db.query(
        `INSERT INTO role_rates (id, org_id, role, hourly_cost_cents, currency, valid_from, valid_to, created_by)
         VALUES (gen_random_uuid()::text, 'org_c_1', 'analista', $1, 'BRL', $2, $3, 'u')`,
        [cents, from, to],
      );
    await rate(9000, "2026-01-01", null);
    await expect(rate(-1, "2026-01-01", null)).rejects.toThrow(/role_rates_value_check/);
    await expect(rate(1, "2026-02-01", "2026-01-01")).rejects.toThrow(/role_rates_period_check/);
    await expect(
      db.query(
        `INSERT INTO off_invoice_costs (id, org_id, category, amount_cents, currency, period_start, period_end, allocation, created_by)
         VALUES (gen_random_uuid()::text, 'org_c_1', 'license', 10, 'BRL', '2026-10-01', '2026-10-31', 'agent', 'u')`,
      ),
    ).rejects.toThrow(/off_invoice_costs_allocation_check/);
  });

  it("projeto de outra conta é recusado pela FK composta", async () => {
    await expect(
      db.query(
        `INSERT INTO off_invoice_costs (id, org_id, project_id, category, amount_cents, currency, period_start, period_end, allocation, created_by)
         VALUES (gen_random_uuid()::text, 'org_c_2', 'prj_c_x', 'infra', 10, 'BRL', '2026-10-01', '2026-10-31', 'project', 'u')`,
      ),
    ).rejects.toThrow(/off_invoice_costs_project_org_fk/);
  });
});

/**
 * up → down → up de cada migração da cunha, da mais nova para a mais antiga:
 * o down de N volta o retrato exatamente ao de N−1 e os eventos ficam.
 */
const CADEIA = [M0023, M0024, M0025, M0026];

describe.skipIf(!runIntegration)("cunha · up → down → up", () => {
  let db: ScratchDb;
  const retratos = new Map<string, string[]>();

  async function eventos() {
    return db.query(`SELECT id, agent_id, kind, cost_cents, success FROM agent_events ORDER BY id`);
  }

  beforeAll(async () => {
    db = await createScratchDb("muster_cdown");
    await db.migrateUntil(M0022);
    await seed0022(db);
    retratos.set(M0022, await schemaSnapshot(db));
    for (const tag of CADEIA) {
      await db.migrateUntil(tag);
      retratos.set(tag, await schemaSnapshot(db));
    }
  }, 180_000);

  afterAll(async () => {
    if (db) await db.drop();
  });

  it("cada down volta ao retrato da anterior e preserva os eventos", async () => {
    const antes = await eventos();
    const ordem = [M0022, ...CADEIA];
    for (let i = ordem.length - 1; i >= 1; i -= 1) {
      await db.runSqlFile(migrationFiles(ordem[i]!).down);
      expect(await schemaSnapshot(db), `down de ${ordem[i]}`).toEqual(retratos.get(ordem[i - 1]!));
    }
    expect(await eventos()).toEqual(antes);
  });

  it("up de novo reaplica tudo com o mesmo retrato e refaz o backfill", async () => {
    await db.migrateUntil(CADEIA.at(-1));
    expect(await schemaSnapshot(db)).toEqual(retratos.get(CADEIA.at(-1)!));
    const [n] = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM agent_events WHERE org_id IS NULL OR environment_id IS NULL`,
    );
    expect(n!.n).toBe(0);
  });
});
