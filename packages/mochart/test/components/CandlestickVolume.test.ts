// createCandlestick volume pane: direction-split volume bars on a hidden second axis confined to the bottom band,
// price candles lifted above them; asserts parse bar paths (`M{x},{y}h{w}v{h}h{-w}Z`).
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle, barRects } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import { createCandlestick } from '../../src/data/Candlestick';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

const ITEMS = [
  { label: 'Mon', open: 1, high: 3, low: 0, close: 2, volume: 1200 },
  { label: 'Tue', open: 2, high: 4, low: 1, close: 1.5, volume: 800 }
];

function mountVolumeCandlestick(): Element {
  const { data, categoryAxis: categoryAxisConfig, series: seriesConfigs, valueAxes: valueAxisConfigs } = createCandlestick(ITEMS, { volume: true });
  const config = {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: categoryAxisConfig,
    valueAxes: valueAxisConfigs,
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

describe('candlestick volume pane', () => {
  it('renders the volume bars entirely below the price marks', () => {
    const container = mountVolumeCandlestick();
    const priceBottoms = ['upWick', 'downWick', 'up', 'down']
      .flatMap((seriesId) => barRects(container, seriesId))
      .map((bar) => bar.y + bar.height);
    const volumeTops = ['upVolume', 'downVolume']
      .flatMap((seriesId) => barRects(container, seriesId))
      .map((bar) => bar.y);
    expect(priceBottoms).toHaveLength(4);
    expect(volumeTops).toHaveLength(2);
    expect(Math.max(...priceBottoms)).toBeLessThan(Math.min(...volumeTops));
  });

  it('confines the tallest volume bar to the bottom heightFraction of the plot', () => {
    const container = mountVolumeCandlestick();
    const volumeBars = ['upVolume', 'downVolume'].flatMap((seriesId) => barRects(container, seriesId));
    // the volume axis min is pinned at 0, so every bar grows from the bottom
    // of the series area — the shared baseline is the series extent
    const bottoms = volumeBars.map((bar) => bar.y + bar.height);
    const seriesExtent = bottoms[0];
    for (const bottom of bottoms) {
      expect(bottom).toBeCloseTo(seriesExtent, 6);
    }
    // default heightFraction 0.2: the largest volume reaches 20% up the plot
    const tallest = Math.max(...volumeBars.map((bar) => bar.height));
    expect(tallest / seriesExtent).toBeCloseTo(0.2, 2);
    // and the price marks keep a visible gap above the volume band
    const maxPriceBottom = Math.max(...['upWick', 'downWick', 'up', 'down']
      .flatMap((seriesId) => barRects(container, seriesId))
      .map((bar) => bar.y + bar.height));
    const minVolumeTop = Math.min(...volumeBars.map((bar) => bar.y));
    expect(minVolumeTop - maxPriceBottom).toBeGreaterThan(seriesExtent * 0.02);
  });

  it('scales the volume bars against their own axis', () => {
    const container = mountVolumeCandlestick();
    const [upVolume] = barRects(container, 'upVolume'); // 1200
    const [downVolume] = barRects(container, 'downVolume'); // 800
    expect(downVolume.height / upVolume.height).toBeCloseTo(800 / 1200, 1);
  });
});
