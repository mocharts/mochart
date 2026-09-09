// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';

import { getGallerySections, demoModeIcons, switchableDemoModes } from '../src/gallery';
import { getChartDataCount, getDataProvidersForDataCount } from '../src/multiCharts';
import { createErrorDataProvider } from '../src/errorDataProvider';
import { demoText } from '../src/demoText';
import type { DemoData } from '../src/types';

const demoData = {
  demoIds: ['first', 'second'],
  testDemoIds: ['probe'],
  demoObjectMap: {
    first: { id: 'first', title: 'First', description: 'One', notes: 'The long story', config: {}, data: [], random: {} },
    second: { id: 'second', title: 'Second', config: {}, data: [], random: {} },
    probe: { id: 'probe', title: 'Probe', description: 'Coverage', config: {}, data: [], random: {} }
  }
} as unknown as DemoData;

describe('the gallery model', () => {
  it('lists the demos, the test demos, and the showcase pages in their own sections', () => {
    const sections = getGallerySections(demoData);
    expect(sections.map(section => section.key)).toEqual(['demos', 'test', 'showcases']);

    const [demos, test, showcases] = sections;
    expect(demos.items.map(item => item.kind === 'demo' && item.id)).toEqual(['first', 'second']);
    expect(demos.collapsed).toBe(false);
    // the test demos are deliberately invalid, so the section opens closed and says why
    expect(test.items.map(item => item.kind === 'demo' && item.id)).toEqual(['probe']);
    expect(test.collapsed).toBe(true);
    expect(test.hint).toBe(demoText.gallery.testSectionHint);
    expect(showcases.items.map(item => item.kind === 'page' && item.mode)).toEqual(['transition', 'rotation', 'sparkline']);
  });

  it('carries each demo title, description, and notes onto its item', () => {
    const [demos] = getGallerySections(demoData);
    expect(demos.items[0]).toEqual({ kind: 'demo', id: 'first', title: 'First', description: 'One', notes: 'The long story' });
    // a demo with neither reads as an item with neither, rather than empty strings
    expect(demos.items[1]).toEqual({ kind: 'demo', id: 'second', title: 'Second', description: undefined, notes: undefined });
  });

  it('gives every switchable mode an icon', () => {
    expect(Object.keys(demoModeIcons).sort()).toEqual([...switchableDemoModes].sort());
  });
});

describe('multi-mode data counts', () => {
  const data = [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }];

  it('steps each chart back one row, wrapping to the full set instead of an empty one', () => {
    expect([0, 1, 2, 3].map(index => getChartDataCount(data, 4, index))).toEqual([4, 3, 2, 1]);
    // index 4 would land on 0 rows; the wrap keeps a chart's worth of data
    expect(getChartDataCount(data, 4, 4)).toBe(4);
    expect(getChartDataCount(data, 2, 3)).toBe(3);
  });

  it('builds one provider per chart, each over its own leading slice', () => {
    const providers = getDataProvidersForDataCount(data, 3, 4);
    expect(providers).toHaveLength(3);
    expect(providers.map(provider => provider.getPropertyValues('v'))).toEqual([[1, 2, 3, 4], [1, 2, 3], [1, 2]]);
  });
});

describe('the error data provider', () => {
  it('reports its error and no values, which is what renders the chart error state', () => {
    const provider = createErrorDataProvider('no data');
    expect(provider.getError?.()).toBe('no data');
    expect(provider.getPropertyValues('anything')).toBeUndefined();
    expect(createErrorDataProvider(true).getError?.()).toBe(true);
  });
});
