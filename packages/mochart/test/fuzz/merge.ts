// Merges the reports of a sharded fuzz run into one report. Each argument is the --out directory of
// one `--shard=i/N` run. See "Running on GitHub" in README.md in this directory.
import fs from 'node:fs';
import path from 'node:path';
import { MAX_SAMPLES, sortFindings, writeReport, type RunSummary } from './report';
import type { FindingGroup } from './runner';

interface ShardReport { summary: RunSummary; findings: FindingGroup[]; swept: string[] }

function readShard(dir: string): ShardReport {
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')) as Omit<ShardReport, 'swept'>;
  const statePath = path.join(dir, 'state.json');
  const swept = fs.existsSync(statePath) ? (JSON.parse(fs.readFileSync(statePath, 'utf8')) as { swept: string[] }).swept : [];
  return { ...report, swept };
}

function sum(shards: ShardReport[], value: (summary: RunSummary) => number): number {
  return shards.reduce((total, shard) => total + value(shard.summary), 0);
}

function mergeSummaries(shards: ShardReport[]): RunSummary {
  const first = shards[0]!.summary;
  const stats: Record<string, number> = {};
  for (const shard of shards) {
    for (const [key, value] of Object.entries(shard.summary.stats)) {
      stats[key] = (stats[key] ?? 0) + value;
    }
  }
  // a shard names a property none of its own units ran a case for, though another shard's unit may have
  const swept = new Set(shards.flatMap(shard => shard.swept));
  const unswept = new Set(shards.flatMap(shard => shard.summary.properties.unswept));
  return {
    startedAt: shards.map(shard => shard.summary.startedAt).sort()[0]!,
    elapsedSeconds: Math.max(...shards.map(shard => shard.summary.elapsedSeconds)),
    bases: first.bases,
    properties: { total: first.properties.total, untested: first.properties.untested, unswept: [...unswept].filter(id => !swept.has(id)) },
    units: { total: sum(shards, summary => summary.units.total), done: sum(shards, summary => summary.units.done) },
    stats
  };
}

function mergeFindings(shards: ShardReport[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();
  for (const shard of shards) {
    for (const group of shard.findings) {
      const merged = groups.get(group.key);
      if (!merged) {
        groups.set(group.key, structuredClone(group));
        continue;
      }
      merged.count += group.count;
      merged.bases.push(...group.bases.filter(base => !merged.bases.includes(base)));
      merged.samples.push(...group.samples.slice(0, MAX_SAMPLES - merged.samples.length));
    }
  }
  return sortFindings([...groups.values()]);
}

function main(): void {
  let out: string | null = null;
  let failOnFindings = false;
  const dirs: string[] = [];
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith('--out=')) {
      out = path.resolve(process.cwd(), argument.slice('--out='.length));
    }
    else if (argument === '--fail-on-findings') {
      failOnFindings = true;
    }
    else if (argument.startsWith('--')) {
      throw new Error('Unknown option: ' + argument);
    }
    else {
      dirs.push(path.resolve(process.cwd(), argument));
    }
  }
  if (out === null || dirs.length === 0) {
    throw new Error('Usage: npm run fuzz:merge -w @mochart/core -- --out=dir [--fail-on-findings] shardDir...');
  }
  const shards = dirs.map(readShard);
  const summary = mergeSummaries(shards);
  const findings = mergeFindings(shards);
  writeReport(out, summary, findings);
  console.log('merged ' + shards.length + ' shards: ' + summary.units.done + '/' + summary.units.total + ' units · '
    + summary.stats.cases + ' cases · ' + findings.length + ' finding groups · ' + path.join(out, 'report.md'));
  if (failOnFindings && findings.length > 0) {
    process.exitCode = 1;
  }
}

main();
