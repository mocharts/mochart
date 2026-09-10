import { describe, it, expect } from 'vitest';

import { validateRandomConfig } from '@mochart/demo-common';
import type { RandomConfig, RangeRandomConfig } from '@mochart/demo-data';

import { makeGenericRandom } from '../src/content/locals';
import { randomForSeed } from '../src/content/randomForSeed';
import type { WalkBounds } from '../src/content/types';

function slots(range: number, interval: number): number {
  return Math.floor(range / interval) + 1;
}

function walked(spec: RandomConfig, seed: number, bounds?: WalkBounds): RandomConfig {
  return randomForSeed(spec, seed, bounds) as RandomConfig;
}

describe('randomForSeed', () => {
  const spec = makeGenericRandom({ categoryCount: 9, categoryNumber: { min: 3, max: 22, interval: 1 } });

  it('is a pure function of the spec and the seed', () => {
    expect(walked(spec, 7)).toEqual(walked(spec, 7));
    expect(walked(spec, 7)).not.toEqual(walked(spec, 8));
    const before = JSON.stringify(spec);
    walked(spec, 12);
    expect(JSON.stringify(spec)).toBe(before);
  });

  it('keeps seed 0 on the curated window and drops the global category share', () => {
    const result = walked(spec, 0);
    expect(result.category.number).toEqual({ min: 3, max: 22, interval: 1 });
    expect(result.category.reuse).toEqual({ globalFraction: 0, stepFraction: spec.category.reuse.stepFraction });
  });

  it('moves the window as the seed climbs', () => {
    const windows = new Set([1, 2, 3, 4, 5].map(seed => walked(spec, seed).category.number.min));
    expect(windows.size).toBeGreaterThan(1);
  });

  it('keeps room for every category on every seed, whole and fractional intervals alike', () => {
    const specs = [
      spec,
      makeGenericRandom({ categoryCount: 20, categoryNumber: { min: 99.18, max: 127.68, interval: 1.5 } }),
      makeGenericRandom({ categoryCount: 8, categoryNumber: { min: 0.1, max: 4.65, interval: 0.65 } })
    ];
    for (const candidate of specs) {
      for (let seed = 0; seed <= 200; seed++) {
        const { min, max, interval } = walked(candidate, seed).category.number;
        expect(slots(max - min, interval), `seed ${seed}`).toBeGreaterThanOrEqual(candidate.category.count);
        expect(validateRandomConfig(walked(candidate, seed))).toBe(true);
      }
    }
  });

  it('holds a bounded window inside its bounds and pins one as wide as them', () => {
    for (let seed = 0; seed <= 300; seed++) {
      const { min, max, interval } = walked(spec, seed, { min: 1, max: 24 }).category.number;
      expect(min, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(max, `seed ${seed}`).toBeLessThanOrEqual(24);
      expect(interval).toBe(1);
    }
    const pinned = makeGenericRandom({ categoryCount: 6, categoryNumber: { min: 1, max: 6, interval: 1 } });
    for (let seed = 0; seed <= 50; seed++) {
      expect(walked(pinned, seed, { min: 1, max: 6 }).category.number).toEqual({ min: 1, max: 6, interval: 1 });
    }
  });

  it('keeps a date window\'s span and interval across days, and inside the day for times', () => {
    const days = makeGenericRandom({ categoryCount: 14, categoryDate: { min: '2026-03-03T00:00:00Z', max: '2026-03-07T12:00:00Z', interval: 15, intervalUnit: 'minute' } });
    const curatedSpan = Date.parse('2026-03-07T12:00:00Z') - Date.parse('2026-03-03T00:00:00Z');
    for (let seed = 0; seed <= 30; seed++) {
      const { min, max, interval, intervalUnit } = walked(days, seed).category.date;
      expect(Date.parse(max) - Date.parse(min)).toBe(curatedSpan);
      expect([interval, intervalUnit]).toEqual([15, 'minute']);
    }
    const times = makeGenericRandom({ categoryCount: 10, categoryDate: { min: '2026-03-03T09:00:00Z', max: '2026-03-03T11:15:00Z', interval: 15, intervalUnit: 'minute' } });
    for (let seed = 0; seed <= 30; seed++) {
      const { min, max, interval } = walked(times, seed).category.date;
      expect(min >= '2026-03-03T00:00:00.000Z').toBe(true);
      expect(max < '2026-03-04T00:00:00.000Z').toBe(true);
      expect(slots(Date.parse(max) - Date.parse(min), interval * 60000)).toBeGreaterThanOrEqual(10);
    }
  });

  it('passes a chart-type generator spec through untouched', () => {
    const range: RangeRandomConfig = { categories: { min: 24, max: 30 }, value: { min: 4, max: 16, volatility: 0.3 }, width: { min: 1, max: 4 }, reuse: { step: true } };
    expect(randomForSeed(range, 5)).toBe(range);
  });
});
