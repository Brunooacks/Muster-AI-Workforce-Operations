import { expect, test } from "@playwright/test";
import {
  WORKFORCE_STATIC_PATHS,
  isKnownAppPath,
} from "../src/lib/workforce-routing";

test.describe.configure({ mode: "serial" });

test("landing permanece pública e oferece autenticação explícita", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("a[href*='sign-in']").first()).toBeVisible();
});

test("landing usa as novas paletas e não retorna ao verde-musgo", async ({ page }) => {
  await page.goto("/");

  const landing = page.locator("[data-landing-theme]");
  await expect(landing).toHaveAttribute("data-landing-theme", "graphite");
  await expect(page.locator("button[aria-label^='Usar paleta']")).toHaveCount(3);
  expect(await landing.evaluate((element) => getComputedStyle(element).getPropertyValue("--primary").trim())).toBe("211 100% 68%");

  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await page.getByRole("button", { name: "Usar paleta Dracula" }).click();
    await expect(landing).toHaveAttribute("data-landing-theme", "dracula");
    await page.reload();
    await expect(page.locator("[data-landing-theme]")).toHaveAttribute("data-landing-theme", "dracula");
  }
});

const protectedPaths = [
  ...WORKFORCE_STATIC_PATHS,
  "/agentes/sofia",
  "/agentes/sofia/conectar",
  "/prototipos",
  "/prototipos/workforce-os",
  "/onboarding",
];

for (const path of protectedPaths) {
  test(`${path} exige login e preserva o destino`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/sign-in\?/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("redirect_url")).toBe(path);
    await expect(page.locator("[data-workforce-shell='true']")).toHaveCount(0);
  });
}

test("todos os links internos da landing apontam para rotas registradas", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator("a[href^='/']").evaluateAll((links) =>
    [...new Set(links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href)))],
  );

  for (const href of hrefs) expect(isKnownAppPath(href), href).toBe(true);
});

test("âncoras da landing possuem seção correspondente", async ({ page }) => {
  await page.goto("/");
  const hashes = await page.locator("a[href^='#']").evaluateAll((links) =>
    [...new Set(links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href)))],
  );

  for (const hash of hashes) await expect(page.locator(hash), hash).toHaveCount(1);
});

test("rota inexistente oferece retorno funcional ao Muster", async ({ page }) => {
  await page.goto("/rota-inexistente");
  await expect(page.getByRole("heading", { name: "Este destino não faz parte da operação atual." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao Muster" })).toHaveAttribute("href", "/");
});

test("fluxo de entrada abre a autenticação real", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("modo de desenvolvimento");
});

test("login preserva identidade Muster e contraste dos campos", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.locator("header").getByText("Muster", { exact: true })).toBeVisible();
  const email = page.getByLabel("E-mail corporativo", { exact: true });
  const password = page.getByLabel("Senha", { exact: true });
  await email.fill("gestor@muster.local");
  await password.fill("Senha-de-validacao-123");

  await expect(email).toHaveValue("gestor@muster.local");
  await expect(password).toHaveValue("Senha-de-validacao-123");
  await expect(email).toHaveCSS("opacity", "1");
  await expect(password).toHaveCSS("opacity", "1");
  expect(await email.evaluate((field) => getComputedStyle(field).color)).not.toBe("rgba(0, 0, 0, 0)");
  expect(await password.evaluate((field) => getComputedStyle(field).color)).not.toBe("rgba(0, 0, 0, 0)");
});

test("cadastro orienta contas existentes para o login", async ({ page }) => {
  await page.goto("/sign-up?redirect_url=%2Fjornadas");

  const existingAccountLink = page.getByRole("link", {
    name: "Entre na conta existente",
  });
  await expect(existingAccountLink).toBeVisible();
  await existingAccountLink.click();

  await expect(page).toHaveURL(/\/sign-in\?/, { timeout: 15_000 });
  expect(new URL(page.url()).searchParams.get("redirect_url")).toBe("/jornadas");
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
});
