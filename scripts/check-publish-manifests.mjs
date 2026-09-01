// Guards the pnpm-publish manifest swap: every published package must declare a
// dist-only publishConfig.exports, and a packed tarball must actually carry it.
// Publishing must go through pnpm (npm run publish:libs → scripts/publish-libs.mjs);
// npm publish would ship the development condition, which resolves raw src in
// consumers' dev servers.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const packagesDir = join(root, 'packages');
const pnpm = join(root, 'node_modules', '.bin', 'pnpm');

const errors = [];
const published = [];

for (const dir of readdirSync(packagesDir)) {
  const manifestPath = join(packagesDir, dir, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    continue;
  }
  if (manifest.private) continue;
  published.push(dir);

  const fail = (message) => errors.push(`${dir}: ${message}`);
  const publishExports = manifest.publishConfig?.exports;
  if (!publishExports) {
    fail('missing publishConfig.exports (pnpm publish would ship the development condition)');
    continue;
  }
  const serialized = JSON.stringify(publishExports);
  if (serialized.includes('"development"')) fail('publishConfig.exports contains a development condition');
  if (serialized.includes('./src')) fail('publishConfig.exports points into src');
  const devKeys = Object.keys(manifest.exports ?? {});
  const pubKeys = Object.keys(publishExports);
  const missing = devKeys.filter((key) => !pubKeys.includes(key));
  const extra = pubKeys.filter((key) => !devKeys.includes(key));
  if (missing.length) fail(`publishConfig.exports drops subpaths: ${missing.join(', ')}`);
  if (extra.length) fail(`publishConfig.exports has subpaths absent from exports: ${extra.join(', ')}`);

  // npmjs.com renders the README with no repo around it, so relative links are dead there.
  const readme = readFileSync(join(packagesDir, dir, 'README.md'), 'utf8');
  for (const [, target] of readme.matchAll(/\]\(([^)\s]+)/g)) {
    if (!/^(https?:\/\/|#)/.test(target)) fail(`README.md has a relative link, dead on npmjs.com: ${target}`);
  }
}

// End-to-end proof on the cheapest package: pack with pnpm and inspect the
// tarball's manifest, which is what a consumer's resolver actually reads.
if (!errors.length) {
  const scratch = mkdtempSync(join(tmpdir(), 'mochart-pack-check-'));
  try {
    execFileSync(pnpm, ['-C', join(packagesDir, 'movalid'), 'pack', '--out', join(scratch, 'movalid.tgz')], { stdio: 'inherit' });
    const packed = JSON.parse(execFileSync('tar', ['-xzOf', join(scratch, 'movalid.tgz'), 'package/package.json'], { encoding: 'utf8' }));
    if (JSON.stringify(packed.exports).includes('"development"')) {
      errors.push('packed movalid tarball still has a development condition — pnpm did not apply publishConfig.exports');
    }
    const files = execFileSync('tar', ['-tzf', join(scratch, 'movalid.tgz')], { encoding: 'utf8' });
    if (!files.includes('package/dist/validators.js')) errors.push('packed movalid tarball is missing dist');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`);
  process.exit(1);
}
console.log(`✓ publish manifests clean for ${published.length} packages: ${published.join(', ')}`);
