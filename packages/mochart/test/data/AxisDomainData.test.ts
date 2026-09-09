import { describe, it, expect } from 'vitest';
import { getAxisDomain, getRenderAxisDomain, isExplicitCollapsedDomain } from '../../src/data/AxisDomainData';

// getAxisDomain(axisConfig, calculator): resolves an axis domain from explicit
// min/max, soft bounds, margins and offsets. calculator supplies the data-driven
// [min, max] used whenever a bound is "auto".
const cfg = (over: Record<string, unknown>) => ({
  type: 'number',
  min: 'auto',
  max: 'auto',
  minOffset: 0,
  maxOffset: 0,
  softMin: null,
  softMax: null,
  base: null,
  minMarginFraction: 0,
  maxMarginFraction: 0,
  minTickInterval: 0,
  tickLabel: { format: 'auto' },
  ...over
}) as never;

describe('getAxisDomain', () => {
  it('uses explicit min and max verbatim', () => {
    expect(getAxisDomain(cfg({ min: 5, max: 50 }), () => [0, 100])).toEqual([5, 50]);
  });

  it('uses the calculated domain when both bounds are auto', () => {
    expect(getAxisDomain(cfg({}), () => [10, 90])).toEqual([10, 90]);
  });

  it('applies an explicit min against an auto max', () => {
    expect(getAxisDomain(cfg({ min: 0 }), () => [10, 90])).toEqual([0, 90]);
  });

  it('applies an explicit max against an auto min', () => {
    expect(getAxisDomain(cfg({ max: 100 }), () => [10, 90])).toEqual([10, 100]);
  });

  it('clips an auto max up to an explicit min above all the data instead of inverting', () => {
    expect(getAxisDomain(cfg({ min: 0 }), () => [-8, -5])).toEqual([0, 0]);
  });

  it('clips an auto min down to an explicit max below all the data instead of inverting', () => {
    expect(getAxisDomain(cfg({ max: 10 }), () => [20, 30])).toEqual([10, 10]);
  });

  it('extends the min to a lower softMin', () => {
    expect(getAxisDomain(cfg({ softMin: -5 }), () => [10, 90])).toEqual([-5, 90]);
  });

  it('ignores a softMin that is above the calculated min', () => {
    expect(getAxisDomain(cfg({ softMin: 50 }), () => [10, 90])).toEqual([10, 90]);
  });

  it('extends the max to a higher softMax', () => {
    expect(getAxisDomain(cfg({ softMax: 200 }), () => [10, 90])).toEqual([10, 200]);
  });

  it('ignores a softMax that is below the calculated max', () => {
    expect(getAxisDomain(cfg({ softMax: 50 }), () => [10, 90])).toEqual([10, 90]);
  });

  it('adds margin percentages to an auto domain', () => {
    // extent 80, 10% each side => [10-8, 90+8]
    expect(getAxisDomain(cfg({ minMarginFraction: 0.1, maxMarginFraction: 0.1 }), () => [10, 90]))
      .toEqual([2, 98]);
  });

  it('does not add the min margin when the min equals the base', () => {
    // min (10) === base (10) => no bottom margin, top still grows
    expect(getAxisDomain(cfg({ base: 10, minMarginFraction: 0.1, maxMarginFraction: 0.1 }), () => [10, 90]))
      .toEqual([10, 98]);
  });

  it('applies min and max offsets to an auto domain', () => {
    expect(getAxisDomain(cfg({ minOffset: -5, maxOffset: 5 }), () => [10, 90])).toEqual([5, 95]);
  });

  // the semantic domain stays collapsed on purpose: only the render domain widens
  it('collapses to the softMin when the data domain is empty', () => {
    expect(getAxisDomain(cfg({ softMin: 50 }), () => [null, null])).toEqual([50, 50]);
  });

  it('collapses to the softMax when the data domain is empty', () => {
    expect(getAxisDomain(cfg({ softMax: 200 }), () => [null, null])).toEqual([200, 200]);
  });

  it('spans softMin to softMax when the data domain is empty', () => {
    expect(getAxisDomain(cfg({ softMin: -5, softMax: 200 }), () => [null, null])).toEqual([-5, 200]);
  });

  it('collapses to an explicit min when the data domain is empty and max is auto', () => {
    expect(getAxisDomain(cfg({ min: 5 }), () => [null, null])).toEqual([5, 5]);
  });

  it('keeps a domain collapsed by flat data', () => {
    expect(getAxisDomain(cfg({}), () => [10, 10])).toEqual([10, 10]);
  });

  it('keeps an explicit min === max verbatim, which config deliberately allows', () => {
    expect(getAxisDomain(cfg({ min: 5, max: 5 }), () => [5, 5])).toEqual([5, 5]);
  });

  it('stays fully null when the data domain is empty and no bounds are set', () => {
    expect(getAxisDomain(cfg({}), () => [null, null])).toEqual([null, null]);
  });

  it('creates Date bounds for a date axis', () => {
    const t0 = Date.UTC(2020, 0, 1);
    const t1 = Date.UTC(2021, 0, 1);
    const [min, max] = getAxisDomain(cfg({ type: 'date', min: t0, max: t1 }), () => [null, null]);
    expect(min).toBeInstanceOf(Date);
    expect((min as Date).getTime()).toBe(t0);
    expect((max as Date).getTime()).toBe(t1);
  });

  it('offsets a date axis by milliseconds', () => {
    const t0 = Date.UTC(2020, 0, 1);
    const day = 24 * 60 * 60 * 1000;
    const [min] = getAxisDomain(cfg({ type: 'date', minOffset: -day }), () => [new Date(t0), new Date(t0 + day)]);
    expect((min as Date).getTime()).toBe(t0 - day);
  });
});

// getRenderAxisDomain: the domain scales/ticks are built from. A collapsed domain
// draws every value on the midline, so it widens — relative to the value, then
// nice()d — while the semantic domain above stays exact for bounds consumers.
describe('getRenderAxisDomain', () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  it('returns the same array when the domain has an extent', () => {
    const domain: [number, number] = [3, 9];
    expect(getRenderAxisDomain(cfg({}), domain)).toBe(domain);
  });

  it('returns the same array when the domain is null', () => {
    const domain: [null, null] = [null, null];
    expect(getRenderAxisDomain(cfg({}), domain)).toBe(domain);
  });

  it('widens a collapsed domain by 5% of the value on each side', () => {
    const [lo, hi] = getRenderAxisDomain(cfg({}), [10, 10]) as [number, number];
    expect(lo).toBeCloseTo(9.5, 10);
    expect(hi).toBeCloseTo(10.5, 10);
  });

  it('scales the widening with the magnitude, so tick labels stay distinguishable', () => {
    expect(getRenderAxisDomain(cfg({}), [1000000, 1000000])).toEqual([950000, 1050000]);
  });

  it('widens a negative value symmetrically', () => {
    const [lo, hi] = getRenderAxisDomain(cfg({}), [-10, -10]) as [number, number];
    expect(lo).toBeCloseTo(-10.5, 10);
    expect(hi).toBeCloseTo(-9.5, 10);
  });

  it('widens zero upward, so a zero baseline stays on the axis', () => {
    expect(getRenderAxisDomain(cfg({}), [0, 0])).toEqual([0, 1]);
  });

  it('widens a collapsed date domain by one day on each side by default', () => {
    const t = Date.UTC(2020, 0, 1);
    expect(getRenderAxisDomain(cfg({ type: 'date' }), [new Date(t), new Date(t)]))
      .toEqual([new Date(t - DAY), new Date(t + DAY)]);
  });

  it('uses minTickInterval as the date half-width when set', () => {
    const t = Date.UTC(2020, 0, 1);
    expect(getRenderAxisDomain(cfg({ type: 'date', minTickInterval: HOUR }), [new Date(t), new Date(t)]))
      .toEqual([new Date(t - HOUR), new Date(t + HOUR)]);
  });

  it('derives the date half-width from the finest tickLabelFormat directive', () => {
    const t = Date.UTC(2020, 0, 1);
    const minute = 60 * 1000;
    expect(getRenderAxisDomain(cfg({ type: 'date', tickLabel: { format: '%H:%M' } }), [new Date(t), new Date(t)]))
      .toEqual([new Date(t - minute), new Date(t + minute)]);
    expect(getRenderAxisDomain(cfg({ type: 'date', tickLabel: { format: '%Y-%m-%d' } }), [new Date(t), new Date(t)]))
      .toEqual([new Date(t - DAY), new Date(t + DAY)]);
    expect(getRenderAxisDomain(cfg({ type: 'date', tickLabel: { format: '%Y' } }), [new Date(t), new Date(t)]))
      .toEqual([new Date(t - 365 * DAY), new Date(t + 365 * DAY)]);
  });
});

describe('isExplicitCollapsedDomain', () => {
  it('is true only when both bounds are explicit and the domain is collapsed', () => {
    expect(isExplicitCollapsedDomain(cfg({ min: 5, max: 5 }), [5, 5])).toBe(true);
    expect(isExplicitCollapsedDomain(cfg({ min: 5 }), [5, 5])).toBe(false);
    expect(isExplicitCollapsedDomain(cfg({}), [5, 5])).toBe(false);
    expect(isExplicitCollapsedDomain(cfg({ min: 5, max: 50 }), [5, 50])).toBe(false);
    expect(isExplicitCollapsedDomain(cfg({ min: 5, max: 5 }), [null, null])).toBe(false);
  });
});
