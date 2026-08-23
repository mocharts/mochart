import { defineConfig, devices } from '@playwright/test';

// Local runs use the dev server on vite.config's pinned 5173 (--strictPort so a clash fails loudly);
// it resolves the development export condition, so tests run against src and edits show up live.
const devServer = {
  command: 'npm run dev -- --strictPort',
  url: 'http://localhost:5173',
  reuseExistingServer: true
};

// CI builds the demo against the library dist bundles and serves it on vite preview's pinned 4173,
// so the published build is what every project executes; the bundle also loads far faster than
// the dev server's per-module requests. The timeout covers the build step.
// Reproduce locally with: CI=1 npx playwright test
const previewServer = {
  command: 'npm run build && npm run preview -- --strictPort',
  url: 'http://localhost:4173',
  reuseExistingServer: false,
  timeout: 180_000
};

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // the runner's default is half its cores; the tests are short page loads, so all four stay busy
  workers: isCI ? 4 : undefined,
  reporter: 'list',
  use: {
    baseURL: isCI ? previewServer.url : devServer.url,
    trace: 'on-first-retry'
  },
  // Chromium runs everything; Gecko and WebKit run the @smoke subset, so the
  // three engines the core README claims support for are all exercised without
  // tripling the gate. Tag a test with `smokeTag` from e2e/helpers to add it.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@smoke/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@smoke/ }
  ],
  webServer: isCI ? previewServer : devServer
});
