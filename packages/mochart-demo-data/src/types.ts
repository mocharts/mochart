import type { MochartInputConfig } from '@mochart/core';

/** A single data row in a demo's data set. */
export type DataObject = Record<string, unknown>;

/** A demo's editable chart config (the input config plus arbitrary edits). */
export type DemoConfig = MochartInputConfig & Record<string, unknown>;

/** The generic per-property random-generation config (see random/*.json). */
export interface RandomConfig {
  category: {
    count: number;
    order: { sort: boolean };
    missing: { probability: number };
    reuse: { globalFraction: number; stepFraction: number };
    number: { min: number; max: number; interval: number };
    string: { minLength: number; maxLength: number };
    date: {
      min: string;
      max: string;
      interval: number;
      intervalUnit: 'second' | 'minute' | 'hour' | 'day' | string;
    };
  };
  series: {
    number: { min: number; max: number; round: boolean; limitToAxisConfig: boolean };
    missing: { probability: number };
    reuse: { global: boolean; step: boolean };
  };
}

/**
 * Random config for the pie/donut/gauge generators. Slices come from a curated
 * pool; `value` is the range the pool weights are scaled into, `missing` the
 * chance a droppable slice generates 0 for a step (scaled by the pool's
 * per-slice drop weight), and `reuse` the fractions of slices whose values
 * persist across every step / across adjacent steps.
 */
export interface PieRandomConfig {
  value: { min: number; max: number };
  missing: { probability: number };
  reuse: { globalFraction: number; stepFraction: number };
}

/**
 * Random config for the waterfall generator. Same model as PieRandomConfig,
 * over the curated pool of income-statement steps: `value` remaps the pool
 * deltas, `missing` drops the optional steps, `reuse` persists step values.
 */
export interface WaterfallRandomConfig {
  value: { min: number; max: number };
  missing: { probability: number };
  reuse: { globalFraction: number; stepFraction: number };
}

/**
 * Random config for the candlestick/hollow/OHLC generators: how many trading
 * days each step keeps, the band the walk's starting price is drawn from with
 * the intraday volatility, and whether adjacent steps stay correlated (the
 * walk reads shared half-step seeds, so playing steps looks like one
 * instrument drifting instead of unrelated charts).
 */
export interface WalkRandomConfig {
  candles: { min: number; max: number };
  price: { min: number; max: number; volatility: number };
  reuse: { step: boolean };
}

/**
 * Random config for the histogram generator: the sampled population size, the
 * value range its normal distribution wanders in, and whether the
 * distribution parameters pin to a global seed / morph smoothly between
 * adjacent steps.
 */
export interface HistogramRandomConfig {
  samples: { min: number; max: number };
  value: { min: number; max: number };
  reuse: { global: boolean; step: boolean };
}

/**
 * Random config for the heatmap generator. Cell values stay on each row's
 * baked color extents, so there is no value range here: `columns` controls the
 * per-step column dropouts, `missing` the empty-cell chance, and `reuse`
 * whether cell values pin globally / morph smoothly between adjacent steps.
 */
export interface HeatmapRandomConfig {
  columns: { dropProbability: number; maxDropped: number };
  missing: { probability: number };
  reuse: { global: boolean; step: boolean };
}

/**
 * Random config for the error-bars generator: how many months each step
 * keeps, the whisker half-width range, the chance a point (and its bounds)
 * drops out, and whether the per-point jitter pins globally / morphs smoothly
 * between adjacent steps.
 */
export interface ErrorBarsRandomConfig {
  months: { min: number; max: number };
  margin: { min: number; max: number };
  missing: { probability: number };
  reuse: { global: boolean; step: boolean };
}

/** Any demo's random config: the generic shape or a chart-type generator's. */
export type DemoRandomConfig =
  | RandomConfig
  | PieRandomConfig
  | WaterfallRandomConfig
  | WalkRandomConfig
  | HistogramRandomConfig
  | HeatmapRandomConfig
  | ErrorBarsRandomConfig;

/** One entry in the demos.json manifest, referencing files by basename. */
export interface DemoManifestEntry {
  id: string;
  title: string;
  /** One short sentence on what the demo showcases (the gallery blurb). */
  description?: string;
  /**
   * The longer explanation, for the curious: which config options are being
   * exercised, what random mode does to the data. Surfaced on demand (the
   * gallery card's details toggle and the in-demo notes button), never inline,
   * so `description` can stay a single sentence.
   */
  notes?: string;
  config: string;
  data: string;
  random: string;
  /**
   * Chart-type data generator used in random mode instead of the generic
   * per-property generator (see demo-common's chartTypeGenerators).
   */
  generator?: string;
  /**
   * Golden-harness only: shift every category by this amount (days on date
   * axes, value units on numeric ones) and snapshot the resulting window
   * slide mid-tween and settled. Demo apps ignore it.
   */
  goldenCategoryShift?: number;
}

/** A single demo entry assembled from its config/data/random JSON. */
export interface Demo {
  id: string;
  title: string;
  /** One short sentence on what the demo showcases (the gallery blurb). */
  description?: string;
  /** The longer explanation (see DemoManifestEntry.notes). */
  notes?: string;
  config: DemoConfig;
  data: DataObject[];
  random: DemoRandomConfig;
  /** Chart-type random-mode generator id (see DemoManifestEntry.generator). */
  generator?: string;
}

/** The assembled collection of demos loaded at startup. */
export interface DemoData {
  demoIds: string[];
  demoObjectMap: Record<string, Demo>;
  testDemoIds: string[];
}
