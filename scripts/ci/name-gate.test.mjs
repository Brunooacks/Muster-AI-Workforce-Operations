import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..", "..");
const gate = join(repositoryRoot, "scripts", "ci", "name-gate.sh");
const hook = join(repositoryRoot, "scripts", "hooks", "pre-push");

// Termo sintético, montado em tempo de execução para que este arquivo passe no
// próprio gate. Nunca use um termo real da lista de bloqueio em fixtures.
const TERM = ["Zorblax", "quintal"].join("");

const cleanEnvironment = () => {
  const environment = { ...process.env };
  delete environment.MUSTER_BLOCKLIST;
  delete environment.MUSTER_BLOCKLIST_FILE;
  delete environment.MUSTER_PREPUSH_FULL;
  return environment;
};

function identity(name, email) {
  return {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email,
  };
}

const neutral = identity("Muster CI", "ci@example.invalid");

function git(cwd, args, environment = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...cleanEnvironment(), ...neutral, ...environment },
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

function tempRepository() {
  const directory = mkdtempSync(join(tmpdir(), "muster-name-gate-"));
  git(directory, ["init", "-q", "-b", "main"]);
  git(directory, ["config", "commit.gpgsign", "false"]);
  return directory;
}

function commitFile(directory, path, content, environment = {}) {
  const fullPath = join(directory, path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
  git(directory, ["add", "-A"]);
  git(directory, ["commit", "-q", "-m", `altera ${path}`], environment);
}

function home() {
  const directory = mkdtempSync(join(tmpdir(), "muster-name-gate-home-"));
  mkdirSync(join(directory, ".config", "muster"), { recursive: true });
  writeFileSync(join(directory, ".config", "muster", "blocklist"), `# comentário\n\n${TERM}\n`);
  return directory;
}

function runGate(cwd, args = [], environment = {}) {
  return spawnSync("bash", [gate, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...cleanEnvironment(), HOME: mkdtempSync(join(tmpdir(), "muster-empty-home-")), ...environment },
  });
}

describe("name-gate.sh · arquivos versionados", () => {
  it("falha com arquivo:linha e não exibe o termo", () => {
    const repository = tempRepository();
    commitFile(repository, "docs/limpo.md", "nada aqui\n");
    commitFile(repository, "docs/sujo.md", `linha 1\nfala com ${TERM.toLowerCase()} hoje\n`);

    const result = runGate(repository, [], { MUSTER_BLOCKLIST: TERM });
    const log = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("docs/sujo.md:2");
    expect(result.stdout).not.toContain("docs/limpo.md");
    expect(log.toLowerCase()).not.toContain(TERM.toLowerCase());
  });

  it("passa quando nenhum termo aparece", () => {
    const repository = tempRepository();
    commitFile(repository, "README.md", "conteúdo neutro\n");

    const result = runGate(repository, [], { MUSTER_BLOCKLIST: TERM });

    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it("falha quando não há lista configurada ou a lista está vazia", () => {
    const repository = tempRepository();
    commitFile(repository, "README.md", "conteúdo neutro\n");

    expect(runGate(repository).status).toBe(3);
    expect(runGate(repository, [], { MUSTER_BLOCKLIST: "# só comentário\n\n" }).status).toBe(3);
    expect(runGate(repository, [], { MUSTER_BLOCKLIST_FILE: join(repository, "nao-existe") }).status).toBe(3);
  });

  it("lê ~/.config/muster/blocklist e ignora lockfile, node_modules e dist", () => {
    const repository = tempRepository();
    commitFile(repository, "pnpm-lock.yaml", `${TERM}\n`);
    commitFile(repository, "pacote/dist/saida.js", `${TERM}\n`);
    commitFile(repository, "pacote/node_modules/x/index.js", `${TERM}\n`);

    const clean = runGate(repository, [], { HOME: home() });
    expect(clean.status, clean.stdout + clean.stderr).toBe(0);

    commitFile(repository, ".agents/memory/nota.md", `${TERM}\n`);
    commitFile(repository, "attached_assets/colado.txt", `x\n${TERM}\n`);
    const dirty = runGate(repository, [], { HOME: home() });
    expect(dirty.status).toBe(1);
    expect(dirty.stdout).toContain(".agents/memory/nota.md:1");
    expect(dirty.stdout).toContain("attached_assets/colado.txt:2");
  });

  it("conta caminhos com termo sem revelar o caminho", () => {
    const repository = tempRepository();
    commitFile(repository, `docs/${TERM}.md`, "neutro\n");

    const result = runGate(repository, [], { MUSTER_BLOCKLIST: TERM });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("(caminho) 1 arquivo");
    expect(result.stdout.toLowerCase()).not.toContain(TERM.toLowerCase());
  });
});

describe("name-gate.sh · commits", () => {
  it("aponta linha adicionada e autor sem revelar o termo", () => {
    const repository = tempRepository();
    commitFile(repository, "base.txt", "base\n");
    const base = git(repository, ["rev-parse", "HEAD"]);
    commitFile(repository, "src/novo.ts", `a\nb\nconst x = '${TERM.toLowerCase()}';\n`);
    commitFile(repository, "outro.txt", "neutro\n", identity(TERM, "dev@example.invalid"));

    const result = runGate(repository, ["--commits", "HEAD", `^${base}`], { MUSTER_BLOCKLIST: TERM });

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/commit [0-9a-f]{12} src\/novo\.ts:3/);
    expect(result.stdout).toMatch(/commit [0-9a-f]{12} autor/);
    expect(result.stdout).toMatch(/commit [0-9a-f]{12} committer/);
    expect(`${result.stdout}${result.stderr}`.toLowerCase()).not.toContain(TERM.toLowerCase());
  });
});

describe("scripts/hooks/pre-push", () => {
  function setup() {
    const remote = mkdtempSync(join(tmpdir(), "muster-pre-push-remote-"));
    git(remote, ["init", "-q", "--bare"]);
    const repository = tempRepository();
    mkdirSync(join(repository, "scripts", "ci"), { recursive: true });
    mkdirSync(join(repository, "scripts", "hooks"), { recursive: true });
    copyFileSync(gate, join(repository, "scripts", "ci", "name-gate.sh"));
    copyFileSync(hook, join(repository, "scripts", "hooks", "pre-push"));
    chmodSync(join(repository, "scripts", "hooks", "pre-push"), 0o755);
    git(repository, ["config", "core.hooksPath", "scripts/hooks"]);
    git(repository, ["remote", "add", "origin", remote]);
    commitFile(repository, "README.md", "neutro\n");
    return repository;
  }

  function push(repository, environment) {
    return spawnSync("git", ["push", "-q", "origin", "HEAD:refs/heads/main"], {
      cwd: repository,
      encoding: "utf8",
      env: { ...cleanEnvironment(), ...neutral, ...environment },
    });
  }

  it("aceita push limpo", () => {
    const repository = setup();
    const result = push(repository, { HOME: home() });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it("recusa push com termo no conteúdo", () => {
    const repository = setup();
    commitFile(repository, "nota.md", `${TERM}\n`);
    const result = push(repository, { HOME: home() });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("push recusado");
    expect(result.stdout + result.stderr).toContain("nota.md:1");
  });

  it("recusa push com termo no autor, depois de um push limpo", () => {
    const repository = setup();
    expect(push(repository, { HOME: home() }).status).toBe(0);
    commitFile(repository, "outro.md", "neutro\n", identity("Dev", `${TERM.toLowerCase()}@example.invalid`));
    const result = push(repository, { HOME: home() });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/autor/);
  });

  it("recusa push quando não há lista", () => {
    const repository = setup();
    const result = push(repository, { HOME: mkdtempSync(join(tmpdir(), "muster-empty-home-")) });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("lista de bloqueio ausente");
  });
});
