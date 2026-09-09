import { describe, it, expect } from 'vitest';
import { binValues, createHistogram } from '../../src/data/Histogram';
import { enhanceConfig } from '../../src/config/helper';
import { getDataErrors } from '../../src/data/DataValidator';
import { ArrayOfObjectsDataProvider } from '../../src/data/DataProvider';
import type { CreateHistogramOptions } from '../../src/data/Histogram';

describe('binValues', () => {
  it('returns no bins for empty input', () => {
    expect(binValues([])).toEqual([]);
  });

  it('ignores non-finite values', () => {
    expect(binValues([NaN, Infinity, -Infinity])).toEqual([]);
    const bins = binValues([NaN, 1, 2, Infinity], { binWidth: 1, nice: false });
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  });

  it('bins values into half-open intervals with the max included in the last bin', () => {
    const bins = binValues([0, 1, 2, 5, 9, 10], { binWidth: 5 });
    expect(bins.map((bin) => [bin.start, bin.end])).toEqual([
      [0, 5],
      [5, 10]
    ]);
    // 0, 1, 2 → [0, 5); 5, 9 → [5, 10); 10 sits on the final edge and is kept.
    expect(bins.map((bin) => bin.count)).toEqual([3, 3]);
  });

  it('counts every value exactly once', () => {
    const values = Array.from({ length: 500 }, (_, i) => Math.sin(i) * 100);
    const bins = binValues(values);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(values.length);
  });

  it('produces nice bin edges by default', () => {
    const bins = binValues([1.3, 2.7, 9.4, 14.2, 19.9]);
    for (const bin of bins) {
      expect(bin.end - bin.start).toBeCloseTo(bins[0].end - bins[0].start);
      expect(Number.isInteger(bin.start * 100)).toBe(true);
    }
    expect(bins[0].start).toBeLessThanOrEqual(1.3);
    expect(bins[bins.length - 1].end).toBeGreaterThanOrEqual(19.9);
  });

  it('divides the domain exactly when nice is false', () => {
    const bins = binValues([1, 9], { binCount: 4, nice: false });
    expect(bins).toHaveLength(4);
    expect(bins[0].start).toBe(1);
    expect(bins[3].end).toBe(9);
  });

  // Regression: non-nice edges were rounded to the width's precision, so a min with more precision
  // shifted every reported edge off the true division and membership followed the shifted edges
  it('keeps the data\'s own precision on non-nice edges', () => {
    const bins = binValues([3.75, 103.8, 250], { nice: false, binWidth: 100 });
    expect(bins.map(bin => [bin.start, bin.end, bin.count])).toEqual([[3.75, 103.75, 1], [103.75, 203.75, 1], [203.75, 303.75, 1]]);
    const thirds = binValues([0.1, 0.4], { nice: false, binCount: 3 });
    expect(thirds.map(bin => bin.start)).toEqual([0.1, 0.2, 0.3]);
    expect(thirds[2].end).toBe(0.4);
    for (let seed = 1; seed < 200; seed++) {
      const min = seed * 0.0137;
      const values = [min, min + 1.234, min + 5.678];
      const exact = binValues(values, { nice: false, binWidth: 1.5 });
      expect(exact[0].start).toBeCloseTo(min, 12);
      expect(exact.map(bin => bin.count)).toEqual([2, 0, 0, 1]);
    }
  });

  it('handles a single value', () => {
    const bins = binValues([5]);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(1);
    expect(bins[0].start).toBeLessThanOrEqual(5);
    expect(bins[0].end).toBeGreaterThanOrEqual(5);
  });

  it('handles all-identical values', () => {
    const bins = binValues([3, 3, 3, 3]);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(4);
  });

  it('drops values outside an explicit domain', () => {
    const bins = binValues([-5, 1, 2, 3, 99], { domain: [0, 10], binWidth: 5 });
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(3);
  });

  it('throws on an inverted domain', () => {
    expect(() => binValues([1, 2], { domain: [10, 0] })).toThrow();
  });

  it('throws on a non-finite domain', () => {
    expect(() => binValues([1, 2, 3], { domain: [0, Infinity] })).toThrow(/invalid domain/);
    expect(() => binValues([1, 2, 3], { domain: [-Infinity, 0] })).toThrow(/invalid domain/);
    expect(() => binValues([1, 2, 3], { domain: [0, Infinity], nice: false })).toThrow(/invalid domain/);
    expect(() => binValues([1, 2, 3], { domain: [0, NaN] })).toThrow(/invalid domain/);
  });

  it('bins right up to the maximum bin count', () => {
    expect(binValues([0, 10000], { binWidth: 1, nice: false })).toHaveLength(10000);
  });

  it('throws rather than allocating past the maximum bin count', () => {
    expect(() => binValues([0, 10001], { binWidth: 1, nice: false })).toThrow(/10000 maximum/);
    // a bin width small enough to ask for ~90 million bins used to exhaust the heap
    expect(() => binValues([1, 10], { binWidth: 1e-7 })).toThrow(/10000 maximum/);
    expect(() => binValues([1, 10], { binCount: 1e6, nice: false })).toThrow(/10000 maximum/);
    // a count past 2^53 used to spin in the trailing trim, whose decrement no longer changes the number
    expect(() => binValues([0, 1e18], { binWidth: 1 })).toThrow(/10000 maximum/);
    expect(() => binValues([0, 1], { binWidth: 1e-16 })).toThrow(/10000 maximum/);
  });

  it('rounds a fractional binCount down to a whole count', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bins = binValues(values, { binCount: 2.5, nice: false });
    expect(bins).toHaveLength(2);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(values.length);
  });

  it('falls back to the derived count for a non-finite binCount', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const derived = binValues(values, { nice: false });
    for (const binCount of [NaN, Infinity, -Infinity]) {
      const bins = binValues(values, { binCount, nice: false });
      expect(bins).toHaveLength(derived.length);
      expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(values.length);
    }
  });

  it('clamps a non-positive binCount to a single bin', () => {
    const bins = binValues([1, 2, 3], { binCount: 0, nice: false });
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(3);
  });

  it('ignores a non-finite or non-positive binWidth', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const derived = binValues(values);
    for (const binWidth of [NaN, Infinity, 0, -1]) {
      const bins = binValues(values, { binWidth });
      expect(bins).toHaveLength(derived.length);
      expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(values.length);
    }
  });

  it('avoids floating point noise on fractional bin edges', () => {
    const bins = binValues([0.05, 0.15, 0.25, 0.35], { binWidth: 0.1 });
    expect(bins.map((bin) => bin.start)).toEqual([0, 0.1, 0.2, 0.3]);
    expect(bins.map((bin) => bin.count)).toEqual([1, 1, 1, 1]);
  });

  it('normalizes to probabilities summing to 1', () => {
    const bins = binValues([1, 2, 3, 4, 5, 6, 7, 8], { binWidth: 2, normalize: 'probability' });
    expect(bins.reduce((sum, bin) => sum + bin.value, 0)).toBeCloseTo(1);
  });

  it('normalizes to a density integrating to 1', () => {
    const bins = binValues([1, 2, 3, 4, 5, 6, 7, 8], { binWidth: 2, normalize: 'density' });
    const integral = bins.reduce((sum, bin) => sum + bin.value * (bin.end - bin.start), 0);
    expect(integral).toBeCloseTo(1);
  });

  it('accumulates when cumulative is set', () => {
    const bins = binValues([1, 2, 3, 4], { binWidth: 2, cumulative: true, normalize: 'probability' });
    expect(bins[bins.length - 1].value).toBeCloseTo(1);
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i].value).toBeGreaterThanOrEqual(bins[i - 1].value);
    }
  });

  it('ends a cumulative density curve at 1, not at 1 / bin width', () => {
    // summing density values tops out at 1/width; a cumulative density has to integrate
    const bins = binValues([1, 2, 3, 4], { binWidth: 2, cumulative: true, normalize: 'density' });
    expect(bins[bins.length - 1].value).toBeCloseTo(1);
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i].value).toBeGreaterThanOrEqual(bins[i - 1].value);
    }
  });

  it('matches the cumulative probability curve bin for bin', () => {
    const density = binValues([1, 2, 3, 4, 9], { binWidth: 2, cumulative: true, normalize: 'density' });
    const probability = binValues([1, 2, 3, 4, 9], { binWidth: 2, cumulative: true, normalize: 'probability' });
    expect(density.map(bin => bin.value)).toEqual(probability.map(bin => bin.value));
  });
});

describe('createHistogram', () => {
  it('inherits the maximum bin count', () => {
    expect(() => createHistogram([1, 10], { binWidth: 1e-7 })).toThrow(/10000 maximum/);
  });

  it('returns rows keyed by the default properties', () => {
    const { data } = createHistogram([0, 1, 2, 8, 9], { binWidth: 5 });
    expect(data).toEqual([
      { binLabel: '0–5', value: 3, binStart: 0, binEnd: 5, binCenter: 2.5, count: 3 },
      { binLabel: '5–10', value: 2, binStart: 5, binEnd: 10, binCenter: 7.5, count: 2 }
    ]);
  });

  it('honours a custom value property and bin label', () => {
    const { data, seriesConfig } = createHistogram([1, 2], {
      binWidth: 5,
      valueProperty: 'freq',
      binLabel: (bin) => `<${bin.end}`
    });
    expect(data[0].freq).toBe(2);
    expect(data[0].binLabel).toBe('<5');
    expect(seriesConfig.property).toBe('freq');
  });

  it('emits config fragments for touching ordinal bars', () => {
    const { categoryAxis: categoryAxisConfig, seriesConfig } = createHistogram([1, 2, 3]);
    expect(categoryAxisConfig).toEqual({
      property: 'binLabel',
      type: 'string',
      scale: 'ordinal',
      categoryPaddingFraction: { inner: 0, outer: 0 }
    });
    expect(seriesConfig.renderer).toBe('bar');
    expect(seriesConfig.title).toBe('Count');
  });

  it('titles the series after the normalization', () => {
    expect(createHistogram([1], { normalize: 'density' }).seriesConfig.title).toBe('Density');
    expect(createHistogram([1], { seriesTitle: 'Ages' }).seriesConfig.title).toBe('Ages');
  });

  it('returns empty data for empty input', () => {
    const { bins, data } = createHistogram([]);
    expect(bins).toEqual([]);
    expect(data).toEqual([]);
  });

  describe('config round-trip', () => {
    const values = [0, 1, 2, 3.5, 8, 9, 9.5, 12];

    it.each<[string, CreateHistogramOptions]>([
      ['default', {}],
      ['custom property + label', { binWidth: 5, valueProperty: 'freq', binLabel: (bin) => `<${bin.end}` }],
      ['cumulative density', { binCount: 4, normalize: 'density', cumulative: true }]
    ])('assembles a valid config and data provider (%s)', (_label, options) => {
      const histogram = createHistogram(values, options);
      const mochartConfig = enhanceConfig({
        version: '1.0.0',
        categoryAxis: histogram.categoryAxis,
        series: [histogram.seriesConfig]
      });
      expect(mochartConfig.validation.errors).toEqual([]);
      expect(mochartConfig.validation.valid).toBe(true);
      expect(getDataErrors(mochartConfig, new ArrayOfObjectsDataProvider(histogram.data))).toEqual([]);
    });

    it('stays valid for a single-bin histogram', () => {
      const histogram = createHistogram([5, 5, 5]);
      const mochartConfig = enhanceConfig({
        version: '1.0.0',
        categoryAxis: histogram.categoryAxis,
        series: [histogram.seriesConfig]
      });
      expect(mochartConfig.validation.valid).toBe(true);
      expect(getDataErrors(mochartConfig, new ArrayOfObjectsDataProvider(histogram.data))).toEqual([]);
    });
  });
});

// Regression: the bin index came from the raw float quotient while bins report rounded edges, so a
// value on a non-representable edge ((0.3-0)/0.1 = 2.999...) was counted one bin low vs [start, end).
describe('bin membership on floating-point edges', () => {
  it('counts an edge value into the bin whose reported edges contain it', () => {
    const bins = binValues([0, 0.3, 1], { binWidth: 0.1 });
    const binFor = (value: number) =>
      bins.find(bin => bin.start <= value && (value < bin.end || bin === bins[bins.length - 1]))!;
    expect(binFor(0.3).count).toBe(1);
    expect(bins.find(bin => bin.start === 0.2)!.count).toBe(0);
  });

  it('respects the reported edges across non-representable widths', () => {
    for (const binWidth of [0.1, 0.2, 0.3, 0.7]) {
      for (let k = 1; k < 10; k++) {
        const edge = k * binWidth;
        const bins = binValues([0, edge, 10 * binWidth], { binWidth });
        const target = bins.find(bin => bin.start <= edge && (edge < bin.end || bin === bins[bins.length - 1]))!;
        expect(target.count).toBeGreaterThan(0);
      }
    }
  });

  // Regression: the raw (max - start) / width quotient landing one ulp past an integer (2.1 / 0.3)
  // opened an empty extra bin beyond the max instead of closing the last bin on it
  it('closes the last bin on a max that is a whole number of widths from the start', () => {
    expect(binValues([0, 2.1], { binWidth: 0.3 }).map(bin => bin.end)).toEqual([0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1]);
    expect(binValues([0, 0.07], { binCount: 7 })).toHaveLength(7);
    for (const binWidth of [0.3, 0.6, 0.7, 0.01, 0.02, 0.05]) {
      for (let k = 1; k < 40; k++) {
        const bins = binValues([0, k * binWidth], { binWidth });
        expect(bins).toHaveLength(k);
        expect(bins[k - 1].count).toBe(k === 1 ? 2 : 1); // a single bin holds both values
      }
    }
  });

  // Regression: the raw min / width quotient landing one ulp under an integer (0.3 / 0.1) floored one
  // step too low, opening an empty bin below the min
  it('starts the first bin on a min that is a whole number of widths', () => {
    expect(binValues([0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]).map(bin => bin.start)).toEqual([0.3, 0.4, 0.5, 0.6]);
    expect(binValues([1.2, 1.4], { binWidth: 0.2 }).map(bin => [bin.start, bin.count])).toEqual([[1.2, 2]]);
    for (const binWidth of [0.1, 0.2, 0.3, 0.7, 0.05]) {
      for (let k = 1; k < 40; k++) {
        const bins = binValues([k * binWidth, (k + 3) * binWidth], { binWidth });
        expect(bins[0].start).toBeCloseTo(k * binWidth, 10);
        expect(bins[0].count).toBe(1);
        expect(bins).toHaveLength(3);
      }
    }
  });

  // a custom binLabel can collapse distinct bins onto one category value
  it('throws when a custom binLabel produces duplicates', () => {
    expect(() => createHistogram([1, 2, 3, 4, 5, 6], { binCount: 3, binLabel: () => 'bin' }))
      .toThrow(/createHistogram: binLabel values must be unique, duplicates: bin/);
  });
});
