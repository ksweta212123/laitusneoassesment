import { defineConfig } from "@playwright/test";

/**
 * Browser tests for the token layer. They run against a dev server on :3000
 * (started if not already running) and the local PGlite database.
 * Serial on purpose: the tests share one database and one pair of accounts.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 90_000,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: { command: "npm run dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 60_000 },
});
