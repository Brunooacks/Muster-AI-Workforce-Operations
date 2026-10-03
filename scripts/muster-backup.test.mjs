import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const backupScript = join(root, "deploy/backup/muster-backup.sh");
const deployScript = join(root, "deploy/remote-deploy.sh");
const temporary = [];
const disposableSecret = `test-${process.pid}-${Date.now()}`;

afterEach(() => temporary.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

function workspace() {
  const path = mkdtempSync(join(tmpdir(), "mus161-"));
  temporary.push(path);
  mkdirSync(join(path, "bin"));
  return path;
}

function write(path, text, mode = 0o755) {
  writeFileSync(path, text, { mode });
  chmodSync(path, mode);
}

function backupEnvironment(path, extra = {}) {
  const log = join(path, "docker.log");
  write(join(path, "bin", "docker"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${log}"
if [[ "$1" == compose ]]; then
  printf 'PGDUMP'
  exit 0
fi
if [[ "$1" == run ]]; then
  case " $* " in
    *' list-objects-v2 '*) printf '2026-10-03T12:00:00Z\\tmuster/postgres/muster-20261003T120000Z.dump\\n2026-09-01T00:00:00Z\\tmuster/postgres/muster-old-1.dump\\n2026-08-01T00:00:00Z\\tmuster/postgres/muster-old-2.dump\\n2026-07-01T00:00:00Z\\tmuster/postgres/muster-old-3.dump\\n' ;;
  esac
fi
`);
  return {
    PATH: `${join(path, "bin")}:${process.env.PATH}`,
    MUSTER_BACKUP_DIR: join(path, "backups"),
    MUSTER_BACKUP_ENV_FILE: join(path, "missing.env"),
    MUSTER_BACKUP_S3_ENDPOINT: "http://s3.invalid",
    MUSTER_BACKUP_S3_BUCKET: "backup-test",
    AWS_ACCESS_KEY_ID: "access-test",
    AWS_SECRET_ACCESS_KEY: disposableSecret,
    TZ: "UTC",
    ...extra,
  };
}

function run(command, args, options) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

describe("backup do Muster", () => {
  it("gera dump e checksum previsíveis, mantém o novo e preserva três backups", () => {
    const path = workspace();
    const result = run("bash", [backupScript], { env: backupEnvironment(path) });
    const log = readFileSync(join(path, "docker.log"), "utf8");

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/muster-\d{8}T\d{6}Z\.dump/);
    expect(log).toContain("compose -p muster");
    expect(log).not.toContain("--key muster/postgres/muster-old-1.dump");
    expect(log).not.toContain("--key muster/postgres/muster-old-2.dump");
    expect(log).toContain("--key muster/postgres/muster-old-3.dump");
    const dumpName = result.stdout.match(/muster-\d{8}T\d{6}Z\.dump/)?.[0];
    expect(dumpName).toBeTruthy();
    expect(readFileSync(join(path, "backups", `${dumpName}.sha256`), "utf8")).toMatch(new RegExp(`^[a-f0-9]{64}  ${dumpName}\\n$`));
  });

  it("recusa env file com permissões abertas e não vaza segredo", () => {
    const path = workspace();
    const envFile = join(path, "backup.env");
    writeFileSync(envFile, `AWS_SECRET_ACCESS_KEY=${disposableSecret}\n`, { mode: 0o644 });
    chmodSync(envFile, 0o644);
    const result = run("bash", [backupScript], { env: backupEnvironment(path, { MUSTER_BACKUP_ENV_FILE: envFile }) });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("permissão 0600");
    expect(`${result.stdout}${result.stderr}`).not.toContain(disposableSecret);
  });

  it("interrompe o pré-deploy antes do pull quando o upload falha", () => {
    const path = workspace();
    const deployDir = join(path, "deploy-root");
    mkdirSync(join(deployDir, "deploy"), { recursive: true });
    writeFileSync(join(deployDir, "deploy", "docker-compose.prod.yml"), "services: {}\n");
    writeFileSync(join(deployDir, ".env.production"), "MUSTER_IMAGE_TAG=sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n");
    const failure = join(path, "fail-backup.sh");
    write(failure, "#!/usr/bin/env bash\nprintf 'upload recusado\\n' >&2\nexit 1\n");
    const dockerLog = join(path, "deploy-docker.log");
    write(join(path, "bin", "docker"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${dockerLog}"
if [[ " $* " == *' ps --status running --services '* ]]; then printf 'postgres\\n'; fi
if [[ " $* " == *' exec -T postgres '* ]]; then printf 'dump'; fi
`);
    const result = run("bash", [deployScript, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"], {
      env: { ...process.env, PATH: `${join(path, "bin")}:${process.env.PATH}`, MUSTER_DEPLOY_DIR: deployDir, MUSTER_BACKUP_SCRIPT: failure, MUSTER_BACKUP_S3_BUCKET: "backup-test" },
    });

    expect(result.status).not.toBe(0);
    expect(readFileSync(dockerLog, "utf8")).not.toContain(" pull");
  });
});
