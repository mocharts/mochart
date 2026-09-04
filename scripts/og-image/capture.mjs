#!/usr/bin/env node
// Renders the docs site's social preview card. See README.md beside this file.
//
// Serves the repo root over HTTP (see ../readme-gif/serve.mjs), opens
// card.html in Chromium with Playwright and screenshots it at 1200x630.
//
// Usage:
//   node scripts/og-image/capture.mjs [outFile]
//
// outFile defaults to packages/mochart-docs/public/og-image.png, which the
// docs config references as og:image.

import { chromium } from '@playwright/test';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { repoRoot, serveRepo } from '../readme-gif/serve.mjs';

const WIDTH = 1200;
const HEIGHT = 630;
const distBundle = join(repoRoot, 'packages', 'mochart', 'dist', 'mochart.js');
const defaultOutFile = join(repoRoot, 'packages', 'mochart-docs', 'public', 'og-image.png');

async function main() {
  const [arg, extra] = process.argv.slice(2);
  if (extra !== undefined || (arg !== undefined && arg.startsWith('--'))) {
    throw new Error('usage: capture.mjs [outFile]');
  }
  const outFile = arg === undefined ? defaultOutFile : resolve(arg);
  if (!existsSync(distBundle)) {
    throw new Error(`${distBundle} is missing; run "npm run build -w @mochart/core" first`);
  }
  const { server, port } = await serveRepo();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, colorScheme: 'light', reducedMotion: 'no-preference' });
    page.on('pageerror', (error) => { throw error; });
    await page.goto(`http://127.0.0.1:${port}/scripts/og-image/card.html`);
    await page.waitForFunction(() => window.__cardReady === true);
    await page.screenshot({ path: outFile, type: 'png' });
    console.log(`${outFile}  ${WIDTH}x${HEIGHT}  ${Math.round(statSync(outFile).size / 1024)} KB`);
  }
  finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
