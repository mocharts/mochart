import { checkUniqueLabels } from './labels';
import { roundToSignificant } from '../utils/utils';
import type { CategoryAxisConfig, SeriesConfig } from '../types/config';

export interface HistogramBin {
  /** Inclusive lower edge of the bin. */
  start: number;
  /** Exclusive upper edge of the bin (inclusive for the last bin). */
  end: number;
  /** Midpoint of the bin, used as the category value when charted. */
  center: number;
  /** Number of values that fell into the bin. */
  count: number;
  /** The count after applying `normalize` (equal to `count` for 'count'). */
  value: number;
}

export interface BinValuesOptions {
  /**
   * Approximate number of bins, rounded down to a whole count of at least one.
   * Ignored when `binWidth` is set. When omitted — or when non-finite — the
   * count is derived from the data via Sturges' formula. With `nice`
   * enabled (the default) the actual count may differ slightly so that bin
   * edges land on round numbers. Asking for more than 10000 bins throws.
   */
  binCount?: number;
  /**
   * Exact bin width. Takes precedence over `binCount`; ignored unless finite
   * and positive. A width small enough to need more than 10000 bins throws.
   */
  binWidth?: number;
  /**
   * The value range to bin over. Values outside the domain are ignored.
   * Defaults to the extent of the data.
   */
  domain?: [number, number];
  /**
   * Whether to round the bin width and edges to round numbers (1, 2 or 5
   * times a power of ten). When false the domain is divided exactly.
   *
   * @default true
   */
  nice?: boolean;
  /**
   * How to scale each bin's `value`: the raw 'count', 'probability'
   * (count / total, sums to 1) or 'density' (probability / bin width,
   * integrates to 1).
   *
   * @default 'count'
   */
  normalize?: 'count' | 'probability' | 'density';
  /** Whether each bin's `value` accumulates the bins before it; with 'density' it integrates, so the curve still ends at 1. */
  cumulative?: boolean;
}

export interface CreateHistogramOptions extends BinValuesOptions {
  /**
   * The data property holding the bin value.
   *
   * @default 'value'
   */
  valueProperty?: string;
  /** The series title, e.g. shown in the legend and tooltip. */
  seriesTitle?: string;
  /**
   * Formats each bin's `binLabel`, shown as the category tick label.
   *
   * @default bin => `${bin.start}–${bin.end}`
   */
  binLabel?: (bin: HistogramBin) => string;
}

export interface HistogramData {
  bins: HistogramBin[];
  /**
   * One row per bin: `binLabel` (the category value), the value property, plus
   * `binStart`, `binEnd`, `binCenter` and `count`.
   */
  data: Record<string, number | string>[];
  /** Fragment to spread into the chart config's `categoryAxis`. */
  categoryAxis: Partial<CategoryAxisConfig>;
  /** Fragment to spread into an entry of the chart config's `series`. */
  seriesConfig: Partial<SeriesConfig>;
}

const CATEGORY_PROPERTY = 'binLabel';
const DEFAULT_VALUE_PROPERTY = 'value';
const NICE_STEPS = [1, 2, 5, 10];
// a tiny binWidth or a huge binCount allocates until the heap gives out; the widest
// plot area is a few thousand pixels, so nothing legible comes near this
const MAX_BIN_COUNT = 10000;

export function binValues(values: readonly number[], options: BinValuesOptions = {}): HistogramBin[] {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const domain = options.domain ?? getExtent(finiteValues);
  if (domain === null) {
    return [];
  }
  const [domainMin, domainMax] = domain;
  if (!Number.isFinite(domainMin) || !Number.isFinite(domainMax) || domainMax < domainMin) {
    throw new Error(`binValues: invalid domain [${domainMin}, ${domainMax}]`);
  }

  const { start, width, binCount, roundEdge } = getBinLayout(domainMin, domainMax, finiteValues.length, options);
  const bins: HistogramBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const binStart = roundEdge(start + i * width, width);
    const binEnd = roundEdge(start + (i + 1) * width, width);
    bins.push({
      start: binStart,
      end: binEnd,
      center: roundEdge(binStart + width / 2, width / 2),
      count: 0,
      value: 0
    });
  }

  for (const value of finiteValues) {
    if (value < domainMin || value > domainMax) {
      continue;
    }
    // Half-open bins [start, end); the last bin also includes its upper edge.
    // an extreme one ulp off the rounded first or last edge still belongs to that bin
    let index = Math.max(0, Math.min(Math.floor((value - start) / width), binCount - 1));
    // the raw quotient can disagree with the rounded edges by one ulp-sized
    // step; membership follows the edges the bins report
    if (index < binCount - 1 && value >= bins[index].end) {
      index++;
    }
    else if (index > 0 && value < bins[index].start) {
      index--;
    }
    bins[index].count++;
  }

  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const normalize = options.normalize ?? 'count';
  let runningValue = 0;
  for (const bin of bins) {
    let value = bin.count;
    if (normalize === 'probability' && total > 0) {
      value = bin.count / total;
    } else if (normalize === 'density' && total > 0) {
      value = bin.count / (total * (bin.end - bin.start));
    }
    // cumulative density integrates rather than sums, so the curve ends at 1 like a probability
    runningValue += normalize === 'density' ? value * (bin.end - bin.start) : value;
    bin.value = options.cumulative === true ? runningValue : value;
  }
  return bins;
}

export function createHistogram(values: readonly number[], options: CreateHistogramOptions = {}): HistogramData {
  const bins = binValues(values, options);
  const valueProperty = options.valueProperty ?? DEFAULT_VALUE_PROPERTY;
  const binLabel = options.binLabel ?? ((bin: HistogramBin) => `${bin.start}–${bin.end}`);

  const labels = bins.map((bin) => binLabel(bin));
  checkUniqueLabels('createHistogram', 'binLabel values', labels);

  const data = bins.map((bin, index) => ({
    [CATEGORY_PROPERTY]: labels[index],
    [valueProperty]: bin.value,
    binStart: bin.start,
    binEnd: bin.end,
    binCenter: bin.center,
    count: bin.count
  }));

  // Bins are contiguous and equal width, so an ordinal axis positions them identically to a linear
  // one while letting bars fill each bin (a linear category axis spans a bar over a single category
  // *value*, leaving slivers for multi-unit-wide bins).
  const categoryAxis: Partial<CategoryAxisConfig> = {
    property: CATEGORY_PROPERTY,
    type: 'string',
    scale: 'ordinal',
    categoryPaddingFraction: { inner: 0, outer: 0 }
  };
  const seriesConfig: Partial<SeriesConfig> = {
    property: valueProperty,
    renderer: 'bar',
    title: options.seriesTitle ?? getDefaultSeriesTitle(options)
  };
  return { bins, data, categoryAxis, seriesConfig };
}

function getDefaultSeriesTitle(options: BinValuesOptions): string {
  switch (options.normalize) {
    case 'probability':
      return 'Probability';
    case 'density':
      return 'Density';
    default:
      return 'Count';
  }
}

function getExtent(values: readonly number[]): [number, number] | null {
  if (values.length === 0) {
    return null;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function getBinLayout(
  domainMin: number,
  domainMax: number,
  valueCount: number,
  options: BinValuesOptions
): { start: number; width: number; binCount: number; roundEdge: EdgeRounder } {
  const extent = domainMax - domainMin;
  const nice = options.nice ?? true;
  // nice edges are multiples of a decimal step; an exact division keeps the data's own precision and snaps only float noise
  const roundEdge: EdgeRounder = nice ? roundToPrecision : roundToSignificant;

  // a non-finite width would carry NaN into every edge, so it counts as unset
  const requestedWidth = options.binWidth;
  let width = requestedWidth !== undefined && Number.isFinite(requestedWidth) && requestedWidth > 0 ? requestedWidth : 0;
  if (width <= 0) {
    const targetCount = getTargetBinCount(options.binCount, valueCount);
    if (extent === 0) {
      // All values identical — a single unit-width (or nice-width) bin.
      width = nice ? getNiceStep(1) : 1;
    } else if (nice) {
      width = getNiceStep(extent / Math.max(1, targetCount));
    } else {
      return { start: domainMin, width: extent / Math.max(1, targetCount), binCount: checkBinCount(Math.max(1, targetCount)), roundEdge };
    }
  }

  // Count by the rounded edges the bins report, with the min and max read at the same precision: the raw
  // quotient (0.3 / 0.1, 2.1 / 0.3) or the extreme itself (31 * 0.3, 3 * 0.05) can land one ulp off an
  // edge, which would open an empty bin below the min or beyond the max instead of closing on it.
  const roundedMin = roundEdge(domainMin, width);
  const roundedMax = roundEdge(domainMax, width);
  let start = nice ? roundToPrecision(Math.floor(domainMin / width) * width, width) : domainMin;
  if (roundEdge(start + width, width) <= roundedMin) {
    start = roundEdge(start + width, width);
  }
  // checked before the trim, which steps one bin at a time and would never end past 2^53
  let binCount = checkBinCount(Math.max(1, Math.ceil((domainMax - start) / width)));
  while (binCount > 1 && roundEdge(start + (binCount - 1) * width, width) >= roundedMax) {
    binCount--;
  }
  return { start, width, binCount, roundEdge };
}

function checkBinCount(binCount: number): number {
  if (binCount > MAX_BIN_COUNT) {
    throw new Error(`binValues: ${binCount} bins requested, more than the ${MAX_BIN_COUNT} maximum`);
  }
  return binCount;
}

// bin counts size an array, so a fractional or non-finite request would index bins that do not exist
function getTargetBinCount(requested: number | undefined, valueCount: number): number {
  const derived = getSturgesBinCount(valueCount);
  if (requested === undefined || !Number.isFinite(requested)) {
    return derived;
  }
  return Math.max(1, Math.floor(requested));
}

function getSturgesBinCount(valueCount: number): number {
  return valueCount === 0 ? 1 : Math.max(1, Math.ceil(Math.log2(valueCount)) + 1);
}

function getNiceStep(rawStep: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  for (const step of NICE_STEPS) {
    if (step * magnitude >= rawStep) {
      return roundToPrecision(step * magnitude, magnitude);
    }
  }
  return 10 * magnitude;
}

type EdgeRounder = (value: number, step: number) => number;

function roundToPrecision(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(Math.abs(step))) + 2);
  return Number(value.toFixed(Math.min(20, decimals)));
}

