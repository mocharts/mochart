// during an animated update the clip indicator follows the drawn values, not the series ranges, which cover both the old and new values
import { describe, it, beforeAll, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, mockBoundingClientRect } from '../components/helpers';
import { getCssSelector } from '../../src/utils/ChartDom';
import type { MochartInputConfig } from '../../src/types/config';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  mockBoundingClientRect(300, 200);
  installFakeFrameClock();
  mochart = await import('../../src');
});

const MAX_FRAMES = 400;

/** The highest point of the line, in plot coordinates where the top edge of a 0 to 20 axis is at 0. */
function lineTop(container: Element): number {
  const d = container.querySelector(getCssSelector('seriesLine'))!.getAttribute('d')!;
  return Math.min(...Array.from(d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g), match => Number(match[2])));
}

function clipIndicatorShown(container: Element): boolean {
  return container.querySelector(getCssSelector('clipIndicator') + ' path') !== null;
}

/** Mounts and settles `from`, updates to `to`, and records each frame's line top and clip indicator state. */
function traceUpdate(from: number, to: number) {
  const container = mountContainer();
  const mochartConfig = mochart.enhanceConfig({
    version: '1.0.0',
    animation: { enabled: true, easing: 'linear', initialDuration: 800, valueChangeDuration: 800, expansionDuration: 800, contractionDuration: 800 },
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    valueAxes: [{ min: 0, max: 20 }],
    series: [{ id: 's', property: 'v', renderer: 'line' }]
  } as MochartInputConfig);
  const rows = (value: number) => [{ c: 0, v: 5 }, { c: 1, v: value }];
  const chart = mochart.createChart(container, { mochartConfig, dataProvider: new mochart.ArrayOfObjectsDataProvider(rows(from)), width: 300, height: 200 });
  runFrames();
  chart.update({ dataProvider: new mochart.ArrayOfObjectsDataProvider(rows(to)) });
  const frames: { top: number; shown: boolean }[] = [];
  while (vi.getTimerCount() > 0 && frames.length < MAX_FRAMES) {
    advanceFrames(1);
    frames.push({ top: lineTop(container), shown: clipIndicatorShown(container) });
  }
  chart.destroy();
  container.remove();
  return frames;
}

describe('the clip indicator during an animated update', () => {
  it.each([['moves past the top edge', 6, 40], ['moves back inside', 40, 6]])('shows only while the line is past the edge when a value %s', (_name, from, to) => {
    const frames = traceUpdate(from, to);
    expect(frames.length, 'animation never completed').toBeLessThan(MAX_FRAMES);
    // both states occur during the update
    expect(frames.some(frame => frame.shown)).toBe(true);
    expect(frames.some(frame => !frame.shown)).toBe(true);
    for (const { top, shown } of frames) {
      expect(shown).toBe(top < 0);
    }
  });
});
