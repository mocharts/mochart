import { interpolateRgb, interpolateHsl, interpolateLab, interpolateHcl } from 'd3-interpolate';

import { checkUniqueLabels } from './labels';
import type { ColorInterpolation } from '../config/core/constants';
import type { DeepPartial, CategoryAxisConfig, ValueAxisConfig, SeriesConfig } from '../types/config';

export interface HeatmapRow {
  /** The row title, e.g. shown in the legend and tooltip. */
  label: string;
  /** One cell value per column; null/undefined leaves a gap in the grid (or a `missingColor` cell). */
  values: readonly (number | null | undefined)[];
}

export interface CreateHeatmapColorScaleOptions {
  /**
   * The cell color at the low end of the value domain. Together with
   * `colorMax` the defaults form a single-hue light-to-dark sequential blue
   * ramp that reads on both light and dark surfaces.
   *
   * @default '#cde2fb'
   */
  colorMin?: string;
  /**
   * The cell color at the high end of the value domain.
   *
   * @default '#0d366b'
   */
  colorMax?: string;
  /**
   * The color space the ramp interpolates through, matching the series config
   * `colorInterpolation` values. The default 'lab' (and 'rgb') interpolate
   * linearly, which keeps the per-row series colors emitted by
   * `createHeatmap` exactly on the global ramp; 'hsl'/'hcl' rotate through
   * hue and can drift very slightly per row.
   *
   * @default 'lab'
   */
  colorInterpolation?: ColorInterpolation;
}

export interface CreateHeatmapOptions extends CreateHeatmapColorScaleOptions {
  /**
   * The column labels, used as the category values: one per column and unique,
   * both enforced with a throw. Defaults to the 1-based column numbers as strings.
   */
  columnLabels?: readonly string[];
  /**
   * The value domain the cell colors are scaled over. Defaults to the extent
   * of all cell values. Cell values outside an explicit domain are clamped
   * toward the end colors. `domain[0]` must be <= `domain[1]`; a descending
   * domain throws an error.
   */
  domain?: [number, number];
  /**
   * The fraction (0 to under 0.5) of a cell trimmed from each side as the gap
   * between neighbouring cells (use 0 for a contiguous grid).
   *
   * @default 0.03
   */
  cellPadding?: number;
  /**
   * When set, a cell whose value is missing renders as a full band in this
   * color instead of leaving a gap in the grid (it becomes each row series'
   * `colorScale.missing`). Pick a color clearly off the ramp so missing cells
   * read as "no data" rather than as a value.
   */
  missingColor?: string;
}

export interface HeatmapData {
  /** The value domain the cell colors are scaled over (null with no values). */
  domain: [number, number] | null;
  /** Maps a cell value to its hex color, e.g. for building a color legend. */
  colorScale: (value: number) => string;
  /**
   * One entry per column: `column` (the category value) plus, for each heatmap
   * row `r` with a cell in the column, `row{r}` / `row{r}Start` (the cell's
   * band on the value axis) and `row{r}Value` (the cell value). With an
   * explicit domain a domain-clamped `row{r}Color` drives the color instead.
   */
  data: Record<string, number | string | undefined>[];
  /** Fragment to spread into the chart config's `categoryAxis`. */
  categoryAxis: Partial<CategoryAxisConfig>;
  /** Fragment to spread into the chart config's `valueAxes`. */
  valueAxes: Partial<ValueAxisConfig>[];
  /** Fragments to spread into the chart config's `series`, one per row. */
  series: DeepPartial<SeriesConfig>[];
}

const CATEGORY_PROPERTY = 'column';
const DEFAULT_COLOR_MIN = '#cde2fb';
const DEFAULT_COLOR_MAX = '#0d366b';
const DEFAULT_COLOR_INTERPOLATION: ColorInterpolation = 'lab';
const DEFAULT_CELL_PADDING = 0.03;

const INTERPOLATORS: Record<ColorInterpolation, (a: string, b: string) => (t: number) => string> = {
  rgb: interpolateRgb,
  hsl: interpolateHsl,
  lab: interpolateLab,
  hcl: interpolateHcl
};

/**
 * Builds the sequential color scale a heatmap uses: `domain[0]` maps to
 * `colorMin`, `domain[1]` to `colorMax`, values outside the domain clamp to
 * the end colors and everything in between interpolates through
 * `colorInterpolation` space. Returned colors are hex strings.
 */
export function createHeatmapColorScale(domain: [number, number], options: CreateHeatmapColorScaleOptions = {}): (value: number) => string {
  const colorMin = options.colorMin ?? DEFAULT_COLOR_MIN;
  const colorMax = options.colorMax ?? DEFAULT_COLOR_MAX;
  const interpolate = INTERPOLATORS[options.colorInterpolation ?? DEFAULT_COLOR_INTERPOLATION](colorMin, colorMax);
  const [min, max] = domain;
  if (!(max >= min)) {
    throw new Error(`createHeatmapColorScale: invalid domain [${min}, ${max}]`);
  }
  const extent = max - min;
  return (value: number) => {
    // A collapsed domain (all cells equal) sits every cell at the ramp midpoint.
    const t = extent > 0 ? Math.min(Math.max((value - min) / extent, 0), 1) : 0.5;
    return toHexColor(interpolate(t));
  };
}

/**
 * Turns a grid of values into the pieces of a heatmap chart: each row becomes
 * a full-width `bar` series floating on a fixed one-unit band of a linear
 * value axis labelled with the row names via explicit `ticks` (`rows[0]` on
 * top), columns become ordinal category values, and each cell's `colorProperty`
 * value colors it from a shared sequential ramp. Spread the fragments into a
 * chart config and chart the `data`. The row series stay out of the legend
 * (`showInLegend: false`) — the axis names the rows and a color-scale strip
 * built from `colorScale` makes the better legend.
 *
 * The core color scale spans each series' own color-value extent, so each
 * row's `colorScale.min`/`colorScale.max` is the global ramp sampled at that row's
 * min/max — linear interpolation restricted to a sub-interval reproduces the
 * global scale, keeping cell colors comparable across rows. With an explicit
 * domain the per-cell color values are domain-clamped (`row{r}Color`) so that
 * sub-interval stays inside the ramp.
 *
 * Each series sets `tooltipProperty` to the cell value, so the tooltip shows
 * the value driving the color rather than the cell's band coordinates.
 */
export function createHeatmap(rows: readonly HeatmapRow[], options: CreateHeatmapOptions = {}): HeatmapData {
  const cellPadding = options.cellPadding ?? DEFAULT_CELL_PADDING;
  if (!(cellPadding >= 0 && cellPadding < 0.5)) {
    throw new Error(`createHeatmap: cellPadding must be at least 0 and below 0.5, got ${cellPadding}`);
  }
  const rowCount = rows.length;
  const columnCount = rows.reduce((count, row) => Math.max(count, row.values.length), 0);
  checkColumnLabels(options.columnLabels, columnCount);

  const explicitDomain = options.domain ?? null;
  if (explicitDomain !== null && !(explicitDomain[1] >= explicitDomain[0])) {
    throw new Error(`createHeatmap: invalid domain [${explicitDomain[0]}, ${explicitDomain[1]}]`);
  }
  const domain = explicitDomain ?? getExtent(rows.flatMap((row) => row.values));
  const colorScale = createHeatmapColorScale(domain ?? [0, 1], options);

  const data: Record<string, number | string | undefined>[] = [];
  for (let c = 0; c < columnCount; c++) {
    const entry: Record<string, number | string | undefined> = {
      [CATEGORY_PROPERTY]: options.columnLabels?.[c] ?? String(c + 1)
    };
    for (let r = 0; r < rowCount; r++) {
      const value = rows[r].values[c];
      if (value != null && Number.isFinite(value)) {
        entry['row' + r] = rowCount - r - cellPadding;
        entry['row' + r + 'Start'] = rowCount - r - 1 + cellPadding;
        entry['row' + r + 'Value'] = value;
        if (explicitDomain !== null) {
          // The core spans colors over the row's own color-value extent, so an
          // out-of-domain raw value would stretch the row off the global ramp.
          entry['row' + r + 'Color'] = clampValue(value, explicitDomain);
        }
      }
      else if (options.missingColor !== undefined) {
        // the band renders (colored colorScale.missing) with no cell value
        entry['row' + r] = rowCount - r - cellPadding;
        entry['row' + r + 'Start'] = rowCount - r - 1 + cellPadding;
      }
    }
    data.push(entry);
  }

  const categoryAxis: Partial<CategoryAxisConfig> = {
    property: CATEGORY_PROPERTY,
    type: 'string',
    scale: 'ordinal',
    // outer trims half its fraction from each side of a column, so doubling it matches the rows'
    // per-side trim; inner only applies to grouped series and the rows are ungrouped
    categoryPaddingFraction: { inner: 0, outer: cellPadding * 2 }
  };

  // Pinned to exactly the stacked row bands, with one explicit tick per row at its band center
  // (auto numeric ticks would land on band edges and mislabel the rows).
  const valueAxisConfig: Partial<ValueAxisConfig> = {
    min: 0,
    max: Math.max(rowCount, 1),
    minMarginFraction: 0,
    maxMarginFraction: 0,
    ticks: rows.map((row, r) => ({ value: rowCount - r - 0.5, label: row.label }))
  };

  const seriesConfigs = rows.map((row, r) => {
    const colorValues = explicitDomain === null ? row.values
      : row.values.map((value) => value != null && Number.isFinite(value) ? clampValue(value, explicitDomain) : value);
    const rowDomain = getExtent(colorValues) ?? domain ?? [0, 1];
    return {
      id: 'row' + r,
      property: 'row' + r,
      rangeProperty: 'row' + r + 'Start',
      tooltipProperty: 'row' + r + 'Value',
      colorProperty: 'row' + r + (explicitDomain === null ? 'Value' : 'Color'),
      colorScale: {
        interpolation: options.colorInterpolation ?? DEFAULT_COLOR_INTERPOLATION,
        min: colorScale(rowDomain[0]),
        max: colorScale(rowDomain[1]),
        ...(options.missingColor !== undefined ? { missing: options.missingColor } : {})
      },
      renderer: 'bar',
      // an all-missing row leaves its properties out of every data object
      allowAbsentDataProperties: true,
      missingValueMode: 'connect',
      group: null,
      stack: null,
      shapeStyle: { normal: { fillOpacity: 1 } },
      // Rows are named by the axis ticks; a legend entry per row would only
      // invite filtering rows, which reads as data rather than a hidden series.
      showInLegend: false,
      title: row.label
    } as DeepPartial<SeriesConfig>;
  });

  return { domain, colorScale, data, categoryAxis, valueAxes: [valueAxisConfig], series: seriesConfigs };
}

// column values index the rows, so a short list padded with column numbers could collide
function checkColumnLabels(columnLabels: readonly string[] | undefined, columnCount: number): void {
  if (columnLabels === undefined) {
    return;
  }
  if (columnLabels.length !== columnCount) {
    throw new Error(`createHeatmap: ${columnLabels.length} columnLabels for ${columnCount} columns`);
  }
  checkUniqueLabels('createHeatmap', 'columnLabels', columnLabels);
}

function clampValue(value: number, [min, max]: [number, number]): number {
  return Math.min(Math.max(value, min), max);
}

function getExtent(values: readonly (number | null | undefined)[]): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value != null && Number.isFinite(value)) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return min <= max ? [min, max] : null;
}

// d3's interpolators return 'rgb(r, g, b)' strings; the config color
// validator wants hex (its rgb() form rejects the spaces).
function toHexColor(color: string): string {
  const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (match === null) {
    return color;
  }
  return '#' + match.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, '0')).join('');
}
