// Log axis domains: margins and collapsed domains in logs, values at or below 0 left out, slots measured in logs, and the category data error.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAxisDomain, getRenderAxisDomain } from '../../src/data/AxisDomainData';
import { getDomainForValues } from '../../src/data/DomainData';
import { getCategoryValueInterval } from '../../src/data/CategoryData';
import { getChartData } from '../../src/data/ChartData';
import { getDataErrors } from '../../src/data/DataValidator';
import { isDomainTranslation } from '../../src/animation/DomainAnimationData';
import { makeConfig, ArrayOfObjectsDataProvider } from './fixtures';

const logAxis = (over: Record<string, unknown> = {}) => ({
  type: 'number',
  scale: 'log',
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('log axis domains', () => {
  it('takes margins as a share of the extent of the logs', () => {
    const [min, max] = getAxisDomain(logAxis({ minMarginFraction: 0.1, maxMarginFraction: 0.1 }), () => [1, 1000]) as [number, number];
    expect(Math.log10(min)).toBeCloseTo(-0.3);
    expect(Math.log10(max)).toBeCloseTo(3.3);
  });

  it('keeps an end at the base free of its margin', () => {
    const [min] = getAxisDomain(logAxis({ base: 1, minMarginFraction: 0.1 }), () => [1, 1000]) as [number, number];
    expect(min).toBe(1);
  });

  it('widens a collapsed domain by a ratio, not by niced steps', () => {
    expect(getRenderAxisDomain(logAxis(), [50, 50])).toEqual([50 / 1.05, 50 * 1.05]);
  });

  it('leaves values at or below 0 out of a positive-only domain', () => {
    expect(getDomainForValues([-3, 0, 5, 20, NaN], true)).toEqual([5, 20]);
    expect(getDomainForValues([-3, 0], true)).toEqual([null, null]);
    expect(getDomainForValues([-3, 0, 5], false)).toEqual([-3, 5]);
  });

  it('leaves series values at or below 0 out of a log value axis domain, but keeps them in the data', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = makeConfig({ categoryAxis: { property: 'c' }, valueAxes: [{ id: 'A', scale: 'log', minMarginFraction: 0, maxMarginFraction: 0 }],
      series: [{ id: 'S', property: 'v', errorLowProperty: 'lo', errorHighProperty: 'hi' }] });
    const data = new ArrayOfObjectsDataProvider([{ c: 'a', v: 0, lo: -1, hi: 4 }, { c: 'b', v: 10, lo: 2, hi: 30 }, { c: 'c', v: -4, lo: -5, hi: -2 }]);
    const { seriesData } = getChartData(config, data, {});
    expect(seriesData.raw.axisDomains['A']).toEqual([2, 30]);
    expect(Array.from(seriesData.raw.values['S']!.plain!)).toEqual([0, 10, -4]);
  });
});

describe('log axis warning', () => {
  it('names the series once, and again only after its values clear', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = makeConfig({ categoryAxis: { property: 'c' }, valueAxes: [{ id: 'A', scale: 'log' }], series: [{ id: 'S', property: 'v' }] });
    const withZero = new ArrayOfObjectsDataProvider([{ c: 'a', v: 0 }, { c: 'b', v: 10 }]);
    getChartData(config, withZero, {});
    getChartData(config, withZero, {});
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toBe('mochart value axis A is a log axis, so it draws series values at or below 0 as missing, in series: S');
    getChartData(config, new ArrayOfObjectsDataProvider([{ c: 'a', v: 1 }, { c: 'b', v: 10 }]), {});
    getChartData(config, withZero, {});
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not warn for a range with one end above 0, which is still drawn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = makeConfig({ categoryAxis: { property: 'c' }, valueAxes: [{ id: 'A', scale: 'log' }], series: [{ id: 'S', property: 'v', rangeProperty: 'r' }] });
    getChartData(config, new ArrayOfObjectsDataProvider([{ c: 'a', v: 0, r: 5 }, { c: 'b', v: 10, r: 20 }]), {});
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('log category axis', () => {
  const logCategoryConfig = () => makeConfig({ categoryAxis: { property: 'x', type: 'number', scale: 'log' }, series: [{ property: 'v' }] });

  it('measures the smallest gap between neighbouring category values in logs', () => {
    expect(getCategoryValueInterval(logCategoryConfig().categoryAxis, [1, 10, 100, 1000])).toBeCloseTo(1);
    expect(getCategoryValueInterval(logCategoryConfig().categoryAxis, [100, 200, 400])).toBeCloseTo(Math.log10(2));
  });

  it('reports category values at or below 0 as a data error', () => {
    const data = new ArrayOfObjectsDataProvider([{ x: 0, v: 1 }, { x: 10, v: 2 }, { x: -1, v: 3 }]);
    expect(getDataErrors(logCategoryConfig(), data)).toContain('category values must be greater than 0 on a log category scale, values at or below 0: 0, -1');
  });

  it('reports out-of-order category values for line series, as on a linear scale', () => {
    const data = new ArrayOfObjectsDataProvider([{ x: 1, v: 1 }, { x: 10, v: 2 }, { x: 5, v: 3 }]);
    expect(getDataErrors(logCategoryConfig(), data)[0]).toMatch(/^category values must be in order on a log category scale/);
  });
});

describe('log domain translation', () => {
  it('reads a one-decade slide as a translation, which linear extents would not', () => {
    expect(isDomainTranslation([1, 10], [10, 100])).toBe(false);
    expect(isDomainTranslation([1, 10], [10, 100], true)).toBe(true);
  });
});
