import { defineConfig, devices } from "@playwright/test";

// Browser tests for the web export (`pnpm test:web` builds it first). They
// play the real station: stream.animu.moe and api.animu.moe must be reachable.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["junit", { outputFile: "playwright-junit.xml" }]] : "list",
  use: {
    baseURL: "http://localhost:8090",
    viewport: { width: 1280, height: 800 },
    // Playback starts from a click, as a user's would.
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    // Safari's engine: the stream's CORS and the oscilloscope behave differently there.
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "node scripts/serve-web.mjs dist/web",
    url: "http://localhost:8090",
    reuseExistingServer: !process.env.CI,
  },
});
