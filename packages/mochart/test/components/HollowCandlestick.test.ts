// createCandlestick hollow option: up bodies outlined (transparent fill), wick split into segments stopping at the
// body edges, shapeless wick series absent from the DOM; asserts parse bar paths (`M{x},{y}h{w}v{h}h{-w}Z`).
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle, barRects } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import { createCandlestick } from '../../src/data/Candlestick';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getIdCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

// Mon is an up candle (body open 1 → close 2), Tue a down candle.
const ITEMS = [
  { label: 'Mon', open: 1, high: 3, low: 0, close: 2 },
  { label: 'Tue', open: 2, high: 4, low: 1, close: 1.5 }
];

function mountHollowCandlestick(): Element {
  const { data, categoryAxis: categoryAxisConfig, series: seriesConfigs } = createCandlestick(ITEMS, { hollow: true });
  const config = {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: categoryAxisConfig,
    series: seriesConfigs
  } as unknown as MochartInputConfig;
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('hollow candlestick rendering', () => {
  it('draws the up body as an outlined transparent rect and the down body filled', () => {
    const container = mountHollowCandlestick();
    const [upBody] = barRects(container, 'up');
    const [downBody] = barRects(container, 'down');
    expect(upBody.path.getAttribute('fill-opacity')).toBe('0');
    expect(upBody.path.getAttribute('stroke-width')).toBe('2');
    expect(downBody.path.getAttribute('fill-opacity')).toBe('1');
    expect(downBody.path.getAttribute('stroke-width')).toBe('0');
  });

  it('renders no shape for the shapeless wick series and no markers for it', () => {
    const container = mountHollowCandlestick();
    expect(container.querySelectorAll(getIdCssSelector('series', 'upWick') + ' path').length).toBe(0);
    expect(container.querySelectorAll(getIdCssSelector('series', 'upWick') + ' circle').length).toBe(0);
  });

  it('stops the wick segments exactly at the body edges', () => {
    const container = mountHollowCandlestick();
    const [upBody] = barRects(container, 'up');
    const [upper] = barRects(container, 'upWickUpper');
    const [lower] = barRects(container, 'upWickLower');
    // upper segment spans high → body top, lower spans body bottom → low
    expect(upper.y + upper.height).toBeCloseTo(upBody.y, 6);
    expect(lower.y).toBeCloseTo(upBody.y + upBody.height, 6);
    expect(upper.height).toBeGreaterThan(0);
    expect(lower.height).toBeGreaterThan(0);
  });

  it('gates every hollow series to its direction', () => {
    const container = mountHollowCandlestick();
    for (const seriesId of ['up', 'upWickUpper', 'upWickLower', 'down', 'downWickUpper', 'downWickLower']) {
      expect(barRects(container, seriesId), seriesId).toHaveLength(1);
    }
  });
});
