import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const deployScript = join(root, "deploy/remote-deploy.sh");
const temporary = [];

const PREVIOUS_SHA = "a".repeat(40);
const NEW_SHA = "b".repeat(40);
const WRONG_SHA = "c".repeat(40);
const PREVIOUS_TAG = `sha-${PREVIOUS_SHA}`;
const CANDIDATE_TAG = `sha-${NEW_SHA}`;

afterEach(() =>
  temporary
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true })),
);

function write(path, text, mode = 0o755) {
  writeFileSync(path, text, { mode });
  chmodSync(path, mode);
}

function envPath(path) {
  return join(path, "deploy-root", ".env.production");
}

function readEnvFile(path) {
  return readFileSync(envPath(path), "utf8");
}

function readImageTags(path) {
  return readEnvFile(path)
    .split("\n")
    .filter((line) => line.startsWith("MUSTER_IMAGE_TAG="));
}

function readLog(path, name) {
  const log = join(path, name);
  return existsSync(log) ? readFileSync(log, "utf8") : "";
}

function dockerCalls(path) {
  return readLog(path, "docker.log")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const separator = line.indexOf(" ");
      return { tag: line.slice(0, separator), args: line.slice(separator + 1) };
    });
}

function callIndex(calls, tag, suffix) {
  return calls.findIndex(
    (call) => call.tag === tag && call.args.trimEnd().endsWith(suffix),
  );
}

function strayEnvTemporaries(path) {
  return readdirSync(join(path, "deploy-root")).filter((name) =>
    name.startsWith(".env.production.tmp."),
  );
}

function workspace() {
  const path = mkdtempSync(join(tmpdir(), "mus160-"));
  temporary.push(path);
  mkdirSync(join(path, "bin"));
  return path;
}

function deployFixture(options = {}) {
  const path = workspace();
  const deployDir = join(path, "deploy-root");
  mkdirSync(join(deployDir, "deploy"), { recursive: true });
  mkdirSync(join(deployDir, "scripts"), { recursive: true });

  if (options.compose !== false) {
    write(
      join(deployDir, "deploy", "docker-compose.prod.yml"),
      "services:\n  muster:\n    image: ghcr.io/muster/muster:${MUSTER_IMAGE_TAG}\n",
    );
  }

  if (options.envFile !== false) {
    const lines = options.envLines ?? [
      `MUSTER_IMAGE_TAG=${PREVIOUS_TAG}`,
      "COMPOSE_PROJECT_NAME=muster",
      "POSTGRES_PASSWORD=deploy-secret",
    ];
    write(envPath(path), `${lines.join("\n")}\n`, options.envMode ?? 0o640);
  }

  write(
    join(deployDir, "scripts", "release-smoke.sh"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'smoke %s\\n' "\${MUSTER_BASE_URL:-}" >> '${join(path, "smoke.log")}'
exit \${FAKE_SMOKE_EXIT:-0}
`,
  );

  write(
    join(path, "bin", "docker"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s %s\\n' "\${MUSTER_IMAGE_TAG:-}" "$*" >> '${join(path, "docker.log")}'
if [[ " $* " == *" ps --status running --services "* ]]; then
  exit 0
fi
if [[ " $* " == *" ps -q muster "* ]]; then
  printf 'muster-container-id\\n'
  exit 0
fi
if [[ " $* " == *" inspect "* ]]; then
  printf 'healthy\\n'
  exit 0
fi
exit 0
`,
  );

  write(
    join(path, "bin", "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
url="\${*: -1}"
if [[ "$url" == *veltrix* ]]; then
  # FAKE_VELTRIX_SEQUENCE: resultados por chamada, ex. "ok fail".
  counter='${join(path, "veltrix-calls")}'
  calls=$(( $(cat "$counter" 2>/dev/null || printf 0) + 1 ))
  printf '%s' "$calls" > "$counter"
  read -r -a sequence <<< "\${FAKE_VELTRIX_SEQUENCE:-ok ok}"
  last=$(( \${#sequence[@]} - 1 ))
  index=$(( calls - 1 > last ? last : calls - 1 ))
  result="\${sequence[$index]}"
  [[ "$result" == ok ]] && exit 0
  exit 22
fi
printf '{"status":"ok","sha":"%s"}\\n' "\${FAKE_HEALTH_SHA:-}"
`,
  );

  return path;
}

function runDeploy(path, sha, extra = {}) {
  const env = {
    ...process.env,
    PATH: `${join(path, "bin")}:${process.env.PATH}`,
    MUSTER_DEPLOY_DIR: join(path, "deploy-root"),
    MUSTER_BACKUP_ENV_FILE: join(path, "missing-backup.env"),
    FAKE_HEALTH_SHA: sha,
    // Host de teste com folga: 4 GiB livres de RAM e 40 GiB de disco.
    MUSTER_PREFLIGHT_MEM_AVAILABLE_KIB: String(4 * 1024 * 1024),
    MUSTER_PREFLIGHT_DISK_AVAILABLE_KIB: String(40 * 1024 * 1024),
    ...extra,
  };
  delete env.MUSTER_BACKUP_S3_BUCKET;
  for (const key of [
    "MUSTER_COMPOSE_OVERLAYS",
    "MUSTER_VELTRIX_HEALTH_URL",
    "MUSTER_MIN_MEM_AVAILABLE_MIB",
    "MUSTER_MIN_DISK_FREE_MIB",
  ]) {
    if (!(key in extra)) delete env[key];
  }
  return spawnSync("bash", [deployScript, sha], { encoding: "utf8", env });
}

function expectNoDockerCall(path, sha) {
  const result = runDeploy(path, sha);
  expect(result.status, `exit code para ${sha}`).toBe(2);
  expect(readLog(path, "docker.log"), `docker.log para ${sha}`).toBe("");
  return result;
}

describe("deploy remoto do Muster", () => {
  it("rejeita SHA em maiúsculas, curto ou não hexadecimal sem chamar o docker", () => {
    for (const sha of ["A".repeat(40), "abc1234", "z".repeat(40)]) {
      expectNoDockerCall(deployFixture(), sha);
    }
  });

  it("exige o compose e o .env.production antes de chamar o docker", () => {
    const semCompose = deployFixture({ compose: false });
    expectNoDockerCall(semCompose, NEW_SHA);

    const semEnv = deployFixture({ envFile: false });
    expectNoDockerCall(semEnv, NEW_SHA);

    const semAmbos = deployFixture({ compose: false, envFile: false });
    expectNoDockerCall(semAmbos, NEW_SHA);
  });

  it("publica o novo tag, roda o smoke e persiste o .env.production", () => {
    const path = deployFixture();
    const result = runDeploy(path, NEW_SHA);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Deployment completed successfully.");

    const calls = dockerCalls(path);
    expect(readLog(path, "docker.log")).toContain("pull");
    expect(callIndex(calls, CANDIDATE_TAG, "pull")).toBeGreaterThanOrEqual(0);
    expect(callIndex(calls, CANDIDATE_TAG, "up -d")).toBeGreaterThan(
      callIndex(calls, CANDIDATE_TAG, "pull"),
    );

    expect(readLog(path, "smoke.log")).toContain("http://127.0.0.1:8081");

    expect(readImageTags(path)).toEqual([`MUSTER_IMAGE_TAG=${CANDIDATE_TAG}`]);
    expect(readEnvFile(path)).toContain("COMPOSE_PROJECT_NAME=muster");
    expect(readEnvFile(path)).toContain("POSTGRES_PASSWORD=deploy-secret");

    // `chmod --reference` é GNU; no macOS o script cai para 0600.
    const esperado = process.platform === "linux" ? 0o640 : 0o600;
    expect(statSync(envPath(path)).mode & 0o777).toBe(esperado);
    expect(strayEnvTemporaries(path)).toEqual([]);
  });

  it("reverte para o tag anterior quando o healthz não confirma o SHA", () => {
    const path = deployFixture();
    const result = runDeploy(path, NEW_SHA, { FAKE_HEALTH_SHA: WRONG_SHA });

    expect(result.status).not.toBe(0);

    const calls = dockerCalls(path);
    const candidatoUp = callIndex(calls, CANDIDATE_TAG, "up -d");
    const anteriorPull = callIndex(calls, PREVIOUS_TAG, "pull");
    const anteriorUp = callIndex(calls, PREVIOUS_TAG, "up -d");
    expect(candidatoUp).toBeGreaterThanOrEqual(0);
    expect(anteriorPull).toBeGreaterThan(candidatoUp);
    expect(anteriorUp).toBeGreaterThan(anteriorPull);

    expect(readLog(path, "smoke.log")).toBe("");
    expect(readImageTags(path)).toEqual([`MUSTER_IMAGE_TAG=${PREVIOUS_TAG}`]);
    expect(strayEnvTemporaries(path)).toEqual([]);
  });

  it("para o candidato quando não existe tag anterior válido", () => {
    for (const envLines of [
      ["COMPOSE_PROJECT_NAME=muster", "POSTGRES_PASSWORD=deploy-secret"],
      ["MUSTER_IMAGE_TAG=latest", "COMPOSE_PROJECT_NAME=muster"],
    ]) {
      const path = deployFixture({ envLines });
      const antes = readEnvFile(path);
      const result = runDeploy(path, NEW_SHA, { FAKE_HEALTH_SHA: WRONG_SHA });

      expect(result.status).not.toBe(0);

      const calls = dockerCalls(path);
      expect(
        callIndex(calls, CANDIDATE_TAG, "stop muster"),
      ).toBeGreaterThanOrEqual(0);
      expect([
        ...new Set(
          calls.filter((call) => call.tag !== "").map((call) => call.tag),
        ),
      ]).toEqual([CANDIDATE_TAG]);

      expect(readEnvFile(path)).toBe(antes);
    }
  });

  it("reverte para o tag anterior quando o release-smoke falha", () => {
    const path = deployFixture();
    const result = runDeploy(path, NEW_SHA, { FAKE_SMOKE_EXIT: "1" });

    expect(result.status).not.toBe(0);
    expect(readLog(path, "smoke.log")).toContain("http://127.0.0.1:8081");

    const calls = dockerCalls(path);
    const candidatoUp = callIndex(calls, CANDIDATE_TAG, "up -d");
    expect(candidatoUp).toBeGreaterThanOrEqual(0);
    expect(callIndex(calls, PREVIOUS_TAG, "pull")).toBeGreaterThan(candidatoUp);
    expect(callIndex(calls, PREVIOUS_TAG, "up -d")).toBeGreaterThan(
      callIndex(calls, PREVIOUS_TAG, "pull"),
    );

    expect(readImageTags(path)).toEqual([`MUSTER_IMAGE_TAG=${PREVIOUS_TAG}`]);
  });

  it("não inicia o deploy quando falta memória para proteger o Veltrix", () => {
    const path = deployFixture();
    const result = runDeploy(path, NEW_SHA, {
      MUSTER_PREFLIGHT_MEM_AVAILABLE_KIB: String(512 * 1024),
    });

    expect(result.status).toBe(3);
    expect(result.stderr).toContain("Memória disponível abaixo do mínimo");
    expect(readLog(path, "docker.log")).toBe("");
    expect(readImageTags(path)).toEqual([`MUSTER_IMAGE_TAG=${PREVIOUS_TAG}`]);
  });

  it("não inicia o deploy quando o disco livre está abaixo do mínimo configurado", () => {
    const path = deployFixture({
      envLines: [
        `MUSTER_IMAGE_TAG=${PREVIOUS_TAG}`,
        "MUSTER_MIN_DISK_FREE_MIB=50000",
      ],
    });
    const result = runDeploy(path, NEW_SHA);

    expect(result.status).toBe(3);
    expect(result.stderr).toContain("Disco livre abaixo do mínimo");
    expect(readLog(path, "docker.log")).toBe("");
  });

  it("aplica o overlay público versionado e recusa caminhos arbitrários", () => {
    const path = deployFixture({
      envLines: [
        `MUSTER_IMAGE_TAG=${PREVIOUS_TAG}`,
        "MUSTER_COMPOSE_OVERLAYS=deploy/docker-compose.public.yml",
      ],
    });
    write(
      join(path, "deploy-root", "deploy", "docker-compose.public.yml"),
      "services:\n  cloudflared:\n    image: cloudflare/cloudflared\n",
      0o644,
    );
    const result = runDeploy(path, NEW_SHA);
    expect(result.status).toBe(0);
    const up = dockerCalls(path).find(
      (call) => call.tag === CANDIDATE_TAG && call.args.trimEnd().endsWith("up -d"),
    );
    expect(up?.args).toContain("deploy/docker-compose.public.yml");

    for (const overlay of ["../../etc/passwd", "deploy/outro.yml", "deploy/docker-compose.inexistente.yml"]) {
      const bad = deployFixture();
      const rejected = runDeploy(bad, NEW_SHA, { MUSTER_COMPOSE_OVERLAYS: overlay });
      expect(rejected.status, overlay).toBe(2);
      expect(readLog(bad, "docker.log"), overlay).toBe("");
    }
  });

  it("reverte o Muster quando o Veltrix para de responder depois do deploy", () => {
    const path = deployFixture();
    const result = runDeploy(path, NEW_SHA, {
      MUSTER_VELTRIX_HEALTH_URL: "http://127.0.0.1/veltrix-health",
      FAKE_VELTRIX_SEQUENCE: "ok fail",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("O Veltrix deixou de responder");
    const calls = dockerCalls(path);
    const candidatoUp = callIndex(calls, CANDIDATE_TAG, "up -d");
    expect(candidatoUp).toBeGreaterThanOrEqual(0);
    expect(callIndex(calls, PREVIOUS_TAG, "up -d")).toBeGreaterThan(candidatoUp);
    expect(readImageTags(path)).toEqual([`MUSTER_IMAGE_TAG=${PREVIOUS_TAG}`]);
  });

  it("segue o deploy quando o Veltrix já estava fora antes, sem culpar o Muster", () => {
    const path = deployFixture();
    const result = runDeploy(path, NEW_SHA, {
      MUSTER_VELTRIX_HEALTH_URL: "http://127.0.0.1/veltrix-health",
      FAKE_VELTRIX_SEQUENCE: "fail fail",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("o Veltrix já estava indisponível");
    expect(readImageTags(path)).toEqual([`MUSTER_IMAGE_TAG=${CANDIDATE_TAG}`]);
  });
});
