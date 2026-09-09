import { describe, it, expect } from 'vitest';
import { getChartData } from '../../src/data/ChartData';
import { getChartAnimationData } from '../../src/animation/ChartAnimationData';
import { getChartDataForValueDelta } from '../../src/animation/ChartAnimation';
import { getCategoryDeltaData } from '../../src/animation/CategoryAnimationData';
import { getInitialValueChangeData, getTransitionValueChangeData } from '../../src/animation/SeriesAnimationData';
import { makeConfig, ArrayOfObjectsDataProvider } from '../data/fixtures';
import type { ChartData } from '../../src/types/data';

// Regression: filtered series shared one module-level null value object, so a stack-prior write
// leaked into every other filtered series and crashed the initial delta computation.
describe('getInitialValueChangeData with filtered series', () => {
  const rows = [
    { g: 0, a: 5, b: 3, c: 2 },
    { g: 1, a: 4, b: 6, c: 1 }
  ];

  function stackedPlusUnstackedConfig() {
    return makeConfig({
      categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
      series: [
        { stack: 'SS0', property: 'a', renderer: 'bar' },
        { stack: 'SS0', property: 'b', renderer: 'bar' },
        { property: 'c', renderer: 'bar' }
      ],
      seriesStacks: [{ id: 'SS0' }]
    });
  }

  it('handles a filtered stacked series alongside a filtered unstacked series', () => {
    const config = stackedPlusUnstackedConfig();
    const chartData = getChartData(config, new ArrayOfObjectsDataProvider(rows), { S1: true, S2: true });
    expect(() => getChartAnimationData(config, null, chartData)).not.toThrow();
  });

  it('does not leak stack priors into later charts', () => {
    const stackedConfig = stackedPlusUnstackedConfig();
    const stackedData = getChartData(stackedConfig, new ArrayOfObjectsDataProvider(rows), { S1: true });
    getChartAnimationData(stackedConfig, null, stackedData);

    const plainConfig = makeConfig({
      categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
      series: [
        { property: 'a', renderer: 'bar' },
        { property: 'b', renderer: 'bar' }
      ]
    });
    const plainData = getChartData(plainConfig, new ArrayOfObjectsDataProvider(rows), { S1: true });
    expect(() => getChartAnimationData(plainConfig, null, plainData)).not.toThrow();
  });

  // Regression: the filtered map shallow-copied only the map, so the filtered
  // stack/prior writes mutated the raw side's value objects in place.
  it('keeps raw priors intact when a stacked series is filtered at mount', () => {
    const config = makeConfig({
      categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
      series: [
        { stack: 'SS0', property: 'a', renderer: 'bar' },
        { stack: 'SS0', property: 'b', renderer: 'bar' },
        { stack: 'SS0', property: 'c', renderer: 'bar' }
      ],
      seriesStacks: [{ id: 'SS0' }]
    });
    const chartData = getChartData(config, new ArrayOfObjectsDataProvider(rows), { S0: true });
    const changeData = getInitialValueChangeData(config, chartData);
    const raw = changeData.start.seriesData.raw.values;
    const filtered = changeData.start.seriesData.filtered.values;

    // raw ignores filtering: S1 stacks on S0, so its prior is a real array
    expect(raw['S1'].prior).not.toBeNull();
    // filtered: S0 is gone, so S1 has no prior and S2's prior is S1's stack
    expect(filtered['S1'].prior).toBeNull();
    expect(filtered['S2'].prior).toBe(filtered['S1'].stack);
    expect(raw['S2'].prior).not.toBe(filtered['S2'].prior);
  });
});

// Legend toggle of a stacked series between two chart datas: the filtered start/end value objects
// and their deltas come from getFilteredSeriesValueObjectsWithChanges + setStackBaseValuesForChanges.
describe('getTransitionValueChangeData for a stacked series legend toggle', () => {
  const config = makeConfig({
    categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
    series: [
      { stack: 'SS0', property: 'a', renderer: 'bar' },
      { stack: 'SS0', property: 'b', renderer: 'bar' },
      { stack: 'SS0', property: 'c', renderer: 'bar' }
    ],
    seriesStacks: [{ id: 'SS0' }]
  });
  const rows = [
    { g: 0, a: 5, b: 3, c: 2 },
    { g: 1, a: 4, b: 6, c: 1 }
  ];
  const changedRows = [
    { g: 0, a: 1, b: 3, c: 9 },
    { g: 1, a: 8, b: 6, c: 1 }
  ];
  const dataFor = (r: Record<string, number>[], filtered: Record<string, boolean>) =>
    getChartData(config, new ArrayOfObjectsDataProvider(r), filtered);
  const transition = (prev: ChartData, next: ChartData) =>
    getTransitionValueChangeData(config, prev, next, getCategoryDeltaData(config.categoryAxis, prev.categoryData, next.categoryData));

  it('filtering the middle series collapses it onto its prior and drops the series above it', () => {
    const vcd = transition(dataFor(rows, {}), dataFor(rows, { S1: true }));
    const start = vcd.start.seriesData.filtered.values;
    const end = vcd.end.seriesData.filtered.values;

    // start is the unfiltered stack
    expect(start['S1'].stack).toEqual([8, 10]);
    expect(start['S1'].prior).toEqual([5, 4]);
    expect(start['S2'].prior).toEqual([8, 10]);
    // end: S1 keeps its slot but has zero height, S2 sits directly on S0
    expect(end['S1'].prior).toEqual([5, 4]);
    expect(end['S1'].stack).toEqual([5, 4]);
    expect(end['S1'].plain).toEqual([0, 0]);
    expect(end['S2'].prior).toEqual([5, 4]);
    expect(end['S2'].stack).toEqual([7, 5]);
    // the data did not change, so the raw side has nothing to animate
    expect(vcd.deltas.raw.deltaPercentage).toBe(0);

    const filtered = vcd.deltas.filtered.deltas as any;
    // S0 sits below the toggled series and stays a copy of the raw values
    expect(filtered.S0.deltaCopied).toBe(true);
    expect(filtered.S1.stack.deltas).toEqual([-3, -6]);
    expect(filtered.S1.prior.deltaPercentage).toBe(0);
    expect(filtered.S2.stack.deltas).toEqual([-3, -6]);
    expect(filtered.S2.prior.deltas).toEqual([-3, -6]);
  });

  it('unfiltering grows the returning series out of its prior', () => {
    const vcd = transition(dataFor(rows, { S1: true }), dataFor(rows, {}));
    const start = vcd.start.seriesData.filtered.values;
    const end = vcd.end.seriesData.filtered.values;

    expect(start['S1'].stack).toEqual([5, 4]);
    expect(start['S1'].stack).toEqual(start['S1'].prior);
    expect(start['S2'].prior).toEqual([5, 4]);
    expect(end['S1'].stack).toEqual([8, 10]);
    expect(end['S1'].prior).toEqual([5, 4]);
    expect(end['S2'].prior).toEqual([8, 10]);
    expect(end['S2'].stack).toEqual([10, 11]);
    expect(vcd.deltas.raw.deltaPercentage).toBe(0);

    const filtered = vcd.deltas.filtered.deltas as any;
    expect(filtered.S1.stack.deltas).toEqual([3, 6]);
    expect(filtered.S2.prior.deltas).toEqual([3, 6]);
    expect(filtered.S2.stack.deltas).toEqual([3, 6]);
  });

  it('paces the collapsing series and the series above it as one stack', () => {
    const vcd = transition(dataFor(rows, {}), dataFor(changedRows, { S1: true }));
    const filtered = vcd.deltas.filtered.deltas as any;
    const stackPercentages = [filtered.S1.stack, filtered.S1.prior, filtered.S2.stack, filtered.S2.prior]
      .map(d => d.deltaPercentage);
    // the biggest stack edge move sets the shared percentage
    expect(stackPercentages[0]).toBeGreaterThan(0);
    for (const percentage of stackPercentages) {
      expect(percentage).toBe(stackPercentages[0]);
    }
    for (const delta of [filtered.S1.stack, filtered.S1.prior, filtered.S2.stack, filtered.S2.prior]) {
      expect(delta.deltaFactor).toBeGreaterThanOrEqual(1);
    }
    expect(vcd.deltaPercentage).toBeGreaterThanOrEqual(vcd.deltas.filtered.deltaPercentage);
    // both edges of the collapsing series land on the new stack
    const end = vcd.end.seriesData.filtered.values;
    expect(end['S1'].prior).toEqual([1, 8]);
    expect(end['S1'].stack).toEqual([1, 8]);
    expect(end['S2'].prior).toEqual([1, 8]);
    expect(end['S2'].stack).toEqual([10, 9]);
  });

  it('fills an added category from the priors when filtering', () => {
    const addedRows = [...rows, { g: 2, a: 2, b: 2, c: 7 }];
    const vcd = transition(dataFor(rows, {}), dataFor(addedRows, { S1: true }));
    const start = vcd.start.seriesData.filtered.values;
    const end = vcd.end.seriesData.filtered.values;

    // the new category starts as a zero-height stack and grows into place
    expect(start['S0'].stack).toEqual([5, 4, 0]);
    expect(start['S1'].prior).toEqual([5, 4, 0]);
    expect(start['S1'].stack).toEqual([8, 10, 0]);
    expect(start['S2'].prior).toEqual([8, 10, 0]);
    expect(start['S2'].stack).toEqual([10, 11, 0]);
    expect(end['S1'].prior).toEqual([5, 4, 2]);
    expect(end['S1'].stack).toEqual([5, 4, 2]);
    expect(end['S2'].prior).toEqual([5, 4, 2]);
    expect(end['S2'].stack).toEqual([7, 5, 9]);
    for (const seriesId of ['S0', 'S1', 'S2']) {
      for (const values of [start[seriesId].stack, start[seriesId].prior, end[seriesId].stack, end[seriesId].prior]) {
        expect(values!.some(Number.isNaN)).toBe(false);
      }
    }
  });

  describe('mid-tween stack contiguity', () => {
    const tweenFor = (percentage: number) => {
      const cad = getChartAnimationData(config, dataFor(rows, {}), dataFor(changedRows, { S1: true }));
      return getChartDataForValueDelta(config, cad, percentage).seriesData.filtered.values;
    };

    it('keeps the series above the collapsing one glued to its top edge', () => {
      for (const percentage of [0.25, 0.5, 0.75]) {
        const values = tweenFor(percentage);
        expect(values['S2'].prior).toEqual(values['S1'].stack);
      }
    });

    // Regression: S0's filtered stack is a raw copy paced by the raw stack sync while S1's prior was
    // paced by the filtered one, so the collapsing bar detached from the bar below it.
    it('keeps the collapsing series glued to the top edge of the series below it', () => {
      for (const percentage of [0.25, 0.5, 0.75]) {
        const values = tweenFor(percentage);
        expect(values['S1'].prior).toEqual(values['S0'].stack);
      }
    });
  });
});

type DeltaMap = Record<string, Record<string, { deltaPercentage: number; deltaFactor?: number; deltaCopied?: boolean; deltas: number[] | null }> & { deltaPercentage: number }>;

const ordinalNumberAxis = { property: 'g', type: 'number', scale: 'ordinal' };

// Duration sync across raw and filtered maps per stack (adjustDeltaPercentagesForStackedCategories).
describe('stack duration sync across the raw and filtered maps', () => {
  const rows = [
    { g: 0, a: 5, b: 3, c: 2, x: 1, y: 1 },
    { g: 1, a: 4, b: 6, c: 1, x: 1, y: 1 }
  ];
  const stackConfig = (extraSeries: Record<string, unknown>[] = [], extraStacks: Record<string, unknown>[] = []) => makeConfig({
    categoryAxis: ordinalNumberAxis,
    series: [
      { stack: 'SS0', property: 'a', renderer: 'bar' },
      { stack: 'SS0', property: 'b', renderer: 'bar' },
      { stack: 'SS0', property: 'c', renderer: 'bar' },
      ...extraSeries
    ],
    seriesStacks: [{ id: 'SS0' }, ...extraStacks]
  });
  const transition = (config: ReturnType<typeof makeConfig>, prevRows: Record<string, number>[], prevFiltered: Record<string, boolean>, nextRows: Record<string, number>[], nextFiltered: Record<string, boolean>) => {
    const prev = getChartData(config, new ArrayOfObjectsDataProvider(prevRows), prevFiltered);
    const next = getChartData(config, new ArrayOfObjectsDataProvider(nextRows), nextFiltered);
    return getTransitionValueChangeData(config, prev, next, getCategoryDeltaData(config.categoryAxis, prev.categoryData, next.categoryData));
  };

  it('paces the raw and filtered stack edges of one stack together when data changes while a series filters', () => {
    const changedRows = [
      { g: 0, a: 1, b: 3, c: 9, x: 1, y: 1 },
      { g: 1, a: 8, b: 6, c: 1, x: 1, y: 1 }
    ];
    const vcd = transition(stackConfig(), rows, {}, changedRows, { S1: true });
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    const filtered = vcd.deltas.filtered.deltas as DeltaMap;
    const shared = raw.S0.stack.deltaPercentage;
    expect(shared).toBeGreaterThan(0);
    // S0's filtered stack is a raw copy, so it inherits the raw percentage
    expect(filtered.S0.stack.deltaCopied).toBe(true);
    for (const delta of [raw.S1.stack, raw.S1.prior, raw.S2.stack, raw.S2.prior,
      filtered.S0.stack, filtered.S1.stack, filtered.S1.prior, filtered.S2.stack, filtered.S2.prior]) {
      expect(delta.deltaPercentage).toBe(shared);
    }
    // the deltas themselves keep their own magnitudes; only the pacing is shared
    expect(raw.S0.stack.deltas).toEqual([-4, 4]);
    expect(filtered.S2.stack.deltas).toEqual([0, -2]);
    // neither map reports done before its stack entries finish
    expect(vcd.deltas.raw.deltaPercentage).toBeGreaterThanOrEqual(shared);
    expect(vcd.deltas.filtered.deltaPercentage).toBeGreaterThanOrEqual(shared);
    for (const seriesId of ['S1', 'S2']) {
      expect(raw[seriesId].deltaPercentage).toBeGreaterThanOrEqual(shared);
      expect(filtered[seriesId].deltaPercentage).toBeGreaterThanOrEqual(shared);
    }
  });

  it('leaves stack entries that did not move at zero', () => {
    // only the top series changes, so S0's stack and S1's prior are untouched
    const changedRows = rows.map(row => ({ ...row, c: row.c + 5 }));
    const vcd = transition(stackConfig(), rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    expect(raw.S2.stack.deltaPercentage).toBeGreaterThan(0);
    expect(raw.S0.stack.deltaPercentage).toBe(0);
    expect(raw.S1.stack.deltaPercentage).toBe(0);
    expect(raw.S1.prior.deltaPercentage).toBe(0);
    expect(raw.S2.prior.deltaPercentage).toBe(0);
    expect(raw.S0.deltaPercentage).toBe(0);
  });

  it('paces independent stacks separately', () => {
    const config = stackConfig([
      { stack: 'SS1', property: 'x', renderer: 'bar' },
      { stack: 'SS1', property: 'y', renderer: 'bar' }
    ], [{ id: 'SS1' }]);
    // SS0 moves a lot (a: 5→9), SS1 barely (x: 1→1.5)
    const changedRows = rows.map(row => ({ ...row, a: row.a + 4, x: row.x + 0.5 }));
    const vcd = transition(config, rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    const bigStack = raw.S0.stack.deltaPercentage;
    const smallStack = raw.S3.stack.deltaPercentage;
    expect(smallStack).toBeGreaterThan(0);
    expect(smallStack).toBeLessThan(bigStack);
    for (const delta of [raw.S1.stack, raw.S1.prior, raw.S2.stack, raw.S2.prior]) {
      expect(delta.deltaPercentage).toBe(bigStack);
    }
    for (const delta of [raw.S4.stack, raw.S4.prior]) {
      expect(delta.deltaPercentage).toBe(smallStack);
    }
    // the small stack finishes early instead of stretching to the big stack's duration
    expect(raw.S4.prior.deltaFactor).toBeGreaterThan(1);
    expect(raw.S1.prior.deltaFactor).toBe(1);
  });
});

// Error-bar duration sync (adjustDeltaPercentagesForErrorBarSeries): plain/range/errorLow/errorHigh share a duration.
describe('error-bar duration sync', () => {
  // the second row spreads the value axis so the moves below are small fractions of its extent
  const rows = [
    { g: 0, v: 5, lo: 4, hi: 6, r: 2, p: 5 },
    { g: 1, v: 15, lo: 12, hi: 18, r: 8, p: 15 }
  ];
  const errorBarConfig = (extraSeriesProps: Record<string, unknown> = {}) => makeConfig({
    categoryAxis: ordinalNumberAxis,
    series: [
      { id: 'V', property: 'v', renderer: 'bar', errorLowProperty: 'lo', errorHighProperty: 'hi', ...extraSeriesProps },
      { id: 'P', property: 'p', renderer: 'bar' }
    ]
  });
  const transition = (config: ReturnType<typeof makeConfig>, prevRows: Record<string, number>[], prevFiltered: Record<string, boolean>, nextRows: Record<string, number>[], nextFiltered: Record<string, boolean>) => {
    const prev = getChartData(config, new ArrayOfObjectsDataProvider(prevRows), prevFiltered);
    const next = getChartData(config, new ArrayOfObjectsDataProvider(nextRows), nextFiltered);
    return getTransitionValueChangeData(config, prev, next, getCategoryDeltaData(config.categoryAxis, prev.categoryData, next.categoryData));
  };

  it('stretches a small whisker move to the bar move on the same series', () => {
    // v moves 4, lo moves 1, hi stays; the control series P moves 1 like lo
    const changedRows = [{ ...rows[0], v: 9, lo: 3, p: 6 }, rows[1]];
    const config = errorBarConfig();
    const vcd = transition(config, rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    expect(raw.V.plain.deltas).toEqual([4, 0]);
    expect(raw.V.errorLow.deltas).toEqual([-1, 0]);
    expect(raw.V.plain.deltaPercentage).toBeGreaterThan(0);
    expect(raw.V.errorLow.deltaPercentage).toBe(raw.V.plain.deltaPercentage);
    // the untouched bound and the absent range are zero entries and stay zero
    expect(raw.V.errorHigh.deltaPercentage).toBe(0);
    expect(raw.V.range.deltaPercentage).toBe(0);
    // the same 1-unit move on an unrelated series keeps its own, smaller percentage
    expect(raw.P.plain.deltaPercentage).toBeLessThan(raw.V.errorLow.deltaPercentage);
    expect(raw.V.errorLow.deltaFactor).toBe(raw.V.plain.deltaFactor);
    expect(raw.P.plain.deltaFactor).toBeGreaterThan(raw.V.errorLow.deltaFactor!);
  });

  it('keeps the whisker halfway when the bar is halfway', () => {
    const changedRows = [{ ...rows[0], v: 9, lo: 3, hi: 8 }, rows[1]];
    const config = errorBarConfig();
    const prev = getChartData(config, new ArrayOfObjectsDataProvider(rows), {});
    const next = getChartData(config, new ArrayOfObjectsDataProvider(changedRows), {});
    const cad = getChartAnimationData(config, prev, next);
    for (const percentage of [0.25, 0.5, 0.75]) {
      const values = getChartDataForValueDelta(config, cad, percentage).seriesData.raw.values;
      expect(values['V'].plain![0]).toBeCloseTo(5 + 4 * percentage, 9);
      expect(values['V'].errorLow![0]).toBeCloseTo(4 - 1 * percentage, 9);
      expect(values['V'].errorHigh![0]).toBeCloseTo(6 + 2 * percentage, 9);
    }
  });

  it('syncs the range edge of a ranged error-bar series too', () => {
    // v moves 4, r moves 1, lo moves 1, hi stays
    const changedRows = [{ ...rows[0], v: 9, r: 3, lo: 3 }, rows[1]];
    const config = errorBarConfig({ rangeProperty: 'r' });
    const vcd = transition(config, rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    const shared = raw.V.plain.deltaPercentage;
    expect(shared).toBeGreaterThan(0);
    expect(raw.V.range.deltaPercentage).toBe(shared);
    expect(raw.V.errorLow.deltaPercentage).toBe(shared);
    expect(raw.V.errorHigh.deltaPercentage).toBe(0);
  });

  it('does not touch a series that has no moving synced key', () => {
    // only the control series moves; the error-bar series has nothing to sync
    const changedRows = [{ ...rows[0], p: 9 }, rows[1]];
    const vcd = transition(errorBarConfig(), rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    for (const key of ['plain', 'range', 'errorLow', 'errorHigh']) {
      expect(raw.V[key].deltaPercentage).toBe(0);
    }
    expect(raw.V.deltaPercentage).toBe(0);
  });

  it('syncs the filtered map when the error-bar series is being unfiltered', () => {
    const config = errorBarConfig();
    const vcd = transition(config, rows, { V: true }, rows, {});
    const filtered = vcd.deltas.filtered.deltas as DeltaMap;
    expect(vcd.deltas.raw.deltaPercentage).toBe(0);
    const shared = filtered.V.plain.deltaPercentage;
    expect(shared).toBeGreaterThan(0);
    for (const key of ['plain', 'errorLow', 'errorHigh']) {
      expect(filtered.V[key].deltaCopied).toBe(false);
      expect(filtered.V[key].deltaPercentage).toBe(shared);
    }
    // the unrelated series is an untouched raw copy
    expect(filtered.P.deltaCopied).toBe(true);
  });
});

// Follower duration sync (adjustDeltaPercentagesForFollowerCategories): a leader and its followers share a duration.
describe('follower duration sync', () => {
  // the second row spreads the value axis so the moves below are small fractions of its extent
  const rows = [
    { g: 0, l: 5, f: 5, f2: 5, c: 5 },
    { g: 1, l: 15, f: 12, f2: 15, c: 15 }
  ];
  const followerConfig = (extraSeries: Record<string, unknown>[] = []) => makeConfig({
    categoryAxis: ordinalNumberAxis,
    series: [
      { id: 'F', property: 'f', renderer: 'bar', followSeries: 'L' },
      { id: 'L', property: 'l', renderer: 'bar' },
      { id: 'C', property: 'c', renderer: 'bar' },
      ...extraSeries
    ]
  });
  const transition = (config: ReturnType<typeof makeConfig>, prevRows: Record<string, number>[], prevFiltered: Record<string, boolean>, nextRows: Record<string, number>[], nextFiltered: Record<string, boolean>) => {
    const prev = getChartData(config, new ArrayOfObjectsDataProvider(prevRows), prevFiltered);
    const next = getChartData(config, new ArrayOfObjectsDataProvider(nextRows), nextFiltered);
    return getTransitionValueChangeData(config, prev, next, getCategoryDeltaData(config.categoryAxis, prev.categoryData, next.categoryData));
  };

  it('stretches a small follower move to the leader move', () => {
    // l moves 4, f moves 1, the unrelated control moves 1 like f
    const changedRows = [{ ...rows[0], l: 9, f: 6, c: 6 }, rows[1]];
    const config = followerConfig();
    const vcd = transition(config, rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    expect(raw.L.plain.deltas).toEqual([4, 0]);
    expect(raw.F.plain.deltas).toEqual([1, 0]);
    expect(raw.L.plain.deltaPercentage).toBeGreaterThan(0);
    expect(raw.F.plain.deltaPercentage).toBe(raw.L.plain.deltaPercentage);
    // the follower's series-level percentage is raised so it does not report done early
    expect(raw.F.deltaPercentage).toBe(raw.L.deltaPercentage);
    expect(raw.C.plain.deltaPercentage).toBeLessThan(raw.F.plain.deltaPercentage);
    expect(raw.F.plain.deltaFactor).toBe(raw.L.plain.deltaFactor);
    expect(raw.C.plain.deltaFactor).toBeGreaterThan(raw.F.plain.deltaFactor!);
  });

  it('stretches a small leader move to the follower move', () => {
    const changedRows = [{ ...rows[0], l: 6, f: 9 }, rows[1]];
    const vcd = transition(followerConfig(), rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    expect(raw.F.plain.deltaPercentage).toBeGreaterThan(0);
    expect(raw.L.plain.deltaPercentage).toBe(raw.F.plain.deltaPercentage);
    expect(raw.L.deltaPercentage).toBe(raw.F.deltaPercentage);
  });

  it('leaves a member that did not move at zero', () => {
    const changedRows = [{ ...rows[0], l: 9 }, rows[1]];
    const vcd = transition(followerConfig(), rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    expect(raw.L.plain.deltaPercentage).toBeGreaterThan(0);
    expect(raw.F.plain.deltaPercentage).toBe(0);
    expect(raw.F.deltaPercentage).toBe(0);
  });

  it('shares the largest move across a leader with several followers', () => {
    const config = followerConfig([{ id: 'F2', property: 'f2', renderer: 'bar', followSeries: 'L' }]);
    // the second follower makes the biggest move
    const changedRows = [{ ...rows[0], l: 6, f: 7, f2: 9 }, rows[1]];
    const vcd = transition(config, rows, {}, changedRows, {});
    const raw = vcd.deltas.raw.deltas as DeltaMap;
    const shared = raw.F2.plain.deltaPercentage;
    expect(shared).toBeGreaterThan(0);
    expect(raw.L.plain.deltaPercentage).toBe(shared);
    expect(raw.F.plain.deltaPercentage).toBe(shared);
    expect(raw.C.plain.deltaPercentage).toBe(0);
  });

  it('keeps the follower halfway when the leader is halfway', () => {
    const changedRows = [{ ...rows[0], l: 9, f: 6 }, rows[1]];
    const config = followerConfig();
    const prev = getChartData(config, new ArrayOfObjectsDataProvider(rows), {});
    const next = getChartData(config, new ArrayOfObjectsDataProvider(changedRows), {});
    const cad = getChartAnimationData(config, prev, next);
    for (const percentage of [0.25, 0.5, 0.75]) {
      const values = getChartDataForValueDelta(config, cad, percentage).seriesData.raw.values;
      expect(values['L'].plain![0]).toBeCloseTo(5 + 4 * percentage, 9);
      expect(values['F'].plain![0]).toBeCloseTo(5 + 1 * percentage, 9);
    }
  });

  it('syncs the filtered map when the leader is being unfiltered', () => {
    const config = followerConfig();
    // the controller filters followers with their leader, so both grow back at once
    const vcd = transition(config, rows, { L: true, F: true }, rows, {});
    const filtered = vcd.deltas.filtered.deltas as DeltaMap;
    expect(vcd.deltas.raw.deltaPercentage).toBe(0);
    const shared = filtered.L.plain.deltaPercentage;
    expect(shared).toBeGreaterThan(0);
    expect(filtered.L.plain.deltaCopied).toBe(false);
    expect(filtered.F.plain.deltaCopied).toBe(false);
    // the follower grows back less far than the leader yet shares its duration
    expect(filtered.F.plain.deltas![1]).toBeLessThan(filtered.L.plain.deltas![1]);
    expect(filtered.F.plain.deltaPercentage).toBe(shared);
    expect(filtered.C.deltaCopied).toBe(true);
  });
});

// Regression: the trailing-side guard read the changed side's values over the merged-space range, which
// runs past its own array whenever both sides changed, so a sliding window seeded its entering point at the base
describe('animateBaseFromAdjacent across a sliding window', () => {
  const config = makeConfig({
    categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
    series: [{ property: 'v', renderer: 'line' }],
    valueAxes: [{ min: 0, max: 50 }]
  });
  const dataFor = (r: Record<string, number>[]) => getChartData(config, new ArrayOfObjectsDataProvider(r), {});
  const transition = (prev: ChartData, next: ChartData) =>
    getTransitionValueChangeData(config, prev, next, getCategoryDeltaData(config.categoryAxis, prev.categoryData, next.categoryData));

  it('seeds both the leaving and the entering point from their neighbours', () => {
    const vcd = transition(
      dataFor([{ g: 1, v: 10 }, { g: 2, v: 20 }, { g: 3, v: 30 }]),
      dataFor([{ g: 2, v: 20 }, { g: 3, v: 30 }, { g: 4, v: 40 }]));
    // merged [1, 2, 3, 4]: the entering point 4 starts at the old last value, the leaving point 1 ends at the new first value
    expect(vcd.start.seriesData.raw.values['S0'].plain).toEqual([10, 20, 30, 30]);
    expect(vcd.end.seriesData.raw.values['S0'].plain).toEqual([20, 20, 30, 40]);
  });

  it('still seeds a pure trailing addition', () => {
    const vcd = transition(
      dataFor([{ g: 1, v: 10 }, { g: 2, v: 20 }, { g: 3, v: 30 }]),
      dataFor([{ g: 1, v: 10 }, { g: 2, v: 20 }, { g: 3, v: 30 }, { g: 4, v: 40 }]));
    expect(vcd.start.seriesData.raw.values['S0'].plain).toEqual([10, 20, 30, 30]);
  });

  // Regression: only the position keys were seeded, but stacked series render from stack/prior, which the
  // stack base fill then set to 0, so stacked edges always rose from and sank to the floor
  it('seeds the stack and prior edges of stacked series from their neighbours', () => {
    const stacked = makeConfig({
      categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
      series: [{ stack: 'SS0', property: 'a', renderer: 'area' }, { stack: 'SS0', property: 'b', renderer: 'area' }],
      seriesStacks: [{ id: 'SS0' }],
      valueAxes: [{ min: 0, max: 50 }]
    });
    const stackedDataFor = (r: Record<string, number>[]) => getChartData(stacked, new ArrayOfObjectsDataProvider(r), {});
    const prev = stackedDataFor([{ g: 1, a: 10, b: 1 }, { g: 2, a: 20, b: 2 }, { g: 3, a: 30, b: 3 }]);
    const next = stackedDataFor([{ g: 2, a: 20, b: 2 }, { g: 3, a: 30, b: 3 }, { g: 4, a: 40, b: 4 }]);
    const vcd = getTransitionValueChangeData(stacked, prev, next, getCategoryDeltaData(stacked.categoryAxis, prev.categoryData, next.categoryData));
    const start = vcd.start.seriesData.raw.values;
    const end = vcd.end.seriesData.raw.values;
    // entering point 4 starts on the old last stack edges; leaving point 1 ends on the new first ones
    expect(start['S0'].stack).toEqual([10, 20, 30, 30]);
    expect(start['S1'].prior).toEqual([10, 20, 30, 30]);
    expect(start['S1'].stack).toEqual([11, 22, 33, 33]);
    expect(end['S0'].stack).toEqual([20, 20, 30, 40]);
    expect(end['S1'].prior).toEqual([20, 20, 30, 40]);
    expect(end['S1'].stack).toEqual([22, 22, 33, 44]);
  });
});
