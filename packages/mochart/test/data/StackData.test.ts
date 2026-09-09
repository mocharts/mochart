import { describe, it, expect } from 'vitest';
import { getStackData, getStackDataWithMutations } from '../../src/data/StackData';
import { getChartData } from '../../src/data/ChartData';
import { makeConfig, ArrayOfObjectsDataProvider } from './fixtures';

function stackedSetup(rows: Record<string, number>[]) {
  const config = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    series: [
      { stack: 'SS0', property: 'a', renderer: 'bar' },
      { stack: 'SS0', property: 'b', renderer: 'bar' }
    ],
    seriesStacks: [{ id: 'SS0' }]
  });
  const chartData = getChartData(config, new ArrayOfObjectsDataProvider(rows), {});
  return { config, chartData };
}

describe('getStackData', () => {
  it('records the outermost positive and negative series per category', () => {
    // category 0: both series positive -> S1 is the outer (last-stacked) positive
    // category 1: both series negative -> S1 is the outer negative
    const { config, chartData } = stackedSetup([
      { c: 0, a: 5, b: 3 },
      { c: 1, a: -2, b: -4 }
    ]);
    const stackData = getStackData(config, chartData);
    expect(stackData.outerPositiveSeriesIds).toEqual({ SS0: ['S1', undefined] });
    expect(stackData.outerNegativeSeriesIds).toEqual({ SS0: [undefined, 'S1'] });
  });

  // Regression: classifying by the cumulative stack value let a zero-value series above the visible top bar take the outer cap
  it('classifies by each series own contribution and leaves holes for absent signs', () => {
    // category 0: a=4 forms the visible top, b=0 adds nothing -> the outer positive is S0; no negatives.
    // category 1: everything is zero -> neither sign contributes, all holes.
    const { config, chartData } = stackedSetup([
      { c: 0, a: 4, b: 0 },
      { c: 1, a: 0, b: 0 }
    ]);
    const stackData = getStackData(config, chartData);
    expect(stackData.outerPositiveSeriesIds.SS0).toEqual(['S0', undefined]);
    expect(stackData.outerNegativeSeriesIds.SS0).toEqual([undefined, undefined]);
  });

  it('skips undefined stack values via the positive/negative guards', () => {
    // category 0: only a (S0) has a value -> S0 is the outer positive, b is a hole
    // category 1: only b (S1) has a value -> S1 is the outer positive, a is a hole
    const { config, chartData } = stackedSetup([
      { c: 0, a: 5 },
      { c: 1, b: 3 }
    ]);
    const stackData = getStackData(config, chartData);
    expect(stackData.outerPositiveSeriesIds.SS0).toEqual(['S0', 'S1']);
    // no negative contributors anywhere
    expect(stackData.outerNegativeSeriesIds.SS0).toEqual([undefined, undefined]);
  });

  it('mirrors raw ids into the filtered ids when nothing is filtered', () => {
    const { config, chartData } = stackedSetup([
      { c: 0, a: 5, b: 3 }
    ]);
    const stackData = getStackData(config, chartData);
    expect(stackData.filteredOuterPositiveSeriesIds).toEqual(stackData.outerPositiveSeriesIds);
    expect(stackData.filteredOuterNegativeSeriesIds).toEqual(stackData.outerNegativeSeriesIds);
  });
});

// three-series stack so a filtered series can sit below, between or above unfiltered ones
function threeStackedSetup(rows: Record<string, number>[], filteredSeriesMap: Record<string, boolean> = {}) {
  const config = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    series: [
      { stack: 'SS0', property: 'a', renderer: 'bar' },
      { stack: 'SS0', property: 'b', renderer: 'bar' },
      { stack: 'SS0', property: 'c2', renderer: 'bar' }
    ],
    seriesStacks: [{ id: 'SS0' }]
  });
  const chartData = getChartData(config, new ArrayOfObjectsDataProvider(rows), filteredSeriesMap);
  return { config, chartData, raw: chartData.seriesData.raw, filtered: chartData.seriesData.filtered };
}

// category 0: mixed signs, category 1: all positive, category 2: mixed signs with the middle series negative
const MIXED_ROWS = [
  { c: 0, a: 5, b: 4, c2: -2 },
  { c: 1, a: 1, b: 2, c2: 3 },
  { c: 2, a: -1, b: -3, c2: 2 }
];

describe('filtered stack values', () => {
  it('stacks with nothing filtered exactly like the raw stack', () => {
    const { raw, filtered } = threeStackedSetup(MIXED_ROWS);
    for (const id of ['S0', 'S1', 'S2']) {
      expect(filtered.values[id].stack).toEqual(raw.values[id].stack);
      expect(filtered.values[id].prior).toEqual(raw.values[id].prior);
    }
    // sanity-check the raw stacking the later tests diverge from
    expect(raw.values.S1.stack).toEqual([9, 3, -4]);
    expect(raw.values.S1.prior).toEqual([5, 1, -1]);
    expect(raw.values.S2.stack).toEqual([-2, 6, 2]);
    expect(raw.values.S2.prior).toEqual([0, 3, 0]);
  });

  it('restacks the series above a filtered middle series onto the totals without it', () => {
    const { raw, filtered } = threeStackedSetup(MIXED_ROWS, { S1: true });
    // the series below the filtered one keeps its raw stacking
    expect(filtered.values.S0.stack).toEqual(raw.values.S0.stack);
    expect(filtered.values.S0.prior).toEqual(raw.values.S0.prior);
    // c2 now sits directly on a: category 0 negative from 0, category 1 on top of 1, category 2 positive from 0
    expect(filtered.values.S2.stack).toEqual([-2, 4, 2]);
    expect(filtered.values.S2.prior).toEqual([0, 1, 0]);
    // its filtered domain shrinks with the restack while the raw domain keeps b's contribution
    expect(filtered.domains.S2.domain).toEqual([-2, 4]);
    expect(raw.domains.S2.domain).toEqual([-2, 6]);
  });

  it('gives a filtered series no stack values but a prior at its collapse point', () => {
    const { filtered } = threeStackedSetup(MIXED_ROWS, { S1: true });
    expect(filtered.values.S1.plain).toBeNull();
    expect(filtered.values.S1.stack).toBeNull();
    // b's raw values are 4, 2, -3: positive ones collapse onto the positive total, the negative one onto the negative total
    expect(filtered.values.S1.prior).toEqual([5, 1, -1]);
    expect(filtered.domains.S1.domain).toEqual([null, null]);
  });

  it('restacks everything from zero when the bottom series is filtered', () => {
    const { filtered } = threeStackedSetup(MIXED_ROWS, { S0: true });
    expect(filtered.values.S0.stack).toBeNull();
    expect(filtered.values.S0.prior).toEqual([0, 0, 0]);
    expect(filtered.values.S1.stack).toEqual([4, 2, -3]);
    expect(filtered.values.S1.prior).toEqual([0, 0, 0]);
    expect(filtered.values.S2.stack).toEqual([-2, 5, 2]);
    expect(filtered.values.S2.prior).toEqual([0, 2, 0]);
  });

  it('leaves the lower series untouched when the top series is filtered', () => {
    const { raw, filtered } = threeStackedSetup(MIXED_ROWS, { S2: true });
    expect(filtered.values.S0.stack).toEqual(raw.values.S0.stack);
    expect(filtered.values.S1.stack).toEqual(raw.values.S1.stack);
    expect(filtered.values.S1.prior).toEqual(raw.values.S1.prior);
    expect(filtered.values.S2.stack).toBeNull();
    // the top series collapses where it used to start
    expect(filtered.values.S2.prior).toEqual(raw.values.S2.prior);
  });

  it('collapses every filtered series onto the totals of the unfiltered ones below it', () => {
    const { filtered } = threeStackedSetup(MIXED_ROWS, { S0: true, S1: true });
    expect(filtered.values.S0.prior).toEqual([0, 0, 0]);
    expect(filtered.values.S1.prior).toEqual([0, 0, 0]);
    expect(filtered.values.S2.stack).toEqual([-2, 3, 2]);
    expect(filtered.values.S2.prior).toEqual([0, 0, 0]);
  });

  it('collapses a filtered missing value onto the positive total', () => {
    const { filtered } = threeStackedSetup([
      { c: 0, a: 5, c2: -2 },
      { c: 1, a: -1, b: NaN, c2: 3 }
    ], { S1: true });
    expect(filtered.values.S1.prior).toEqual([5, 0]);
    // the restacked series ignores the filtered holes as it did the raw ones
    expect(filtered.values.S2.stack).toEqual([-2, 3]);
    expect(filtered.values.S2.prior).toEqual([0, 0]);
  });
});

describe('filtered outer series ids', () => {
  it('diverge from the raw ids when a mid-stack series is filtered', () => {
    const { config, chartData } = threeStackedSetup(MIXED_ROWS, { S1: true });
    const stackData = getStackData(config, chartData);
    // raw: b is the outer positive at category 0 and the outer negative at category 2
    expect(stackData.outerPositiveSeriesIds.SS0).toEqual(['S1', 'S2', 'S2']);
    expect(stackData.outerNegativeSeriesIds.SS0).toEqual(['S2', undefined, 'S1']);
    // filtered: a takes over both slots, c2 keeps the ones it already held
    expect(stackData.filteredOuterPositiveSeriesIds.SS0).toEqual(['S0', 'S2', 'S2']);
    expect(stackData.filteredOuterNegativeSeriesIds.SS0).toEqual(['S2', undefined, 'S0']);
  });

  it('never name a filtered series', () => {
    const { config, chartData } = threeStackedSetup(MIXED_ROWS, { S0: true, S2: true });
    const stackData = getStackData(config, chartData);
    expect(stackData.filteredOuterPositiveSeriesIds.SS0).toEqual(['S1', 'S1', undefined]);
    expect(stackData.filteredOuterNegativeSeriesIds.SS0).toEqual([undefined, undefined, 'S1']);
    // the raw ids still see every series
    expect(stackData.outerPositiveSeriesIds.SS0).toEqual(['S1', 'S2', 'S2']);
  });
});

describe('getStackDataWithMutations', () => {
  it('produces stack data equal to a fresh computation', () => {
    const { config, chartData } = stackedSetup([
      { c: 0, a: 5, b: 3 },
      { c: 1, a: -2, b: -4 }
    ]);
    const fresh = getStackData(config, chartData);
    const mutated = getStackDataWithMutations(null, config, chartData);
    expect(mutated).toEqual(fresh);
  });
});
