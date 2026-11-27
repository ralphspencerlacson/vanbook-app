import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3241", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/fixtures/auth-server.mjs",
      url: "http://127.0.0.1:3242/health",
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3241",
      url: "http://127.0.0.1:3241",
      reuseExistingServer: false,
      env: {
        VANBOOK_E2E: "1",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3242",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local-test-only",
        SITE_URL: "http://127.0.0.1:3241",
      },
    },
  ],
});
