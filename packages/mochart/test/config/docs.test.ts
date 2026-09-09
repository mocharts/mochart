import { describe, it, expect } from 'vitest';

import { buildConfigReference } from '../../scripts/configReferenceModel';
import type { DescriptionEntry } from '../../src/config/docs/shared';

// The docs modules each default-export a getDescriptions() thunk returning a
// map of config-key -> human description (a string, or a nested entry with a
// description per member). They feed the docs generator; this pins that every
// module loads and yields a non-empty description map.
const modules = (import.meta as unknown as {
  glob: (pattern: string, options: { eager: boolean }) => Record<string, { default?: () => Record<string, DescriptionEntry> }>;
}).glob('../../src/config/docs/*.ts', { eager: true });

// Shared prose and types rather than a section's descriptions: no default getDescriptions() thunk.
const helperModules = new Set(['shared.ts', 'seriesIconConfig.ts']);

function collectDescriptions(entry: DescriptionEntry, path: string, into: [string, unknown][]) {
  if (typeof entry === 'string') {
    into.push([path, entry]);
    return;
  }
  into.push([path, entry.description]);
  for (const [key, nested] of Object.entries(entry.properties)) {
    collectDescriptions(nested, path + '.' + key, into);
  }
}

describe('config/docs description modules', () => {
  const entries = Object.entries(modules)
    .filter(([path]) => !helperModules.has(path.split('/').pop() as string));

  it('discovers every docs module', () => {
    // 18 per-section config docs + the top-level mochartConfig aggregator
    expect(entries.length).toBeGreaterThanOrEqual(18);
  });

  for (const [path, mod] of entries) {
    const name = path.split('/').pop();

    it(`${name} exports a non-empty description map of strings`, () => {
      expect(typeof mod.default).toBe('function');
      const descriptions = mod.default!();
      expect(descriptions).toBeTypeOf('object');
      const flattened: [string, unknown][] = [];
      for (const [key, entry] of Object.entries(descriptions)) {
        collectDescriptions(entry, key, flattened);
      }
      expect(flattened.length).toBeGreaterThan(0);
      const empty = flattened.filter(([, value]) => typeof value !== 'string' || value.length === 0);
      expect(empty.map(([key]) => key)).toEqual([]);
    });
  }

  it('describes every member of a nested property', () => {
    const chart = modules['../../src/config/docs/chartConfig.ts']!.default!();
    const backgroundStyle = chart.backgroundStyle;
    expect(typeof backgroundStyle).toBe('object');
    expect(Object.keys((backgroundStyle as { properties: object }).properties).sort())
      .toEqual(['fillColor', 'fillOpacity', 'strokeColor', 'strokeDashArray', 'strokeOpacity', 'strokeWidth']);
  });
});

describe('config reference nested properties', () => {
  const { model, integrityErrors } = buildConfigReference();

  it('has no cross-source key mismatches, at any nesting level', () => {
    expect(integrityErrors).toEqual([]);
  });

  it('documents every member of a nested property', () => {
    const section = model.sections.find(candidate => candidate.id === 'chart');
    const property = section?.properties.find(candidate => candidate.key === 'backgroundStyle');
    expect(property?.properties?.map(member => member.key))
      .toEqual(['fillColor', 'fillOpacity', 'strokeColor', 'strokeDashArray', 'strokeOpacity', 'strokeWidth']);
    for (const member of property?.properties ?? []) {
      expect(member.description?.length, member.key + ' description').toBeGreaterThan(0);
      expect(member.rules.length, member.key + ' rules').toBeGreaterThan(0);
      expect(member.default, member.key + ' default').toBeDefined();
    }
  });

  it('gives each nested member the default it holds inside its parent', () => {
    const section = model.sections.find(candidate => candidate.id === 'chart');
    const property = section?.properties.find(candidate => candidate.key === 'margin');
    const top = property?.properties?.find(member => member.key === 'top');
    expect(top?.default).toEqual({ kind: 'literal', text: '2' });
  });
});
