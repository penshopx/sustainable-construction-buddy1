import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./tests",
  testMatch: "bedah-real-auth.spec.mjs",
  workers: 1, retries: 0, forbidOnly: true,
  timeout: 120_000,
  reporter: "list",
  outputDir: path.join(process.env.BEDAH_TEST_DIRECTORY || "../../generated-artifacts/bedah", "browser-results"),
  use: {
    ...devices["Desktop Chrome"], ignoreHTTPSErrors: true,
    launchOptions: process.env.BEDAH_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.BEDAH_CHROMIUM_EXECUTABLE } : {},
    // Never save traces/storageState: they contain disposable Auth credentials.
    trace: "off", video: "off",
  },
});
