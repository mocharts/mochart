import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// src/version.ts carries the package.json version, stamped by scripts/stampVersion.ts. The build
// only checks it (so an install never dirties the tracked file), which means a bump can be committed
// with the stamp missing; this pins the two together the way jsdocSync pins the generated JSDoc.
// When it fails, run `npm run stamp-version -w @mochart/core`.
describe('src/version.ts sync', () => {
  const packageDir = path.resolve(import.meta.dirname, '..', '..');
  const { version } = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')) as { version: string };
  const source = fs.readFileSync(path.join(packageDir, 'src', 'version.ts'), 'utf-8');

  it('matches the version package.json declares', () => {
    expect(source).toContain('mochartVersion = "' + version + '"');
  });
});
