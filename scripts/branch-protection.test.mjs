import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");
const script = join(repositoryRoot, "scripts", "branch-protection.sh");
const endpoint = "repos/Brunooacks/Muster-AI-Workforce-Operations/branches/main/protection";

function run(args, environment = {}) {
  return spawnSync("bash", [script, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

function printedPayload(args = [], environment = {}) {
  const result = run(args, environment);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.split("\n# Comando")[0]);
}

function ghShim() {
  const directory = mkdtempSync(join(tmpdir(), "muster-mus-157-gh-"));
  const executable = join(directory, "gh");
  writeFileSync(executable, `#!/usr/bin/env sh
printf '%s\\n' "$*" >> "$GH_LOG"
cat "$GH_RESPONSE"
`);
  chmodSync(executable, 0o755);
  return directory;
}

describe("branch-protection.sh", () => {
  it("gera o payload padrão com os checks atuais e a proteção estrita", () => {
    const payload = printedPayload();

    expect(payload.required_status_checks).toEqual({
      strict: true,
      contexts: ["typecheck · test · build", "actionlint"],
    });
    expect(payload.enforce_admins).toBe(true);
    expect(payload.required_pull_request_reviews.required_approving_review_count).toBe(0);
    expect(payload.required_pull_request_reviews).not.toHaveProperty("dismissal_restrictions");
    expect(payload.required_pull_request_reviews).not.toHaveProperty("bypass_pull_request_allowances");
    expect(payload.allow_force_pushes).toBe(false);
    expect(payload.allow_deletions).toBe(false);
  });

  it("aceita lista customizada por parâmetro e enforce_admins por ambiente", () => {
    const payload = printedPayload(
      ["--checks", "PostgreSQL integration,E2E público"],
      {
        ENFORCE_ADMINS: "false",
        REQUIRED_APPROVALS: "2",
        REQUIRED_CHECKS: "ignorado",
      },
    );

    expect(payload.required_status_checks.contexts).toEqual([
      "PostgreSQL integration",
      "E2E público",
    ]);
    expect(payload.enforce_admins).toBe(false);
    expect(payload.required_pull_request_reviews.required_approving_review_count).toBe(2);
  });

  it("aceita a lista customizada por REQUIRED_CHECKS", () => {
    const payload = printedPayload([], {
      REQUIRED_CHECKS: "docker build · release smoke,e2e autenticado · Clerk",
    });

    expect(payload.required_status_checks.contexts).toEqual([
      "docker build · release smoke",
      "e2e autenticado · Clerk",
    ]);
  });

  it("não chama gh em --apply sem confirmação interativa", () => {
    const directory = ghShim();
    const log = join(directory, "gh.log");
    const response = join(directory, "response.json");
    writeFileSync(response, "{}");

    const result = run(["--apply"], {
      PATH: `${directory}:${process.env.PATH}`,
      GH_LOG: log,
      GH_RESPONSE: response,
    });

    expect(result.status).not.toBe(0);
    expect(existsSync(log)).toBe(false);
  });

  it("faz somente GET em --check e compara com o payload", () => {
    const directory = ghShim();
    const log = join(directory, "gh.log");
    const response = join(directory, "response.json");
    writeFileSync(response, JSON.stringify(printedPayload(["--payload"])));

    const result = run(["--check"], {
      PATH: `${directory}:${process.env.PATH}`,
      GH_LOG: log,
      GH_RESPONSE: response,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(log, "utf8").trim()).toBe(`api ${endpoint}`);
  });
});
