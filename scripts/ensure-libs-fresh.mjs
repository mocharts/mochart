// Prebuild for every dist-bundling entry point: rebuilds any lib whose build inputs are newer than its dist, so builds never ship stale code.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

// every package whose `default` export condition points at dist
const libDirs = ['movalid', 'mochart', 'mochart-export', 'mochart-editor', 'mochart-react',
  'mochart-svelte', 'mochart-vue', 'mochart-lit', 'mochart-angular'];

function newestMtime(path) {
  const stats = statSync(path);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }
  let newest = 0;
  for (const entry of readdirSync(path)) {
    newest = Math.max(newest, newestMtime(join(path, entry)));
  }
  return newest;
}

function distMtime(pkgDir) {
  try {
    return newestMtime(join(pkgDir, 'dist'));
  }
  catch {
    return 0; // no dist yet, so stale by definition
  }
}

// a build reads its package's sources, build scripts and config files (tsconfig.build.json extends tsconfig.json)
const buildInputs = ['src', 'scripts', 'package.json', 'tsconfig.json', 'tsconfig.build.json', 'vite.config.ts', 'svelte.config.js'];

// inputs outside the package: the editor build generates its model from core's config sources with core's scripts
const externalInputs = {
  'mochart-editor': ['mochart/src', 'mochart/scripts']
};

function inputMtime(path) {
  return existsSync(path) ? newestMtime(path) : 0;
}

export function staleLibs() {
  return libDirs.filter((dir) => {
    const pkgDir = join(rootDir, 'packages', dir);
    const inputs = [...buildInputs.map((input) => join(pkgDir, input)),
      ...(externalInputs[dir] ?? []).map((input) => join(rootDir, 'packages', input))];
    const srcMtime = Math.max(...inputs.map(inputMtime));
    return srcMtime > distMtime(pkgDir);
  });
}

export function ensureLibsFresh() {
  const stale = staleLibs();
  if (stale.length > 0) {
    console.log(`library dist is older than src for: ${stale.join(', ')}. Running build:libs first`);
    execSync('npm run build:libs', { cwd: rootDir, stdio: 'inherit' });
  }
}

// `node scripts/ensure-libs-fresh.mjs` runs it; importing it does not
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ensureLibsFresh();
}
