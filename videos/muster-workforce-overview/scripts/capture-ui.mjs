import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../../../artifacts/cohort/node_modules/@playwright/test/index.mjs";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectDir, "assets", "ui-light");
const baseUrl = process.env.MUSTER_CAPTURE_URL ?? "http://127.0.0.1:5187";

const routes = [
  ["visao-gerencial.png", "/comando"],
  ["guia-inicial.png", "/guia"],
  ["relatorios-executivos.png", "/relatorios"],
  ["portfolio.png", "/agentes"],
  ["profissional.png", "/agentes/sofia"],
  ["metricas.png", "/metricas"],
  ["equipes-mistas.png", "/equipes"],
  ["jornadas-a2a.png", "/jornadas"],
  ["benchmarks.png", "/benchmarks"],
  ["conectores.png", "/conectores"],
  ["governanca.png", "/governanca"],
  ["admissao.png", "/admissao"],
  ["alertas.png", "/alertas"],
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

for (const [filename, route] of routes) {
  console.log(`Capturing ${route} -> ${filename}`);
  await page.goto(`${baseUrl}${route}?theme=mineral`, { waitUntil: "domcontentloaded" });
  try {
    await page.locator("[data-workforce-shell='true']").waitFor({ state: "visible", timeout: 10_000 });
  } catch (error) {
    console.error(`Capture shell missing at ${page.url()}: ${await page.locator("body").innerText()}`);
    throw error;
  }
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });
}

const connectorPage = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await connectorPage.goto(`${baseUrl}/conectores?theme=mineral`, { waitUntil: "domcontentloaded" });
await connectorPage.locator("[data-workforce-shell='true']").waitFor({ state: "visible" });
await connectorPage.getByRole("button", { name: "Ver integração" }).first().waitFor({ state: "visible" });
await connectorPage.getByRole("button", { name: "Ver integração" }).first().click({ force: true });
await connectorPage.getByRole("heading", { name: "Zendesk Support" }).waitFor({ state: "visible" });
await connectorPage.screenshot({ path: path.join(outputDir, "conector-ativacao.png"), fullPage: false });
await connectorPage.close();

const alertPage = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await alertPage.goto(`${baseUrl}/alertas?theme=mineral`, { waitUntil: "domcontentloaded" });
await alertPage.locator("[data-workforce-shell='true']").waitFor({ state: "visible" });
const resolveAlert = alertPage.getByRole("button", { name: "Resolver" }).first();
await resolveAlert.scrollIntoViewIfNeeded();
await alertPage.waitForTimeout(250);
await alertPage.screenshot({ path: path.join(outputDir, "alerta-acoes.png"), fullPage: false });
await alertPage.close();

const decisionPage = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await decisionPage.goto(`${baseUrl}/agentes/sofia?theme=mineral`, { waitUntil: "domcontentloaded" });
await decisionPage.locator("[data-workforce-shell='true']").waitFor({ state: "visible" });
await decisionPage.waitForTimeout(900);
await decisionPage.getByTestId("approve-professional-plan").scrollIntoViewIfNeeded();
await decisionPage.screenshot({ path: path.join(outputDir, "decisao-acoes.png"), fullPage: false });
await decisionPage.getByTestId("approve-professional-plan").click({ force: true });
await decisionPage.getByRole("heading", { name: /Aprovar plano/ }).waitFor({ state: "visible" });
await decisionPage.screenshot({ path: path.join(outputDir, "decisao-aprovacao.png"), fullPage: false });
await decisionPage.close();

await browser.close();
console.log(`Captured ${routes.length + 4} Muster states in ${outputDir}`);
