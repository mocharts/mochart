import { describe, it, expect } from 'vitest';
import {
  getFocusData,
  getFocusDataWithDomainPercentages,
  getFocusDataWithCategoryChanges,
  getFocusDataWithMutations,
  getSeriesConfigsOrderedByFocus
} from '../../src/data/FocusData';
import { getChartData } from '../../src/data/ChartData';
import { makeConfig, ArrayOfObjectsDataProvider } from './fixtures';
import type { CategoryDeltaData } from '../../src/types/animation';

// A 3-category / 2-series chart on a single value axis. Series values are chosen
// so the focus-domain percentages are stable and easy to reason about.
function makeChart() {
  const config = makeConfig({
    categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
    series: [{ property: 'a' }, { property: 'b' }]
  });
  const provider = new ArrayOfObjectsDataProvider(
    [{ g: 0, a: 10, b: 5 }, { g: 1, a: 20, b: 15 }, { g: 2, a: 30, b: 25 }]);
  const chartData = getChartData(config, provider, {});
  return {
    config,
    chartData,
    s0: config.series[0].id, // 'S0'
    s1: config.series[1].id, // 'S1'
    axisId: config.valueAxes[0].id // 'VA0'
  };
}

describe('getFocusData', () => {
  it('leaves everything unfocused when nothing is selected', () => {
    const { config, chartData } = makeChart();
    const fd = getFocusData(config, chartData, -1, null, null);
    expect(fd.categoryFocusPercentages).toEqual([null, null, null]);
    expect(Object.values(fd.seriesFocusPercentages)).toEqual([null, null]);
    expect(Object.values(fd.valueAxisFocusPercentages)).toEqual([null]);
    expect(fd.categoryFocusDomainPercentages).toEqual([]);
  });

  it('treats an out-of-range category index as unfocused', () => {
    // a host's controlled index can outlive its data (e.g. rows removed in the
    // same update); it must degrade to no focus, not dim everything
    const { config, chartData } = makeChart();
    const fd = getFocusData(config, chartData, 10, null, null);
    expect(fd.focusedCategoryIndex).toBe(-1);
    expect(fd.categoryFocusPercentages).toEqual([null, null, null]);
    expect(fd.categoryFocusPercentages.length).toBe(3);
    expect(fd.categoryFocusDomainPercentages).toEqual([]);
  });

  it.each([-2, 1.5, NaN])('treats %s as unfocused, not as a slot', (index) => {
    // these used to pass the upper-bound-only guard and write a non-index key onto the
    // percentages array, dimming every category while focusing none
    const { config, chartData } = makeChart();
    const fd = getFocusData(config, chartData, index, null, null);
    expect(fd.focusedCategoryIndex).toBe(-1);
    expect(fd.categoryFocusPercentages).toEqual([null, null, null]);
    expect(Object.keys(fd.categoryFocusPercentages)).toEqual(['0', '1', '2']);
  });

  it('marks the focused category at +1 and the rest at -1', () => {
    const { config, chartData } = makeChart();
    const fd = getFocusData(config, chartData, 1, null, null);
    expect(fd.categoryFocusPercentages).toEqual([-1, 1, -1]);
    // category 1 (numeric value 1) sits at the middle of the [0,2] domain
    expect(fd.categoryFocusDomainPercentages).toEqual([0.5]);
  });

  it('marks the focused series at +1 and computes its domain percentages', () => {
    const { config, chartData, s0, s1, axisId } = makeChart();
    const fd = getFocusData(config, chartData, -1, null, s0);
    expect(fd.seriesFocusPercentages).toEqual({ [s0]: 1, [s1]: -1 });
    expect(fd.seriesFocusDomainPercentages).toEqual([0.7727272727272727, 0.045454545454545456]);
    expect(fd.valueAxisComputedFocusDomainPercentages![axisId]).toEqual(fd.seriesFocusDomainPercentages);
  });

  it('marks the focused value axis at +1 and spans the full axis domain', () => {
    const { config, chartData, axisId } = makeChart();
    const fd = getFocusData(config, chartData, -1, axisId, null);
    expect(fd.valueAxisFocusPercentages).toEqual({ [axisId]: 1 });
    expect(fd.valueAxisFocusDomainPercentages).toEqual([1, 0]);
  });

  it('reduces to a single value plus the axis base when a category and series are both focused', () => {
    const { config, chartData, s0 } = makeChart();
    const fd = getFocusData(config, chartData, 1, null, s0);
    // series S0 at category 1 is value 20; paired with the axis base 5, the smallest value on the axis
    expect(fd.seriesFocusDomainPercentages).toEqual([0.4090909090909091, 0.9545454545454546]);
  });

  it('skips domain percentages when computeDomainPercentages is false', () => {
    const { config, chartData } = makeChart();
    const fd = getFocusData(config, chartData, 1, null, null, false);
    expect(fd.categoryFocusDomainPercentages).toBeUndefined();
    expect(fd.seriesFocusDomainPercentages).toBeUndefined();
    // the discrete focus percentages are still computed
    expect(fd.categoryFocusPercentages).toEqual([-1, 1, -1]);
  });
});

// A candlestick-style chart: a hidden wick series following the body series
// via followSeries, plus an unrelated series, all on one axis. The wick spans
// low→high beyond the body's open→close so the merged focus extent is visible.
function makeFollowerChart() {
  const config = makeConfig({
    categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
    series: [
      { id: 'wick', property: 'high', rangeProperty: 'low', showInLegend: false, followSeries: 'body' },
      { id: 'body', property: 'close', rangeProperty: 'open' },
      { id: 'other', property: 'x' }
    ]
  });
  const provider = new ArrayOfObjectsDataProvider(
    [
      { g: 0, high: 30, low: 5, open: 10, close: 20, x: 50 },
      { g: 1, high: 40, low: 12, open: 22, close: 25, x: 60 }
    ]);
  const chartData = getChartData(config, provider, {});
  const axisId = config.valueAxes[0].id;
  const domain = chartData.seriesData.raw.axisDomains[axisId] as [number, number];
  // the chart is not inverted, so a value's domain percentage measures down from the max
  const pct = (value: number) => (domain[1] - value) / (domain[1] - domain[0]);
  return { config, chartData, pct };
}

describe('followSeries followers', () => {
  it('shares the leader series focus with its followers', () => {
    const { config, chartData } = makeFollowerChart();
    const fd = getFocusData(config, chartData, -1, null, 'body');
    expect(fd.seriesFocusPercentages).toEqual({ wick: 1, body: 1, other: -1 });
  });

  it('keeps followers with the leader in the focus ordering', () => {
    const { config, chartData } = makeFollowerChart();
    const fd = getFocusData(config, chartData, -1, null, 'body');
    const ordered = getSeriesConfigsOrderedByFocus(config, fd).map(s => s.id);
    // the defocused series first, then the follower under its leader
    expect(ordered).toEqual(['other', 'wick', 'body']);
  });

  it('spans the follower extent in the focused-category domain percentages', () => {
    const { config, chartData, pct } = makeFollowerChart();
    const fd = getFocusData(config, chartData, 0, null, 'body');
    // category 0 spans the wick's low 5 → high 30, wider than the body's 10 → 20
    expect(fd.seriesFocusDomainPercentages).toEqual([pct(30), pct(5)]);
  });

  it('spans the follower extent in the whole-series domain percentages', () => {
    const { config, chartData, pct } = makeFollowerChart();
    const fd = getFocusData(config, chartData, -1, null, 'body');
    // across both categories the candles span low 5 → high 40
    expect(fd.seriesFocusDomainPercentages).toEqual([pct(5), pct(40)]);
  });

  it('leaves single-series focus behavior unchanged', () => {
    const { config, chartData, pct } = makeFollowerChart();
    const fd = getFocusData(config, chartData, -1, null, 'other');
    expect(fd.seriesFocusPercentages).toEqual({ wick: -1, body: -1, other: 1 });
    expect(fd.seriesFocusDomainPercentages).toEqual([pct(50), pct(60)]);
  });
});

// Four bar series divisible two ways: stacks SA and SB, groups GA and GB, each
// holding two series and cutting across the other.
// Dropping a division lets one propagation branch run on its own.
function makeStackedGroupedChart(divisions: 'stacks' | 'groups' | 'both') {
  const withStacks = divisions !== 'groups';
  const withGroups = divisions !== 'stacks';
  const member = (id: string, stack: string, group: string) => ({
    id,
    property: id,
    ...(withStacks ? { stack } : {}),
    ...(withGroups ? { group } : {})
  });
  const config = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    seriesDefaults: { renderer: 'bar' },
    series: [
      member('p', 'SA', 'GA'),
      member('q', 'SB', 'GA'),
      member('r', 'SA', 'GB'),
      member('s', 'SB', 'GB')
    ],
    ...(withStacks ? { seriesStacks: [{ id: 'SA' }, { id: 'SB' }] } : {}),
    ...(withGroups ? { seriesGroups: [{ id: 'GA' }, { id: 'GB' }] } : {})
  });
  const provider = new ArrayOfObjectsDataProvider(
    [{ c: 0, p: 1, q: 2, r: 3, s: 4 }, { c: 1, p: 5, q: 6, r: 7, s: 8 }]);
  return { config, chartData: getChartData(config, provider, {}) };
}

describe('seriesStack and seriesGroup focus ordering', () => {
  it('raises the whole stack of the focused series', () => {
    const { config, chartData } = makeStackedGroupedChart('stacks');
    const fd = getFocusData(config, chartData, -1, null, 'p');
    const ordered = getSeriesConfigsOrderedByFocus(config, fd).map(s => s.id);
    // stack SA holds p and r, so r rises with p ahead of the whole of stack SB
    expect(ordered).toEqual(['q', 's', 'r', 'p']);
  });

  it('raises the whole group of the focused series', () => {
    const { config, chartData } = makeStackedGroupedChart('groups');
    const fd = getFocusData(config, chartData, -1, null, 'p');
    const ordered = getSeriesConfigsOrderedByFocus(config, fd).map(s => s.id);
    // group GA holds p and q, so q rises with p ahead of the whole of group GB
    expect(ordered).toEqual(['r', 's', 'q', 'p']);
  });

  it('raises both the group and the stack when the focused series is in each', () => {
    const { config, chartData } = makeStackedGroupedChart('both');
    const fd = getFocusData(config, chartData, -1, null, 'p');
    const ordered = getSeriesConfigsOrderedByFocus(config, fd).map(s => s.id);
    // group-mate q and stack-mate r both rise; only s, sharing neither, stays down
    expect(ordered).toEqual(['s', 'q', 'r', 'p']);
  });

  it('still styles the stack- and group-mates as defocused', () => {
    // unlike followSeries, group and stack membership only reorders: focusing one
    // segment highlights that segment alone and dims the rest of its stack
    const { config, chartData } = makeStackedGroupedChart('both');
    const fd = getFocusData(config, chartData, -1, null, 'p');
    expect(fd.seriesFocusPercentages).toEqual({ p: 1, q: -1, r: -1, s: -1 });
  });
});

describe('getFocusDataWithDomainPercentages', () => {
  it('adds domain percentages to a focus-data object that lacks them', () => {
    const { config, chartData } = makeChart();
    const bare = getFocusData(config, chartData, 1, null, null, false);
    expect(bare.categoryFocusDomainPercentages).toBeUndefined();
    const filled = getFocusDataWithDomainPercentages(bare, config, chartData);
    expect(filled.categoryFocusDomainPercentages).toEqual([0.5]);
    // discrete percentages are carried over unchanged
    expect(filled.categoryFocusPercentages).toEqual(bare.categoryFocusPercentages);
  });
});

describe('getFocusDataWithCategoryChanges', () => {
  const delta = (over: Record<string, unknown>, indices: Record<string, number[]>): CategoryDeltaData =>
    ({ values: { merged: ['x', 'y', 'z'], new: ['x', 'y', 'z'], ...over }, indices } as unknown as CategoryDeltaData);

  it('remaps the focused index into the merged array on addition', () => {
    const { config, chartData } = makeChart();
    const base = getFocusData(config, chartData, 1, null, null);
    const result = getFocusDataWithCategoryChanges(
      base, config, chartData,
      delta({}, { old: [1, 2], new: [0, 1, 2] }),
      true, true
    );
    expect(result.focusedCategoryIndex).toBe(2);
    expect(result.categoryFocusPercentages).toEqual([-1, -1, 1]);
  });

  it('clears the focus when the focused category is removed', () => {
    const { config, chartData } = makeChart();
    const base = getFocusData(config, chartData, 1, null, null);
    const result = getFocusDataWithCategoryChanges(
      base, config, chartData,
      delta({ merged: ['g0', 'g1', 'g2'], new: ['g0', 'g2'] }, { old: [0, 1, 2], new: [0, 2] }),
      false, true
    );
    expect(result.focusedCategoryIndex).toBe(-1);
    expect(result.categoryFocusPercentages).toEqual([-1, -1]);
  });

  it('initialises new percentages to null when nothing was focused', () => {
    const { config, chartData } = makeChart();
    const base = getFocusData(config, chartData, -1, null, null);
    const result = getFocusDataWithCategoryChanges(
      base, config, chartData,
      delta({}, { old: [1, 2], new: [0, 1, 2] }),
      true, true
    );
    expect(result.focusedCategoryIndex).toBe(-1);
    expect(result.categoryFocusPercentages).toEqual([null, null, null]);
  });
});

describe('getSeriesConfigsOrderedByFocus', () => {
  it('orders defocused series first and the focused series last', () => {
    const { config, chartData, s0, s1 } = makeChart();
    const fd = getFocusData(config, chartData, -1, null, s0);
    const ordered = getSeriesConfigsOrderedByFocus(config, fd).map(s => s.id);
    expect(ordered).toEqual([s1, s0]);
  });

  it('returns the configured order when nothing is focused', () => {
    const { config, chartData, s0, s1 } = makeChart();
    const fd = getFocusData(config, chartData, -1, null, null);
    const ordered = getSeriesConfigsOrderedByFocus(config, fd).map(s => s.id);
    expect(ordered).toEqual([s0, s1]);
  });
});

describe('getFocusDataWithMutations', () => {
  it('preserves the focus selection when merging identical focus data', () => {
    const { config, chartData } = makeChart();
    const fd = getFocusData(config, chartData, 1, null, null);
    const merged = getFocusDataWithMutations(fd, fd);
    expect(merged.focusedCategoryIndex).toBe(1);
    expect(merged.categoryFocusPercentages).toEqual([-1, 1, -1]);
  });
});
