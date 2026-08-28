import { describe, it, expect } from 'vitest';
import {
  isDataProviderValid,
  getChartData,
  getChartDataWithCategoryData,
  getChartDataWithSeriesData,
  getChartDataWithData,
  getCategorySeriesValueObject,
  getChartDataCategoryCount
} from '../../src/data/ChartData';
import { makeConfig, ArrayOfObjectsDataProvider } from './fixtures';
import type { DataProvider } from '../../src/types/data';

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

function makeChartData() {
  const config = makeConfig({
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }]
  });
  const provider = new ArrayOfObjectsDataProvider(rows);
  return { config, chartData: getChartData(config, provider, {}) };
}

describe('isDataProviderValid', () => {
  it('is false for null or undefined', () => {
    expect(isDataProviderValid(null)).toBe(false);
    expect(isDataProviderValid(undefined)).toBe(false);
  });

  it('is true for a provider with no getError', () => {
    const provider = new ArrayOfObjectsDataProvider(rows);
    expect(isDataProviderValid(provider)).toBe(true);
  });

  it('is true for a provider whose getError returns null or undefined', () => {
    const nullProvider = { getPropertyValues: () => [], getError: () => null } as unknown as DataProvider;
    expect(isDataProviderValid(nullProvider)).toBe(true);
    const undefinedProvider = { getPropertyValues: () => [], getError: () => undefined } as unknown as DataProvider;
    expect(isDataProviderValid(undefinedProvider)).toBe(true);
  });

  it('is false for a provider whose getError returns a message', () => {
    const provider = { getPropertyValues: () => [], getError: () => 'boom' } as unknown as DataProvider;
    expect(isDataProviderValid(provider)).toBe(false);
  });

  // Regression: a provider missing the required accessor used to pass here and throw inside getChartData
  it('is false for a provider missing the required accessor', () => {
    // an error-free provider that only reports state is not a provider
    const stateOnly = { getError: () => null, getLoading: () => false } as unknown as DataProvider;
    expect(isDataProviderValid(stateOnly)).toBe(false);
  });

  it('is true for a provider with the one accessor and none of the optional members', () => {
    const bare = { getPropertyValues: () => [] } as unknown as DataProvider;
    expect(isDataProviderValid(bare)).toBe(true);
  });

  // Regression: truthiness let '' and 0 through, though the error prop honors them
  it('is false for a provider whose getError returns a falsy non-null error', () => {
    const emptyStringProvider = { getCategoryValues: () => [], getSeriesValue: () => 0, getError: () => '' } as unknown as DataProvider;
    expect(isDataProviderValid(emptyStringProvider)).toBe(false);
    const zeroProvider = { getCategoryValues: () => [], getSeriesValue: () => 0, getError: () => 0 } as unknown as DataProvider;
    expect(isDataProviderValid(zeroProvider)).toBe(false);
  });
});

describe('getChartData', () => {
  it('builds category and series data from a provider', () => {
    const { chartData } = makeChartData();
    expect(chartData.categoryData.values.key).toEqual(['Jan', 'Feb', 'Mar']);
    expect(chartData).toHaveProperty('seriesData');
  });
});

describe('getChartDataWith* merge helpers', () => {
  it('replaces only categoryData and returns a new object', () => {
    const { chartData } = makeChartData();
    const other = makeChartData().chartData;
    const merged = getChartDataWithCategoryData(chartData, other.categoryData);
    expect(merged).not.toBe(chartData);
    expect(merged.categoryData).toBe(other.categoryData);
    expect(merged.seriesData).toBe(chartData.seriesData);
  });

  it('replaces only seriesData and returns a new object', () => {
    const { chartData } = makeChartData();
    const other = makeChartData().chartData;
    const merged = getChartDataWithSeriesData(chartData, other.seriesData);
    expect(merged).not.toBe(chartData);
    expect(merged.seriesData).toBe(other.seriesData);
    expect(merged.categoryData).toBe(chartData.categoryData);
  });

  it('replaces both category and series data', () => {
    const { chartData } = makeChartData();
    const other = makeChartData().chartData;
    const merged = getChartDataWithData(chartData, other.categoryData, other.seriesData);
    expect(merged.categoryData).toBe(other.categoryData);
    expect(merged.seriesData).toBe(other.seriesData);
  });
});

describe('getChartDataCategoryCount', () => {
  it('returns 0 for null chart data', () => {
    expect(getChartDataCategoryCount(null)).toBe(0);
  });

  it('returns the number of raw category values', () => {
    const { chartData } = makeChartData();
    expect(getChartDataCategoryCount(chartData)).toBe(3);
  });
});

describe('getCategorySeriesValueObject', () => {
  it('exposes the category and series values at an index', () => {
    const { chartData } = makeChartData();
    const obj = getCategorySeriesValueObject(chartData, 1);
    expect(obj.category.values.key).toBe('Feb');
    expect(obj).toHaveProperty('series');
  });
});

describe('missing series values', () => {
  function makeHoledChartData() {
    const config = makeConfig({
      categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
      series: [{ property: 'a' }]
    });
    // category 1 has no value for property "a"
    const provider = new ArrayOfObjectsDataProvider([{ g: 0, a: 10 }, { g: 1 }, { g: 2, a: 30 }]);
    const seriesId = config.series[0].id;
    return { chartData: getChartData(config, provider, {}), seriesId };
  }

  it('carries a missing value through as NaN (not null, 0 or a hole)', () => {
    const { chartData, seriesId } = makeHoledChartData();
    const plain = chartData.seriesData.raw.values[seriesId].plain!;
    expect(plain).toEqual([10, NaN, 30]);
    // the slot exists and holds the missing value
    expect(1 in plain).toBe(true);
    expect(plain[1]).toBeNaN();
  });

  it('hands the missing value outward as undefined in the per-category value object', () => {
    // tooltips, labels and callbacks read this object; NaN stays internal to the value arrays
    const { chartData, seriesId } = makeHoledChartData();
    expect(getCategorySeriesValueObject(chartData, 1).series.raw.values[seriesId].plain).toBeUndefined();
    expect(getCategorySeriesValueObject(chartData, 0).series.raw.values[seriesId].plain).toBe(10);
  });

  it('excludes the missing value from the series domain', () => {
    const { chartData, seriesId } = makeHoledChartData();
    expect(chartData.seriesData.raw.domains[seriesId].plain).toEqual([10, 30]);
  });

  it('carries a missing range value as NaN and excludes it from the range domain', () => {
    const config = makeConfig({
      categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
      series: [{ property: 'a', rangeProperty: 'hi' }]
    });
    // category 1 has no "hi" (range) value, but keeps its "a" (plain) value
    const provider = new ArrayOfObjectsDataProvider([{ g: 0, a: 10, hi: 15 }, { g: 1, a: 20 }, { g: 2, a: 30, hi: 35 }]);
    const seriesId = config.series[0].id;
    const chartData = getChartData(config, provider, {});
    expect(chartData.seriesData.raw.values[seriesId].plain).toEqual([10, 20, 30]);
    expect(chartData.seriesData.raw.values[seriesId].range).toEqual([15, NaN, 35]);
    expect(chartData.seriesData.raw.domains[seriesId].range).toEqual([15, 35]);
  });
});

// Regression: the filter map lookup went through Object.prototype, so a series
// with a prototype-member id counted as always-filtered (and __proto__ could never be).
describe('prototype-member series ids', () => {
  const protoRows = [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }];

  function makeProtoChartData(id: string, filteredSeriesMap: Record<string, unknown>) {
    const config = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ id, property: 'sales' }]
    });
    return getChartData(config, new ArrayOfObjectsDataProvider(protoRows), filteredSeriesMap);
  }

  it('does not treat a series with a prototype-member id as filtered', () => {
    const chartData = makeProtoChartData('constructor', {});
    expect(chartData.seriesData.filteredFlags['constructor']).toBe(false);
    expect(chartData.seriesData.filtered.values['constructor'].plain).toEqual([10, 20]);
  });

  it('filters a series whose id is __proto__', () => {
    const filterMap: Record<string, boolean> = Object.create(null);
    filterMap['__proto__'] = true;
    const chartData = makeProtoChartData('__proto__', filterMap);
    expect(chartData.seriesData.filteredFlags['__proto__']).toBe(true);
    expect(chartData.seriesData.filtered.values['__proto__'].plain).toBe(null);
  });
});
