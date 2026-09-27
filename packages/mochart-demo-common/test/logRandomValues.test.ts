import { describe, it, expect } from 'vitest';
import { enhanceConfig } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

import { generateDemoDataProvider } from '../src/chartTypeGenerators';

function randomConfig(categoryNumber: { min: number; max: number }, seriesNumber: { min: number; max: number }) {
  return {
    category: {
      count: 200,
      order: { sort: true },
      missing: { probability: 0 },
      reuse: { globalFraction: 0, stepFraction: 0 },
      number: { ...categoryNumber, interval: 1 },
      string: { minLength: 1, maxLength: 8 },
      date: { min: '2026-06-01', max: '2026-07-24', interval: 1, intervalUnit: 'day' }
    },
    series: {
      number: { ...seriesNumber, round: true, limitToAxisConfig: false },
      missing: { probability: 0 },
      reuse: { global: false, step: false }
    }
  };
}

/** The share of the values below the geometric middle of min and max, which a log axis puts halfway along. */
function shareBelowMiddle(values: number[], min: number, max: number): number {
  return values.filter(value => value < Math.sqrt(min * max)).length / values.length;
}

describe('random values on log axes', () => {
  it('draws the values a log axis places evenly across its powers of 10', () => {
    const config = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'x', type: 'number', scale: 'log' },
      valueAxes: [{ scale: 'log' }],
      series: [{ property: 'v' }]
    } as unknown as MochartInputConfig);
    const provider = generateDemoDataProvider(undefined, config, randomConfig({ min: 10, max: 100000 }, { min: 1, max: 1000000 }) as never, 3);
    const categories = provider.categoryValues as number[];
    const values = provider.seriesValues!['v'] as number[];
    expect(Math.min(...categories)).toBeGreaterThanOrEqual(10);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1);
    expect(shareBelowMiddle(categories, 10, 100000)).toBeCloseTo(0.5, 1);
    expect(shareBelowMiddle(values, 1, 1000000)).toBeCloseTo(0.5, 1);
  });

  it('draws values above 0 from a random min at or below 0', () => {
    const config = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'c' },
      valueAxes: [{ scale: 'log' }],
      series: [{ property: 'v' }]
    } as unknown as MochartInputConfig);
    const provider = generateDemoDataProvider(undefined, config, randomConfig({ min: 0, max: 100 }, { min: -100, max: 1000 }) as never, 3);
    expect(Math.min(...(provider.seriesValues!['v'] as number[]))).toBeGreaterThan(0);
  });
});

describe('random log draws at the edges of their config', () => {
  const logConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'x', type: 'number', scale: 'log' },
    valueAxes: [{ scale: 'log' }],
    series: [{ property: 'v' }]
  } as unknown as MochartInputConfig);

  it('draws finite values above 0 when a max is at or below 0, rather than NaN', () => {
    const provider = generateDemoDataProvider(undefined, logConfig, randomConfig({ min: -10, max: 0 }, { min: -5, max: -1 }) as never, 3);
    for (const value of [...provider.categoryValues as number[], ...provider.seriesValues!['v'] as number[]]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('draws more significant digits when 3 give too few distinct category values, rather than throwing', () => {
    const provider = generateDemoDataProvider(undefined, logConfig, randomConfig({ min: 1, max: 2 }, { min: 1, max: 1000 }) as never, 3);
    const categories = provider.categoryValues as number[];
    expect(categories).toHaveLength(200);
    expect(new Set(categories).size).toBe(200);
    expect(Math.min(...categories)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...categories)).toBeLessThanOrEqual(2);
  });
});
