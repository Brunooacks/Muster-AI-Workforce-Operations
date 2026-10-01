import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup, type Page } from "@playwright/test";
import {
  E2E_AUTH_FILE,
  E2E_FIXTURE_FILE,
  type E2EAgentFixture,
  type E2EAgentKey,
  type E2EFixture,
} from "./fixtures";

setup.describe.configure({ mode: "serial", timeout: 120_000 });

const userEmail =
  process.env.E2E_CLERK_USER_EMAIL?.trim() ||
  "muster.gauntlet+clerk_test@example.com";
const organizationName =
  process.env.E2E_CLERK_ORG_NAME?.trim() || "Muster Gauntlet E2E";

const agentSeeds: Array<{
  key: E2EAgentKey;
  name: string;
  role: string;
  purpose: string;
}> = [
  {
    key: "sofia",
    name: "Sofia",
    role: "Suporte N1",
    purpose: "Resolver solicitações elegíveis com qualidade e escalonamento seguro.",
  },
  {
    key: "vega",
    name: "Vega",
    role: "KYC documental",
    purpose: "Validar documentação e preservar evidência de cada decisão.",
  },
  {
    key: "approve",
    name: "Gauntlet Aprovação",
    role: "Revisão de código",
    purpose: "Reduzir regressões sem ultrapassar a autoridade do tech lead.",
  },
  {
    key: "adjust",
    name: "Gauntlet Ajuste",
    role: "Qualificação comercial",
    purpose: "Qualificar oportunidades dentro do ICP e justificar cada descarte.",
  },
  {
    key: "reject",
    name: "Gauntlet Rejeição",
    role: "Operação financeira",
    purpose: "Conciliar transações sem executar movimentações irreversíveis.",
  },
];

async function ensureClerkScenario() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY é obrigatório para o E2E autenticado. O teste não será ignorado.",
    );
  }

  const client = createClerkClient({ secretKey });
  const users = await client.users.getUserList({
    emailAddress: [userEmail],
    limit: 1,
  });
  const user =
    users.data[0] ??
    (await client.users.createUser({
      externalId: "muster-gauntlet-e2e",
      emailAddress: [userEmail],
      firstName: "Muster",
      lastName: "Gauntlet",
      password: `Muster-Gauntlet-${randomUUID()}!`,
      skipPasswordChecks: true,
      skipLegalChecks: true,
    }));

  const organizations = await client.organizations.getOrganizationList({
    query: organizationName,
    limit: 100,
  });
  const organization =
    organizations.data.find((candidate) => candidate.name === organizationName) ??
    (await client.organizations.createOrganization({
      name: organizationName,
      createdBy: user.id,
    }));

  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: organization.id,
    userId: [user.id],
    limit: 1,
  });
  if (memberships.data.length === 0) {
    await client.organizations.createOrganizationMembership({
      organizationId: organization.id,
      userId: user.id,
      role: "org:admin",
    });
  } else if (memberships.data[0]?.role !== "org:admin") {
    await client.organizations.updateOrganizationMembership({
      organizationId: organization.id,
      userId: user.id,
      role: "org:admin",
    });
  }

  return { user, organization };
}

async function getClerkToken(page: Page): Promise<string> {
  const token = await page.evaluate(async () => {
    const clerkWindow = window as Window & {
      Clerk?: {
        session?: {
          getToken(options?: { skipCache?: boolean }): Promise<string | null>;
        };
      };
    };
    return clerkWindow.Clerk?.session?.getToken({ skipCache: true }) ?? null;
  });
  if (!token) throw new Error("Clerk não emitiu token para o cenário E2E.");
  return token;
}

async function apiRequest<T>(
  page: Page,
  token: string,
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; data?: unknown } = {},
): Promise<T> {
  const response = await page.request.fetch(new URL(path, page.url()).toString(), {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.data ? { "content-type": "application/json" } : {}),
    },
    data: options.data,
  });
  if (!response.ok()) {
    throw new Error(
      `${options.method ?? "GET"} ${path} falhou (${response.status()}): ${await response.text()}`,
    );
  }
  if (response.status() === 204) return undefined as T;
  return (await response.json()) as T;
}

async function seedAgents(page: Page, token: string) {
  const existing = await apiRequest<Array<{ id: string }>>(page, token, "/api/agents");
  for (const agent of existing) {
    await apiRequest(page, token, `/api/agents/${agent.id}`, { method: "DELETE" });
  }

  const agents = {} as Record<E2EAgentKey, E2EAgentFixture>;
  for (const seed of agentSeeds) {
    const created = await apiRequest<{ agent: E2EAgentFixture }>(page, token, "/api/agents", {
      method: "POST",
      data: {
        externalId: `muster-gauntlet-${seed.key}`,
        name: seed.name,
        role: seed.role,
        platform: "openai-assistants",
        version: "e2e",
        bio: seed.purpose,
        tagline: seed.purpose,
        shouldDo: ["Executar o escopo contratado", "Registrar evidência"],
        shouldNotDo: ["Executar ação irreversível sem aprovação"],
        autonomyLevel: "escalates",
        limits: ["Escalar baixa confiança ao responsável humano"],
        businessOwner: "Muster Gauntlet",
        technicalOwner: "Muster Platform",
        governanceSponsor: "Muster QA",
        baseline: "Ciclo inicial sem evidência observada",
        businessCaseDescription: seed.purpose,
        proposedMetrics: [
          {
            layer: "efficacy",
            label: "Cumprimento do propósito",
            unit: "%",
            target: "≥ 90%",
            rationale: "Compara resultado observado com o contrato de admissão.",
          },
          {
            layer: "governance",
            label: "Cobertura de evidência",
            unit: "%",
            target: "≥ 95%",
            rationale: "Toda decisão deve preservar fonte e justificativa.",
          },
        ],
      },
    });
    if (!created.agent?.id || !created.agent.slug || !created.agent.name) {
      throw new Error(`POST /api/agents não retornou a identidade esperada para ${seed.name}.`);
    }
    agents[seed.key] = created.agent;
  }
  return agents;
}

async function resetCustomCatalogMetrics(page: Page, token: string) {
  const verticals = await apiRequest<Array<{
    metrics: Array<{ key: string; isCustom: boolean }>;
  }>>(page, token, "/api/catalog/metrics");
  for (const metric of verticals.flatMap((vertical) => vertical.metrics)) {
    if (metric.isCustom) {
      await apiRequest(page, token, `/api/catalog/metrics/${encodeURIComponent(metric.key)}`, {
        method: "DELETE",
      });
    }
  }
}

setup("cria sessão Clerk, tenant e dados determinísticos", async ({ page }) => {
  await clerkSetup({ dotenv: false });
  const { user, organization } = await ensureClerkScenario();

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: userEmail });
  await page.evaluate(async (organizationId) => {
    const clerkWindow = window as Window & {
      Clerk?: {
        setActive(options: { organization: string }): Promise<void>;
      };
    };
    if (!clerkWindow.Clerk) throw new Error("Clerk não carregou no browser E2E.");
    await clerkWindow.Clerk.setActive({ organization: organizationId });
  }, organization.id);
  await page.waitForFunction(
    (organizationId) =>
      (window as Window & { Clerk?: { organization?: { id?: string } } }).Clerk
        ?.organization?.id === organizationId,
    organization.id,
  );

  await page.evaluate(
    ({ userId, organizationId }) => {
      const scope = [userId, organizationId]
        .map((value) => encodeURIComponent(value))
        .join(":");
      window.localStorage.setItem(`cohort:onboarding:${scope}`, "done");
      window.localStorage.setItem("muster:lang", "pt");
    },
    { userId: user.id, organizationId: organization.id },
  );

  const token = await getClerkToken(page);
  await apiRequest(page, token, "/api/organizations/active/sync", {
    method: "POST",
  });
  await resetCustomCatalogMetrics(page, token);
  const agents = await seedAgents(page, token);

  await page.goto("/comando");
  await expect(page.locator("[data-workforce-shell='true']")).toBeVisible();

  const fixture: E2EFixture = {
    userId: user.id,
    organizationId: organization.id,
    agents,
  };
  mkdirSync(new URL("../playwright/.clerk/", import.meta.url), {
    recursive: true,
  });
  writeFileSync(E2E_FIXTURE_FILE, JSON.stringify(fixture, null, 2));
  await page.context().storageState({ path: E2E_AUTH_FILE });
});
