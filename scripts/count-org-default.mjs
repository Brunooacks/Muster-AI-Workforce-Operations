#!/usr/bin/env node
// Contagem SOMENTE-LEITURA de linhas sob org_default, por tabela (RG-X01).
//
// Uso: DATABASE_URL=postgres://localhost/... node scripts/count-org-default.mjs
// - Recusa host que não seja local (localhost/127.0.0.1/::1/socket) — este
//   script NÃO é para produção. Para rodar contra outra base, é decisão humana
//   fora deste script.
// - Transação READ ONLY; só SELECT. Não imprime a URL nem credenciais.
import { pathToFileURL } from "node:url";

export const ORG = "org_default";
const COLS = ["org_id", "organization_id"];

/** query(sql, params) -> { rows }. Funciona com pg.Client e PGlite. */
export async function countOrgDefault(query) {
  await query("BEGIN TRANSACTION READ ONLY");
  try {
    const { rows: cols } = await query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = ANY($1) ORDER BY table_name`,
      [COLS],
    );
    const out = [];
    for (const { table_name, column_name } of cols) {
      const t = '"' + table_name.replace(/"/g, '""') + '"';
      const c = '"' + column_name.replace(/"/g, '""') + '"';
      const { rows } = await query(`SELECT count(*)::int AS n FROM ${t} WHERE ${c} = $1`, [ORG]);
      out.push({ tabela: table_name, coluna: column_name, linhas: rows[0].n });
    }
    return out;
  } finally {
    await query("ROLLBACK");
  }
}

export function hostIsLocal(url) {
  try {
    const u = new URL(url);
    const host = u.hostname || u.searchParams.get("host") || "";
    return ["", "localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || host.startsWith("/");
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL ausente"); process.exit(2); }
  if (!hostIsLocal(url)) { console.error("Recusado: DATABASE_URL não é local. Este script não roda contra produção."); process.exit(3); }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const r = await countOrgDefault((s, p) => client.query(s, p));
    console.table(r);
    console.log("total:", r.reduce((a, x) => a + x.linhas, 0));
  } finally { await client.end(); }
}
