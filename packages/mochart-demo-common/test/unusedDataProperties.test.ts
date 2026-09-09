import { describe, it, expect } from 'vitest';
import { enhanceConfig } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

import { collectUsedDataProperties, filterDataProperties } from '../src/unusedDataProperties';
import { parseFullData } from '../src/dataEditing';
import { generateDemoDataProvider } from '../src/chartTypeGenerators';

const config = enhanceConfig({
  version: '1.0.0',
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  series: [{
    property: 'a', tooltipProperty: 'aInfo', errorLowProperty: 'aLow', errorHighProperty: 'aHigh'
  }]
} as unknown as MochartInputConfig);

// Regression: tooltip and error-bar properties were missing from the used-set,
// so the Data tab's default filtered view hid actively-rendered whisker data
// and rows added there silently dropped their bounds.
describe('collectUsedDataProperties', () => {
  it('includes tooltip and error-bar properties', () => {
    const used = collectUsedDataProperties(config)!;
    expect(used.has('aInfo')).toBe(true);
    expect(used.has('aLow')).toBe(true);
    expect(used.has('aHigh')).toBe(true);
  });

  it('keeps error-bar columns in the filtered data view', () => {
    const used = collectUsedDataProperties(config)!;
    const filtered = filterDataProperties([{ month: 'Jan', a: 5, aLow: 4, aHigh: 6, junk: 1 }], used);
    expect(filtered[0]).toEqual({ month: 'Jan', a: 5, aLow: 4, aHigh: 6 });
  });
});

// Regression: the generic random generator's property-key list missed the same
// three keys, so a generator-less demo would never get error-bar/tooltip data.
describe('generic random generation for tooltip and error-bar properties', () => {
  it('generates values for every configured property key', () => {
    const randomConfig = {
      category: {
        count: 6,
        order: { sort: true },
        missing: { probability: 0 },
        reuse: { globalFraction: 0, stepFraction: 0 },
        number: { min: 0, max: 100, interval: 1 },
        string: { minLength: 1, maxLength: 8 },
        date: { min: '2020-01-01', max: '2024-01-01', interval: 30, intervalUnit: 'day' }
      },
      series: {
        number: { min: 0, max: 100, round: true, limitToAxisConfig: false },
        missing: { probability: 0 },
        reuse: { global: false, step: false }
      }
    };
    const provider = generateDemoDataProvider(undefined, config, randomConfig as never, 1);
    const keys = Object.keys(provider.seriesValues ?? {});
    expect(keys).toEqual(expect.arrayContaining(['a', 'aInfo', 'aLow', 'aHigh']));
  });
});

// Regression: the Unused toggle parsed the view without the category property,
// so deleting/reordering filtered rows reattached hidden columns by index.
describe('parseFullData row matching', () => {
  const fullData = [
    { month: 'Jan', sales: 10, note: 'jan-note' },
    { month: 'Feb', sales: 20, note: 'feb-note' },
    { month: 'Mar', sales: 30, note: 'mar-note' }
  ];
  const used = new Set(['month', 'sales']);
  // the filtered view with Feb deleted and Mar moved first
  const editedView = JSON.stringify([
    { month: 'Mar', sales: 31 },
    { month: 'Jan', sales: 11 }
  ]);

  it('keeps hidden columns with their row across delete/reorder edits', () => {
    expect(parseFullData(editedView, fullData, used, 'month')).toEqual({ full: [
      { month: 'Mar', sales: 31, note: 'mar-note' },
      { month: 'Jan', sales: 11, note: 'jan-note' }
    ] });
  });

  it('falls back to index matching without a category property', () => {
    expect(parseFullData(editedView, fullData, used)).toEqual({ full: [
      { month: 'Mar', sales: 31, note: 'jan-note' },
      { month: 'Jan', sales: 11, note: 'feb-note' }
    ] });
  });
});
