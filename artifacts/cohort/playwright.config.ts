import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
const storageState = path.resolve(import.meta.dirname, "playwright/.clerk/user.json");
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true";

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
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "pnpm --dir ../api-server run dev",
          url: "http://127.0.0.1:8087/api/healthz",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "pnpm run dev",
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
        storageState,
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
