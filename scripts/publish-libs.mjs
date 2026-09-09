// Publishes every public package through pnpm (which applies publishConfig.exports;
// npm publish would ship the development condition), in dependency order, skipping
// versions already on the registry so a re-run after a partial failure — or the
// release job running on a push with nothing to release — is a no-op.
// Extra arguments pass through to `pnpm publish` (e.g. --dry-run, --otp=123456).
// In changesets pre mode the pre.json tag becomes the npm dist-tag.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pnpm = join(root, 'node_modules', '.bin', 'pnpm');
const packageDirs = ['movalid', 'mochart', 'mochart-editor', 'mochart-export', 'mochart-react',
  'mochart-svelte', 'mochart-vue', 'mochart-lit', 'mochart-angular'];
const passthrough = process.argv.slice(2);

const preFile = join(root, '.changeset', 'pre.json');
const pre = existsSync(preFile) ? JSON.parse(readFileSync(preFile, 'utf8')) : null;
const distTag = pre?.mode === 'pre' && !passthrough.some((arg) => arg.startsWith('--tag')) ? ['--tag', pre.tag] : [];

function isPublished(name, version) {
  try {
    const out = execFileSync('npm', ['view', `${name}@${version}`, 'version', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out.trim() !== '' && out.includes(version);
  } catch (error) {
    // an unpublished name or version is E404, anything else is a real registry problem
    if (`${error.stdout ?? ''}${error.stderr ?? ''}`.includes('E404')) return false;
    throw error;
  }
}

let published = 0;
for (const dir of packageDirs) {
  const pkgDir = join(root, 'packages', dir);
  const { name, version, private: isPrivate } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  if (isPrivate) throw new Error(`${name} is private but listed for publishing`);
  if (isPublished(name, version)) {
    console.log(`publish-libs: ${name}@${version} is already published, skipping`);
    continue;
  }
  console.log(`publish-libs: publishing ${name}@${version}`);
  // cwd rather than `pnpm -C`: pnpm 10.34 forwards -C's directory to npm publish as a stray positional
  const result = spawnSync(pnpm, ['publish', '--no-git-checks', ...distTag, ...passthrough], { cwd: pkgDir, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`publish-libs: ${name}@${version} failed; re-run to resume from here`);
    process.exit(result.status ?? 1);
  }
  published++;
}
console.log(`publish-libs: ${published} package(s) published, ${packageDirs.length - published} already current`);
