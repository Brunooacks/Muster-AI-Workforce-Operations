import path from "node:path";

export function startupMigrationsEnabled(value = process.env.MIGRATE_ON_START): boolean {
  return value?.trim().toLowerCase() === "true";
}

/** Contagens que a 0022 precisa preservar ou criar (T1.3). */
export interface Contagens0022 {
  orgs: number;
  projetos: number | null;
  ambientes: number | null;
  agentes: number;
  chaves: number;
}

type Consulta = (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>;

/** Lê as contagens; `projetos`/`ambientes` ficam nulos antes da 0022. */
export async function lerContagens0022(query: Consulta): Promise<Contagens0022> {
  const { rows } = await query(`
    SELECT (SELECT count(*) FROM organizations)::int AS orgs,
           (SELECT count(*) FROM agents)::int AS agentes,
           (SELECT count(*) FROM agent_api_keys)::int AS chaves,
           to_regclass('public.projects') IS NOT NULL AS tem_projetos`);
  const row = rows[0] ?? {};
  let projetos: number | null = null;
  let ambientes: number | null = null;
  if (row.tem_projetos) {
    const escopo = await query(`
      SELECT (SELECT count(*) FROM projects)::int AS projetos,
             (SELECT count(*) FROM environments)::int AS ambientes`);
    projetos = Number(escopo.rows[0]?.projetos ?? 0);
    ambientes = Number(escopo.rows[0]?.ambientes ?? 0);
  }
  return {
    orgs: Number(row.orgs ?? 0),
    projetos,
    ambientes,
    agentes: Number(row.agentes ?? 0),
    chaves: Number(row.chaves ?? 0),
  };
}

export function formatarContagens0022(c: Contagens0022): string {
  const n = (v: number | null) => (v === null ? "-" : String(v));
  return `0022: orgs=${c.orgs} projetos=${n(c.projetos)} ambientes=${n(c.ambientes)} agentes=${c.agentes} chaves=${c.chaves}`;
}

export async function runStartupMigrations(): Promise<void> {
  if (!startupMigrationsEnabled()) return;
  const migrationsFolder = path.resolve(process.env.DB_MIGRATIONS_DIR?.trim() || "migrations");
  const [{ migrate }, { db, pool }, { logger }] = await Promise.all([
    import("drizzle-orm/node-postgres/migrator"),
    import("@workspace/db"),
    import("./logger"),
  ]);
  const query: Consulta = (sql) => pool.query(sql);
  // Contagem é diagnóstico: se falhar (base vazia antes da 0009, por exemplo),
  // a migração segue mesmo assim.
  const antes = await lerContagens0022(query).catch(() => null);
  await migrate(db, { migrationsFolder });
  // Só loga quando esta subida aplicou a 0022 (antes sem projects, agora com).
  if (antes && antes.projetos === null) {
    const depois = await lerContagens0022(query).catch(() => null);
    if (depois && depois.projetos !== null) {
      logger.info({ antes, depois }, `antes ${formatarContagens0022(antes)}`);
      logger.info({ antes, depois }, formatarContagens0022(depois));
    }
  }
}
