import { describe, it, expect } from 'vitest';

import { validateRandomConfig } from '@mochart/demo-common';
import type { DataObject, DemoConfig } from '@mochart/demo-data';

import { makeGenericRandom } from '../src/content/locals';
import { randomFromCurated } from '../src/content/randomFromCurated';

function config(type: string): DemoConfig {
  return { categoryAxis: { property: 'c', type }, series: [{ property: 'v' }] } as unknown as DemoConfig;
}

function derive(type: string, rows: DataObject[]) {
  return randomFromCurated(config(type), rows, makeGenericRandom());
}

describe('randomFromCurated', () => {
  it('takes the category count, range, spacing and value range from the rows, with a margin on the range', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(c => ({ c, v: c * 10 - 50 }));
    const spec = derive('number', rows);

    expect(spec.category.count).toBe(12);
    // a sixth of eleven gaps rounds to two categories each side, clamped at zero for non-negative categories
    expect(spec.category.number).toEqual({ min: 0, max: 14, interval: 1 });
    expect(spec.series.number).toMatchObject({ min: -40, max: 70, round: true, limitToAxisConfig: false });
    expect(validateRandomConfig(spec)).toBe(true);
  });

  it('lets categories that go negative keep a pool below zero', () => {
    const spec = derive('number', [-4, -2, 0, 2, 4].map(c => ({ c, v: 1 })));
    expect(spec.category.number).toEqual({ min: -6, max: 6, interval: 2 });
  });

  it('holds string lengths at the schema limit, where the generator still spells whole numbers', () => {
    const rows = [
      { c: 'Four', v: 1 }, { c: 'A deliberately long series title that goes on', v: 2 },
      { c: 'Medium length', v: 3 }, { c: 'Another quite long title to truncate xx', v: 4 }
    ];
    const spec = derive('string', rows);
    expect(spec.category.string).toEqual({ minLength: 4, maxLength: 20 });
    expect(validateRandomConfig(spec)).toBe(true);
  });

  it('rounds a date interval to whole units of the spec', () => {
    const rows = [0, 250, 500, 750].map(ms => ({ c: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, ms)).toISOString(), v: ms }));
    const spec = derive('date', rows);
    expect(spec.category.date.interval).toBe(1);
    expect(spec.category.date.intervalUnit).toBe('second');
    expect(validateRandomConfig(spec)).toBe(true);
  });

  it('keeps a window of times inside their day and picks the largest whole unit', () => {
    const rows = [5, 6, 7, 8, 20, 21, 22, 23].map(h => ({ c: `2026-03-03T${String(h).padStart(2, '0')}:00:00Z`, v: h }));
    const spec = derive('date', rows);
    expect(spec.category.date.intervalUnit).toBe('hour');
    expect(spec.category.date.min >= '2026-03-03T00:00:00.000Z').toBe(true);
    expect(spec.category.date.max < '2026-03-04T00:00:00.000Z').toBe(true);
    expect(spec.category.count).toBeLessThanOrEqual(8);
  });

  it('never asks for more categories than the pool has slots', () => {
    const spec = derive('number', [1, 2, 3].map(c => ({ c, v: 1 })));
    const { min, max, interval } = spec.category.number;
    expect(spec.category.count).toBeLessThanOrEqual(Math.floor((max - min) / interval) + 1);
  });

  it('leaves the rows and the demo spec untouched', () => {
    const rows = [{ c: 1, v: 1 }, { c: 2, v: 2 }];
    const random = makeGenericRandom();
    const before = JSON.stringify({ rows, random });
    randomFromCurated(config('number'), rows, random);
    expect(JSON.stringify({ rows, random })).toBe(before);
  });
});
