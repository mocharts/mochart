// an inverted explicit domain has a negative extent that used to zero the phase-duration denominator — an Infinity-duration tween that never settles; both tests drive real frames on a fake clock
import { describe, it, beforeAll, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';

const WIDTH = 800;
const HEIGHT = 600;
// far beyond any real phase chain here (400ms + 200ms + 400ms ≈ 63 frames)
const RUNAWAY_FRAMES = 2000;

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

interface Row { [key: string]: string | number; c: string; v: number }

function mount(valueAxis: Record<string, unknown>, rows: Row[]) {
  const mochartConfig = mochart.enhanceConfig({
    version: '1.0.0',
    animation: { enabled: true, expansionDuration: 400, valueChangeDuration: 200, contractionDuration: 400 },
    categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
    valueAxes: [valueAxis],
    series: [{ id: 'S0', property: 'v', renderer: 'bar' }]
  } as never);
  const container = mountContainer();
  const chart = mochart.createChart(container, {
    mochartConfig,
    dataProvider: new mochart.ArrayOfObjectsDataProvider(rows) as never,
    width: WIDTH,
    height: HEIGHT
  });
  return { container, chart, mochartConfig };
}

function updateRows(chart: ReturnType<typeof mount>['chart'], mochartConfig: unknown, rows: Row[]) {
  chart.update({
    mochartConfig,
    dataProvider: new mochart.ArrayOfObjectsDataProvider(rows) as never,
    width: WIDTH,
    height: HEIGHT
  } as never);
}

describe('inverted value-axis domain pacing', () => {
  it('settles when `min` sits above all-negative data and the values grow back to it', () => {
    // domain [0, -5]: extent -5, and a growth delta of +5 cancels the denominator exactly
    const { chart, mochartConfig } = mount({ min: 0 }, [{ c: 'a', v: -5 }, { c: 'b', v: -5 }]);
    runFrames(RUNAWAY_FRAMES);

    updateRows(chart, mochartConfig, [{ c: 'a', v: 0 }, { c: 'b', v: 0 }]);

    const frames = runFrames(RUNAWAY_FRAMES);
    expect(frames, 'animation never completed').toBeLessThan(RUNAWAY_FRAMES);
    expect(vi.getTimerCount(), 'a frame request outlived the animation').toBe(0);
  });

  it('settles when `max` sits below all-positive data and the values fall back to it', () => {
    const { chart, mochartConfig } = mount({ max: 0 }, [{ c: 'a', v: 5 }, { c: 'b', v: 5 }]);
    runFrames(RUNAWAY_FRAMES);

    updateRows(chart, mochartConfig, [{ c: 'a', v: 0 }, { c: 'b', v: 0 }]);

    const frames = runFrames(RUNAWAY_FRAMES);
    expect(frames, 'animation never completed').toBeLessThan(RUNAWAY_FRAMES);
    expect(vi.getTimerCount(), 'a frame request outlived the animation').toBe(0);
  });
});
