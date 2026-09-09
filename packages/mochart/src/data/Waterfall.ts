import { checkUniqueLabels } from './labels';
import type { DeepPartial, CategoryAxisConfig, SeriesConfig, ValueAxisConfig } from '../types/config';

export type WaterfallDirection = 'increase' | 'decrease' | 'total';

export interface WaterfallItem {
  /** The step label, used as the category value when charted. */
  label: string;
  /**
   * The signed change for a delta step. For a `total` step it instead resets
   * the running total (e.g. an audited opening or closing balance); when
   * omitted the total shows the running total accumulated so far. Non-finite
   * values count as 0, and leave a total at its running value.
   */
  value?: number;
  /**
   * Whether the step is a total: a bar spanning from the base to the running
   * total instead of a floating delta bar.
   */
  total?: boolean;
}

export interface WaterfallStep {
  label: string;
  /** The signed change of the step (for totals, the offset from the base). */
  delta: number;
  /** The value the bar starts from (the base for totals). */
  start: number;
  /** The value the bar ends at. */
  end: number;
  /** The running total after the step. */
  cumulative: number;
  direction: WaterfallDirection;
}

export interface CreateWaterfallOptions {
  /**
   * The value the running total starts from and total bars span from. Returned
   * in `valueAxes` as the axis `base`, so spreading that fragment keeps the
   * axis and the bars agreeing.
   *
   * @default 0
   */
  base?: number;
  /** The per-direction series titles, e.g. shown in the legend and tooltip. */
  seriesTitles?: Partial<Record<WaterfallDirection, string>>;
  /**
   * The per-direction bar fill colors. The defaults pass the palette
   * validation for adjacent bars on both light and dark surfaces.
   */
  colors?: Partial<Record<WaterfallDirection, string>>;
}

export interface WaterfallData {
  steps: WaterfallStep[];
  /**
   * One row per step: `label` (the category value), `start` (the shared range
   * property) and the step's `end` under the property matching its direction
   * (`increase`, `decrease` or `total` — the other two stay undefined), plus
   * `delta`, `cumulative` and `direction`.
   */
  data: Record<string, number | string | undefined>[];
  /** Fragment to spread into the chart config's `categoryAxis`. */
  categoryAxis: Partial<CategoryAxisConfig>;
  /**
   * Fragments to spread into the chart config's `series`, one per
   * direction in increase/decrease/total order. Directions absent from the
   * data keep their series so the config stays stable across data updates.
   */
  series: DeepPartial<SeriesConfig>[];
  /** Fragment to spread into the chart config's `valueAxes`, carrying the `base`. */
  valueAxes: DeepPartial<ValueAxisConfig>[];
}

const CATEGORY_PROPERTY = 'label';
const RANGE_PROPERTY = 'start';
const DIRECTIONS: WaterfallDirection[] = ['increase', 'decrease', 'total'];

const DEFAULT_TITLES: Record<WaterfallDirection, string> = {
  increase: 'Increase',
  decrease: 'Decrease',
  total: 'Total'
};

// Teal-green/red/blue, not pure green/red: teal dodges the classic red-green-blindness
// collision and keeps every pair ≥3:1 against both light and dark chart surfaces.
const DEFAULT_COLORS: Record<WaterfallDirection, string> = {
  increase: '#1baf7a',
  decrease: '#e34948',
  total: '#2a78d6'
};

export function computeWaterfallSteps(items: readonly WaterfallItem[], base = 0): WaterfallStep[] {
  return computeWaterfallStepsFor('computeWaterfallSteps', items, base);
}

/** computeWaterfallSteps naming the public helper it serves, so its errors name the function the caller called */
function computeWaterfallStepsFor(helperName: string, items: readonly WaterfallItem[], base: number): WaterfallStep[] {
  checkUniqueLabels(helperName, 'labels', items.map((item) => item.label));
  let running = base;
  return items.map((item) => {
    const { label } = item;
    if (item.total === true) {
      if (item.value !== undefined && Number.isFinite(item.value)) {
        running = item.value;
      }
      return { label, delta: running - base, start: base, end: running, cumulative: running, direction: 'total' as const };
    }
    // a non-finite value would carry NaN through every later step's running total
    const value = item.value !== undefined && Number.isFinite(item.value) ? item.value : 0;
    const start = running;
    running += value;
    return { label, delta: value, start, end: running, cumulative: running, direction: value < 0 ? 'decrease' as const : 'increase' as const };
  });
}

export function createWaterfall(items: readonly WaterfallItem[], options: CreateWaterfallOptions = {}): WaterfallData {
  const base = options.base ?? 0;
  const steps = computeWaterfallStepsFor('createWaterfall', items, base);

  const data = steps.map((step) => ({
    [CATEGORY_PROPERTY]: step.label,
    [RANGE_PROPERTY]: step.start,
    increase: step.direction === 'increase' ? step.end : undefined,
    decrease: step.direction === 'decrease' ? step.end : undefined,
    total: step.direction === 'total' ? step.end : undefined,
    delta: step.delta,
    cumulative: step.cumulative,
    direction: step.direction
  }));

  const categoryAxis: Partial<CategoryAxisConfig> = {
    property: CATEGORY_PROPERTY,
    type: 'string',
    scale: 'ordinal'
  };

  // One full-width series per direction (group/stack null), all floating from the shared `start`;
  // each category carries a value for exactly one of them and the legend names the three directions.
  // partialRangeIsMissing matters because `start` exists on every row: without it the two
  // off-direction series would keep zero-extent bars at `start` instead of skipping the category.
  const seriesConfigs = DIRECTIONS.map((direction) => {
    const color = options.colors?.[direction] ?? DEFAULT_COLORS[direction];
    return {
      id: direction,
      property: direction,
      rangeProperty: RANGE_PROPERTY,
      renderer: 'bar',
      missingValueMode: 'connect',
      partialRangeIsMissing: true,
      group: null,
      stack: null,
      title: options.seriesTitles?.[direction] ?? DEFAULT_TITLES[direction],
      // strokeColor matches the fill: focused bars grow a 1px outline, and the default strokeColor
      // is the palette color for the series *index*, which would rim the bar in an unrelated color.
      shapeStyle: { normal: { strokeColor: color, fillColor: color } }
    } as DeepPartial<SeriesConfig>;
  });

  return { steps, data, categoryAxis, series: seriesConfigs, valueAxes: [{ base }] };
}
