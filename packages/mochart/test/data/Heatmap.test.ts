import { describe, it, expect } from 'vitest';
import { scaleLinear } from 'd3-scale';
import { interpolateLab } from 'd3-interpolate';
import { createHeatmap, createHeatmapColorScale } from '../../src/data/Heatmap';
import { enhanceConfig } from '../../src/config/helper';
import { getDataErrors } from '../../src/data/DataValidator';
import { ArrayOfObjectsDataProvider } from '../../src/data/DataProvider';
import type { HeatmapRow } from '../../src/data/Heatmap';

interface TestColorScale {
  (value: number): string;
  range(values: readonly unknown[]): TestColorScale;
  domain(values: readonly number[]): TestColorScale;
  interpolate(interpolator: unknown): TestColorScale;
}

const rows = (): HeatmapRow[] => [
  { label: 'North', values: [0, 5, 10] },
  { label: 'South', values: [2, undefined, 8] },
  { label: 'West', values: [4, 6, null] }
];

const toHex = (rgb: string): string => {
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)!;
  return '#' + match.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, '0')).join('');
};

describe('createHeatmap', () => {
  it('lays each row out as a one-unit band, first row on top', () => {
    const { data, valueAxes } = createHeatmap(rows(), { cellPadding: 0 });
    expect(data).toHaveLength(3);
    expect(data[0].column).toBe('1');
    expect(data[0].row0Start).toBe(2);
    expect(data[0].row0).toBe(3);
    expect(data[0].row0Value).toBe(0);
    expect(data[0].row2Start).toBe(0);
    expect(data[0].row2).toBe(1);
    expect(valueAxes[0]).toMatchObject({ min: 0, max: 3 });
  });

  it('labels each row band center with an explicit axis tick', () => {
    const { valueAxes } = createHeatmap(rows());
    expect(valueAxes[0].ticks).toEqual([
      { value: 2.5, label: 'North' },
      { value: 1.5, label: 'South' },
      { value: 0.5, label: 'West' }
    ]);
  });

  it('trims cellPadding from each side of the bands and category slots', () => {
    const { data, categoryAxis: categoryAxisConfig } = createHeatmap(rows(), { cellPadding: 0.1 });
    expect(data[0].row0Start).toBeCloseTo(2.1);
    expect(data[0].row0).toBeCloseTo(2.9);
    // outer trims half of itself per side; inner is a no-op for the ungrouped rows
    expect(categoryAxisConfig.categoryPaddingFraction).toEqual({ inner: 0, outer: 0.2 });
  });

  it('leaves missing cells out of the data', () => {
    const { data, series: seriesConfigs } = createHeatmap(rows());
    expect(data[1].row1).toBeUndefined();
    expect(data[1].row1Start).toBeUndefined();
    expect(data[1].row1Value).toBeUndefined();
    expect(data[2].row2Value).toBeUndefined();
    expect(seriesConfigs.every((seriesConfig) => seriesConfig.missingValueMode === 'connect')).toBe(true);
    expect(seriesConfigs.every((seriesConfig) => seriesConfig.colorScale!.missing === undefined)).toBe(true);
  });

  it('renders missing cells as missingColor bands when the option is set', () => {
    const { data, series: seriesConfigs } = createHeatmap(rows(), { missingColor: '#e0e0e0', cellPadding: 0 });
    // the South row's missing middle cell keeps its band, minus any value
    expect(data[1].row1Start).toBe(1);
    expect(data[1].row1).toBe(2);
    expect(data[1].row1Value).toBeUndefined();
    expect(seriesConfigs.every((seriesConfig) => seriesConfig.colorScale!.missing === '#e0e0e0')).toBe(true);
  });

  it('uses custom column labels', () => {
    const { data } = createHeatmap(rows(), { columnLabels: ['Jan', 'Feb', 'Mar'] });
    expect(data.map((entry) => entry.column)).toEqual(['Jan', 'Feb', 'Mar']);
  });

  // column values index the rows, so duplicates would collapse them
  it('rejects a columnLabels list that is not one per column', () => {
    expect(() => createHeatmap(rows(), { columnLabels: ['Jan'] })).toThrow(/1 columnLabels for 3 columns/);
    expect(() => createHeatmap(rows(), { columnLabels: ['a', 'b', 'c', 'd'] })).toThrow(/4 columnLabels for 3 columns/);
  });

  it('rejects duplicate column labels', () => {
    expect(() => createHeatmap(rows(), { columnLabels: ['a', 'b', 'a'] })).toThrow(/must be unique, duplicates: a/);
  });

  it('rejects a cellPadding that leaves no cell to draw', () => {
    // at 0.5 the gap eats the whole cell, so the value is refused rather than quietly clamped
    expect(() => createHeatmap(rows(), { cellPadding: 0.5 })).toThrow(/cellPadding must be at least 0 and below 0.5/);
    expect(() => createHeatmap(rows(), { cellPadding: 0.7 })).toThrow(/cellPadding/);
    expect(() => createHeatmap(rows(), { cellPadding: -0.1 })).toThrow(/cellPadding/);
    expect(() => createHeatmap(rows(), { cellPadding: 0.49 })).not.toThrow();
  });

  it('rejects a descending domain, naming the entry point the caller used', () => {
    expect(() => createHeatmap(rows(), { domain: [100, 0] })).toThrow(/createHeatmap: invalid domain \[100, 0\]/);
    expect(() => createHeatmap(rows(), { domain: [0, 0] })).not.toThrow();
  });

  it('titles one bar series per row', () => {
    const { series: seriesConfigs } = createHeatmap(rows());
    expect(seriesConfigs.map((seriesConfig) => seriesConfig.title)).toEqual(['North', 'South', 'West']);
    expect(seriesConfigs[1]).toMatchObject({
      id: 'row1', property: 'row1', rangeProperty: 'row1Start', colorProperty: 'row1Value',
      tooltipProperty: 'row1Value', renderer: 'bar', group: null, stack: null, showInLegend: false
    });
  });

  it('computes the domain from all cells and samples each row color range from the global ramp', () => {
    const heatmap = createHeatmap(rows());
    expect(heatmap.domain).toEqual([0, 10]);
    expect(heatmap.series[0]!.colorScale!.min).toBe(heatmap.colorScale(0));
    expect(heatmap.series[0]!.colorScale!.max).toBe(heatmap.colorScale(10));
    expect(heatmap.series[1]!.colorScale!.min).toBe(heatmap.colorScale(2));
    expect(heatmap.series[1]!.colorScale!.max).toBe(heatmap.colorScale(8));
    expect(heatmap.series.every((seriesConfig) => /^#[0-9a-f]{6}$/.test(seriesConfig.colorScale!.min as string))).toBe(true);
  });

  it('reproduces the global scale when the core interpolates each row over its own extent', () => {
    const heatmap = createHeatmap(rows());
    for (const [r, row] of rows().entries()) {
      const values = row.values.filter((value): value is number => value != null);
      // What SeriesColors.getSeriesColorGenerator builds for the series.
      const coreScale = (scaleLinear() as unknown as TestColorScale)
        .range([heatmap.series[r]!.colorScale!.min, heatmap.series[r]!.colorScale!.max])
        .domain([Math.min(...values), Math.max(...values)])
        .interpolate(interpolateLab);
      for (const value of values) {
        expect(toHex(coreScale(value))).toBe(heatmap.colorScale(value));
      }
    }
  });

  // Regression: an explicit narrower domain sampled row endpoint colors from the clamped ramp
  // while the core spanned the raw extent, coloring the same value differently across rows.
  it('reproduces the global scale under an explicit narrower domain', () => {
    const heatmap = createHeatmap([
      { label: 'A', values: [0, 5, 20] },
      { label: 'B', values: [0, 5, 10] }
    ], { domain: [0, 10] });

    // color values are domain-clamped and separate from the tooltip values
    expect(heatmap.series[0]!.colorProperty).toBe('row0Color');
    expect(heatmap.series[0]!.tooltipProperty).toBe('row0Value');
    expect(heatmap.data[2]!.row0Value).toBe(20);
    expect(heatmap.data[2]!.row0Color).toBe(10);

    for (const r of [0, 1]) {
      const clampedValues = [0, 5, 10];
      const coreScale = (scaleLinear() as unknown as TestColorScale)
        .range([heatmap.series[r]!.colorScale!.min, heatmap.series[r]!.colorScale!.max])
        .domain([Math.min(...clampedValues), Math.max(...clampedValues)])
        .interpolate(interpolateLab);
      for (const value of clampedValues) {
        expect(toHex(coreScale(value))).toBe(heatmap.colorScale(value));
      }
    }
  });

  it('colors every cell at the ramp midpoint when all values are equal', () => {
    const heatmap = createHeatmap([{ label: 'A', values: [7, 7] }, { label: 'B', values: [7] }]);
    expect(heatmap.domain).toEqual([7, 7]);
    const midpoint = heatmap.colorScale(7);
    expect(heatmap.colorScale(0)).toBe(midpoint);
    expect(heatmap.series[0]!.colorScale!.min).toBe(midpoint);
    expect(heatmap.series[1]!.colorScale!.max).toBe(midpoint);
  });

  it('produces a valid chart config and data', () => {
    const heatmap = createHeatmap(rows());
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: heatmap.categoryAxis,
      valueAxes: [{ ...heatmap.valueAxes[0], id: 'va' }],
      series: heatmap.series.map((seriesConfig) => ({ ...seriesConfig, axis: 'va' }))
    });
    expect(mochartConfig.validation.valid).toBe(true);
    // The category property is always set; only cell properties can be undefined.
    const dataProvider = new ArrayOfObjectsDataProvider(heatmap.data as Record<string, string | number>[]);
    expect(getDataErrors(mochartConfig, dataProvider)).toEqual([]);
  });

  it('keeps the data valid when a whole row is missing, with or without missingColor', () => {
    const allMissingRows: HeatmapRow[] = [{ label: 'Offline', values: [null, undefined, null] }, ...rows()];
    for (const missingColor of [undefined, '#999999']) {
      const heatmap = createHeatmap(allMissingRows, { missingColor });
      const mochartConfig = enhanceConfig({
        version: '1.0.0',
        categoryAxis: heatmap.categoryAxis,
        valueAxes: [{ ...heatmap.valueAxes[0], id: 'va' }],
        series: heatmap.series.map((seriesConfig) => ({ ...seriesConfig, axis: 'va' }))
      });
      expect(mochartConfig.validation.valid).toBe(true);
      const dataProvider = new ArrayOfObjectsDataProvider(heatmap.data as Record<string, string | number>[]);
      expect(getDataErrors(mochartConfig, dataProvider)).toEqual([]);
    }
  });

  it('does not mutate the passed rows or options', () => {
    const input = rows();
    const snapshot = structuredClone(input);
    const options = { columnLabels: ['a', 'b', 'c'], domain: [0, 10] as [number, number] };
    const optionsSnapshot = structuredClone(options);
    createHeatmap(input, options);
    expect(input).toEqual(snapshot);
    expect(options).toEqual(optionsSnapshot);
  });

  it('handles empty input', () => {
    const heatmap = createHeatmap([]);
    expect(heatmap.domain).toBeNull();
    expect(heatmap.data).toEqual([]);
    expect(heatmap.series).toEqual([]);
  });
});

describe('createHeatmapColorScale', () => {
  it('maps the domain ends to the end colors and clamps outside values', () => {
    const scale = createHeatmapColorScale([0, 10], { colorMin: '#000000', colorMax: '#ffffff', colorInterpolation: 'rgb' });
    expect(scale(0)).toBe('#000000');
    expect(scale(10)).toBe('#ffffff');
    expect(scale(-5)).toBe('#000000');
    expect(scale(15)).toBe('#ffffff');
    expect(scale(5)).toBe(toHex('rgb(128, 128, 128)'));
  });

  it('rejects a backwards domain instead of painting every cell one colour', () => {
    // a backwards domain used to land every value on the ramp midpoint, painting the whole heatmap
    // one colour with no warning; reversing the ramp is asked for by swapping colorMin and colorMax
    expect(() => createHeatmapColorScale([10, 0])).toThrow(/invalid domain \[10, 0\]/);
    expect(() => createHeatmapColorScale([Number.NaN, 10])).toThrow(/invalid domain/);
  });

  it('still puts a flat domain at the ramp midpoint', () => {
    // deliberate: every cell really does have the same value
    const scale = createHeatmapColorScale([7, 7], { colorMin: '#000000', colorMax: '#ffffff', colorInterpolation: 'rgb' });
    expect(scale(7)).toBe(toHex('rgb(128, 128, 128)'));
  });
});
