import { describe, it, expect } from 'vitest';
import { createOhlc } from '../../src/data/Ohlc';
import { enhanceConfig } from '../../src/config/helper';
import { getDataErrors } from '../../src/data/DataValidator';
import { ArrayOfObjectsDataProvider } from '../../src/data/DataProvider';
import type { CreateOhlcOptions } from '../../src/data/Ohlc';

describe('createOhlc', () => {
  it('returns one row per bar keyed by direction, with the open split too', () => {
    const { data } = createOhlc([
      { label: 'Mon', open: 100, high: 105, low: 98, close: 103 },
      { label: 'Tue', open: 103, high: 104, low: 96, close: 97 }
    ]);
    expect(data).toEqual([
      { label: 'Mon', open: 100, high: 105, low: 98, close: 103, up: 103, down: undefined, upHigh: 105, downHigh: undefined, upOpen: 100, downOpen: undefined, change: 3, direction: 'up' },
      { label: 'Tue', open: 103, high: 104, low: 96, close: 97, up: undefined, down: 97, upHigh: undefined, downHigh: 104, upOpen: undefined, downOpen: 103, change: -6, direction: 'down' }
    ]);
  });

  it('emits config fragments for ordinal line and tick bars', () => {
    const { categoryAxis: categoryAxisConfig, series: seriesConfigs } = createOhlc([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }]);
    expect(categoryAxisConfig).toEqual({ property: 'label', type: 'string', scale: 'ordinal' });
    expect(seriesConfigs.map((seriesConfig) => seriesConfig.id)).toEqual(['up', 'down', 'upOpen', 'downOpen', 'upClose', 'downClose']);
    for (const seriesConfig of seriesConfigs) {
      expect(seriesConfig.renderer).toBe('bar');
      expect(seriesConfig.missingValueMode).toBe('connect');
      expect(seriesConfig.partialRangeIsMissing).toBe(true);
      expect(seriesConfig.group).toBeNull();
      expect(seriesConfig.stack).toBeNull();
      expect(seriesConfig.shapeStyle!.normal!.fillOpacity).toBe(1);
      expect(seriesConfig.shapeStyle!.normal!.fillColor).toMatch(/^#/);
    }
  });

  it('spans lines from low to high and ticks across zero-extent open/close ranges, split by direction', () => {
    const { series: seriesConfigs } = createOhlc([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }]);
    const [up, down, upOpen, downOpen, upClose, downClose] = seriesConfigs;
    expect(up).toMatchObject({ property: 'upHigh', rangeProperty: 'low', bar: { widthFraction: 0.15 }, title: 'Up', valueLabel: 'Range' });
    expect(down).toMatchObject({ property: 'downHigh', rangeProperty: 'low', bar: { widthFraction: 0.15 }, title: 'Down', valueLabel: 'Range' });
    expect(upOpen).toMatchObject({ property: 'upOpen', rangeProperty: 'open', bar: { widthFraction: 0.5, alignFraction: 0, minExtent: 2 }, showInLegend: false, followSeries: 'up', valueLabel: 'Open' });
    expect(downOpen).toMatchObject({ property: 'downOpen', rangeProperty: 'open', bar: { widthFraction: 0.5, alignFraction: 0, minExtent: 2 }, showInLegend: false, followSeries: 'down', valueLabel: 'Open' });
    expect(upClose).toMatchObject({ property: 'up', rangeProperty: 'close', bar: { widthFraction: 0.5, alignFraction: 1, minExtent: 2 }, showInLegend: false, followSeries: 'up', valueLabel: 'Close' });
    expect(downClose).toMatchObject({ property: 'down', rangeProperty: 'close', bar: { widthFraction: 0.5, alignFraction: 1, minExtent: 2 }, showInLegend: false, followSeries: 'down', valueLabel: 'Close' });
  });

  it('colors each tick to match its line, with strokes matching the fills', () => {
    const { series: seriesConfigs } = createOhlc([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }]);
    const [up, down, upOpen, downOpen, upClose, downClose] = seriesConfigs;
    expect(upOpen.shapeStyle!.normal!.fillColor).toBe(up.shapeStyle!.normal!.fillColor);
    expect(upClose.shapeStyle!.normal!.fillColor).toBe(up.shapeStyle!.normal!.fillColor);
    expect(downOpen.shapeStyle!.normal!.fillColor).toBe(down.shapeStyle!.normal!.fillColor);
    expect(downClose.shapeStyle!.normal!.fillColor).toBe(down.shapeStyle!.normal!.fillColor);
    expect(up.shapeStyle!.normal!.fillColor).not.toBe(down.shapeStyle!.normal!.fillColor);
    // the focused 1px outline must not fall back to the palette-index color
    for (const seriesConfig of seriesConfigs) {
      expect(seriesConfig.shapeStyle!.normal!.strokeColor).toBe(seriesConfig.shapeStyle!.normal!.fillColor);
    }
  });

  it('honours custom titles, colors, widths and tooltip labels', () => {
    const { series: seriesConfigs } = createOhlc([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }], {
      seriesTitles: { up: 'Gain' },
      colors: { down: '#123456' },
      lineWidthFraction: 0.1,
      tickWidthFraction: 0.4,
      tickExtent: 3,
      rangeTitle: 'Low – High',
      openTitle: 'O',
      closeTitle: 'C'
    });
    const [up, down, upOpen, , upClose] = seriesConfigs;
    expect(up.title).toBe('Gain');
    expect(down.title).toBe('Down');
    expect(down.shapeStyle!.normal!.fillColor).toBe('#123456');
    expect(up.bar!.widthFraction).toBe(0.1);
    expect(upOpen.bar!.widthFraction).toBe(0.4);
    expect(upOpen.bar!.minExtent).toBe(3);
    expect(up.valueLabel).toBe('Low – High');
    expect(upOpen.valueLabel).toBe('O');
    expect(upClose.valueLabel).toBe('C');
  });

  it('returns empty data for empty input', () => {
    const { candles, data, series: seriesConfigs } = createOhlc([]);
    expect(candles).toEqual([]);
    expect(data).toEqual([]);
    expect(seriesConfigs).toHaveLength(6);
  });

  it('supports the volume pane like the candlestick helper', () => {
    const { data, series: seriesConfigs, valueAxes: valueAxisConfigs } = createOhlc([
      { label: 'Mon', open: 1, high: 3, low: 0, close: 2, volume: 500 }
    ], { volume: true });
    expect(data[0]).toMatchObject({ volume: 500, upVolume: 500, downVolume: undefined });
    expect(seriesConfigs.map((seriesConfig) => seriesConfig.id))
      .toEqual(['up', 'down', 'upOpen', 'downOpen', 'upClose', 'downClose', 'upVolume', 'downVolume']);
    for (const seriesConfig of seriesConfigs) {
      expect(seriesConfig.axis, seriesConfig.id).toBe(seriesConfig.id!.includes('Volume') ? 'volume' : 'price');
    }
    const [priceAxis, volumeAxis] = valueAxisConfigs!;
    expect(priceAxis).toMatchObject({ id: 'price' });
    expect(volumeAxis).toMatchObject({ id: 'volume', min: 0, visible: false });
  });

  it('emits no volume fragments by default', () => {
    const { data, series: seriesConfigs, valueAxes: valueAxisConfigs } = createOhlc([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }]);
    expect(valueAxisConfigs).toBeUndefined();
    expect('upVolume' in data[0]).toBe(false);
    expect(seriesConfigs).toHaveLength(6);
  });

  // createOhlc shares the candlestick guards, and its errors name createOhlc
  it('throws when two bars share a label', () => {
    expect(() => createOhlc([
      { label: 'Mon', open: 1, high: 3, low: 0, close: 2 },
      { label: 'Mon', open: 2, high: 4, low: 1, close: 1.5 }
    ])).toThrow(/^createOhlc: labels must be unique, duplicates: Mon/);
  });

  it('names createOhlc in the candle and volume errors', () => {
    expect(() => createOhlc([{ label: 'Mon', open: 2, high: 1, low: 3, close: 2.5 }]))
      .toThrow(/^createOhlc: Mon has high 1 below low 3/);
    expect(() => createOhlc([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }], { volume: { heightFraction: 2 } }))
      .toThrow(/^createOhlc: volume heightFraction/);
  });

  describe('config round-trip', () => {
    const items = [
      { label: 'Mon', open: 100, high: 105, low: 98, close: 103, volume: 1200 },
      { label: 'Tue', open: 103, high: 104, low: 96, close: 97, volume: 800 },
      { label: 'Wed', open: 97, high: 97, low: 97, close: 97, volume: 300 } // flat bar
    ];

    it.each<[string, CreateOhlcOptions]>([
      ['default', {}],
      ['volume', { volume: true }],
      ['custom widths + volume', { lineWidthFraction: 0.05, tickWidthFraction: 0.5, tickExtent: 3, volume: { heightFraction: 0.3, gapFraction: 0.1 } }]
    ])('assembles a valid config and data provider (%s)', (_label, options) => {
      const ohlc = createOhlc(items, options);
      const mochartConfig = enhanceConfig({
        version: '1.0.0',
        categoryAxis: ohlc.categoryAxis,
        valueAxes: ohlc.valueAxes,
        series: ohlc.series
      });
      expect(mochartConfig.validation.errors).toEqual([]);
      expect(mochartConfig.validation.valid).toBe(true);
      expect(getDataErrors(mochartConfig, new ArrayOfObjectsDataProvider(ohlc.data))).toEqual([]);
    });

    it('stays valid when a direction is absent from the data', () => {
      const ohlc = createOhlc(items.slice(1, 2), { volume: true }); // down only
      const mochartConfig = enhanceConfig({
        version: '1.0.0',
        categoryAxis: ohlc.categoryAxis,
        valueAxes: ohlc.valueAxes,
        series: ohlc.series
      });
      expect(mochartConfig.validation.valid).toBe(true);
      expect(getDataErrors(mochartConfig, new ArrayOfObjectsDataProvider(ohlc.data))).toEqual([]);
    });
  });
});
