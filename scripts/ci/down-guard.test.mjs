// Guarda da pasta lib/db/drizzle/down (D-E1-5): downs nunca entram no journal,
// na imagem nem no deploy. Roda no `make ci` (etapa down-guard).
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..", "..");
const drizzleDir = join(repositoryRoot, "lib", "db", "drizzle");
const packager = join(repositoryRoot, "scripts", "ci", "package-migrations.sh");
const read = (...parts) => readFileSync(join(repositoryRoot, ...parts), "utf8");

/** Problemas no journal: entradas que apontam para down/ ou para .sql inexistente. */
export function journalViolations(journal, topLevelSql) {
  const problems = [];
  for (const { tag } of journal.entries) {
    if (tag.includes("/") || /(^|[\\/])down([\\/]|$)/.test(tag)) problems.push(`journal aponta para fora do nível de cima: ${tag}`);
    else if (!topLevelSql.includes(`${tag}.sql`)) problems.push(`journal sem .sql no nível de cima: ${tag}`);
  }
  return problems;
}

/** Problemas no Dockerfile: a imagem só pode receber migrações já empacotadas sem down/. */
export function dockerfileViolations(dockerfile) {
  const problems = [];
  const lines = dockerfile.split("\n").map((line) => line.trim());
  for (const line of lines) {
    if (!/^COPY\s/i.test(line)) continue;
    const parts = line.split(/\s+/).filter((part) => !part.startsWith("--"));
    const sources = parts.slice(1, -1);
    const destination = parts.at(-1);
    for (const source of sources) {
      if (/lib\/db\/drizzle\/?$/.test(source) || /lib\/db\/drizzle\/down/.test(source) || /(^|\/)down\/?$/.test(source)) {
        problems.push(`COPY leva down/ para a imagem: ${line}`);
      }
    }
    if (/^(\.\/)?migrations\/?$|^\/app\/migrations\/?$/.test(destination) && !sources.every((s) => s === "/app/migrations-dist")) {
      problems.push(`migrações da imagem não vêm de package-migrations.sh: ${line}`);
    }
  }
  if (!lines.some((line) => /^RUN\s.*scripts\/ci\/package-migrations\.sh\s+lib\/db\/drizzle\s+\/app\/migrations-dist/.test(line))) {
    problems.push("Dockerfile não empacota as migrações com scripts/ci/package-migrations.sh");
  }
  return problems;
}

/** Problemas em scripts/compose de deploy: cópia de migrações sem excluir down/. */
export function deployViolations(text) {
  const problems = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (/lib\/db\/drizzle\/down|drizzle\/down/.test(trimmed)) {
      problems.push(`deploy referencia down/: ${trimmed}`);
      continue;
    }
    const copies = /\b(rsync|cp|scp|tar)\b/.test(trimmed) || /^-\s*\S+:\S+/.test(trimmed);
    if (copies && /lib\/db\/drizzle|migrations/.test(trimmed) && !/--exclude[= ]['"]?down\/?/.test(trimmed)) {
      problems.push(`deploy copia migrações sem --exclude down/: ${trimmed}`);
    }
  }
  return problems;
}

function topLevelSql(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name);
}

describe("down-guard · estado atual do repo", () => {
  it("o drizzle e o migrator leem só lib/db/drizzle via journal", () => {
    expect(read("lib", "db", "drizzle.config.ts")).toMatch(/out:\s*"\.\/drizzle"/);
    const startup = read("artifacts", "api-server", "src", "lib", "startup-migrations.ts");
    expect(startup).toMatch(/migrate\(db,\s*\{\s*migrationsFolder\s*\}\)/);
    expect(startup).not.toMatch(/down/);
  });

  it("nenhum arquivo de down/ aparece no journal", () => {
    const journal = JSON.parse(read("lib", "db", "drizzle", "meta", "_journal.json"));
    expect(journalViolations(journal, topLevelSql(drizzleDir))).toEqual([]);
  });

  it("o Dockerfile empacota migrações sem down/", () => {
    expect(dockerfileViolations(read("Dockerfile"))).toEqual([]);
  });

  it("remote-deploy.sh e o compose de prod não levam down/", () => {
    expect(deployViolations(read("deploy", "remote-deploy.sh"))).toEqual([]);
    expect(deployViolations(read("deploy", "docker-compose.prod.yml"))).toEqual([]);
  });

  it("dry-run: package-migrations.sh gera só nível de cima + meta", () => {
    const workspace = mkdtempSync(join(tmpdir(), "muster-down-guard-"));
    const source = join(workspace, "drizzle");
    const target = join(workspace, "migrations");
    cpSync(drizzleDir, source, { recursive: true });
    expect(existsSync(join(source, "down"))).toBe(true);

    const result = spawnSync("bash", [packager, source, target], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);

    expect(existsSync(join(target, "down"))).toBe(false);
    expect(existsSync(join(target, "meta", "_journal.json"))).toBe(true);
    expect(topLevelSql(target).sort()).toEqual(topLevelSql(source).sort());
    const journal = JSON.parse(readFileSync(join(target, "meta", "_journal.json"), "utf8"));
    expect(journalViolations(journal, topLevelSql(target))).toEqual([]);
  });
});

describe("down-guard · fixtures que devem falhar", () => {
  it("journal com entrada em down/", () => {
    const journal = { entries: [{ tag: "0000_ok" }, { tag: "down/0001_volta" }] };
    expect(journalViolations(journal, ["0000_ok.sql"])).toHaveLength(1);
  });

  it("Dockerfile copiando lib/db/drizzle inteiro para a imagem", () => {
    const fixture = [
      "FROM node:24-slim AS runner",
      "COPY --from=builder /app/lib/db/drizzle ./migrations",
    ].join("\n");
    expect(dockerfileViolations(fixture).length).toBeGreaterThan(0);
  });

  it("deploy com rsync de migrações sem exclusão de down/", () => {
    expect(deployViolations("rsync -a lib/db/drizzle/ host:/opt/muster/migrations/")).toHaveLength(1);
    expect(deployViolations("rsync -a --exclude down/ lib/db/drizzle/ host:/opt/muster/migrations/")).toEqual([]);
    expect(deployViolations("cp -R lib/db/drizzle/down /opt/muster/migrations")).toHaveLength(1);
  });
});
