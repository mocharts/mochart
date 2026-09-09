// Pointer fractions and category picking must survive CSS scaling: the plot rect here reports half its logical size
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartEventPayload, DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getChartRootCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

const config = {
  version: '1.0.0',
  animation: { enabled: false },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  series: [{ property: 'sales' }]
} as unknown as MochartInputConfig;

/** Report every element's client rect at `scale` of its logical size, anchored at the origin. */
function mockRectsAtScale(scale: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const width = WIDTH * scale;
    const height = HEIGHT * scale;
    return {
      x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({})
    } as DOMRect;
  });
}

function mountChart(onChartMouseMove: (payload: ChartEventPayload) => void) {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT, onChartMouseMove,
    tooltip: undefined
  } as unknown as DefaultChartProps));
  return container;
}

function move(root: Element, clientX: number, clientY: number) {
  root.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
}

beforeAll(() => {
  installSvgMeasurementShims();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pointer payloads under CSS scaling', () => {
  it('reports the same fractions and category at 1x and at 0.5x', () => {
    const unscaled: ChartEventPayload[] = [];
    mockRectsAtScale(1);
    let container = mountChart(payload => { unscaled.push(payload); });
    let root = container.querySelector(getChartRootCssSelector())!;
    move(root, 10, 10);
    move(root, WIDTH * 0.75, HEIGHT * 0.5);

    const scaled: ChartEventPayload[] = [];
    mockRectsAtScale(0.5);
    container = mountChart(payload => { scaled.push(payload); });
    root = container.querySelector(getChartRootCssSelector())!;
    // the same *visual* points, in the CSS pixels the page actually delivers
    move(root, 5, 5);
    move(root, WIDTH * 0.75 * 0.5, HEIGHT * 0.5 * 0.5);

    const last = (list: ChartEventPayload[]) => list[list.length - 1];
    expect(scaled.length).toBe(unscaled.length);
    expect(last(scaled).categoryIndex).toBe(last(unscaled).categoryIndex);
    expect(last(scaled).categoryFraction).toBeCloseTo(last(unscaled).categoryFraction, 6);
    expect(last(scaled).valueFraction).toBeCloseTo(last(unscaled).valueFraction, 6);
  });

  it('keeps percentages inside 0-1 when the chart is scaled down', () => {
    const payloads: ChartEventPayload[] = [];
    mockRectsAtScale(0.5);
    const container = mountChart(payload => { payloads.push(payload); });
    const root = container.querySelector(getChartRootCssSelector())!;

    // bottom-right of the visually scaled chart
    move(root, 10, 10);
    move(root, WIDTH * 0.5 - 2, HEIGHT * 0.5 - 2);

    const last = payloads[payloads.length - 1];
    expect(last.categoryFraction).toBeLessThanOrEqual(1);
    expect(last.valueFraction).toBeLessThanOrEqual(1);
    // the far right of the plot must still resolve to the last category
    expect(last.categoryIndex).toBe(rows.length - 1);
  });
});
