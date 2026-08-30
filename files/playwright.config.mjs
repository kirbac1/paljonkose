import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `PORT=${PORT} SITE_URL=http://localhost:${PORT} node server.mjs`,
    port: PORT,
    reuseExistingServer: !process.env.CI
  }
});
