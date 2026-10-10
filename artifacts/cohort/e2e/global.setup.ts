import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup, type Page } from "@playwright/test";
import {
  E2E_AUTH_FILE,
  E2E_FIXTURE_FILE,
  loadE2EFixture,
  type E2EAgentFixture,
  type E2EAgentKey,
  type E2EFixture,
} from "./fixtures";
import {
  applyClerkTestingEnvironment,
  clerkE2EEnvironment,
  scopedTestEmail,
} from "./runtime";

setup.describe.configure({ mode: "serial", timeout: 120_000 });

const environment = clerkE2EEnvironment();
const runId = ([process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT]
  .filter(Boolean)
  .join("") || randomUUID())
  .replace(/[^a-zA-Z0-9]/g, "")
  .slice(-16);
const userEmail = scopedTestEmail(environment.userEmail, runId);
const primaryOrganizationName = `${environment.organizationName} ${runId}`;
const isolatedOrganizationName = `${environment.organizationName} isolado ${runId}`;

const agentSeeds: Array<{
  key: E2EAgentKey;
  name: string;
  role: string;
  purpose: string;
}> = [
  { key: "sofia", name: "Sofia", role: "Suporte N1", purpose: "Resolver solicitações elegíveis com qualidade e escalonamento seguro." },
  { key: "vega", name: "Vega", role: "KYC documental", purpose: "Validar documentação e preservar evidência de cada decisão." },
  { key: "approve", name: "Gauntlet Aprovação", role: "Revisão de código", purpose: "Reduzir regressões sem ultrapassar a autoridade do tech lead." },
  { key: "adjust", name: "Gauntlet Ajuste", role: "Qualificação comercial", purpose: "Qualificar oportunidades dentro do ICP e justificar cada descarte." },
  { key: "reject", name: "Gauntlet Rejeição", role: "Operação financeira", purpose: "Conciliar transações sem executar movimentações irreversíveis." },
];

function writeFixture(fixture: E2EFixture): void {
  mkdirSync(new URL("../playwright/.clerk/", import.meta.url), { recursive: true });
  writeFileSync(E2E_FIXTURE_FILE, JSON.stringify(fixture, null, 2));
}

async function getClerkToken(page: Page): Promise<string> {
  const token = await page.evaluate(async () => {
    const clerkWindow = window as Window & {
      Clerk?: { session?: { getToken(options?: { skipCache?: boolean }): Promise<string | null> } };
    };
    return clerkWindow.Clerk?.session?.getToken({ skipCache: true }) ?? null;
  });
  if (!token) throw new Error("Clerk não emitiu token para o cenário E2E.");
  return token;
}

async function getSessionId(page: Page): Promise<string> {
  const sessionId = await page.evaluate(() => {
    const clerkWindow = window as Window & { Clerk?: { session?: { id?: string } } };
    return clerkWindow.Clerk?.session?.id ?? null;
  });
  if (!sessionId) throw new Error("Clerk não expôs a sessão E2E para a verificação de expiração.");
  return sessionId;
}

async function apiRequest<T>(
  page: Page,
  token: string,
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; data?: unknown; expectedStatus?: number } = {},
): Promise<T> {
  const response = await page.request.fetch(new URL(path, page.url()).toString(), {
    method: options.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, ...(options.data ? { "content-type": "application/json" } : {}) },
    data: options.data,
  });
  if (options.expectedStatus !== undefined) {
    expect(response.status()).toBe(options.expectedStatus);
    return undefined as T;
  }
  if (!response.ok()) throw new Error(`${options.method ?? "GET"} ${path} falhou (${response.status()}).`);
  if (response.status() === 204) return undefined as T;
  return (await response.json()) as T;
}

async function setActiveOrganization(page: Page, organizationId: string): Promise<void> {
  await page.evaluate(async (id) => {
    const clerkWindow = window as Window & { Clerk?: { setActive(options: { organization: string }): Promise<void> } };
    if (!clerkWindow.Clerk) throw new Error("Clerk não carregou no browser E2E.");
    await clerkWindow.Clerk.setActive({ organization: id });
  }, organizationId);
  await page.waitForFunction(
    (id) => (window as Window & { Clerk?: { organization?: { id?: string } } }).Clerk?.organization?.id === id,
    organizationId,
  );
}

async function signInAtOrganization(page: Page, organizationId: string): Promise<string> {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: userEmail });
  await setActiveOrganization(page, organizationId);
  return getClerkToken(page);
}

async function createAreas(page: Page, token: string) {
  const areas = [] as Array<{ id: string; name: string }>;
  for (const name of ["Atendimento E2E", "Governança E2E"]) {
    const area = await apiRequest<{ id: string; name: string }>(page, token, "/api/areas", {
      method: "POST",
      data: { name, description: `Área descartável ${runId}`, leader: "Muster E2E", costCenter: "E2E" },
    });
    areas.push({ id: area.id, name: area.name });
  }
  return areas;
}

async function seedAgents(page: Page, token: string, areaId: string) {
  const agents = {} as Record<E2EAgentKey, E2EAgentFixture>;
  for (const seed of agentSeeds) {
    const created = await apiRequest<{ agent: E2EAgentFixture }>(page, token, "/api/agents", {
      method: "POST",
      data: {
        externalId: `muster-e2e-${runId}-${seed.key}`,
        name: seed.name,
        role: seed.role,
        platform: "openai-assistants",
        version: "e2e",
        areaId,
        bio: seed.purpose,
        tagline: seed.purpose,
        shouldDo: ["Executar o escopo contratado", "Registrar evidência"],
        shouldNotDo: ["Executar ação irreversível sem aprovação"],
        autonomyLevel: "escalates",
        limits: ["Escalar baixa confiança ao responsável humano"],
        businessOwner: "Muster E2E",
        technicalOwner: "Muster Platform",
        governanceSponsor: "Muster QA",
        baseline: "Ciclo inicial sem evidência observada",
        businessCaseDescription: seed.purpose,
        proposedMetrics: [{ layer: "efficacy", label: "Cumprimento do propósito", unit: "%", target: "≥ 90%", rationale: "Compara resultado observado com o contrato de admissão." }],
      },
    });
    if (!created.agent?.id || !created.agent.slug || !created.agent.name) {
      throw new Error(`POST /api/agents não retornou a identidade esperada para ${seed.name}.`);
    }
    agents[seed.key] = created.agent;
  }
  return agents;
}

async function createIsolatedAgent(page: Page, token: string): Promise<E2EAgentFixture> {
  const created = await apiRequest<{ agent: E2EAgentFixture }>(page, token, "/api/agents", {
    method: "POST",
    data: {
      externalId: `muster-e2e-${runId}-isolated`, name: "Isolado E2E", role: "Isolamento", platform: "openai-assistants", version: "e2e",
      bio: "Recurso exclusivo do tenant negativo.", tagline: "Não pode vazar de tenant.", shouldDo: ["Isolar dados"], shouldNotDo: ["Vazar dados"], autonomyLevel: "restricted", limits: ["Somente teste"], businessOwner: "Muster E2E", technicalOwner: "Muster QA", governanceSponsor: "Muster QA", baseline: "Sem evidência", businessCaseDescription: "Valida isolamento.", proposedMetrics: [],
    },
  });
  return created.agent;
}

setup.beforeAll(async () => {
  applyClerkTestingEnvironment(environment);
  await clerkSetup({ dotenv: false, publishableKey: environment.publishableKey, secretKey: environment.secretKey });
});

setup("cria usuário, tenants e áreas descartáveis", async ({ page }) => {
  const client = createClerkClient({ secretKey: environment.secretKey });
  const user = await client.users.createUser({
    emailAddress: [userEmail], firstName: "Muster", lastName: "E2E", skipLegalChecks: true,
    privateMetadata: { musterE2E: true, runId },
  });
  const primary = await client.organizations.createOrganization({
    name: primaryOrganizationName, createdBy: user.id, privateMetadata: { musterE2E: true, runId },
  });
  const isolated = await client.organizations.createOrganization({
    name: isolatedOrganizationName, createdBy: user.id, privateMetadata: { musterE2E: true, runId },
  });

  const fixture: E2EFixture = {
    runId, user: { id: user.id, email: userEmail }, organizations: [
      { id: primary.id, name: primary.name }, { id: isolated.id, name: isolated.name },
    ], agents: {} as Record<E2EAgentKey, E2EAgentFixture>, areas: [],
    isolatedAgent: {} as E2EAgentFixture,
  };
  // Registra IDs antes de tocar no Muster: o teardown remove Clerk mesmo se a
  // inicialização local falhar no meio do caminho.
  writeFixture(fixture);

  const primaryToken = await signInAtOrganization(page, primary.id);
  await apiRequest(page, primaryToken, "/api/organizations/active/sync", { method: "POST" });
  fixture.areas = await createAreas(page, primaryToken);
  fixture.agents = await seedAgents(page, primaryToken, fixture.areas[0]!.id);

  await setActiveOrganization(page, isolated.id);
  const isolatedToken = await getClerkToken(page);
  await apiRequest(page, isolatedToken, "/api/organizations/active/sync", { method: "POST" });
  const isolatedAgent = await createIsolatedAgent(page, isolatedToken);
  await setActiveOrganization(page, primary.id);
  await page.evaluate(
    ({ userId, organizationId }) => {
      const scope = [userId, organizationId].map(encodeURIComponent).join(":");
      window.localStorage.setItem(`cohort:onboarding:${scope}`, "done");
      window.localStorage.setItem("muster:lang", "pt");
    },
    { userId: user.id, organizationId: primary.id },
  );
  fixture.isolatedAgent = isolatedAgent;
  writeFixture(fixture);

  await page.context().storageState({ path: E2E_AUTH_FILE });
  await page.goto("/comando");
  await expect(page.locator("[data-workforce-shell='true']")).toBeVisible();

});

setup("nega acesso entre tenants para um agente real", async ({ page }) => {
  const fixture = loadE2EFixture();
  const token = await signInAtOrganization(page, fixture.organizations[0]!.id);
  // Sessão válida do tenant primário, ID real do tenant isolado: prova que a
  // barreira de tenant não é uma rota inexistente.
  await apiRequest(page, token, `/api/agents/${fixture.isolatedAgent.id}`, { expectedStatus: 404 });
});

setup("rejeita token de sessão Clerk revogada", async ({ browser }) => {
  const fixture = loadE2EFixture();
  const context = await browser.newContext();
  const page = await context.newPage();
  const client = createClerkClient({ secretKey: environment.secretKey });
  try {
    const token = await signInAtOrganization(page, fixture.organizations[0]!.id);
    const sessionId = await getSessionId(page);
    await client.sessions.revokeSession(sessionId);
    await apiRequest(page, token, "/api/agents", { expectedStatus: 401 });
  } finally {
    await context.close();
  }
});
