import { defineConfig, devices } from '@playwright/test';

// The gallery's own suite, separate from demo-basic's (own deps, own port); Chromium only — clipboard reads need it, and demo-basic already runs the engine matrix.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5179',
    trace: 'on-first-retry'
  },
  // A project, not per-test `setViewportSize`, so the page mounts at phone width; tag tests with `phoneTag` from e2e/helpers to move them here.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@phone/ },
    {
      name: 'chromium-phone',
      // Not a device descriptor (those set a WebKit user agent); 390x844 is all the width-driven fold reads.
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true },
      grep: /@phone/
    }
  ],
  webServer: {
    // Dev server on vite.config's pinned 5179; --strictPort so a clash fails loudly.
    command: 'npm run dev -- --strictPort',
    url: 'http://localhost:5179',
    reuseExistingServer: !process.env.CI
  }
});
