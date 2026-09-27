// Values on a log axis animate in logs: halfway through its change, a value moving from 1 to 1000 is at 31.6, halfway up the plot,
// and a category entering or leaving a line starts or ends on the straight line between its neighbours.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installFakeFrameClock, advanceFrames, runFrames, mockBoundingClientRect, mountContainer, trackHandle, barRects } from './helpers';
import { installSvgMeasurementShims } from './svgShims';
import { getCssSelector } from '../../src/utils/ChartDom';
import type { Bounds } from '../../src/types/geometry';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const WIDTH = 400;
const HEIGHT = 300;
const DURATION = 1000;

let mochart: typeof import('../../src');

beforeAll(async () => {
  installFakeFrameClock();
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
  mochart = await import('../../src');
});

function makeConfig(): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { easing: 'linear', valueChangeDuration: DURATION },
    categoryAxis: { property: 'c' },
    valueAxes: [{ scale: 'log', min: 1, max: 1000 }],
    series: [{ id: 'S', property: 'v', renderer: 'bar' }]
  } as unknown as MochartInputConfig;
}

/** The bar's heights as a fraction of the plot, frame by frame, through a change from 1 to 1000. */
function heightFractions(): number[] {
  const container = mountContainer();
  let bounds: Bounds | null = null;
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config: makeConfig(), data: [{ c: 'a', v: 1 }], width: WIDTH, height: HEIGHT,
    onSeriesLayoutBoundsChange: (b) => { bounds = b; }
  } as DefaultChartProps));
  runFrames();
  handle.update({ data: [{ c: 'a', v: 1000 }] } as Partial<DefaultChartProps>);
  const fractions: number[] = [];
  for (let frame = 0; frame < 200 && vi.getTimerCount() > 0; frame++) {
    advanceFrames(1);
    fractions.push(barRects(container, 'S')[0]!.height / bounds!.height);
  }
  return fractions;
}

describe('log axis value animation', () => {
  it('moves a value at a steady rate on screen', () => {
    // a straight line in values would put it at 500.5 halfway through, 0.9 of the way up
    const fractions = heightFractions();
    const start = fractions.lastIndexOf(0);
    const end = fractions.findIndex(fraction => fraction > 0.99);
    expect(end).toBeGreaterThan(start + 10);
    expect(fractions[Math.round((start + end) / 2)]).toBeCloseTo(0.5, 1);
  });
});

/** The lowest point of the error bar, frame by frame, through a change of its low end from one value to another. */
function errorBarLowEnds(from: number, to: number): { ys: number[]; plotHeight: number } {
  const config = {
    ...makeConfig(),
    valueAxes: [{ scale: 'log', min: 1, max: 100 }],
    series: [{ id: 'S', property: 'v', errorLowProperty: 'lo', renderer: 'bar' }]
  } as unknown as MochartInputConfig;
  const container = mountContainer();
  let bounds: Bounds | null = null;
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config, data: [{ c: 'a', v: 10, lo: from }], width: WIDTH, height: HEIGHT,
    onSeriesLayoutBoundsChange: (b) => { bounds = b; }
  } as DefaultChartProps));
  runFrames();
  handle.update({ data: [{ c: 'a', v: 10, lo: to }] } as Partial<DefaultChartProps>);
  const ys: number[] = [];
  for (let frame = 0; frame < 200 && vi.getTimerCount() > 0; frame++) {
    advanceFrames(1);
    const d = container.querySelector(getCssSelector('seriesErrorBar'))?.getAttribute('d') ?? '';
    // the y of each M x,y and V y: the whisker's ends and its caps; a NaN in the path counts as one
    ys.push(d.includes('NaN') ? NaN : Math.max(...Array.from(d.matchAll(/M-?[\d.]+,(-?[\d.]+)|V(-?[\d.]+)/g)).map(m => Number(m[1] ?? m[2]))));
  }
  return { ys, plotHeight: bounds!.height };
}

describe('log axis ends at or below 0', () => {
  it('slides an error bar end off the minimum end of the axis rather than dropping it for the tween', () => {
    const { ys, plotHeight } = errorBarLowEnds(3, -1);
    expect(ys.every(Number.isFinite)).toBe(true);
    expect(ys[0]).toBeLessThan(plotHeight);
    expect(ys[ys.length - 1]).toBeGreaterThan(plotHeight);
    expect(ys.every((y, i) => i === 0 || y >= ys[i - 1]!)).toBe(true);
    expect(new Set(ys.map(Math.round)).size).toBeGreaterThan(5); // a slide, not a jump
  });

  it('slides an error bar end back in from past the minimum end', () => {
    const { ys, plotHeight } = errorBarLowEnds(-1, 3);
    expect(ys.every(Number.isFinite)).toBe(true);
    expect(ys[0]).toBeGreaterThan(plotHeight);
    expect(ys[ys.length - 1]).toBeLessThan(plotHeight);
    expect(ys.every((y, i) => i === 0 || y <= ys[i - 1]!)).toBe(true);
    expect(new Set(ys.map(Math.round)).size).toBeGreaterThan(5);
  });
});

/** The line's points, frame by frame, through an update that removes the middle category. */
function linePointsWhileRemoving(): [number, number][][] {
  const config = {
    version: '1.0.0',
    animation: { easing: 'linear' },
    categoryAxis: { property: 'x', type: 'number', scale: 'linear' },
    valueAxes: [{ scale: 'log', min: 1, max: 1000 }],
    series: [{ property: 'v', renderer: 'line', marker: { shape: null } }]
  } as unknown as MochartInputConfig;
  const container = mountContainer();
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config, data: [{ x: 1, v: 1 }, { x: 2, v: 10 }, { x: 3, v: 1000 }], width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  runFrames();
  handle.update({ data: [{ x: 1, v: 1 }, { x: 3, v: 1000 }] } as Partial<DefaultChartProps>);
  const frames: [number, number][][] = [];
  for (let frame = 0; frame < 200 && vi.getTimerCount() > 0; frame++) {
    advanceFrames(1);
    const d = container.querySelector(getCssSelector('seriesLine'))!.getAttribute('d') ?? '';
    frames.push(Array.from(d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)).map(point => [Number(point[1]), Number(point[2])]));
  }
  return frames;
}

describe('log axis category changes', () => {
  it('ends a leaving point on the straight line between its neighbours, so the line does not snap when it goes', () => {
    // a point filled in by value would end at 500.5, well above the line from 1 to 1000
    const frames = linePointsWhileRemoving();
    const [left, middle, right] = frames[frames.findIndex(points => points.length === 2) - 1]!;
    const onLine = left![1] + (middle![0] - left![0]) / (right![0] - left![0]) * (right![1] - left![1]);
    expect(Math.abs(middle![1] - onLine)).toBeLessThanOrEqual(2);
  });
});
