import { defineConfig, devices } from '@playwright/test';

// One smoke spec, five galleries: every framework port is a project with its own
// server, so `--project=angular` runs a single gallery and the default runs all.
// Local runs use each gallery's dev server (its vite.config pins the port, and
// --strictPort makes a clash fail loudly); CI builds the gallery against the
// library dist bundles and serves it on the pinned preview port, so the bundle
// a deploy would ship is what the tests execute. Reproduce with: CI=1 npx playwright test
const isCI = !!process.env.CI;

interface Gallery {
  name: string;
  workspace: string;
  devPort: number;
  previewPort: number;
}

const galleries: Gallery[] = [
  { name: 'angular', workspace: '@mochart/demo-angular', devPort: 5180, previewPort: 4180 },
  { name: 'lit', workspace: '@mochart/demo-lit', devPort: 5177, previewPort: 4177 },
  { name: 'react', workspace: '@mochart/demo-react', devPort: 5174, previewPort: 4174 },
  { name: 'svelte', workspace: '@mochart/demo-svelte', devPort: 5175, previewPort: 4175 },
  { name: 'vue', workspace: '@mochart/demo-vue', devPort: 5176, previewPort: 4176 }
];

function galleryUrl(gallery: Gallery): string {
  return 'http://localhost:' + (isCI ? gallery.previewPort : gallery.devPort);
}

// Workspace scripts run from the repo root; the demos' prebuild hook rebuilds stale library dists.
const root = new URL('../..', import.meta.url).pathname;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : undefined,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'on-first-retry'
  },
  projects: galleries.map((gallery) => ({
    name: gallery.name,
    use: { baseURL: galleryUrl(gallery) }
  })),
  webServer: galleries.map((gallery) => ({
    command: isCI
      ? `npm run build -w ${gallery.workspace} && npm run preview -w ${gallery.workspace} -- --strictPort`
      : `npm run dev -w ${gallery.workspace} -- --strictPort`,
    cwd: root,
    url: galleryUrl(gallery),
    reuseExistingServer: !isCI,
    timeout: 180_000
  }))
});
