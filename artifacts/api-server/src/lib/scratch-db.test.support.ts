import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pg } from "@workspace/db/pg";

/**
 * Banco descartável para testes de migração (0022): cada teste cria o seu a
 * partir do DATABASE_URL, migra até onde precisa e apaga no fim. Nada aqui toca
 * o banco do DATABASE_URL além de CREATE/DROP DATABASE.
 */

export const DRIZZLE_DIR = join(import.meta.dirname, "../../../../lib/db/drizzle");
export const DOWN_0022 = join(DRIZZLE_DIR, "down", "0022_projects_envs.sql");
export const UP_0022 = join(DRIZZLE_DIR, "0022_projects_envs.sql");

export interface ScratchDb {
  pool: InstanceType<typeof pg.Pool>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Aplica as migrações do journal até `lastTag` (inclusive); sem tag, todas. */
  migrateUntil(lastTag?: string): Promise<void>;
  /** Executa um arquivo .sql dividido pelos breakpoints do drizzle. */
  runSqlFile(path: string): Promise<void>;
  drop(): Promise<void>;
}

export function sqlStatements(text: string): string[] {
  return text
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.replace(/--.*$/gm, "").trim().length > 0);
}

/** O trecho reexecutável de backfill da 0022 (entre os marcadores). */
export function backfill0022Statements(): string[] {
  const up = readFileSync(UP_0022, "utf8");
  const inicio = up.indexOf("-- >>> backfill-0022");
  const fim = up.indexOf("-- <<< backfill-0022");
  if (inicio < 0 || fim < 0) throw new Error("marcadores de backfill ausentes na 0022");
  return sqlStatements(up.slice(inicio, fim));
}

function urlFor(database: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

export async function createScratchDb(prefix: string): Promise<ScratchDb> {
  const name = `${prefix}_${randomUUID().slice(0, 8)}`.replace(/[^a-z0-9_]/g, "_");
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const pool = new pg.Pool({ connectionString: urlFor(name), max: 2 });
  // NOTICE do Postgres (ex.: contagens da 0022) não deve poluir a saída.
  pool.on("connect", (client) => client.on("notice", () => undefined));

  const scratch: ScratchDb = {
    pool,
    async query(text, params) {
      const result = await pool.query(text, params);
      return result.rows;
    },
    async migrateUntil(lastTag) {
      const folder = mkdtempSync(join(tmpdir(), "muster-mig-"));
      try {
        cpSync(DRIZZLE_DIR, folder, {
          recursive: true,
          filter: (src) => !src.includes(`${join(DRIZZLE_DIR, "down")}`),
        });
        if (lastTag) {
          const journalPath = join(folder, "meta", "_journal.json");
          const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
            entries: Array<{ tag: string }>;
          };
          const idx = journal.entries.findIndex((e) => e.tag === lastTag);
          if (idx < 0) throw new Error(`migração ${lastTag} não está no journal`);
          journal.entries = journal.entries.slice(0, idx + 1);
          writeFileSync(journalPath, JSON.stringify(journal));
        }
        await migrate(drizzle(pool), { migrationsFolder: folder });
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    },
    async runSqlFile(path) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const statement of sqlStatements(readFileSync(path, "utf8"))) {
          await client.query(statement);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async drop() {
      await pool.end();
      const cleanup = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await cleanup.end();
    },
  };
  return scratch;
}

/**
 * Retrato do schema `public` pelo catálogo (colunas, restrições, índices,
 * triggers e funções), ordenado: dois retratos iguais = schemas iguais para o
 * que a 0022 mexe. O diff de `pg_dump --schema-only` fica no relatório da E1.
 */
export async function schemaSnapshot(db: ScratchDb): Promise<string[]> {
  const rows = await db.query<{ line: string }>(`
    SELECT 'col ' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '-') AS line
      FROM information_schema.columns WHERE table_schema = 'public'
    UNION ALL
    SELECT 'con ' || rel.relname || '.' || con.conname || ' ' || pg_get_constraintdef(con.oid)
      FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace WHERE n.nspname = 'public'
    UNION ALL
    SELECT 'idx ' || indexdef FROM pg_indexes WHERE schemaname = 'public'
    UNION ALL
    SELECT 'trg ' || event_object_table || '.' || trigger_name || ' ' || action_timing || ' ' || event_manipulation
      FROM information_schema.triggers WHERE trigger_schema = 'public'
    UNION ALL
    SELECT 'fn ' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
    UNION ALL
    SELECT 'tbl ' || tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  return rows.map((r) => r.line).sort();
}
