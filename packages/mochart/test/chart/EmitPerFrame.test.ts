/**
 * The animated data source renders once per frame: the chained data steps (expand, value, contract),
 * their zero-duration fallbacks and a focus tween running alongside all emit through one afterUpdate
 * flush instead of one Chart.update each.
 */
import { describe, it, beforeAll, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mockBoundingClientRect } from '../components/helpers';
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

const lowRows = [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }, { month: 'Mar', sales: 30 }];
const highRows = [{ month: 'Jan', sales: 80 }, { month: 'Feb', sales: 60 }, { month: 'Mar', sales: 90 }];
const MAX_FRAMES = 400;

function makeInput(rows: typeof lowRows, focusedCategoryIndex = -1): ChartDataSourceInput {
  const mochartConfig = mochart.enhanceConfig({
    version: '1.0.0',
    animation: { enabled: true, initialDuration: 160, valueChangeDuration: 160, expansionDuration: 160, contractionDuration: 160, focusDuration: 80 },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    valueAxes: [{ id: 'value' }],
    series: [{ id: 'sales', property: 'sales', axis: 'value', renderer: 'bar' }]
  } as MochartInputConfig) as EnhancedMochartConfig;
  return {
    mochartConfig,
    dataProvider: new mochart.ArrayOfObjectsDataProvider(rows),
    filteredSeriesIds: {},
    focusedCategoryIndex,
    focusedValueAxisId: null,
    focusedSeriesId: null
  };
}

/** Frames until the tweens settle; fails rather than spinning past a stuck tween. */
function framesToSettle(): number {
  const frames = runFrames(MAX_FRAMES);
  expect(frames, 'animation never completed').toBeLessThan(MAX_FRAMES);
  return frames;
}

describe('animated data source emits once per frame', () => {
  it('through the entrance and a value change with axis expansion', () => {
    const emit = vi.fn();
    const source = new AnimatedDataSource(emit);
    const input = makeInput(lowRows);
    source.start(input);
    expect(emit).not.toHaveBeenCalled();
    advanceFrames(1);
    expect(emit).toHaveBeenCalledTimes(1);
    const entranceFrames = 1 + framesToSettle();
    expect(emit.mock.calls.length).toBeLessThanOrEqual(entranceFrames);

    // the higher values expand the axis, so every phase of the chain runs
    emit.mockClear();
    const next = makeInput(highRows);
    source.update(input, next);
    advanceFrames(1);
    expect(emit).toHaveBeenCalledTimes(1);
    const changeFrames = 1 + framesToSettle();
    expect(emit.mock.calls.length).toBeLessThanOrEqual(changeFrames);
    expect(emit.mock.calls.length).toBeGreaterThan(2);
    source.dispose();
  });

  it('with a focus tween running alongside the data tween', () => {
    const emit = vi.fn();
    const source = new AnimatedDataSource(emit);
    const input = makeInput(lowRows);
    source.start(input);
    framesToSettle();

    emit.mockClear();
    const next = makeInput(highRows, 1);
    source.update(input, next);
    advanceFrames(1);
    expect(emit).toHaveBeenCalledTimes(1);
    const frames = 1 + framesToSettle();
    expect(emit.mock.calls.length).toBeLessThanOrEqual(frames);
    source.dispose();
  });
});
