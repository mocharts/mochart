import { describe, it, expect } from 'vitest';
import { enhanceConfig } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

import { generateDemoDataProvider } from '../src/chartTypeGenerators';

const config = enhanceConfig({
  version: '1.0.0',
  categoryAxis: { property: 'date', type: 'date', scale: 'ordinal', dateUTC: true },
  series: [{ property: 'a' }]
} as unknown as MochartInputConfig);

function randomConfig(weekdays: boolean) {
  return {
    category: {
      count: 20,
      order: { sort: true },
      missing: { probability: 0 },
      reuse: { globalFraction: 0.5, stepFraction: 0.5 },
      number: { min: 0, max: 100, interval: 1 },
      string: { minLength: 1, maxLength: 8 },
      date: { min: '2026-06-01', max: '2026-07-24', interval: 1, intervalUnit: 'day', weekdays }
    },
    series: {
      number: { min: 0, max: 100, round: true, limitToAxisConfig: false },
      missing: { probability: 0 },
      reuse: { global: false, step: false }
    }
  };
}

function weekdaysOf(weekdays: boolean, randomId: number): number[] {
  const provider = generateDemoDataProvider(undefined, config, randomConfig(weekdays) as never, randomId);
  return (provider.categoryValues ?? []).map(value => new Date(value as string | number | Date).getUTCDay());
}

describe('weekdays-only random date categories', () => {
  it('draws Monday to Friday days only, on every seed', () => {
    for (let randomId = 1; randomId <= 5; randomId++) {
      const days = weekdaysOf(true, randomId);
      expect(days).toHaveLength(20);
      expect(days.every(day => day >= 1 && day <= 5)).toBe(true);
    }
  });

  it('still draws weekend days without the member', () => {
    const days = [1, 2, 3, 4, 5].flatMap(randomId => weekdaysOf(false, randomId));
    expect(days.some(day => day === 0 || day === 6)).toBe(true);
  });

  it('throws instead of redrawing forever when the pool has fewer weekdays than categories', () => {
    const random = randomConfig(true);
    // ten weekdays for twenty categories
    random.category.date.max = '2026-06-12';
    expect(() => generateDemoDataProvider(undefined, config, random as never, 1)).toThrow('random category pool has no unused value left');
  });
});
