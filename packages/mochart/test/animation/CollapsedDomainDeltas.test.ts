// getSeriesValuesDeltas weights value changes by valueAxisExtent; a collapsed (0) or inverted (negative) extent used to zero every delta and skip the animation entirely
import { describe, it, expect } from 'vitest';
import { getChartAnimationData } from '../../src/animation/ChartAnimationData';
import { getChartData } from '../../src/data/ChartData';
import { makeConfig, ArrayOfObjectsDataProvider } from '../data/fixtures';

type Row = Record<string, number>;

function deltaPercentageFor(valueAxis: Record<string, unknown>, from: Row[], to: Row[]) {
  const config = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    valueAxes: [valueAxis],
    series: [{ property: 'v', renderer: 'bar' }]
  });
  const prev = getChartData(config, new ArrayOfObjectsDataProvider(from), {});
  const next = getChartData(config, new ArrayOfObjectsDataProvider(to), {});
  return getChartAnimationData(config, prev, next).valueChangeData.deltaPercentage;
}

describe('value deltas on a degenerate value-axis domain', () => {
  it('animates when every value is equal (collapsed domain)', () => {
    const percentage = deltaPercentageFor({},
      [{ c: 0, v: 7 }, { c: 1, v: 7 }],
      [{ c: 0, v: 9 }, { c: 1, v: 9 }]);
    expect(percentage).toBeGreaterThan(0);
  });

  it('animates on a single data point', () => {
    const percentage = deltaPercentageFor({}, [{ c: 0, v: 7 }], [{ c: 0, v: 9 }]);
    expect(percentage).toBeGreaterThan(0);
  });

  it('animates when an explicit min sits above the data (inverted domain)', () => {
    const percentage = deltaPercentageFor({ min: 100 },
      [{ c: 0, v: 10 }, { c: 1, v: 12 }],
      [{ c: 0, v: 20 }, { c: 1, v: 22 }]);
    expect(percentage).toBeGreaterThan(0);
  });

  it('still reports no change when the values are identical', () => {
    const percentage = deltaPercentageFor({},
      [{ c: 0, v: 7 }, { c: 1, v: 7 }],
      [{ c: 0, v: 7 }, { c: 1, v: 7 }]);
    expect(percentage).toBe(0);
  });

  it('leaves an ordinary domain weighting untouched', () => {
    // extent 20 (0..20 before margins), delta 10 -> well under 1 and unchanged by the fix
    const percentage = deltaPercentageFor({ min: 0, max: 20 },
      [{ c: 0, v: 0 }, { c: 1, v: 20 }],
      [{ c: 0, v: 10 }, { c: 1, v: 20 }]);
    expect(percentage).toBeGreaterThan(0);
    expect(percentage).toBeLessThanOrEqual(1);
  });
});

// The pacing weight is movement as a fraction of the axis extent; clipping bounds on-screen travel
// to one extent, and an uncapped weight multiplied the configured duration by the overshoot.
describe('values outside an explicit axis range', () => {
  it('caps the weight at one axis extent', () => {
    const percentage = deltaPercentageFor({ min: 0, max: 200 },
      [{ c: 0, v: 10 }, { c: 1, v: 12 }],
      [{ c: 0, v: 10 }, { c: 1, v: 1408 }]);
    expect(percentage).toBe(1);
  });

  it('caps it however far outside the value lands', () => {
    const percentage = deltaPercentageFor({ min: 0, max: 200 },
      [{ c: 0, v: 10 }, { c: 1, v: 12 }],
      [{ c: 0, v: 10 }, { c: 1, v: 14080 }]);
    expect(percentage).toBe(1);
  });

  it('leaves a move inside the range proportional', () => {
    const percentage = deltaPercentageFor({ min: 0, max: 200 },
      [{ c: 0, v: 10 }, { c: 1, v: 10 }],
      [{ c: 0, v: 10 }, { c: 1, v: 60 }]);
    expect(percentage).toBeCloseTo(0.25);
  });
});
