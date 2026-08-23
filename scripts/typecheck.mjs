// Runs every workspace's typecheck script (plus the root scripts project) concurrently, as many at a
// time as there are cores; the serial `npm run typecheck --workspaces` spent most of its time in
// per-process startup. Each job's output is printed whole when it finishes, so logs never interleave,
// and every job runs even after one fails, so one run reports every failure.
import { spawn } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function readManifest(manifestPath) {
  return JSON.parse(readFileSync(join(rootDir, manifestPath), 'utf8'));
}

// the same set `npm run typecheck --workspaces --if-present` ran: every workspace with a typecheck script
const jobs = [{ name: 'scripts', args: ['exec', '--silent', '--', 'tsc', '-p', 'scripts'] }];
for (const pattern of readManifest('package.json').workspaces) {
  for (const manifestPath of globSync(join(pattern, 'package.json'), { cwd: rootDir }).sort()) {
    const manifest = readManifest(manifestPath);
    if (manifest.scripts?.typecheck) {
      jobs.push({ name: manifest.name, args: ['run', '--silent', 'typecheck', '-w', manifest.name] });
    }
  }
}

function runJob(job) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(npm, job.args, { cwd: rootDir, env: { ...process.env, FORCE_COLOR: '1' } });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('close', (code) => {
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      const output = Buffer.concat(chunks).toString().trimEnd();
      console.log(`${code === 0 ? 'ok  ' : 'FAIL'} ${job.name} (${seconds}s)${output ? '\n' + output : ''}`);
      resolve(code === 0);
    });
  });
}

const queue = [...jobs];
const failures = [];
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    if (!await runJob(job)) {
      failures.push(job.name);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(availableParallelism(), jobs.length) }, worker));
if (failures.length > 0) {
  console.error(`typecheck failed: ${failures.join(', ')}`);
  process.exit(1);
}
