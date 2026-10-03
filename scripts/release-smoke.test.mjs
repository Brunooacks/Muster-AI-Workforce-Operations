import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "release-smoke.sh",
);
const pages = new Set([
  "/",
  "/sign-in",
  "/comando",
  "/metricas",
  "/equipes",
  "/jornadas",
  "/benchmarks",
  "/governanca",
  "/conectores",
  "/relatorios",
]);
const servers = [];
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise((resolve) => server.close(resolve))),
  );
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function routeHandler({
  sha = "release-sha",
  protectedStatus = 401,
  sseStatus = 401,
  hsts,
} = {}) {
  return (request, response) => {
    if (request.url === "/api/healthz") {
      response.writeHead(200, {
        "content-type": "application/json",
        ...(hsts ? { "strict-transport-security": hsts } : {}),
      });
      response.end(JSON.stringify({ status: "ok", sha }));
      return;
    }
    if (request.url === "/api/healthz/worker") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ worker: { running: true } }));
      return;
    }
    if (request.url === "/api/organizations") {
      response.writeHead(protectedStatus, {
        "content-type": "application/json",
      });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (request.url === "/api/telemetry/activity/stream") {
      response.writeHead(sseStatus, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (request.url === "/api/not-a-route") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    if (pages.has(request.url)) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<title>Muster</title>");
      return;
    }
    response.writeHead(404).end();
  };
}

async function listen(server, protocol = "http") {
  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `${protocol}://127.0.0.1:${address.port}`;
}

async function fakeMuster(options) {
  return listen(createServer(routeHandler(options)));
}

async function runSmoke(baseUrl, environment = {}) {
  try {
    const result = await execFileAsync("bash", [scriptPath, "--", baseUrl], {
      env: { ...process.env, ...environment },
      timeout: 15_000,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: error.code ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

describe("release smoke", () => {
  it("preserva o modo padrão", async () => {
    const result = await runSmoke(await fakeMuster());

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Release smoke aprovado");
    expect(result.stdout).not.toContain("/api/organizations");
    expect(result.stdout).not.toContain("/api/telemetry/activity/stream");
  });

  it("valida o SHA esperado quando configurado", async () => {
    const result = await runSmoke(await fakeMuster(), {
      MUSTER_EXPECTED_SHA: "release-sha",
    });

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("PASS /api/healthz sha=release-sha");
  });

  it("falha quando o SHA esperado não corresponde", async () => {
    const result = await runSmoke(await fakeMuster(), {
      MUSTER_EXPECTED_SHA: "outro-sha",
    });

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("expected sha=outro-sha");
  });

  it("confirma 401 sem sessão em uma rota protegida", async () => {
    const result = await runSmoke(await fakeMuster(), {
      MUSTER_CHECK_AUTH: "true",
    });

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("PASS /api/organizations status=401");
  });

  it("falha se uma rota protegida aceitar acesso sem sessão", async () => {
    const result = await runSmoke(await fakeMuster({ protectedStatus: 200 }), {
      MUSTER_CHECK_AUTH: "true",
    });

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain(
      "/api/organizations expected=401 actual=200",
    );
  });

  it("confirma 401 rápido na rota SSE sem sessão", async () => {
    const result = await runSmoke(await fakeMuster(), {
      MUSTER_CHECK_SSE: "true",
    });

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain(
      "PASS /api/telemetry/activity/stream status=401 within=5s",
    );
  });

  it("falha se a rota SSE não exigir sessão", async () => {
    const result = await runSmoke(await fakeMuster({ sseStatus: 200 }), {
      MUSTER_CHECK_SSE: "true",
    });

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain(
      "/api/telemetry/activity/stream expected=401 actual=200",
    );
  });

  it("exige HTTPS quando a checagem TLS está habilitada", async () => {
    const result = await runSmoke(await fakeMuster(), {
      MUSTER_REQUIRE_TLS: "true",
    });

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("exige URL https://");
  });

  it("aceita certificado TLS confiável e registra HSTS", async () => {
    const certificateDirectory = await mkdtemp(
      join(tmpdir(), "muster-release-smoke-"),
    );
    temporaryDirectories.push(certificateDirectory);
    const keyPath = join(certificateDirectory, "key.pem");
    const certificatePath = join(certificateDirectory, "certificate.pem");
    await execFileAsync("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certificatePath,
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
      "-days",
      "1",
    ]);
    const server = createHttpsServer(
      { key: await readFile(keyPath), cert: await readFile(certificatePath) },
      routeHandler({ hsts: "max-age=31536000; includeSubDomains" }),
    );
    const baseUrl = await listen(server, "https");
    const result = await runSmoke(baseUrl, {
      MUSTER_REQUIRE_TLS: "true",
      CURL_CA_BUNDLE: certificatePath,
    });

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("PASS TLS certificate validated");
    expect(result.stdout).toContain(
      "INFO strict-transport-security: max-age=31536000; includeSubDomains",
    );
  });
});
