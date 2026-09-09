// Release dry run: packs every public package with pnpm (the publish path) into
// pack/, checks each tarball's manifest and contents, and with --smoke installs
// the tarballs plus their framework peers into a scratch project and imports
// each package under Node — the closest local stand-in for a consumer install.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pnpm = join(root, 'node_modules', '.bin', 'pnpm');
const packageDirs = ['movalid', 'mochart', 'mochart-editor', 'mochart-export', 'mochart-react',
  'mochart-svelte', 'mochart-vue', 'mochart-lit', 'mochart-angular'];
const smoke = process.argv.includes('--smoke');
const outDir = join(root, 'pack');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const errors = [];
const packed = [];
for (const dir of packageDirs) {
  const pkgDir = join(root, 'packages', dir);
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const tarball = join(outDir, `${dir}.tgz`);
  console.log(`pack-libs: packing ${manifest.name}@${manifest.version}`);
  // stdout is pnpm's full file listing; only failures are worth the log space
  execFileSync(pnpm, ['-C', pkgDir, 'pack', '--out', tarball], { stdio: ['ignore', 'pipe', 'inherit'] });

  const fail = (message) => errors.push(`${manifest.name}: ${message}`);
  const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n');
  const packedManifest = JSON.parse(execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8' }));
  const exportsText = JSON.stringify(packedManifest.exports);
  if (exportsText.includes('"development"')) fail('packed exports still carry the development condition');
  if (exportsText.includes('./src')) fail('packed exports point into src');
  for (const required of ['README.md', 'LICENSE', 'CHANGELOG.md']) {
    if (!files.includes(`package/${required}`)) fail(`tarball is missing ${required}`);
  }
  // every file the packed exports name must actually be in the tarball
  const leaves = (value) => (typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(leaves));
  for (const rel of leaves(packedManifest.exports)) {
    if (!files.includes(`package/${rel.replace(/^\.\//, '')}`)) fail(`packed exports reference ${rel}, which is not in the tarball`);
  }
  packed.push({ manifest, tarball });
}

if (smoke && !errors.length) {
  const smokeDir = join(outDir, 'smoke');
  mkdirSync(smokeDir);
  // peers pinned to the versions each package tests against, tarballs by path
  const dependencies = {};
  for (const { manifest, tarball } of packed) {
    dependencies[manifest.name] = `file:${tarball}`;
    for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
      if (peer.startsWith('@mochart/')) continue;
      dependencies[peer] = manifest.devDependencies?.[peer] ?? manifest.peerDependencies[peer];
      // the angular dist is partially compiled; without the linker it needs the JIT compiler present
      if (peer === '@angular/core') dependencies['@angular/compiler'] = dependencies[peer];
    }
  }
  writeFileSync(join(smokeDir, 'package.json'), JSON.stringify({ name: 'mochart-smoke', private: true, type: 'module', dependencies }, null, 2));
  // the svelte dist ships .svelte sources (with bundler-style extensionless relative
  // imports) for the consumer's bundler; under Node these hooks stand in for it
  writeFileSync(join(smokeDir, 'register.mjs'), [
    "import { registerHooks } from 'node:module';",
    "import { readFileSync } from 'node:fs';",
    "import { compile } from 'svelte/compiler';",
    'registerHooks({',
    '  resolve(specifier, context, next) {',
    '    try { return next(specifier, context); }',
    "    catch (error) { if (/^\\.\\.?\\//.test(specifier) && !/\\.\\w+$/.test(specifier)) return next(specifier + '.js', context); throw error; }",
    '  },',
    '  load(url, context, next) {',
    "    if (!url.endsWith('.svelte')) return next(url, context);",
    "    const { js } = compile(readFileSync(new URL(url), 'utf8'), { filename: url, generate: 'server' });",
    "    return { format: 'module', shortCircuit: true, source: js.code };",
    '  },',
    '});',
    '',
  ].join('\n'));
  console.log('pack-libs: installing tarballs into pack/smoke');
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: smokeDir, stdio: 'inherit' });
  for (const { manifest } of packed) {
    const prelude = manifest.peerDependencies?.['@angular/core'] ? "await import('@angular/compiler'); " : '';
    const script = `${prelude}await import(${JSON.stringify(manifest.name)}); console.log('pack-libs: imported ${manifest.name}');`;
    const result = spawnSync(process.execPath, ['--import', './register.mjs', '--input-type=module', '-e', script], { cwd: smokeDir, stdio: 'inherit' });
    if (result.status !== 0) errors.push(`${manifest.name}: import failed under Node`);
  }
}

if (errors.length) {
  console.error('\npack-libs: FAILED\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`\npack-libs: ${packed.length} tarballs OK in pack/${smoke ? ', smoke install passed' : ''}`);
