import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as ts from "typescript";

const productionPages = [
  "../pages/workforce-os-lab.tsx",
  "../pages/workforce-os-modules.tsx",
  "../pages/mixed-teams-workforce.tsx",
  "../pages/mixed-teams-operational.tsx",
  "../pages/journeys.tsx",
  "../pages/dashboard.tsx",
  "../pages/metricas.tsx",
  "../pages/benchmarks.tsx",
  "../pages/governanca.tsx",
  "../pages/connectors-workforce.tsx",
  "../pages/executive-reports-workforce.tsx",
  "../pages/admission.tsx",
  "../pages/alerts.tsx",
  "../pages/configuracoes.tsx",
  "../pages/perfil.tsx",
  "../pages/conectar.tsx",
];

test("botões nativos visíveis possuem contrato de interação", () => {
  const deadButtons: string[] = [];

  for (const relativePath of productionPages) {
    const filePath = fileURLToPath(new URL(relativePath, import.meta.url));
    const source = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(sourceFile) === "button") {
        const attributes = new Map(
          node.attributes.properties
            .filter(ts.isJsxAttribute)
            .map((attribute) => [attribute.name.getText(sourceFile), attribute.initializer?.getText(sourceFile) ?? ""]),
        );
        const isSubmit = attributes.get("type")?.includes("submit");
        if (!attributes.has("onClick") && !attributes.has("formAction") && !isSubmit) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          const label = node.parent.getText(sourceFile).replace(/<[^>]+>/g, " ").replace(/[{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
          deadButtons.push(`${relativePath}:${line} ${label}`);
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  assert.deepEqual(deadButtons, []);
});

test("componentes de botão não usam indisponibilidade permanente como placeholder", () => {
  const permanentlyDisabled: string[] = [];

  for (const relativePath of productionPages) {
    const filePath = fileURLToPath(new URL(relativePath, import.meta.url));
    const source = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && node.tagName.getText(sourceFile) === "Button"
      ) {
        const disabled = node.attributes.properties.find(
          (attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute)
            && attribute.name.getText(sourceFile) === "disabled",
        );
        if (disabled && !disabled.initializer) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          permanentlyDisabled.push(`${relativePath}:${line}`);
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  assert.deepEqual(permanentlyDisabled, []);
});

test("ações operacionais não terminam em feedback visual local", () => {
  const filePath = fileURLToPath(new URL("../pages/workforce-os-lab.tsx", import.meta.url));
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const operationalButtons: string[] = [];
  const localOnlyHandlers: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(sourceFile) === "button") {
      const attributes = new Map(
        node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((attribute) => [attribute.name.getText(sourceFile), attribute.initializer?.getText(sourceFile) ?? ""]),
      );
      const operation = attributes.get("data-operational-action");
      if (operation) {
        operationalButtons.push(operation);
        const handler = attributes.get("onClick") ?? "";
        if (/=>\s*set[A-Z]/.test(handler)) localOnlyHandlers.push(handler);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  assert.equal(operationalButtons.length, 4);
  assert.deepEqual(localOnlyHandlers, []);
  assert.match(source, /useReevaluateAgent/);
  assert.match(source, /reevaluate\.mutate/);
  assert.match(source, /useRecordProfessionalPlanDecision/);
  assert.match(source, /recordDecision\.mutate/);
});

test("central de conectores exige prova real e entrega configuração executável", () => {
  const filePath = fileURLToPath(new URL("../pages/connectors-workforce.tsx", import.meta.url));
  const admissionPath = fileURLToPath(new URL("../pages/admission.tsx", import.meta.url));
  const source = readFileSync(filePath, "utf8");
  const admission = readFileSync(admissionPath, "utf8");

  assert.match(source, /connector\.status === "connected"/);
  assert.match(source, /setupApiKey/);
  assert.match(source, /muster\.agent-ingestion\.v1/);
  assert.match(source, /externalId/);
  assert.match(source, /Authorization: Bearer \$\{apiKey\}/);
  assert.match(source, /Aguardando o primeiro evento real/);
  assert.match(source, /Revisar e admitir/);
  assert.match(source, /storeAdmissionHandoff/);
  assert.doesNotMatch(source, /useImportDiscoveredAgents/);
  assert.doesNotMatch(source, /status:\s*"connected"/);
  assert.match(admission, /connectorId: selectedConnector\?\.id/);
  assert.match(admission, /<SelectItem key=\{c\.id\} value=\{c\.id\}>/);
  assert.match(admission, /setLocation\(`\/conectores\?\$\{query\.toString\(\)\}`\)/);
});

test("admissão reutiliza o catálogo e cadastra novas métricas governadas", () => {
  const admissionPath = fileURLToPath(new URL("../pages/admission.tsx", import.meta.url));
  const admission = readFileSync(admissionPath, "utf8");

  assert.match(admission, /useListCatalogMetrics/);
  assert.match(admission, /useCreateCatalogMetric/);
  assert.match(admission, /data-testid="inherit-catalog-metric"/);
  assert.match(admission, /data-testid="create-and-use-catalog-metric"/);
  assert.match(admission, /addMetricFromCatalog/);
  assert.match(admission, /catalogMetricKey: m\.catalogMetricKey/);
  assert.match(admission, /getListCatalogMetricsQueryKey/);
});

test("decisões profissionais abrem e executam um fluxo operacional", () => {
  const pagePath = fileURLToPath(new URL("../pages/workforce-os-lab.tsx", import.meta.url));
  const page = readFileSync(pagePath, "utf8");

  assert.match(page, /useUpdateProfessionalPlanAction/);
  assert.match(page, /data-testid="plan-decision-preview"/);
  assert.match(page, /data-testid="professional-plan-next-action"/);
  assert.match(page, /requestActionTransition/);
  assert.match(page, /Evidência obrigatória/);
  assert.match(page, /Um novo ciclo só começa após concluir o atual/);
});

test("alertas não expõem configuração cenográfica", () => {
  const filePath = fileURLToPath(new URL("../pages/alerts.tsx", import.meta.url));
  const source = readFileSync(filePath, "utf8");

  assert.doesNotMatch(source, /Configurar padrões/);
  assert.doesNotMatch(source, /Configure patterns/);
  assert.doesNotMatch(source, /Configurar patrones/);
});

test("equipes e jornadas produtivas usam API e isolam cenários no laboratório", () => {
  const shellPath = fileURLToPath(new URL("../pages/workforce-os-lab.tsx", import.meta.url));
  const teamsPath = fileURLToPath(new URL("../pages/mixed-teams-operational.tsx", import.meta.url));
  const journeysPath = fileURLToPath(new URL("../pages/journeys.tsx", import.meta.url));
  const shell = readFileSync(shellPath, "utf8");
  const teams = readFileSync(teamsPath, "utf8");
  const journeys = readFileSync(journeysPath, "utf8");

  assert.match(shell, /labMode \? <MixedTeamsScreen \/> : <OperationalMixedTeamsScreen \/>/);
  assert.match(shell, /labMode \? <JourneysScreen \/> : <JourneysPage embedded \/>/);
  assert.match(teams, /data-operational-source="api"/);
  assert.match(teams, /customFetch/);
  assert.doesNotMatch(teams, /teamOperatingScenarios/);
  assert.match(journeys, /data-operational-source="api"/);
  assert.match(journeys, /customFetch/);
});

test("Admin Console centraliza tenant, membros, acessos e criação de equipes", () => {
  const filePath = fileURLToPath(new URL("../pages/admin-console.tsx", import.meta.url));
  const source = readFileSync(filePath, "utf8");

  assert.match(source, /openCreateOrganization/);
  assert.match(source, /openOrganizationProfile/);
  assert.match(source, /<AccessControlPanel/);
  assert.match(source, /href="\/equipes\?create=1"/);
  assert.match(source, /Acesso administrativo necessário/);
});

test("comando produtivo evolui a experiência nova com telemetria da API", () => {
  const shellPath = fileURLToPath(new URL("../pages/workforce-os-lab.tsx", import.meta.url));
  const modulesPath = fileURLToPath(new URL("../pages/workforce-os-modules.tsx", import.meta.url));
  const shell = readFileSync(shellPath, "utf8");
  const modules = readFileSync(modulesPath, "utf8");

  assert.match(shell, /<ManagerScreen[^>]+operational=\{!labMode\}/);
  assert.doesNotMatch(shell, /DashboardPage/);
  assert.match(modules, /data-operational-source=\{operational \? "api" : "scenario"\}/);
  assert.match(modules, /useGetFleetSummary/);
  assert.match(modules, /useGetFleetKpis/);
  assert.match(modules, /useListFleetAlerts/);
  assert.match(modules, /data-testid="hybrid-workforce-control-plane"/);
  assert.match(modules, /Control plane do trabalho/);
});

test("métricas, benchmarks e governança produtivos usam API", () => {
  const shellPath = fileURLToPath(new URL("../pages/workforce-os-lab.tsx", import.meta.url));
  const shell = readFileSync(shellPath, "utf8");
  const pages = ["metricas.tsx", "benchmarks.tsx", "governanca.tsx"].map((name) =>
    readFileSync(fileURLToPath(new URL(`../pages/${name}`, import.meta.url)), "utf8"),
  );

  assert.match(shell, /labMode \? <MetricsScreen \/> : <MetricasPage embedded \/>/);
  assert.match(shell, /labMode \? <BenchmarksScreen \/> : <BenchmarksPage embedded \/>/);
  assert.match(shell, /labMode \? <SettingsScreen \/> : <GovernancePage embedded \/>/);
  for (const page of pages) assert.match(page, /data-operational-source="api"/);
});
