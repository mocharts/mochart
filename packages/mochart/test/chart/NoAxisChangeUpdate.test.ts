// an update that moves no axis animates its values straight away, with no frames where nothing moves
import { describe, it, beforeAll, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, mockBoundingClientRect } from '../components/helpers';
import { getCssSelector } from '../../src/utils/ChartDom';
import { createPie } from '../../src/data/Pie';
import type { MochartInputConfig } from '../../src/types/config';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  mockBoundingClientRect(300, 200);
  installFakeFrameClock();
  mochart = await import('../../src');
});

const MAX_FRAMES = 400;

/** Mounts and settles `from`, updates to `to`, and returns the frames to settle, how many changed the shapes, and the first and last that did. */
function traceUpdate(config: Record<string, unknown>, from: Record<string, unknown>[], to: Record<string, unknown>[], shapeSelector: string) {
  const container = mountContainer();
  const mochartConfig = mochart.enhanceConfig({
    version: '1.0.0',
    animation: { enabled: true, easing: 'linear', initialDuration: 800, valueChangeDuration: 800, expansionDuration: 800, contractionDuration: 800 },
    ...config
  } as MochartInputConfig);
  const chart = mochart.createChart(container, { mochartConfig, dataProvider: new mochart.ArrayOfObjectsDataProvider(from), width: 300, height: 200 });
  runFrames();
  const shapes = () => Array.from(container.querySelectorAll(shapeSelector), shape => shape.getAttribute('d')).join('|');
  chart.update({ dataProvider: new mochart.ArrayOfObjectsDataProvider(to) });
  let last = shapes();
  let frames = 0;
  let changedFrames = 0;
  let firstChange = 0;
  let lastChange = 0;
  while (vi.getTimerCount() > 0 && frames < MAX_FRAMES) {
    advanceFrames(1);
    frames++;
    const now = shapes();
    if (now !== last) {
      changedFrames++;
      firstChange ||= frames;
      lastChange = frames;
    }
    last = now;
  }
  chart.destroy();
  container.remove();
  return { frames, changedFrames, firstChange, lastChange };
}

function expectNoStillFrames({ frames, changedFrames, firstChange, lastChange }: ReturnType<typeof traceUpdate>): void {
  expect(frames, 'animation never completed').toBeLessThan(MAX_FRAMES);
  // the shapes change on every frame from the first until they stop
  expect(firstChange).toBe(1);
  expect(changedFrames).toBe(lastChange);
  // then at most a completing frame too small to change the drawn path, and the frame that finds nothing left to run
  expect(frames - lastChange).toBeLessThanOrEqual(2);
}

const line = (extra: Record<string, unknown> = {}) => ({ id: 's', property: 'v', renderer: 'line', ...extra });

describe.each([
  ['a value moving inside its error bars',
    { categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' }, series: [line({ errorLowProperty: 'lo', errorHighProperty: 'hi' })] },
    [{ c: 0, v: 5, lo: 0, hi: 10 }, { c: 1, v: 6, lo: 0, hi: 10 }], [{ c: 0, v: 5, lo: 0, hi: 10 }, { c: 1, v: 8, lo: 0, hi: 10 }]],
  ['a value moving inside a fixed axis',
    { categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' }, valueAxes: [{ min: 0, max: 20 }], series: [line()] },
    [{ c: 0, v: 5 }, { c: 1, v: 6 }], [{ c: 0, v: 5 }, { c: 1, v: 12 }]]
])('%s', (_name, config, from, to) => {
  it('moves the line from the first frame until it settles', () => {
    expectNoStillFrames(traceUpdate(config, from, to, getCssSelector('seriesLine')));
  });

  it('moves the line from the first frame when the update is reversed', () => {
    expectNoStillFrames(traceUpdate(config, to, from, getCssSelector('seriesLine')));
  });
});

describe.each([['grows', [80, 20, 18]], ['shrinks', [40, 20, 18]]])('a pie slice that %s', (_name, values) => {
  const pie = (sliceValues: number[]) => createPie(sliceValues.map((value, index) => ({ label: 'L' + index, value })));
  const { chart, pie: pieConfig, categoryAxis, series, data } = pie([62, 20, 18]);

  it('moves the slices from the first frame until they settle', () => {
    expectNoStillFrames(traceUpdate({ chart, pie: pieConfig, categoryAxis, series }, data, pie(values).data, getCssSelector('seriesSlice')));
  });

  it('moves the slices from the first frame when the update is reversed', () => {
    expectNoStillFrames(traceUpdate({ chart, pie: pieConfig, categoryAxis, series }, pie(values).data, data, getCssSelector('seriesSlice')));
  });
});
