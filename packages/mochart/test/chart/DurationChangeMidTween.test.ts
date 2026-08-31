/**
 * Animation duration config changes while a data tween is running.
 *
 * Phase durations are read once when a tween is built, so a running tween never sees a config
 * change. A duration-only config update takes the animated data source's non-structural path: the
 * tween is rebuilt from the currently rendered frame (no jump) and its remaining delta is paced by
 * the new config.
 *
 * Fixed axis + series domains keep every tween a pure value phase, so frame counts map straight
 * onto valueChangeDuration / initialDuration.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, mockBoundingClientRect, barRects } from '../components/helpers';
import type { MochartInputConfig } from '../../src/types/config';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';
import type { ChartDataSourceInput } from '../../src/chart/ChartDataSource';
import { AnimatedDataSource } from '../../src/chart/AnimatedDataSource';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  mockBoundingClientRect(300, 200);
  installFakeFrameClock();
  mochart = await import('../../src');
});

type Durations = Partial<Record<'initialDuration' | 'valueChangeDuration' | 'expansionDuration' | 'contractionDuration' | 'focusDuration', number>>;

// 50 frames of value change at 16ms/frame; the axis-phase durations never apply here
const baseDurations: Durations = { initialDuration: 800, valueChangeDuration: 800, expansionDuration: 800, contractionDuration: 800, focusDuration: 80 };
// Feb/Mar hold the series domain at [0, 100]; only Jan tweens
const lowRows = [{ month: 'Jan', sales: 0 }, { month: 'Feb', sales: 0 }, { month: 'Mar', sales: 100 }];
const highRows = [{ month: 'Jan', sales: 100 }, { month: 'Feb', sales: 0 }, { month: 'Mar', sales: 100 }];
const MAX_FRAMES = 400;

function makeConfig(animation: Durations = {}, categoryProperty = 'month') {
  return mochart.enhanceConfig({
    version: '1.0.0',
    // linear easing keeps frame counts mapped straight onto durations
    animation: { enabled: true, easing: 'linear', focusEasing: 'linear', ...baseDurations, ...animation },
    categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
    valueAxes: [{ id: 'value', min: 0, max: 100 }],
    series: [{ id: 'sales', property: 'sales', axis: 'value', renderer: 'bar' }]
  } as MochartInputConfig);
}

function mountChart(rows: typeof lowRows, animation: Durations = {}) {
  const container = mountContainer();
  const dataProvider = new mochart.ArrayOfObjectsDataProvider(rows);
  const chart = mochart.createChart(container, { mochartConfig: makeConfig(animation), dataProvider, width: 300, height: 200 });
  return { chart, container, dataProvider };
}

/** Rendered height of the Jan bar. */
function janHeight(container: Element): number {
  return Math.abs(barRects(container, 'sales')[0]!.height);
}

/** Frames until the tweens settle; fails rather than spinning past a stuck tween. */
function framesToSettle(): number {
  const frames = runFrames(MAX_FRAMES);
  expect(frames, 'animation never completed').toBeLessThan(MAX_FRAMES);
  return frames;
}

// height of a settled Jan bar at 100; measured once — runFrames would also settle a chart under test
let fullHeight = 0;
beforeAll(() => {
  const { chart, container } = mountChart(highRows);
  runFrames();
  fullHeight = janHeight(container);
  chart.destroy();
  container.remove();
});

function expectMidTween(height: number): void {
  expect(height).toBeGreaterThan(0);
  expect(height).toBeLessThan(fullHeight);
}

/** Mount low, settle, start the low → high tween and stop `framesIn` frames into its 50-frame value phase. */
function mountMidTween(framesIn: number) {
  const mounted = mountChart(lowRows);
  runFrames();
  const dataProvider = new mochart.ArrayOfObjectsDataProvider(highRows);
  mounted.chart.update({ dataProvider });
  advanceFrames(framesIn);
  const height = janHeight(mounted.container);
  expectMidTween(height);
  return { ...mounted, dataProvider, height };
}

describe('duration change mid data tween', () => {
  it('a shorter valueChangeDuration continues from the rendered frame and finishes sooner', () => {
    const { chart, container, dataProvider, height } = mountMidTween(25);
    chart.update({ mochartConfig: makeConfig({ valueChangeDuration: 80 }), dataProvider });
    // nothing moves until a frame runs
    expect(janHeight(container)).toBe(height);
    advanceFrames(1);
    // the first frame carries on from the rendered height: no rewind, no snap to the end
    expect(janHeight(container)).toBeGreaterThanOrEqual(height);
    expect(janHeight(container)).toBeLessThan(fullHeight);
    // the remaining half of the extent is paced at half the new 5-frame duration
    const remaining = 1 + framesToSettle();
    expect(janHeight(container)).toBe(fullHeight);
    expect(remaining).toBeLessThanOrEqual(4);
  });

  it('a longer valueChangeDuration continues from the rendered frame and finishes later', () => {
    const { chart, container, dataProvider, height } = mountMidTween(25);
    // 200 frames: the remaining half of the extent takes 100
    chart.update({ mochartConfig: makeConfig({ valueChangeDuration: 3200 }), dataProvider });
    advanceFrames(1);
    expect(janHeight(container)).toBeGreaterThanOrEqual(height);
    expect(janHeight(container)).toBeLessThan(fullHeight);
    const remaining = 1 + framesToSettle();
    expect(janHeight(container)).toBe(fullHeight);
    expect(remaining).toBeGreaterThanOrEqual(95);
    expect(remaining).toBeLessThanOrEqual(105);
  });

  it('a duration the running phase does not use leaves its pace unchanged', () => {
    mountMidTween(25);
    // 25 in-flight frames plus the completing one
    const controlRemaining = framesToSettle();

    const { chart, container, dataProvider, height } = mountMidTween(25);
    chart.update({ mochartConfig: makeConfig({ focusDuration: 16, expansionDuration: 16, contractionDuration: 16 }), dataProvider });
    advanceFrames(1);
    expect(janHeight(container)).toBeGreaterThanOrEqual(height);
    // the rebuilt tween paces the remaining half at half the unchanged duration: same frame count
    const remaining = 1 + framesToSettle();
    expect(janHeight(container)).toBe(fullHeight);
    expect(remaining).toBe(controlRemaining);
  });
});

describe('duration change mid initial animation', () => {
  // 100-frame entrance, 5-frame value changes
  const slowEntrance: Durations = { initialDuration: 1600, valueChangeDuration: 80 };

  function mountMidEntrance() {
    const mounted = mountChart(highRows, slowEntrance);
    advanceFrames(20);
    const height = janHeight(mounted.container);
    expectMidTween(height);
    return { ...mounted, height };
  }

  it('a config-only change keeps initialDuration pacing for the rest of the entrance', () => {
    mountMidEntrance();
    // 80 in-flight frames plus the completing one
    const controlRemaining = framesToSettle();
    expect(controlRemaining).toBeGreaterThanOrEqual(80);

    const { chart, container, dataProvider, height } = mountMidEntrance();
    chart.update({ mochartConfig: makeConfig({ ...slowEntrance, focusDuration: 16 }), dataProvider });
    advanceFrames(1);
    expect(janHeight(container)).toBeGreaterThanOrEqual(height);
    expect(janHeight(container)).toBeLessThan(fullHeight);
    // the remaining 80% of the extent at 80% of the initial duration: same frame count as untouched
    const remaining = 1 + framesToSettle();
    expect(janHeight(container)).toBe(fullHeight);
    expect(remaining).toBe(controlRemaining);
  });

  it('a longer initialDuration set mid-entrance stretches the rest of the entrance', () => {
    const { chart, container, dataProvider, height } = mountMidEntrance();
    // 400-frame entrance: the remaining 80% takes 320
    chart.update({ mochartConfig: makeConfig({ ...slowEntrance, initialDuration: 6400 }), dataProvider });
    advanceFrames(1);
    expect(janHeight(container)).toBeGreaterThanOrEqual(height);
    const remaining = 1 + framesToSettle();
    expect(janHeight(container)).toBe(fullHeight);
    expect(remaining).toBeGreaterThanOrEqual(315);
    expect(remaining).toBeLessThanOrEqual(325);
  });

  it('a data change mid-entrance becomes a value change at valueChangeDuration pace', () => {
    const { chart, container } = mountMidEntrance();
    // same values through a new provider: only the pace changes
    chart.update({ dataProvider: new mochart.ArrayOfObjectsDataProvider(highRows) });
    const remaining = framesToSettle();
    expect(janHeight(container)).toBe(fullHeight);
    expect(remaining).toBeLessThanOrEqual(5);
  });

  it('a structural config change mid-entrance restarts the entrance from the beginning', () => {
    const { chart, container } = mountMidEntrance();
    // a new category property is structural: the chart rebuilds its data from empty
    const weekRows = highRows.map(row => ({ ...row, week: row.month }));
    chart.update({ mochartConfig: makeConfig(slowEntrance, 'week'), dataProvider: new mochart.ArrayOfObjectsDataProvider(weekRows) });
    advanceFrames(1);
    expect(janHeight(container)).toBeLessThan(fullHeight * 0.1);
    const remaining = 1 + framesToSettle();
    expect(janHeight(container)).toBe(fullHeight);
    expect(remaining).toBeGreaterThanOrEqual(100);
  });
});

describe('initialAnimationPercentage across a config-only change', () => {
  function makeInput(animation: Durations): ChartDataSourceInput {
    return {
      mochartConfig: makeConfig(animation) as EnhancedMochartConfig,
      dataProvider: new mochart.ArrayOfObjectsDataProvider(highRows),
      filteredSeriesIds: {},
      focusedCategoryIndex: -1,
      focusedValueAxisId: null,
      focusedSeriesId: null
    };
  }

  it('resumes from the rendered progress instead of restarting at 0', () => {
    const source = new AnimatedDataSource(() => {});
    const input = makeInput({ initialDuration: 1600, valueChangeDuration: 80 });
    source.start(input);
    advanceFrames(20);
    const before = source.initialAnimationPercentage;
    expect(before).toBeGreaterThan(0.1);
    expect(before).toBeLessThan(0.3);

    const next = { ...input, mochartConfig: makeConfig({ initialDuration: 1600, valueChangeDuration: 80, focusDuration: 16 }) as EnhancedMochartConfig };
    source.update(input, next);
    advanceFrames(1);
    expect(source.initialAnimationPercentage).toBeGreaterThanOrEqual(before!);
    expect(source.initialAnimationPercentage).toBeLessThan(0.3);
    advanceFrames(40);
    expect(source.initialAnimationPercentage).toBeGreaterThan(0.5);
    expect(source.initialAnimationPercentage).toBeLessThan(0.7);
    framesToSettle();
    expect(source.initialAnimationPercentage).toBeNull();
    source.dispose();
  });
});
