import { describe, it, expect } from 'vitest';
import {
  getSeriesOpacities,
  getSeriesColor,
  getSeriesFillColor,
  getSeriesStrokeColor,
  getSeriesMarkerStrokeColor,
  getSeriesErrorBarStrokeColor,
  getSeriesColorGenerator,
  getSeriesGradientColors
} from '../../src/utils/SeriesColors';
import { makeConfig } from '../data/fixtures';
import { deepMerge } from '../../src/config/core/deepMerge';
import { MISSING_VALUE } from '../../src/utils/utils';
import type { ColorPaletteConfig, DeepPartial } from '../../src/types/config';
import type { EnhancedSeriesConfig } from '../../src/types/enhanced';

// Build a fully-defaulted series + palette, then deep-merge overrides onto the
// series so colour fields under test are realistic rather than hand-rolled.
function setup() {
  const config = makeConfig({
    categoryAxis: { property: 'g', type: 'number', scale: 'ordinal' },
    series: [{ property: 'a' }]
  });
  const base = config.series[0];
  const colorPaletteConfig = (config as unknown as { colorPalette: ColorPaletteConfig }).colorPalette;
  const series = (over: DeepPartial<EnhancedSeriesConfig>): EnhancedSeriesConfig => deepMerge(base, over) as EnhancedSeriesConfig;
  return { colorPaletteConfig, series };
}

describe('getSeriesOpacities', () => {
  const { series } = setup();

  it('returns fill opacities for bar/area renderers', () => {
    const o = getSeriesOpacities(series({ renderer: 'bar', shapeStyle: { normal: { fillOpacity: 0.5 }, focused: { fillOpacity: 0.9 }, defocused: { fillOpacity: 0.1 } } }));
    expect(o).toEqual({ opacity: 0.5, focusedOpacity: 0.9, defocusedOpacity: 0.1 });
  });

  it('returns stroke opacities for the line renderer', () => {
    const o = getSeriesOpacities(series({ renderer: 'line', shapeStyle: { normal: { strokeOpacity: 0.6 }, focused: { strokeOpacity: 0.95 }, defocused: { strokeOpacity: 0.2 } } }));
    expect(o).toEqual({ opacity: 0.6, focusedOpacity: 0.95, defocusedOpacity: 0.2 });
  });

  it('returns marker opacities when there is no shape renderer but a marker', () => {
    const o = getSeriesOpacities(series({ renderer: 'none', marker: { shape: 'circle', style: { normal: { fillOpacity: 0.7 }, focused: { fillOpacity: 1 }, defocused: { fillOpacity: 0.3 } } } }));
    expect(o).toEqual({ opacity: 0.7, focusedOpacity: 1, defocusedOpacity: 0.3 });
  });

  it('falls back to label opacities when there is no renderer and no marker', () => {
    const o = getSeriesOpacities(series({ renderer: 'none', marker: { shape: null }, label: { textStyle: { normal: { fillOpacity: 0.8 }, focused: { fillOpacity: 1 }, defocused: { fillOpacity: 0.4 } } } }));
    expect(o).toEqual({ opacity: 0.8, focusedOpacity: 1, defocusedOpacity: 0.4 });
  });
});

describe('getSeriesColor dispatch', () => {
  const { colorPaletteConfig, series } = setup();

  it('uses the fill color for bar/area', () => {
    expect(getSeriesColor(colorPaletteConfig, series({ renderer: 'bar', shapeStyle: { normal: { fillColor: '#abc' } } }), false)).toBe('#abc');
  });

  it('uses the stroke color for line', () => {
    expect(getSeriesColor(colorPaletteConfig, series({ renderer: 'line', shapeStyle: { normal: { strokeColor: '#def' } } }), false)).toBe('#def');
  });

  it('uses the marker fill color when there is a marker and no shape', () => {
    expect(getSeriesColor(colorPaletteConfig, series({ renderer: 'none', marker: { shape: 'circle', style: { normal: { fillColor: '#123' } } } }), false)).toBe('#123');
  });

  it('uses the label fill color when there is no shape and no marker', () => {
    expect(getSeriesColor(colorPaletteConfig, series({ renderer: 'none', marker: { shape: null }, label: { textStyle: { normal: { fillColor: '#456' } } } }), false)).toBe('#456');
  });

  // a pie slice is drawn filled whatever its renderer says, and it keeps the default 'line'
  it('uses the fill color in pie mode, whatever the renderer says', () => {
    const pieSeries = series({ renderer: 'line', shapeStyle: { normal: { fillColor: '#abc', strokeColor: '#def' } } });
    expect(getSeriesColor(colorPaletteConfig, pieSeries, true)).toBe('#abc');
    expect(getSeriesColor(colorPaletteConfig, pieSeries, false)).toBe('#def');
  });
});

describe('getColor palette + keyword resolution', () => {
  const { colorPaletteConfig, series } = setup();

  it('returns a plain configured color directly', () => {
    expect(getSeriesFillColor(colorPaletteConfig, series({ shapeStyle: { normal: { fillColor: '#ff0000' } } }))).toBe('#ff0000');
  });

  it('resolves "seriesIndex" to the palette color at that index (wrapping)', () => {
    const palette = colorPaletteConfig.shape.normal.fillColors;
    expect(getSeriesFillColor(colorPaletteConfig, series({ shapeStyle: { normal: { fillColor: 'seriesIndex' } } }), 1)).toBe(palette[1]);
    // wraps past the end
    expect(getSeriesFillColor(colorPaletteConfig, series({ shapeStyle: { normal: { fillColor: 'seriesIndex' } } }), palette.length + 2)).toBe(palette[2]);
  });

  it('resolves "categoryIndex" to the palette color for the category index', () => {
    const palette = colorPaletteConfig.shape.normal.fillColors;
    expect(getSeriesFillColor(colorPaletteConfig, series({ shapeStyle: { normal: { fillColor: 'categoryIndex' } } }), 0, null, '#fallback', 3)).toBe(palette[3]);
  });

  it('returns the default color for "categoryIndex" when no category index is supplied', () => {
    expect(getSeriesFillColor(colorPaletteConfig, series({ shapeStyle: { normal: { fillColor: 'categoryIndex' } } }), 0, null, '#fallback')).toBe('#fallback');
  });

  it('resolves "same" on a focused color back to the normal color', () => {
    // focused view, shapeStyle.focused.strokeColor="same" => reuse the normal one
    const color = getSeriesStrokeColor(colorPaletteConfig, series({ shapeStyle: { normal: { strokeColor: '#normal' }, focused: { strokeColor: 'same' } } }), 0, 0.5);
    expect(color).toBe('#normal');
  });

  it('resolves "series" on a marker color across to the series shape color', () => {
    // marker.style.normal.strokeColor defaults to "series"
    const color = getSeriesMarkerStrokeColor(colorPaletteConfig, series({ shapeStyle: { normal: { strokeColor: '#shape' } } }));
    expect(color).toBe('#shape');
  });

  it('chains "same" on the state axis then "series" on the element axis', () => {
    // focused marker "same" -> normal marker "series" -> the shape's normal color
    const color = getSeriesMarkerStrokeColor(colorPaletteConfig, series({ shapeStyle: { normal: { strokeColor: '#shape' } } }), 0, 0.5);
    expect(color).toBe('#shape');
  });

  it('resolves an error bar color through the series shape in every focus state', () => {
    const seriesConfig = series({ shapeStyle: { normal: { strokeColor: '#shape' } } });
    expect(getSeriesErrorBarStrokeColor(colorPaletteConfig, seriesConfig)).toBe('#shape');
    expect(getSeriesErrorBarStrokeColor(colorPaletteConfig, seriesConfig, 0, 0.5)).toBe('#shape');
    expect(getSeriesErrorBarStrokeColor(colorPaletteConfig, seriesConfig, 0, -0.5)).toBe('#shape');
  });

  it('takes an error bar palette color from the errorBar palette', () => {
    const palette = colorPaletteConfig.errorBar.normal.strokeColors;
    const color = getSeriesErrorBarStrokeColor(colorPaletteConfig, series({ errorBar: { style: { normal: { strokeColor: 'seriesIndex' } } } }), 2);
    expect(color).toBe(palette[2]);
  });
});

describe('series style overrides', () => {
  const { series } = setup();

  it('keeps the sibling members and states of a partially overridden style', () => {
    const seriesConfig = series({ marker: { style: { focused: { strokeWidth: 6 } } } });
    expect(seriesConfig.marker.style.focused).toEqual({
      strokeColor: 'same', strokeOpacity: 1, strokeWidth: 6, strokeDashArray: 'same', fillColor: 'same', fillOpacity: 1
    });
    expect(seriesConfig.marker.style.normal.strokeWidth).toBe(1);
    expect(seriesConfig.marker.style.defocused.strokeWidth).toBe(1);
  });
});

describe('getSeriesColorGenerator', () => {
  const { series } = setup();
  const rawDomains = { color: [0, 10] } as never;
  const filteredValues = { color: [0, 5, 10] } as never;

  for (const interpolation of ['rgb', 'hsl', 'lab', 'hcl', null] as const) {
    it(`produces colors for a ${interpolation ?? 'default'} interpolation`, () => {
      const gen = getSeriesColorGenerator(
        series({ colorScale: { min: '#000000', max: '#ffffff', interpolation, base: { value: null } } }),
        rawDomains, filteredValues
      );
      expect(typeof gen(1)).toBe('string');
    });
  }

  it('splits above/below the color base into two scales', () => {
    const gen = getSeriesColorGenerator(
      series({ colorScale: { interpolation: null, base: { value: 5, belowMin: '#000000', belowMax: '#0000ff', aboveMin: '#ff0000', aboveMax: '#ffffff' } } }),
      { color: [0, 10] } as never,
      { color: [0, 5, 10] } as never
    );
    // below-base index (value 0) and above-base index (value 10) both yield colors
    expect(typeof gen(0)).toBe('string');
    expect(typeof gen(2)).toBe('string');
  });

  it('returns the missing color for a row without a color value', () => {
    const gen = getSeriesColorGenerator(
      series({ colorScale: { min: '#000000', max: '#ffffff', missing: '#123456', interpolation: 'rgb', base: { value: null } } }),
      rawDomains, { color: [0, MISSING_VALUE, 10] } as never
    );
    expect(gen(1)).toBe('#123456');
    expect(typeof gen(0)).toBe('string');
    expect(typeof gen(2)).toBe('string');
  });

  it('returns the missing color for a row without a color value on a base-split scale', () => {
    const gen = getSeriesColorGenerator(
      series({ colorScale: { missing: '#123456', interpolation: null, base: { value: 5, belowMin: '#000000', belowMax: '#0000ff', aboveMin: '#ff0000', aboveMax: '#ffffff' } } }),
      { color: [0, 10] } as never,
      { color: [0, MISSING_VALUE, 10] } as never
    );
    expect(gen(1)).toBe('#123456');
  });

  it('returns the missing color for every row when no row has a color value', () => {
    const gen = getSeriesColorGenerator(
      series({ colorScale: { min: '#000000', max: '#ffffff', missing: '#123456', interpolation: 'rgb', base: { value: null } } }),
      { color: [null, null] } as never,
      { color: [MISSING_VALUE, MISSING_VALUE, MISSING_VALUE] } as never
    );
    expect(gen(0)).toBe('#123456');
    expect(gen(1)).toBe('#123456');
    expect(gen(2)).toBe('#123456');
  });

  it('returns null for missing rows when missing is null, deferring to the series colors', () => {
    const gen = getSeriesColorGenerator(
      series({ colorScale: { min: '#000000', max: '#ffffff', missing: null, interpolation: 'rgb', base: { value: null } } }),
      rawDomains, { color: [0, MISSING_VALUE, 10] } as never
    );
    expect(gen(1)).toBe(null);
    expect(typeof gen(0)).toBe('string');
  });
});

describe('getSeriesGradientColors', () => {
  const { series } = setup();

  it('returns [min, max] when a plain color range is configured', () => {
    expect(getSeriesGradientColors(series({ colorScale: { min: '#000', max: '#fff', base: { value: null } } }))).toEqual(['#000', '#fff']);
  });

  it('returns the four base colors when a color base range is configured', () => {
    expect(getSeriesGradientColors(series({
      colorScale: { base: { value: 5, belowMin: '#00f', belowMax: '#0ff', aboveMin: '#f00', aboveMax: '#ff0' } }
    }))).toEqual(['#00f', '#0ff', '#f00', '#ff0']);
  });

  it('returns null when no gradient colors are configured', () => {
    expect(getSeriesGradientColors(series({ colorScale: { min: null, max: null, base: { value: null } } }))).toBe(null);
  });
});
