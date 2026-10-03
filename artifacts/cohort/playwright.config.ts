import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_FILE } from "./e2e/fixtures";
import { clerkE2EEnvironment, e2eDatabaseUrl, isAuthenticatedPlaywrightRun } from "./e2e/runtime";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5273";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true";
const authenticatedRun = isAuthenticatedPlaywrightRun();
const clerkEnvironment = authenticatedRun ? clerkE2EEnvironment() : null;
const commonServerEnvironment = {
  ...Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ),
  PORT: "8187",
  DATABASE_URL: e2eDatabaseUrl(),
  WEB_APP_URL: baseURL,
  ...(clerkEnvironment
    ? {
        CLERK_SECRET_KEY: clerkEnvironment.secretKey,
        CLERK_PUBLISHABLE_KEY: clerkEnvironment.publishableKey,
        VITE_CLERK_PUBLISHABLE_KEY: clerkEnvironment.publishableKey,
      }
    : {}),
};
const apiServerEnvironment = { ...commonServerEnvironment, PORT: "8187" };
const webServerEnvironment = {
  ...commonServerEnvironment,
  PORT: "5273",
  API_PROXY_TARGET: "http://127.0.0.1:8187",
};

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../../output/gauntlet/playwright/artifacts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../output/gauntlet/playwright/report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalTeardown: authenticatedRun ? "./e2e/global.teardown.ts" : undefined,
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "pnpm --dir ../api-server run dev",
          env: apiServerEnvironment,
          url: "http://127.0.0.1:8187/api/healthz",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "pnpm run dev",
          env: webServerEnvironment,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
  projects: [
    {
      name: "clerk-setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "public-chromium",
      testIgnore: [/authenticated\.spec\.ts/, /global\.setup\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated-chromium",
      testMatch: /authenticated\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Criado pelo projeto clerk-setup nesta mesma execução; nunca vem de
        // PLAYWRIGHT_STORAGE_STATE ou de um arquivo versionado/manual.
        storageState: E2E_AUTH_FILE,
      },
      dependencies: ["clerk-setup"],
    },
    {
      name: "public-mobile",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
