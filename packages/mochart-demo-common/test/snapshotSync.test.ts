import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { buildChartTypeDemoSnapshotFiles } from '../scripts/generateChartTypeDemos';

// The chart-type demo config/data JSON committed in @mochart/demo-data is
// generated from src/chartTypeGenerators.ts by scripts/generateChartTypeDemos.ts.
// This pins the committed files to the generator so the two cannot drift:
// when it fails, run `npm run generate-demos -w @mochart/demo-common`.
describe('chart-type demo snapshot sync', () => {
  for (const file of buildChartTypeDemoSnapshotFiles()) {
    it(`${path.basename(file.path)} matches the checked-in file`, () => {
      expect(fs.existsSync(file.path), `${file.path} is missing — run "npm run generate-demos -w @mochart/demo-common"`).toBe(true);
      expect(
        fs.readFileSync(file.path, 'utf-8') === file.content,
        `${file.path} is out of date with the demo generators — run "npm run generate-demos -w @mochart/demo-common"`
      ).toBe(true);
    });
  }
});
