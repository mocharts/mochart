// the stacking accumulators treated only `undefined` as missing; `NaN >= 0` is false, so a NaN was *added* into the negative running total, sending every later series' stacked values and the axis domain NaN at that category
import { describe, it, expect } from 'vitest';
import { getChartData } from '../../src/data/ChartData';
import { makeConfig, ArrayOfObjectsDataProvider } from './fixtures';

type Row = Record<string, number>;

function stackedSetup(rows: Row[]) {
  const config = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    series: [
      { stack: 'SS0', property: 'a', renderer: 'bar' },
      { stack: 'SS0', property: 'b', renderer: 'bar' },
      { stack: 'SS0', property: 'c2', renderer: 'bar' }
    ],
    seriesStacks: [{ id: 'SS0' }]
  });
  return getChartData(config, new ArrayOfObjectsDataProvider(rows), {});
}

const CLEAN: Row[] = [
  { c: 0, a: 5, b: 4, c2: -2 },
  { c: 1, a: 1, b: 2, c2: -4 }
];

describe('non-finite values in a stack', () => {
  it('does not poison the later series in the stack', () => {
    // b is NaN at category 0; c2's own -2 must still stack and reach the axis domain
    const chartData = stackedSetup([
      { c: 0, a: 5, b: NaN, c2: -2 },
      { c: 1, a: 1, b: 2, c2: -4 }
    ]);
    const stacked = chartData.seriesData.raw.values.S2.stack;
    expect(stacked!.every((value) => value === undefined || Number.isFinite(value))).toBe(true);
    expect(stacked![0]).toBe(-2);

    // the axis domain carries margin fractions, so assert it is finite and reaches past -4
    const [min, max] = chartData.seriesData.raw.axisDomains.VA0;
    expect(Number.isFinite(min!) && Number.isFinite(max!)).toBe(true);
    expect(min!).toBeLessThanOrEqual(-4);
  });

  it('treats a non-finite value exactly as it treats a missing one', () => {
    const withNaN = stackedSetup([{ c: 0, a: 5, b: NaN, c2: -2 }, { c: 1, a: 1, b: 2, c2: -4 }]);
    const withHole = stackedSetup([{ c: 0, a: 5, c2: -2 }, { c: 1, a: 1, b: 2, c2: -4 }]);
    expect(withNaN.seriesData.raw.values.S1.stack).toEqual(withHole.seriesData.raw.values.S1.stack);
    expect(withNaN.seriesData.raw.values.S2.stack).toEqual(withHole.seriesData.raw.values.S2.stack);
    expect(withNaN.seriesData.raw.values.S2.prior).toEqual(withHole.seriesData.raw.values.S2.prior);
    expect(withNaN.seriesData.raw.axisDomains.VA0).toEqual(withHole.seriesData.raw.axisDomains.VA0);
  });

  it('excludes an infinite value from the accumulators', () => {
    const chartData = stackedSetup([
      { c: 0, a: 5, b: Infinity, c2: -2 },
      { c: 1, a: 1, b: 2, c2: -4 }
    ]);
    expect(chartData.seriesData.raw.values.S2.stack![0]).toBe(-2);
    const [min, max] = chartData.seriesData.raw.axisDomains.VA0;
    expect(Number.isFinite(min!) && Number.isFinite(max!)).toBe(true);
    expect(min!).toBeLessThanOrEqual(-4);
  });

  it('leaves an all-finite stack untouched', () => {
    const chartData = stackedSetup(CLEAN);
    expect(chartData.seriesData.raw.values.S1.stack).toEqual([9, 3]);
    expect(chartData.seriesData.raw.values.S2.stack).toEqual([-2, -4]);
    expect(chartData.seriesData.raw.domains.S2.stack).toEqual([-4, -2]);
  });
});
