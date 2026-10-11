import { chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const backupScript = join(root, "deploy/backup/muster-backup.sh");
const deployScript = join(root, "deploy/remote-deploy.sh");
const restoreScript = join(root, "deploy/backup/muster-restore-test.sh");
const pullScript = join(root, "deploy/backup/muster-backup-pull.sh");
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
if [[ "$1" == ps ]]; then
  printf 'postgres-container-id\n'
  exit 0
fi
if [[ "$1" == exec ]]; then
  if [[ " $* " == *' pg_dump '* ]]; then printf 'PGDUMP'; fi
  if [[ " $* " == *' pg_restore --list '* && "\${MUS161_FAIL_PG_RESTORE:-}" == true ]]; then exit 1; fi
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
  it("valida o dump por docker exec e retém somente três pares locais", () => {
    const path = workspace();
    const backupDir = join(path, "backups");
    mkdirSync(backupDir);
    for (const timestamp of ["20260101T000000Z", "20260201T000000Z", "20260301T000000Z", "20260401T000000Z"]) {
      writeFileSync(join(backupDir, `muster-${timestamp}.dump`), "old dump");
      writeFileSync(join(backupDir, `muster-${timestamp}.dump.sha256`), "old checksum");
    }
    const result = run("bash", [backupScript], {
      env: backupEnvironment(path, { MUSTER_BACKUP_LOCAL_RETENTION_COUNT: "3" }),
    });
    const log = readFileSync(join(path, "docker.log"), "utf8");

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/muster-\d{8}T\d{6}Z\.dump/);
    expect(log).toContain("ps -q --filter label=com.docker.compose.project=muster --filter label=com.docker.compose.service=postgres");
    expect(log).toContain("exec -i postgres-container-id pg_dump");
    expect(log).toContain("exec -i postgres-container-id pg_restore --list");
    expect(log).not.toContain("compose -p");
    expect(log).not.toContain("--key muster/postgres/muster-old-1.dump");
    expect(log).not.toContain("--key muster/postgres/muster-old-2.dump");
    expect(log).toContain("--key muster/postgres/muster-old-3.dump");
    const dumpName = result.stdout.match(/muster-\d{8}T\d{6}Z\.dump/)?.[0];
    expect(dumpName).toBeTruthy();
    expect(readFileSync(join(backupDir, `${dumpName}.sha256`), "utf8")).toMatch(new RegExp(`^[a-f0-9]{64}  ${dumpName}\\n$`));
    expect(readdirSync(backupDir).filter((name) => name.endsWith(".dump"))).toHaveLength(3);
    expect(readdirSync(backupDir)).not.toContain("muster-20260101T000000Z.dump");
    expect(readdirSync(backupDir)).not.toContain("muster-20260201T000000Z.dump");
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

  it("não envia dump quando a validação pg_restore falha", () => {
    const path = workspace();
    const result = run("bash", [backupScript], {
      env: backupEnvironment(path, { MUS161_FAIL_PG_RESTORE: "true" }),
    });
    const log = readFileSync(join(path, "docker.log"), "utf8");

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("pg_restore");
    expect(log).not.toContain(" s3 cp ");
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
      env: { ...process.env, PATH: `${join(path, "bin")}:${process.env.PATH}`, MUSTER_DEPLOY_DIR: deployDir, MUSTER_BACKUP_SCRIPT: failure, MUSTER_BACKUP_S3_BUCKET: "backup-test", MUSTER_PREFLIGHT_MEM_AVAILABLE_KIB: "4194304", MUSTER_PREFLIGHT_DISK_AVAILABLE_KIB: "41943040" },
    });

    expect(result.status).not.toBe(0);
    // No Linux (droplet e CI) a falha precisa vir do upload. No macOS o bash 3.2
    // não tem mapfile e o find BSD não tem -printf, então o dump local falha
    // antes; o que importa nos dois casos é não chegar ao pull/up.
    if (process.platform === "linux") expect(result.stderr).toContain("upload recusado");
    expect(readFileSync(dockerLog, "utf8")).not.toContain(" pull");
    expect(readFileSync(dockerLog, "utf8")).not.toContain(" up -d");
    expect(readFileSync(dockerLog, "utf8")).not.toContain(" stop muster");
  });

  it("não publica o banco de restore e gera a senha em tempo de execução", () => {
    const source = readFileSync(restoreScript, "utf8");

    expect(source).not.toContain("--publish");
    expect(source).toContain("openssl rand -hex 24");
    expect(source).not.toContain("POSTGRES_PASSWORD=restore-test");
  });

  it("modo local guarda sete pares, não chama a AWS CLI e não exige credenciais S3", () => {
    const path = workspace();
    const backupDir = join(path, "backups");
    mkdirSync(backupDir);
    for (let day = 1; day <= 8; day += 1) {
      const timestamp = `202601${String(day).padStart(2, "0")}T000000Z`;
      writeFileSync(join(backupDir, `muster-${timestamp}.dump`), "old dump");
      writeFileSync(join(backupDir, `muster-${timestamp}.dump.sha256`), "old checksum");
    }
    const env = backupEnvironment(path, { MUSTER_BACKUP_MODE: "local" });
    for (const key of ["MUSTER_BACKUP_S3_ENDPOINT", "MUSTER_BACKUP_S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) delete env[key];
    const result = run("bash", [backupScript], { env });
    const log = readFileSync(join(path, "docker.log"), "utf8");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Backup local concluído");
    expect(log).toContain("pg_restore --list");
    expect(log).not.toMatch(/^run /m);
    expect(readdirSync(backupDir).filter((name) => name.endsWith(".dump"))).toHaveLength(7);
    expect(readdirSync(backupDir)).not.toContain("muster-20260101T000000Z.dump");
  });

  it("recusa modo de backup desconhecido", () => {
    const path = workspace();
    const result = run("bash", [backupScript], { env: backupEnvironment(path, { MUSTER_BACKUP_MODE: "ftp" }) });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("MUSTER_BACKUP_MODE deve ser s3 ou local");
  });

  it("cópia off-site verifica o SHA-256 de cada dump e mantém só os N mais recentes", () => {
    const path = workspace();
    const remoteDir = join(path, "remote");
    const localDir = join(path, "local");
    mkdirSync(remoteDir);
    const sha = (text) => spawnSync("bash", ["-c", "printf %s \"$0\" | (sha256sum 2>/dev/null || shasum -a 256) | cut -d' ' -f1", text], { encoding: "utf8" }).stdout.trim();
    for (const day of ["01", "02", "03"]) {
      const name = `muster-202601${day}T000000Z.dump`;
      writeFileSync(join(remoteDir, name), `dump ${day}`);
      writeFileSync(join(remoteDir, `${name}.sha256`), `${sha(`dump ${day}`)}  ${name}\n`);
    }
    // rsync falso: copia o diretório "remoto" local, preservando o contrato de argumentos.
    write(join(path, "bin", "rsync"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${join(path, "rsync.log")}"
destination="\${@: -1}"
cp "${remoteDir}"/muster-* "$destination"
`);
    const env = { ...process.env, PATH: `${join(path, "bin")}:${process.env.PATH}`, MUSTER_BACKUP_PULL_KEEP: "2" };
    const ok = run("bash", [pullScript, "muster-deploy@203.0.113.10", localDir], { env });

    expect(ok.status, ok.stderr).toBe(0);
    expect(readFileSync(join(path, "rsync.log"), "utf8")).toContain("StrictHostKeyChecking=yes");
    expect(readdirSync(localDir).filter((name) => name.endsWith(".dump")).sort()).toEqual([
      "muster-20260102T000000Z.dump",
      "muster-20260103T000000Z.dump",
    ]);

    writeFileSync(join(remoteDir, "muster-20260103T000000Z.dump"), "adulterado");
    const corrupted = run("bash", [pullScript, "muster-deploy@203.0.113.10", localDir], { env });
    expect(corrupted.status).not.toBe(0);
    expect(corrupted.stderr).toContain("SHA-256 divergente");

    const invalid = run("bash", [pullScript, "root@host; rm -rf /", localDir], { env });
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain("destino SSH inválido");
  });
});
