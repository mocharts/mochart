import { describe, it, expect } from 'vitest';
import { enhanceConfig, sectionKeyAllMap } from '@mochart/core';

import { getDocsBaseUrl, getReferenceSectionIds, getReferenceSectionUrl } from '../src/docsLinks';

describe('getDocsBaseUrl', () => {
  it('strips the gallery slug from the base path', () => {
    expect(getDocsBaseUrl('/mochart/vanilla/')).toBe('/mochart/');
    expect(getDocsBaseUrl('/mochart/vanilla')).toBe('/mochart/');
    expect(getDocsBaseUrl('/react/')).toBe('/');
  });

  it('falls back to the root for a bare base', () => {
    expect(getDocsBaseUrl('/')).toBe('/');
    expect(getDocsBaseUrl('')).toBe('/');
  });
});

describe('getReferenceSectionIds', () => {
  it('returns the sections a config uses, in reference order', () => {
    expect(getReferenceSectionIds({
      version: '1.0.0',
      series: [],
      title: {},
      accessibility: {},
      animation: {}
    })).toEqual(['accessibility', 'animation', 'series', 'title']);
  });

  it('maps *Defaults keys onto their list section', () => {
    expect(getReferenceSectionIds({
      seriesDefaults: {},
      seriesStackDefaults: {}
    })).toEqual(['series', 'seriesStacks']);
  });

  it('ignores unknown keys and empty configs', () => {
    expect(getReferenceSectionIds({ version: '1.0.0', id: 'x' })).toEqual([]);
    expect(getReferenceSectionIds(null)).toEqual([]);
  });
});

describe('getReferenceSectionUrl', () => {
  it('builds the section page url from the base', () => {
    expect(getReferenceSectionUrl('series', '/mochart/vanilla/')).toBe('/mochart/reference/series');
  });
});

// Drift guard for CONTRIBUTING.md's "Adding a new config section" list: the
// enhancer emits every section, so a section missing a reference link here
// means docsLinks.ts was skipped when the section was added.
describe('reference section coverage', () => {
  it('links every config section the enhancer emits', () => {
    const enhanced = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'x', type: 'string', scale: 'ordinal' },
      series: [{ property: 'y' }]
    }) as unknown as Record<string, unknown>;
    // top-level enhanced keys that are not config sections
    const nonSectionKeys = new Set(['version', 'validation']);
    const sectionIds = Object.keys(enhanced).filter((key) => !nonSectionKeys.has(key) && !key.endsWith('ById'));
    const linked = getReferenceSectionIds(Object.fromEntries(sectionIds.map((id) => [id, {}])));
    expect([...linked].sort()).toEqual([...sectionIds].sort());
  });

  it('maps every *Defaults companion key onto its list section', () => {
    for (const [sectionId, defaultsKey] of Object.entries(sectionKeyAllMap)) {
      expect(getReferenceSectionIds({ [defaultsKey]: {} })).toEqual([sectionId]);
    }
  });
});
