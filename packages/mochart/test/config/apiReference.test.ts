import { describe, it, expect } from 'vitest';

import { buildApiReference } from '../../scripts/apiReferenceModel';

// The prop/callback reference pages are generated from the interfaces in
// src/types/chart.ts. This pins that file to the docs model so an addition
// there cannot ship undocumented: the builder reports a member with no JSDoc,
// or an exported interface with no reference page, as an integrity error.
describe('api reference model', () => {
  const { model, integrityErrors } = buildApiReference();

  it('builds without integrity errors', () => {
    expect(integrityErrors).toEqual([]);
  });

  it('documents every group with properties', () => {
    for (const page of model.pages) {
      for (const group of page.groups) {
        expect(group.properties.length, `${group.interfaceName} has no properties`).toBeGreaterThan(0);
        for (const property of group.properties) {
          expect(property.description, `${group.interfaceName}.${property.key} has no description`).not.toBe('');
          expect(property.type, `${group.interfaceName}.${property.key} has no type`).not.toBe('');
        }
      }
    }
  });

  it('documents every enumeration with values and uses', () => {
    const { entries } = model.enumerations;
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.description, `${entry.name} has no description`).not.toBe('');
      expect(entry.values.length, `${entry.name} has no values`).toBeGreaterThan(0);
      expect(entry.usedBy.length, `${entry.name} has no uses`).toBeGreaterThan(0);
    }
    const renderer = entries.find(entry => entry.name === 'RendererType');
    expect(renderer?.values).toEqual(['bar', 'line', 'area', 'none']);
    expect(renderer?.usedBy).toEqual([{ label: 'series.renderer', link: '/reference/series#series.renderer' }]);
  });
});
