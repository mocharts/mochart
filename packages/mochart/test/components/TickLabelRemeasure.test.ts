/**
 * An update's measure pass re-reads the tick labels once more when the widths it measured picked ticks with other
 * label text. Regression: a linear date axis reverted from a long tick label format or explicit tick label measured the wide labels
 * of the ticks chosen for the long width, re-picked fewer ticks with short labels, and kept them until the next update.
 * Regression: a number axis whose whole-number labels leave room for half steps, and whose half-step labels leave room only
 * for whole steps, kept whichever set its last pass picked, so an updated chart and a fresh one drew different ticks.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installTextMetrics, getRenderedText } from '../golden/textMetrics';
import { installFakeFrameClock, runFrames, mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { getCssSelector } from '../../src/utils/ChartDom';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const WIDTH = 800;
const HEIGHT = 300;
const START = Date.UTC(2020, 0, 15, 1);
const rows = Array.from({ length: 12 }, (_, i) => ({ date: new Date(START + i * 15 * 60000).toISOString(), v: 10 + i }));
const numberRows = Array.from({ length: 26 }, (_, i) => ({ n: i + 1, v: (i * 7) % 11 - 5 }));

const config = {
  version: '1.0.0',
  animation: { enabled: false },
  categoryAxis: { property: 'date', type: 'date', scale: 'linear' },
  series: [{ property: 'v', renderer: 'line' }],
  legend: { visible: false }
} as unknown as MochartInputConfig;

function numberConfig(animate: boolean, categoryAxis: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: animate },
    categoryAxis: { property: 'n', type: 'number', scale: 'linear', ...categoryAxis },
    series: [{ property: 'v', renderer: 'line' }],
    legend: { visible: false }
  } as unknown as MochartInputConfig;
}

function categoryTicks(container: Element): string[] {
  return [...container.querySelectorAll(getCssSelector('categoryAxis') + ' ' + getCssSelector('axisTickLabel'))]
    .map(label => label.getAttribute('transform') + ' ' + getRenderedText(label.querySelector('text')!));
}

let mochart: typeof import('../../src');

beforeAll(async () => {
  installTextMetrics();
  installFakeFrameClock();
  mochart = await import('../../src');
  mockBoundingClientRect(WIDTH, HEIGHT);
});

function createChart(container: HTMLElement, chartConfig: MochartInputConfig, data: object[], width = WIDTH) {
  const handle = trackHandle(mochart.createDefaultChart(container, { config: chartConfig, data, width, height: HEIGHT } as DefaultChartProps));
  runFrames();
  return handle;
}

/** Build a chart, update it to the changed category axis and back, and compare its ticks with a fresh chart's. */
function expectRevertMatchesFresh(categoryAxisChange: Record<string, unknown>): void {
  const fresh = mountContainer();
  createChart(fresh, config, rows);
  const container = mountContainer();
  const handle = createChart(container, config, rows);
  const changed = structuredClone(config) as { categoryAxis: Record<string, unknown> };
  Object.assign(changed.categoryAxis, categoryAxisChange);
  handle.update({ config: changed as unknown as MochartInputConfig } as Partial<DefaultChartProps>);
  handle.update({ config: structuredClone(config) } as Partial<DefaultChartProps>);
  expect(categoryTicks(container)).toEqual(categoryTicks(fresh));
}

/** Build a chart, update it to the changed config, and compare its ticks with a fresh chart's built with that config. */
function expectUpdateMatchesFresh(base: MochartInputConfig, changed: MochartInputConfig, data: object[], width: number): void {
  const fresh = mountContainer();
  createChart(fresh, changed, data, width);
  const container = mountContainer();
  const handle = createChart(container, base, data, width);
  handle.update({ config: structuredClone(changed) } as Partial<DefaultChartProps>);
  runFrames();
  expect(categoryTicks(container)).toEqual(categoryTicks(fresh));
}

describe('tick label remeasure on update', () => {
  it('draws the same category ticks after reverting a long tick label format as a fresh chart', () => {
    expectRevertMatchesFresh({ tickLabel: { format: '%A, %B %d, %Y at %H:%M:%S %A, %B %d, %Y at %H:%M:%S' } });
  });

  it('draws the same category ticks after reverting a long explicit tick label as a fresh chart', () => {
    expectRevertMatchesFresh({ ticks: [{ value: rows[6]!.date, label: 'A considerably longer string, long enough to need truncating' }] });
  });

  it('draws the same category ticks after an update to maxTickCount 0 as a fresh chart when the labels switch between two sets', () => {
    expectUpdateMatchesFresh(numberConfig(false, { min: 5, max: 20 }), numberConfig(false, { min: 5, max: 20, maxTickCount: 0 }), numberRows, 760);
  });

  it('draws the same category ticks after an animated update to a collapsed max as a fresh chart when the labels switch between two sets', () => {
    expectUpdateMatchesFresh(numberConfig(true), numberConfig(true, { max: 1 }), numberRows, WIDTH);
  });
});
