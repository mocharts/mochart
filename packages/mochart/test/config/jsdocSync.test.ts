import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

import { buildDocumentedTypesSource, typesPath } from '../../scripts/generateJsdoc';

// The JSDoc on the config interfaces in src/types/config.ts is generated from
// the config docs model (descriptions/validators/defaults) by
// scripts/generateJsdoc.ts. This pins the file to the model so the two cannot
// drift: when it fails, run `npm run generate-jsdoc -w @mochart/core`.
describe('types/config.ts JSDoc sync', () => {
  const source = fs.readFileSync(typesPath, 'utf-8');
  const { output, warnings } = buildDocumentedTypesSource(source);

  it('generates without warnings', () => {
    expect(warnings).toEqual([]);
  });

  it('matches the checked-in file', () => {
    expect(
      output === source,
      'src/types/config.ts JSDoc is out of date with the config docs. Run "npm run generate-jsdoc -w @mochart/core"'
    ).toBe(true);
  });
});
