/**
 * An update's measure pass re-reads the tick labels once more when the widths it measured picked ticks with other
 * label text. Regression: a linear date axis reverted from a long tick label format or explicit tick label measured the wide labels
 * of the ticks chosen for the long width, re-picked fewer ticks with short labels, and kept them until the next update.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installTextMetrics, getRenderedText } from '../golden/textMetrics';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import { getCssSelector } from '../../src/utils/ChartDom';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const WIDTH = 800;
const HEIGHT = 300;
const START = Date.UTC(2020, 0, 15, 1);
const rows = Array.from({ length: 12 }, (_, i) => ({ date: new Date(START + i * 15 * 60000).toISOString(), v: 10 + i }));

const config = {
  version: '1.0.0',
  animation: { enabled: false },
  categoryAxis: { property: 'date', type: 'date', scale: 'linear' },
  series: [{ property: 'v', renderer: 'line' }],
  legend: { visible: false }
} as unknown as MochartInputConfig;

function categoryTicks(container: Element): string[] {
  return [...container.querySelectorAll(getCssSelector('categoryAxis') + ' ' + getCssSelector('axisTickLabel'))]
    .map(label => label.getAttribute('transform') + ' ' + getRenderedText(label.querySelector('text')!));
}

beforeAll(() => {
  installTextMetrics();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

/** Build a chart, update it to the changed category axis and back, and compare its ticks with a fresh chart's. */
function expectRevertMatchesFresh(categoryAxisChange: Record<string, unknown>): void {
  const fresh = mountContainer();
  trackHandle(createDefaultChart(fresh, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  const changed = structuredClone(config) as { categoryAxis: Record<string, unknown> };
  Object.assign(changed.categoryAxis, categoryAxisChange);
  handle.update({ config: changed as unknown as MochartInputConfig } as Partial<DefaultChartProps>);
  handle.update({ config: structuredClone(config) } as Partial<DefaultChartProps>);
  expect(categoryTicks(container)).toEqual(categoryTicks(fresh));
}

describe('tick label remeasure on update', () => {
  it('draws the same category ticks after reverting a long tick label format as a fresh chart', () => {
    expectRevertMatchesFresh({ tickLabel: { format: '%A, %B %d, %Y at %H:%M:%S %A, %B %d, %Y at %H:%M:%S' } });
  });

  it('draws the same category ticks after reverting a long explicit tick label as a fresh chart', () => {
    expectRevertMatchesFresh({ ticks: [{ value: rows[6]!.date, label: 'A considerably longer string, long enough to need truncating' }] });
  });
});
