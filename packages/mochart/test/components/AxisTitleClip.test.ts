/**
 * The axis-title clip rect's non-clipping dimension: a horizontal axis clips across the chart's
 * height and a vertical one across its width. Reading the width for both cut the title off a chart
 * narrower than its bottom axis is tall.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const rows = [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }];

function mountChart(width: number, height: number): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config: {
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal',
        title: { text: 'Month' }, tickLabel: { rotation: 45 } },
      valueAxes: [{ title: { text: 'Sales' } }],
      series: [{ property: 'sales', renderer: 'bar' }]
    } as unknown as MochartInputConfig,
    data: rows, width, height
  } as DefaultChartProps));
  return container;
}

function clipRect(container: Element, idPrefix: string): SVGRectElement {
  const clipPath = container.querySelector<SVGElement>('clipPath[id^="' + idPrefix + '"]');
  expect(clipPath).not.toBeNull();
  const rect = clipPath!.querySelector<SVGRectElement>('rect');
  expect(rect).not.toBeNull();
  return rect!;
}

const titleClipHeight = (container: Element) =>
  Number(clipRect(container, 'categoryaxistitle__clippath__').getAttribute('height'));
const valueTitleClipWidth = (container: Element) =>
  Number(clipRect(container, 'valueaxistitle__clippath__').getAttribute('width'));

/** y of the axis title's own transform, which the clip has to reach past */
function titleTextY(container: Element): number {
  const text = container.querySelector(getCssSelector('axisTitle') + ' text');
  expect(text).not.toBeNull();
  return Number(text!.getAttribute('transform')!.match(/translate\([^,]+,\s*([^)]+)\)/)![1]);
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('axis title clip', () => {
  // Regression: the horizontal branch read the content width as its vertical extent, so a chart
  // narrower than the title's offset clipped the title away entirely.
  it('gives a horizontal axis title the chart height as its clip extent, whatever the width', () => {
    const wide = mountChart(800, 600);
    const narrow = mountChart(120, 600);
    expect(titleClipHeight(wide)).toBe(600);
    expect(titleClipHeight(narrow)).toBe(600);
    expect(titleClipHeight(narrow)).toBeGreaterThan(titleTextY(narrow));
  });

  // the mirrored dimension, unchanged: a vertical axis title clips across the chart width
  it('gives a vertical axis title the chart width as its clip extent', () => {
    expect(valueTitleClipWidth(mountChart(800, 600))).toBe(800);
    expect(valueTitleClipWidth(mountChart(120, 600))).toBe(120);
  });
});
