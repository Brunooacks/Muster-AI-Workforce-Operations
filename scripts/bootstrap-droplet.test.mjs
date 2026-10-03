import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const temporaryPaths = [];
const repositoryRoot = resolve(process.cwd(), "..");

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function makeTemporaryPath(prefix) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryPaths.push(path);
  return path;
}

async function fakeCommands() {
  const bin = await makeTemporaryPath("muster-mus163-bin-");
  const docker = join(bin, "docker");
  const curl = join(bin, "curl");
  const install = join(bin, "install");
  const chown = join(bin, "chown");
  await writeFile(docker, "#!/usr/bin/env bash\nprintf 'Docker test\\n'\n", { mode: 0o755 });
  await writeFile(curl, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
  await writeFile(install, `#!/usr/bin/env bash
args=()
while (($#)); do
  case "$1" in
    -o|-g) shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
/usr/bin/install "\${args[@]}"
`, { mode: 0o755 });
  await writeFile(chown, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "\${MUSTER_TEST_CHOWN_LOG:?}"
`, { mode: 0o755 });
  return { bin, chownLog: join(bin, "chown.log") };
}

async function runBootstrap(args, root, fake) {
  return execFileAsync("bash", ["deploy/bootstrap-droplet.sh", ...args], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      PATH: `${fake.bin}:${process.env.PATH}`,
      MUSTER_TEST_CHOWN_LOG: fake.chownLog,
      BOOTSTRAP_ROOT: root,
      BOOTSTRAP_OS_NAME: "Linux",
      BOOTSTRAP_OS_ID: "test",
      BOOTSTRAP_MEM_TOTAL_KIB: "4194304",
      BOOTSTRAP_MEM_AVAILABLE_KIB: "1048576",
      BOOTSTRAP_CPU_COUNT: "2",
      BOOTSTRAP_DISK_AVAILABLE_KIB: "8388608",
    },
  });
}

describe("bootstrap-droplet", () => {
  it("passa na sintaxe bash", async () => {
    await expect(execFileAsync("bash", ["-n", "deploy/bootstrap-droplet.sh"], { cwd: repositoryRoot })).resolves.toBeDefined();
  });

  it("imprime o plano no dry-run sem criar caminhos", async () => {
    const parent = await makeTemporaryPath("muster-mus163-root-");
    const root = join(parent, "opt", "muster");
    const fake = await fakeCommands();
    const user = process.env.USER ?? "nobody";

    const { stdout } = await runBootstrap(["--deploy-user", user, "--veltrix-health-url", "http://veltrix.test/healthz"], root, fake);

    expect(stdout).toContain("DRY-RUN");
    expect(stdout).toContain(`install -d -m 750 -o ${user} -g ${user}`);
    expect(stdout).toContain(`chown ${user}:${user}`);
    expect(stdout).toContain(`usermod -aG docker ${user}`);
    expect(stdout).toContain("GATILHO DE CAPACIDADE: atingido");
    await expect(stat(root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("cria template 600 apenas no root configurado e preserva o existente", async () => {
    const parent = await makeTemporaryPath("muster-mus163-apply-");
    const root = join(parent, "opt", "muster");
    const fake = await fakeCommands();
    const user = process.env.USER ?? "nobody";

    await runBootstrap(["--apply", "--deploy-user", user], root, fake);
    const envFile = join(root, ".env.production");
    expect(await readFile(envFile, "utf8")).toMatch(/MUSTER_CREDENTIAL_ENCRYPTION_KEY=\nMUSTER_INVITE_ONLY=true\nLOG_LEVEL=\n/);
    expect((await stat(envFile)).mode & 0o777).toBe(0o600);
    expect((await stat(envFile)).uid).toBe(process.getuid?.());
    for (const path of [root, join(root, "backups"), join(root, "scripts")]) {
      expect((await stat(path)).mode & 0o777).toBe(0o750);
      expect((await stat(path)).uid).toBe(process.getuid?.());
    }
    const chownPlan = await readFile(fake.chownLog, "utf8");
    expect(chownPlan).toContain(`${user}:${user} ${root} ${join(root, "backups")} ${join(root, "scripts")}`);
    expect(chownPlan).toContain(`${user}:${user} ${envFile}`);

    await writeFile(envFile, "POSTGRES_PASSWORD=preservado\n");
    await chmod(envFile, 0o600);
    await runBootstrap(["--apply", "--deploy-user", user], root, fake);
    expect(await readFile(envFile, "utf8")).toBe("POSTGRES_PASSWORD=preservado\n");
  });

  it("não aciona o gatilho quando a RAM simulada está saudável", async () => {
    const parent = await makeTemporaryPath("muster-mus163-capacity-");
    const root = join(parent, "opt", "muster");
    const fake = await fakeCommands();
    const { stdout } = await execFileAsync("bash", ["deploy/bootstrap-droplet.sh", "--deploy-user", process.env.USER ?? "nobody"], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PATH: `${fake.bin}:${process.env.PATH}`,
        MUSTER_TEST_CHOWN_LOG: fake.chownLog,
        BOOTSTRAP_ROOT: root,
        BOOTSTRAP_OS_NAME: "Linux",
        BOOTSTRAP_OS_ID: "test",
        BOOTSTRAP_MEM_TOTAL_KIB: "8388608",
        BOOTSTRAP_MEM_AVAILABLE_KIB: "4194304",
        BOOTSTRAP_CPU_COUNT: "2",
        BOOTSTRAP_DISK_AVAILABLE_KIB: "8388608",
      },
    });
    expect(stdout).toContain("Gatilho de capacidade: não atingido.");
  });
});
