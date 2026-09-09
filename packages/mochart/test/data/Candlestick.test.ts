import { describe, it, expect } from 'vitest';
import { computeCandlesticks, createCandlestick } from '../../src/data/Candlestick';
import { enhanceConfig } from '../../src/config/helper';
import { getDataErrors } from '../../src/data/DataValidator';
import { ArrayOfObjectsDataProvider } from '../../src/data/DataProvider';
import type { CreateCandlestickOptions } from '../../src/data/Candlestick';

describe('computeCandlesticks', () => {
  it('returns no candles for empty input', () => {
    expect(computeCandlesticks([])).toEqual([]);
  });

  it('computes the change and classifies directions by its sign', () => {
    const candles = computeCandlesticks([
      { label: 'Mon', open: 100, high: 105, low: 98, close: 103 },
      { label: 'Tue', open: 103, high: 104, low: 96, close: 97 },
      { label: 'Wed', open: 97, high: 99, low: 95, close: 97 }
    ]);
    expect(candles.map((candle) => candle.change)).toEqual([3, -6, 0]);
    expect(candles.map((candle) => candle.direction)).toEqual(['up', 'down', 'up']);
  });

  it('passes the raw values through', () => {
    const candles = computeCandlesticks([{ label: 'Mon', open: 100, high: 105, low: 98, close: 103 }]);
    expect(candles[0]).toEqual({ label: 'Mon', open: 100, high: 105, low: 98, close: 103, change: 3, direction: 'up' });
  });
});

describe('createCandlestick', () => {
  it('returns one row per candle keyed by direction', () => {
    const { data } = createCandlestick([
      { label: 'Mon', open: 100, high: 105, low: 98, close: 103 },
      { label: 'Tue', open: 103, high: 104, low: 96, close: 97 }
    ]);
    expect(data).toEqual([
      { label: 'Mon', open: 100, high: 105, low: 98, close: 103, up: 103, down: undefined, upHigh: 105, downHigh: undefined, change: 3, direction: 'up' },
      { label: 'Tue', open: 103, high: 104, low: 96, close: 97, up: undefined, down: 97, upHigh: undefined, downHigh: 104, change: -6, direction: 'down' }
    ]);
  });

  // A doji's zero-height body draws nothing when filled but still shows its 2px outline when
  // hollow, which is why only the filled bodies get a floor.
  it('gives filled bodies a minimum height so a doji still draws', () => {
    const { series } = createCandlestick([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }]);
    const bodies = series.filter((seriesConfig) => seriesConfig.id === 'up' || seriesConfig.id === 'down');
    expect(bodies.map((seriesConfig) => seriesConfig.bar!.minExtent)).toEqual([2, 2]);

    // the wicks are bars too, but a zero-length wick genuinely means no range there
    const wicks = series.filter((seriesConfig) => seriesConfig.id!.endsWith('Wick'));
    expect(wicks.every((seriesConfig) => seriesConfig.bar!.minExtent === undefined)).toBe(true);
  });

  it('leaves the hollow up body alone, which already draws its outline', () => {
    const { series } = createCandlestick([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }], { hollow: true });
    const up = series.find((seriesConfig) => seriesConfig.id === 'up')!;
    const down = series.find((seriesConfig) => seriesConfig.id === 'down')!;
    expect(up.bar!.minExtent).toBeUndefined();
    expect(up.shapeStyle!.normal!.strokeWidth).toBe(2);
    expect(down.bar!.minExtent).toBe(2);
  });

  it('emits config fragments for ordinal wick and body bars', () => {
    const { categoryAxis: categoryAxisConfig, series: seriesConfigs } = createCandlestick([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }]);
    expect(categoryAxisConfig).toEqual({ property: 'label', type: 'string', scale: 'ordinal' });
    expect(seriesConfigs.map((seriesConfig) => seriesConfig.id)).toEqual(['upWick', 'downWick', 'up', 'down']);
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

  it('spans wicks from low to high and bodies from open to close, split by direction', () => {
    const { series: seriesConfigs } = createCandlestick([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }]);
    const [upWick, downWick, up, down] = seriesConfigs;
    expect(upWick).toMatchObject({ property: 'upHigh', rangeProperty: 'low', bar: { widthFraction: 0.15 }, showInLegend: false, followSeries: 'up', valueLabel: 'Range' });
    expect(downWick).toMatchObject({ property: 'downHigh', rangeProperty: 'low', bar: { widthFraction: 0.15 }, showInLegend: false, followSeries: 'down', valueLabel: 'Range' });
    expect(up).toMatchObject({ property: 'up', rangeProperty: 'open', bar: { widthFraction: 1 }, title: 'Up' });
    expect(down).toMatchObject({ property: 'down', rangeProperty: 'open', bar: { widthFraction: 1 }, title: 'Down' });
  });

  it('colors each wick to match its body, with strokes matching the fills', () => {
    const { series: seriesConfigs } = createCandlestick([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }]);
    const [upWick, downWick, up, down] = seriesConfigs;
    expect(upWick.shapeStyle!.normal!.fillColor).toBe(up.shapeStyle!.normal!.fillColor);
    expect(downWick.shapeStyle!.normal!.fillColor).toBe(down.shapeStyle!.normal!.fillColor);
    expect(up.shapeStyle!.normal!.fillColor).not.toBe(down.shapeStyle!.normal!.fillColor);
    // the focused 1px outline must not fall back to the palette-index color
    for (const seriesConfig of seriesConfigs) {
      expect(seriesConfig.shapeStyle!.normal!.strokeColor).toBe(seriesConfig.shapeStyle!.normal!.fillColor);
    }
  });

  it('honours custom titles, colors, widths and range title', () => {
    const { series: seriesConfigs } = createCandlestick([{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }], {
      seriesTitles: { up: 'Gain' },
      colors: { down: '#123456' },
      wickWidthFraction: 0.1,
      bodyWidthFraction: 0.7,
      rangeTitle: 'Low – High'
    });
    const [upWick, downWick, up, down] = seriesConfigs;
    expect(up.title).toBe('Gain');
    expect(down.title).toBe('Down');
    expect(downWick.shapeStyle!.normal!.fillColor).toBe('#123456');
    expect(down.shapeStyle!.normal!.fillColor).toBe('#123456');
    expect(upWick.bar!.widthFraction).toBe(0.1);
    expect(up.bar!.widthFraction).toBe(0.7);
    expect(upWick.valueLabel).toBe('Low – High');
    expect(downWick.valueLabel).toBe('Low – High');
  });

  it('returns empty data for empty input', () => {
    const { candles, data, series: seriesConfigs } = createCandlestick([]);
    expect(candles).toEqual([]);
    expect(data).toEqual([]);
    expect(seriesConfigs).toHaveLength(4);
  });

  describe('volume', () => {
    // Regression: the price min margin ignored the axis's default max margin, so the lows sat below the
    // pane split (overlapping the volume bars once gapFraction was 0); both margins share one extent
    const bottomShare = (axis: { minMarginFraction?: number; maxMarginFraction?: number }) =>
      axis.minMarginFraction! / (1 + axis.minMarginFraction! + axis.maxMarginFraction!);

    const items = [
      { label: 'Mon', open: 1, high: 3, low: 0, close: 2, volume: 1200 }, // up
      { label: 'Tue', open: 2, high: 4, low: 1, close: 1.5, volume: 800 } // down
    ];

    it('emits no volume properties, series or axes by default', () => {
      const { data, series: seriesConfigs, valueAxes: valueAxisConfigs } = createCandlestick(items);
      expect(valueAxisConfigs).toBeUndefined();
      expect('upVolume' in data[0]).toBe(false);
      expect(seriesConfigs.every((seriesConfig) => seriesConfig.axis === undefined)).toBe(true);
    });

    it('splits the volume by direction and appends follower volume series', () => {
      const { data, series: seriesConfigs } = createCandlestick(items, { volume: true });
      expect(data[0]).toMatchObject({ volume: 1200, upVolume: 1200, downVolume: undefined });
      expect(data[1]).toMatchObject({ volume: 800, upVolume: undefined, downVolume: 800 });
      expect(seriesConfigs.map((seriesConfig) => seriesConfig.id)).toEqual(['upWick', 'downWick', 'up', 'down', 'upVolume', 'downVolume']);
      const upVolume = seriesConfigs.find((seriesConfig) => seriesConfig.id === 'upVolume')!;
      expect(upVolume).toMatchObject({
        property: 'upVolume', axis: 'volume', renderer: 'bar', missingValueMode: 'connect',
        showInLegend: false, followSeries: 'up', valueLabel: 'Volume'
      });
      expect(upVolume.shapeStyle!.normal!.fillColor).toBe(seriesConfigs.find((seriesConfig) => seriesConfig.id === 'up')!.shapeStyle!.normal!.fillColor);
    });

    it('moves the price series onto the price axis and splits the panes with margins', () => {
      const { series: seriesConfigs, valueAxes: valueAxisConfigs } = createCandlestick(items, { volume: true });
      for (const seriesConfig of seriesConfigs) {
        expect(seriesConfig.axis, seriesConfig.id).toBe(seriesConfig.id!.includes('Volume') ? 'volume' : 'price');
      }
      const [priceAxis, volumeAxis] = valueAxisConfigs!;
      // defaults: volume pane 20%, gap 5% — the price margins put the lows at 25% of the plot, volume margin (0.8 / 0.2)
      expect(priceAxis).toMatchObject({ id: 'price', maxMarginFraction: 0.05 });
      expect(priceAxis.minMarginFraction).toBeCloseTo(0.25 * 1.05 / 0.75, 6);
      expect(bottomShare(priceAxis)).toBeCloseTo(0.25, 6);
      expect(volumeAxis).toMatchObject({ id: 'volume', min: 0, visible: false });
      expect(volumeAxis.maxMarginFraction).toBeCloseTo(4, 6);
    });

    it('honours pane sizing and label options', () => {
      const { series: seriesConfigs, valueAxes: valueAxisConfigs } = createCandlestick(items, {
        volume: { heightFraction: 0.25, gapFraction: 0.05, valueLabel: 'Shares' }
      });
      const [priceAxis, volumeAxis] = valueAxisConfigs!;
      expect(bottomShare(priceAxis)).toBeCloseTo(0.3, 6);
      expect(volumeAxis.maxMarginFraction).toBeCloseTo(3, 6);
      expect(seriesConfigs.find((seriesConfig) => seriesConfig.id === 'upVolume')!.valueLabel).toBe('Shares');
    });

    // these all used to produce a config the validator rejects, blanking the chart
    it.each([
      ['heightFraction 1', { heightFraction: 1 }],
      ['heightFraction 0', { heightFraction: 0 }],
      ['heightFraction below 0', { heightFraction: -0.1 }],
      ['gapFraction 1', { gapFraction: 1 }],
      ['gapFraction below 0', { gapFraction: -0.1 }],
      ['fractions summing to 1', { heightFraction: 0.7, gapFraction: 0.3 }],
      ['fractions summing above 1', { heightFraction: 0.8, gapFraction: 0.3 }]
    ])('throws for %s', (_label, volume) => {
      expect(() => createCandlestick(items, { volume })).toThrow(/createCandlestick: volume/);
    });

    it('accepts the ends of the usable range', () => {
      expect(() => createCandlestick(items, { volume: { heightFraction: 0.95, gapFraction: 0 } })).not.toThrow();
      expect(() => createCandlestick(items, { volume: { heightFraction: 0.01, gapFraction: 0.98 } })).not.toThrow();
    });

    it('throws for an item with no volume, rather than reserving the band for a blank pane', () => {
      const noVolume = [{ label: 'Mon', open: 1, high: 3, low: 0, close: 2 }];
      expect(() => createCandlestick(noVolume, { volume: true }))
        .toThrow(/createCandlestick: Mon has a missing or non-finite volume: undefined/);
      expect(() => createCandlestick([{ ...items[0]!, volume: Number.NaN }], { volume: true }))
        .toThrow(/non-finite volume: NaN/);
      // the option is genuinely optional: without the pane a missing volume is fine
      expect(() => createCandlestick(noVolume)).not.toThrow();
    });
  });

  describe('hollow', () => {
    const items = [
      { label: 'Mon', open: 1, high: 3, low: 0, close: 2 }, // up
      { label: 'Tue', open: 2, high: 4, low: 1, close: 1.5 } // down
    ];

    it('splits each wick into upper and lower segments around the body', () => {
      const { series: seriesConfigs } = createCandlestick(items, { hollow: true });
      expect(seriesConfigs.map((seriesConfig) => seriesConfig.id))
        .toEqual(['upWick', 'downWick', 'upWickUpper', 'upWickLower', 'downWickUpper', 'downWickLower', 'up', 'down']);
      const byId = Object.fromEntries(seriesConfigs.map((seriesConfig) => [seriesConfig.id, seriesConfig]));
      expect(byId.upWickUpper).toMatchObject({ property: 'upHigh', rangeProperty: 'up', renderer: 'bar', showInLegend: false, showInTooltip: false, followSeries: 'up' });
      expect(byId.upWickLower).toMatchObject({ property: 'upOpen', rangeProperty: 'low', renderer: 'bar', followSeries: 'up' });
      expect(byId.downWickUpper).toMatchObject({ property: 'downHigh', rangeProperty: 'open', renderer: 'bar', followSeries: 'down' });
      expect(byId.downWickLower).toMatchObject({ property: 'down', rangeProperty: 'low', renderer: 'bar', followSeries: 'down' });
    });

    it('keeps the range tooltip row on a shapeless wick series with a matching icon color', () => {
      const { series: seriesConfigs } = createCandlestick(items, { hollow: true });
      const [upWick, downWick] = seriesConfigs;
      expect(upWick).toMatchObject({ renderer: 'none', marker: { shape: null }, valueLabel: 'Range', followSeries: 'up' });
      expect(downWick).toMatchObject({ renderer: 'none', marker: { shape: null }, valueLabel: 'Range', followSeries: 'down' });
      expect(upWick.label!.textStyle!.normal!.fillColor).toBe(upWick.shapeStyle!.normal!.fillColor);
      expect(upWick.label!.textStyle!.normal!.fillOpacity).toBe(1);
    });

    it('outlines the up body and keeps the down body filled', () => {
      const { series: seriesConfigs } = createCandlestick(items, { hollow: true });
      const byId = Object.fromEntries(seriesConfigs.map((seriesConfig) => [seriesConfig.id, seriesConfig]));
      expect(byId.up!.shapeStyle).toMatchObject({
        normal: { strokeOpacity: 1, strokeWidth: 2, fillOpacity: 0 },
        focused: { strokeWidth: 3, fillOpacity: 0 },
        defocused: { strokeWidth: 2, fillOpacity: 0 }
      });
      expect(byId.up!.shapeStyle!.normal!.strokeColor).toBe(byId.up!.shapeStyle!.normal!.fillColor);
      expect(byId.down!.shapeStyle!.normal!.fillOpacity).toBe(1);
      // filled bodies keep the default zero-width stroke, in the fill color
      expect(byId.down!.shapeStyle!.normal!.strokeColor).toBe(byId.down!.shapeStyle!.normal!.fillColor);
      expect(byId.down!.shapeStyle!.normal!.strokeWidth).toBeUndefined();
    });

    it('supports the volume pane in hollow mode too', () => {
      const { series: seriesConfigs, valueAxes: valueAxisConfigs } = createCandlestick(
        [{ label: 'Mon', open: 1, high: 3, low: 0, close: 2, volume: 100 }],
        { hollow: true, volume: true }
      );
      expect(valueAxisConfigs).toHaveLength(2);
      expect(seriesConfigs.map((seriesConfig) => seriesConfig.id)).toContain('upVolume');
      // every price series references the price axis, volume series the volume axis
      for (const seriesConfig of seriesConfigs) {
        expect(seriesConfig.axis, seriesConfig.id).toBe(seriesConfig.id!.includes('Volume') ? 'volume' : 'price');
      }
    });

    it('adds the upOpen property only in hollow mode', () => {
      const hollowData = createCandlestick(items, { hollow: true }).data;
      expect(hollowData[0].upOpen).toBe(1); // up day
      expect(hollowData[1].upOpen).toBeUndefined(); // down day
      const filledData = createCandlestick(items).data;
      expect('upOpen' in filledData[0]).toBe(false);
    });
  });

  // duplicates used to reach getDataErrors, which blanks the whole chart
  it('throws when two candles share a label', () => {
    expect(() => createCandlestick([
      { label: 'Mon', open: 1, high: 3, low: 0, close: 2 },
      { label: 'Mon', open: 2, high: 4, low: 1, close: 1.5 }
    ])).toThrow(/createCandlestick: labels must be unique, duplicates: Mon/);
  });

  // one bad tick used to blank a whole chart, or half-draw the candle, silently
  it.each([
    ['a NaN high', { label: 'Mon', open: 2, high: NaN, low: 1.5, close: 1.8 }],
    ['a NaN close', { label: 'Mon', open: 5, high: 6, low: 4, close: NaN }],
    ['an infinite low', { label: 'Mon', open: 2, high: 3, low: -Infinity, close: 2.5 }]
  ])('throws for %s', (_label, item) => {
    expect(() => createCandlestick([item])).toThrow(/createCandlestick: Mon has a missing or non-finite/);
  });

  it('throws when a value is absent entirely', () => {
    const item = { label: 'Mon', open: 3, low: 2, close: 3.5 } as unknown as Parameters<typeof createCandlestick>[0][number];
    expect(() => createCandlestick([item])).toThrow(/createCandlestick: Mon has a missing or non-finite high/);
  });

  it('throws when high is below low', () => {
    expect(() => createCandlestick([{ label: 'Mon', open: 2, high: 1, low: 3, close: 2.5 }]))
      .toThrow(/createCandlestick: Mon has high 1 below low 3/);
  });

  it('throws when the open or close lies outside low–high', () => {
    expect(() => createCandlestick([{ label: 'Mon', open: 100, high: 50, low: 40, close: 45 }]))
      .toThrow(/createCandlestick: Mon has open 100 outside low 40 – high 50/);
    expect(() => createCandlestick([{ label: 'Mon', open: 45, high: 50, low: 40, close: 30 }]))
      .toThrow(/createCandlestick: Mon has close 30 outside low 40 – high 50/);
  });

  it('still accepts a flat candle where every value is equal, and an open or close on a bound', () => {
    expect(() => createCandlestick([{ label: 'Mon', open: 2, high: 2, low: 2, close: 2 }])).not.toThrow();
    expect(() => createCandlestick([{ label: 'Mon', open: 1, high: 3, low: 1, close: 3 }])).not.toThrow();
  });

  it('names computeCandlesticks when called directly', () => {
    expect(() => computeCandlesticks([{ label: 'Mon', open: 2, high: 1, low: 3, close: 2.5 }]))
      .toThrow(/computeCandlesticks: Mon has high 1 below low 3/);
  });

  describe('config round-trip', () => {
    const items = [
      { label: 'Mon', open: 100, high: 105, low: 98, close: 103, volume: 1200 },
      { label: 'Tue', open: 103, high: 104, low: 96, close: 97, volume: 800 },
      { label: 'Wed', open: 97, high: 97, low: 97, close: 97, volume: 300 } // doji
    ];

    it.each<[string, CreateCandlestickOptions]>([
      ['filled', {}],
      ['hollow', { hollow: true }],
      ['volume', { volume: true }],
      ['hollow + volume', { hollow: true, volume: { heightFraction: 0.3, gapFraction: 0.1 } }]
    ])('assembles a valid config and data provider (%s)', (_label, options) => {
      const candlestick = createCandlestick(items, options);
      const mochartConfig = enhanceConfig({
        version: '1.0.0',
        categoryAxis: candlestick.categoryAxis,
        valueAxes: candlestick.valueAxes,
        series: candlestick.series
      });
      expect(mochartConfig.validation.errors).toEqual([]);
      expect(mochartConfig.validation.valid).toBe(true);
      expect(getDataErrors(mochartConfig, new ArrayOfObjectsDataProvider(candlestick.data))).toEqual([]);
    });

    it('stays valid when a direction is absent from the data', () => {
      const candlestick = createCandlestick(items.slice(0, 1), { volume: true }); // up only
      const mochartConfig = enhanceConfig({
        version: '1.0.0',
        categoryAxis: candlestick.categoryAxis,
        valueAxes: candlestick.valueAxes,
        series: candlestick.series
      });
      expect(mochartConfig.validation.valid).toBe(true);
      expect(getDataErrors(mochartConfig, new ArrayOfObjectsDataProvider(candlestick.data))).toEqual([]);
    });
  });
});
