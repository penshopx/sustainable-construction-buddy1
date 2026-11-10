import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "routing-smoke.spec.mjs",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4179",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "pnpm run serve",
    env: { PORT: "4179", BASE_PATH: "/" },
    url: "http://127.0.0.1:4179",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});