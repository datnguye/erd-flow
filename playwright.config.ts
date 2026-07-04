import { defineConfig, devices } from "@playwright/test";

const PORT = 5411;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Vite dev server serving demo/index.html (dev mode ignores build.lib), so
    // the e2e drives a real <ErdFlow> mount without a library build step. Bind
    // 127.0.0.1 explicitly — Playwright's health check uses the IPv4 loopback,
    // and Vite's default `localhost` can resolve to IPv6 only.
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/demo/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
