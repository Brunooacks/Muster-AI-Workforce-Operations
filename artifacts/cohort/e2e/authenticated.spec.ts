import { expect, test, type Page } from "@playwright/test";
import {
  WORKFORCE_NAV_ITEMS,
  WORKFORCE_SPECIALIZED_ROUTES,
  isKnownAppPath,
  navigationScreenForWorkforceScreen,
} from "../src/lib/workforce-routing";
import { loadE2EFixture, type E2EAgentKey } from "./fixtures";

async function expectInputValue(page: Page, value: string) {
  await expect.poll(() =>
    page.getByTestId("admission-metric-contract").locator("input").evaluateAll(
      (inputs, expected) =>
        inputs.some((input) => (input as HTMLInputElement).value === expected),
      value,
    ),
  ).toBe(true);
}

test.describe("smoke autenticado", () => {
  test.describe.configure({ timeout: 60_000 });
  for (const item of WORKFORCE_NAV_ITEMS) {
    test(`${item.path} preserva o shell Workforce OS`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto(item.path);
      if (new URL(page.url()).pathname === "/onboarding") {
        await page
          .getByRole("button", {
            name: /pular configuração|skip setup|omitir configuración/i,
          })
          .click();
        await page.goto(item.path);
      }
      await expect(page).toHaveURL(new RegExp(`${item.path.replaceAll("/", "\\/")}$`));
      await expect(page.locator("[data-workforce-shell='true']")).toBeVisible();
      await expect(page.locator("[data-workforce-shell='true']")).toHaveAttribute("data-workforce-screen", item.screen);
      await expect(page.getByTestId("muster-brand-mark")).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }

  for (const item of WORKFORCE_SPECIALIZED_ROUTES.filter((candidate) => candidate.screen !== "onboarding")) {
    test(`${item.path} preserva funções especializadas no shell novo`, async ({ page }) => {
      await page.goto(item.path);
      if (new URL(page.url()).pathname === "/onboarding") {
        await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
        await page.goto(item.path);
      }

      await expect(page).toHaveURL(new RegExp(`${item.path.replaceAll("/", "\\/")}$`));
      await expect(page.locator("[data-workforce-shell='true']")).toHaveAttribute("data-workforce-screen", item.screen);
      await expect(page.locator("[data-workforce-embedded-page='true']")).toBeVisible();
      await expect(page.locator(".workspace-shell")).toHaveCount(0);
      await expect(page.getByRole("link", {
        name: WORKFORCE_NAV_ITEMS.find((candidate) => candidate.screen === navigationScreenForWorkforceScreen(item.screen))?.label,
        exact: true,
      })).toHaveAttribute("aria-current", "page");
    });
  }

  test("central de adoção usa rotas próprias, guias visuais e não ocupa o menu operacional", async ({ page }) => {
    await page.goto("/guia");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
      await page.goto("/guia");
    }

    await expect(page.locator("[data-workforce-shell='true']")).toHaveAttribute("data-workforce-screen", "onboarding");
    await expect(page.locator("nav").getByText("Guia inicial", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("adoption-onboarding-link")).toBeVisible();
    await expect(page.getByTestId("adoption-updates-link")).toBeVisible();

    await expect(page.getByRole("img", { name: "Guia visual: Construir o contrato profissional" })).toBeVisible();
    await expect(page.getByAltText("Tela de referência para Construir o contrato profissional")).toHaveAttribute("src", "/onboarding/build.png");
    await expect(page.getByRole("button", { name: "Marcar como concluído" })).toBeVisible();

    await page.getByRole("tab", { name: "Novidades do Muster", exact: true }).click();
    await expect(page).toHaveURL(/\/guia\/novidades$/);
    await expect(page.getByText("Central de adoção separada da operação", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Radar de agentes", exact: true }).click();
    await expect(page).toHaveURL(/\/guia\/radar$/);
    await expect(page.getByText("Não é um feed em tempo real.", { exact: false })).toBeVisible();
    await expect(page.locator('a[target="_blank"]')).toHaveCount(3);
  });

  test("conexão de telemetria preserva agente e shell novo", async ({ page }) => {
    await page.goto("/agentes/sofia/conectar");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
      await page.goto("/agentes/sofia/conectar");
    }

    await expect(page).toHaveURL(/\/agentes\/sofia\/conectar$/);
    await expect(page.locator("[data-workforce-shell='true']")).toHaveAttribute("data-workforce-screen", "connection");
    await expect(page.locator("[data-workforce-embedded-page='true']")).toBeVisible();
    await expect(page.locator(".workspace-shell")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Conectores", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("navegação completa nunca retorna ao layout legado", async ({ page }) => {
    await page.goto("/comando");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
      await page.goto("/comando");
    }

    for (const item of WORKFORCE_NAV_ITEMS) {
      await page.getByRole("link", { name: item.label, exact: true }).click();
      if (item.screen === "professional") {
        await expect(page).toHaveURL(/\/agentes\/[^/]+$/);
      } else {
        await expect(page).toHaveURL(new RegExp(`${item.path.replaceAll("/", "\\/")}$`));
      }
      await expect(page.locator("[data-workforce-shell='true']")).toHaveAttribute("data-workforce-screen", item.screen);
      await expect(page.locator(".workspace-shell")).toHaveCount(0);
    }
  });

  test("alias de frota permanece no novo portfólio", async ({ page }) => {
    await page.goto("/frota");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
      await page.goto("/frota");
    }

    await expect(page).toHaveURL(/\/frota$/);
    await expect(page.locator("[data-workforce-shell='true']")).toHaveAttribute("data-workforce-screen", "portfolio");
    await expect(page.locator(".workspace-shell")).toHaveCount(0);
  });

  test("portfólio abre o profissional escolhido, não o anterior", async ({ page }) => {
    await page.goto("/agentes");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
      await page.goto("/agentes");
    }

    const vega = loadE2EFixture().agents.vega;
    await page.getByRole("button", { name: "Abrir prontuário de Vega" }).click();
    await expect(page).toHaveURL(new RegExp(`/agentes/${vega.id}$`));
    await expect(page.locator("[data-workforce-shell='true']")).toHaveAttribute("data-workforce-screen", "professional");
    await expect(page.getByRole("heading", { name: /Vega/ }).first()).toBeVisible();
  });

  test("Workforce OS expõe saída para a página inicial", async ({ page }) => {
    await page.goto("/equipes");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page
        .getByRole("button", {
          name: /pular configuração|skip setup|omitir configuración/i,
        })
        .click();
      await page.goto("/equipes");
    }

    await expect(
      page.getByRole("button", { name: "Sair e voltar para a página inicial" }),
    ).toBeVisible();
  });

  test("links internos renderizados pertencem ao catálogo de rotas", async ({ page }) => {
    await page.goto("/comando");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
      await page.goto("/comando");
    }

    const hrefs = await page.locator("[data-workforce-shell='true'] a[href^='/']").evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href)))],
    );
    for (const href of hrefs) expect(isKnownAppPath(href), href).toBe(true);
  });

  test("superfícies gerenciais usam dados reais e expõem ações persistentes", async ({ page }) => {
    await page.goto("/comando");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
      await page.goto("/comando");
    }

    await expect(page.locator("[data-workforce-embedded-page='true']")).toHaveAttribute("data-operational-source", "api");
    await expect(page.getByRole("heading", { name: "Resultado, custo e responsabilidade na mesma leitura." })).toBeVisible();

    await page.goto("/metricas");
    await expect(page.locator("[data-operational-source='api']")).toBeVisible();
    await page.getByRole("button", { name: /Nova métrica|New metric|Nueva métrica/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goto("/jornadas");
    await page.getByRole("button", { name: "Nova jornada" }).click();
    await expect(page.getByText("Nova jornada operacional", { exact: true })).toBeVisible();

    await page.goto("/benchmarks");
    await expect(page.locator("[data-operational-source='api']")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Benchmarks da Frota|Fleet Benchmarks|Benchmarks de la Flota/ })).toBeVisible();

    await page.goto("/governanca");
    await expect(page.locator("[data-operational-source='api']")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Governança da Frota|Fleet Governance|Gobernanza de la Flota/ })).toBeVisible();
  });

  test("equipes e jornadas produtivas carregam dados persistidos da API", async ({ page }) => {
    await page.goto("/equipes");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: /pular configuração|skip setup|omitir configuración/i }).click();
      await page.goto("/equipes");
    }

    await expect(page.getByTestId("operational-teams-screen")).toHaveAttribute("data-operational-source", "api");
    await expect(page.getByText("Cenários sintéticos permanecem disponíveis apenas no laboratório de protótipos.", { exact: false })).toBeVisible();

    await page.goto("/jornadas");
    await expect(page.locator("[data-workforce-embedded-page='true']")).toHaveAttribute("data-operational-source", "api");
    await expect(page.getByRole("button", { name: "Nova jornada" })).toBeVisible();
  });

  const decisionCases: Array<{
    agentKey: E2EAgentKey;
    testId: string;
    confirm: string;
    expected: string;
    nextAction: string;
  }> = [
    {
      agentKey: "adjust",
      testId: "adjust-professional-plan",
      confirm: "Devolver para ajuste",
      expected: "Ajuste solicitado",
      nextAction: "Reformular o plano",
    },
    {
      agentKey: "reject",
      testId: "reject-professional-plan",
      confirm: "Rejeitar e bloquear execução",
      expected: "Plano rejeitado",
      nextAction: "Definir destino do profissional",
    },
    {
      agentKey: "approve",
      testId: "approve-professional-plan",
      confirm: "Aprovar e liberar ações",
      expected: "Plano aprovado",
      nextAction: "Executar o plano aprovado",
    },
  ];

  for (const item of decisionCases) {
    test(`prontuário executa ${item.expected.toLocaleLowerCase()} em fluxo isolado`, async ({ page }) => {
      const agent = loadE2EFixture().agents[item.agentKey];
      await page.goto(`/agentes/${agent.id}`);

      await page.getByTestId(item.testId).click();
      await expect(page.getByTestId("plan-decision-preview")).toBeVisible();
      await page.getByPlaceholder("Registre evidências, riscos e condição esperada para o próximo ciclo.").fill(`Gauntlet E2E: ${item.expected}.`);
      await page.getByRole("button", { name: item.confirm }).click();
      await expect(page.getByRole("status")).toContainText(item.expected);
      await expect(page.getByTestId("professional-plan-decision")).toBeVisible();
      await expect(page.getByTestId("professional-plan-next-action")).toContainText(item.nextAction);
      await expect(page.getByTestId("approve-professional-plan")).toBeDisabled();
      await expect(page.getByTestId("adjust-professional-plan")).toBeDisabled();
      await expect(page.getByTestId("reject-professional-plan")).toBeDisabled();

      if (item.agentKey === "approve") {
        await page.getByTestId("start-plan-action-2").click();
        await expect(page.getByTestId("professional-plan-next-action")).toContainText("Em execução");
        await page.getByRole("button", { name: "Concluir", exact: true }).click();
        await page.getByPlaceholder("Ex.: 40 casos válidos concluídos, acurácia de 93% e nenhum guardrail violado.").fill(
          "42 execuções válidas, 94% de cumprimento e nenhum guardrail violado.",
        );
        await page.getByRole("button", { name: "Confirmar e continuar" }).click();
        await expect(page.getByTestId("professional-plan-next-action")).toContainText("Validar evolução");
        await expect(page.getByTestId("start-plan-action-3")).toBeEnabled();
      }
    });
  }

  test("admissão herda e cria métrica pelo fluxo real", async ({ page }) => {
    await page.goto("/admissao");
    await page.getByRole("button", { name: /07 Probation/ }).click();

    await page.getByTestId("inherit-catalog-metric").click();
    const inheritedOption = page.getByRole("option").first();
    const inheritedLabel = (await inheritedOption.textContent())?.split(" · ")[1];
    await inheritedOption.click();
    await expect(page.getByTestId("admission-metric-contract")).toContainText(/Herdada do catálogo|Inherited from catalog|Heredada del catálogo/);
    if (inheritedLabel) {
      await expectInputValue(page, inheritedLabel);
    }

    await page.getByTestId("open-create-catalog-metric").click();
    const metricLabel = `Qualidade Gauntlet ${Date.now()}`;
    const createMetricForm = page.getByTestId("create-catalog-metric-form");
    await createMetricForm.getByPlaceholder("Rótulo").fill(metricLabel);
    await createMetricForm.getByPlaceholder("Unid.").fill("%");
    await createMetricForm.getByPlaceholder("Meta").fill("≥ 93%");
    await createMetricForm.getByPlaceholder("Como esta métrica orienta uma decisão?").fill(
      "Define se o agente pode ampliar autonomia sem perder qualidade.",
    );

    const createdResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/catalog/metrics",
    );
    await page.getByTestId("create-and-use-catalog-metric").click();
    const createdResponse = await createdResponsePromise;
    expect(createdResponse.status()).toBe(201);
    const created = (await createdResponse.json()) as { key: string };
    await expectInputValue(page, metricLabel);
    await expect(page.getByTestId("admission-metric-contract")).toContainText(/Herdada do catálogo|Inherited from catalog|Heredada del catálogo/);

    const deleted = await page.evaluate(async (metricKey) => {
      const clerkWindow = window as Window & {
        Clerk?: { session?: { getToken(): Promise<string | null> } };
      };
      const token = await clerkWindow.Clerk?.session?.getToken();
      const response = await fetch(`/api/catalog/metrics/${encodeURIComponent(metricKey)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      return response.status;
    }, created.key);
    expect(deleted).toBe(204);
  });
});
