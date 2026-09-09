// Rebuilds the chart-type demos' static config/data JSON in
// @mochart/demo-data from the canonical inputs in src/chartTypeGenerators.ts,
// so the baked snapshots and the random-mode generators can never drift
// structurally. Run after changing the canonical inputs or the core helpers:
//
//   npm run generate-demos -w @mochart/demo-common
//
// test/snapshotSync.test.ts pins the committed JSON to this script's output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildChartTypeDemoSnapshots } from '../src/chartTypeGenerators';

const demoDataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'mochart-demo-data', 'src');

// Matches the hand-written demo data files: one data object per line.
function formatDataObjects(rows: unknown[]): string {
  return '[\n' + rows.map(row => '  ' + JSON.stringify(row)).join(',\n') + '\n]\n';
}

export interface SnapshotFile {
  path: string;
  content: string;
}

export function buildChartTypeDemoSnapshotFiles(): SnapshotFile[] {
  return buildChartTypeDemoSnapshots().flatMap(snapshot => [
    {
      path: path.join(demoDataDir, 'config', snapshot.id + '-config.json'),
      content: JSON.stringify(snapshot.config, null, 2) + '\n'
    },
    {
      path: path.join(demoDataDir, 'data', snapshot.id + '-data.json'),
      content: formatDataObjects(snapshot.data)
    }
  ]);
}

const runDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) {
  for (const file of buildChartTypeDemoSnapshotFiles()) {
    fs.writeFileSync(file.path, file.content);
    console.log('wrote ' + file.path);
  }
}
