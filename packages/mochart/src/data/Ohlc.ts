import {
  computeCandlesticksFor, DIRECTIONS, DEFAULT_TITLES, DEFAULT_COLORS, CATEGORY_PROPERTY, DEFAULT_RANGE_TITLE,
  PRICE_AXIS_ID, getVolumeOptions, buildVolumeValueAxisConfigs, buildVolumeSeriesConfigs, buildDirectionRows
} from './Candlestick';
import type { Candlestick, CandlestickDirection, CandlestickItem, CandlestickVolumeOptions } from './Candlestick';
import type { DeepPartial, CategoryAxisConfig, ValueAxisConfig, SeriesConfig } from '../types/config';

export interface CreateOhlcOptions {
  /** The per-direction series titles, e.g. shown in the legend. */
  seriesTitles?: Partial<Record<CandlestickDirection, string>>;
  /**
   * The per-direction bar colors, used for the low/high line and both ticks.
   * The defaults pass the palette validation for adjacent bars on both light
   * and dark surfaces.
   */
  colors?: Partial<Record<CandlestickDirection, string>>;
  /**
   * The fraction (0 - 1) of the category slot used by the vertical low/high line.
   *
   * @default 0.15
   */
  lineWidthFraction?: number;
  /**
   * The fraction (0 - 1) of the category slot used by each open/close tick. Ticks
   * extend from the slot edge to its center, so at the default each tick spans
   * half the slot.
   *
   * @default 0.5
   */
  tickWidthFraction?: number;
  /**
   * The thickness (in pixels) of the open/close tick marks.
   *
   * @default 2
   */
  tickExtent?: number;
  /**
   * The tooltip label shown for the low/high line rows.
   *
   * @default "Range"
   */
  rangeTitle?: string;
  /**
   * The tooltip label shown for the open tick rows.
   *
   * @default "Open"
   */
  openTitle?: string;
  /**
   * The tooltip label shown for the close tick rows.
   *
   * @default "Close"
   */
  closeTitle?: string;
  /**
   * Add a volume pane: direction-colored volume bars along the bottom of the
   * plot on their own hidden `volume` axis, with the price series moved to a
   * `price` axis whose enlarged minimum margin reserves the lower plot band.
   * Requires a finite `volume` on every item, enforced with a throw; pass
   * `true` for the defaults or an options object to tune the pane. The result
   * gains a `valueAxes` fragment to spread into the chart config alongside the
   * series.
   *
   * @default false
   */
  volume?: boolean | CandlestickVolumeOptions;
}

export interface OhlcData {
  candles: Candlestick[];
  /**
   * One row per bar: `label` (the category value), the raw `open`/`high`/`low`/
   * `close` plus `change` and `direction`, and the direction-split values the
   * series read (the other direction stays undefined): the close under `up`/
   * `down`, the high under `upHigh`/`downHigh` and the open under `upOpen`/
   * `downOpen`.
   */
  data: Record<string, number | string | undefined>[];
  /** Fragment to spread into the chart config's `categoryAxis`. */
  categoryAxis: Partial<CategoryAxisConfig>;
  /**
   * Fragments to spread into the chart config's `series`: the low/high
   * lines first (the legend entries), then the open and close ticks that
   * follow them, in up/down order. Directions absent from the data keep their
   * series so the config stays stable across data updates. With the `volume`
   * option per-direction volume bar series are appended.
   */
  series: DeepPartial<SeriesConfig>[];
  /**
   * Fragments to spread into the chart config's `valueAxes` — only
   * present with the `volume` option: the `price` axis the price series
   * reference and the hidden `volume` axis whose margins split the plot into
   * the two panes.
   */
  valueAxes?: Partial<ValueAxisConfig>[];
}

const DEFAULT_LINE_WIDTH_FRACTION = 0.15;
const DEFAULT_TICK_WIDTH_FRACTION = 0.5;
const DEFAULT_TICK_EXTENT = 2;
const DEFAULT_OPEN_TITLE = 'Open';
const DEFAULT_CLOSE_TITLE = 'Close';

export function createOhlc(items: readonly CandlestickItem[], options: CreateOhlcOptions = {}): OhlcData {
  const candles = computeCandlesticksFor('createOhlc', items);
  const lineWidthFraction = options.lineWidthFraction ?? DEFAULT_LINE_WIDTH_FRACTION;
  const tickWidthFraction = options.tickWidthFraction ?? DEFAULT_TICK_WIDTH_FRACTION;
  const tickExtent = options.tickExtent ?? DEFAULT_TICK_EXTENT;
  const rangeTitle = options.rangeTitle ?? DEFAULT_RANGE_TITLE;
  const openTitle = options.openTitle ?? DEFAULT_OPEN_TITLE;
  const closeTitle = options.closeTitle ?? DEFAULT_CLOSE_TITLE;
  const volumeOptions = getVolumeOptions('createOhlc', options.volume);

  const data = buildDirectionRows('createOhlc', candles, DIRECTIONS, volumeOptions);

  // An ordinal scale so the bars keep even spacing when labels are dates with
  // gaps (weekends, holidays) — a linear/time scale would leave holes.
  const categoryAxis: Partial<CategoryAxisConfig> = {
    property: CATEGORY_PROPERTY,
    type: 'string',
    scale: 'ordinal'
  };

  // Three bar series per direction, direction-gated as in the candlestick helper: a thin centered low→high
  // line (the legend entry), plus zero-extent open/close range bars that bar.minExtent + bar.alignFraction 0/1
  // expand into half-slot tick marks, following their line via followSeries so the whole bar acts as one mark.
  // Tooltip rows per category: the range (low – high), then the ticks' equal-ended ranges as single values.
  const lineConfigs = DIRECTIONS.map((direction) => ({
    id: direction,
    property: direction + 'High',
    rangeProperty: 'low',
    ...(volumeOptions !== null ? { axis: PRICE_AXIS_ID } : {}),
    renderer: 'bar',
    bar: { widthFraction: lineWidthFraction },
    missingValueMode: 'connect',
    partialRangeIsMissing: true,
    group: null,
    stack: null,
    title: options.seriesTitles?.[direction] ?? DEFAULT_TITLES[direction],
    valueLabel: rangeTitle,
    // strokeColor matches the fill: focused bars grow a 1px outline, and the default strokeColor
    // is the palette color for the series *index*, which would rim the bar in an unrelated color.
    shapeStyle: {
      normal: {
        strokeColor: options.colors?.[direction] ?? DEFAULT_COLORS[direction],
        fillColor: options.colors?.[direction] ?? DEFAULT_COLORS[direction],
        fillOpacity: 1
      }
    }
  } as DeepPartial<SeriesConfig>));

  const tickConfigs = (['open', 'close'] as const).flatMap((side) => DIRECTIONS.map((direction) => ({
    id: direction + (side === 'open' ? 'Open' : 'Close'),
    property: side === 'open' ? direction + 'Open' : direction,
    rangeProperty: side,
    ...(volumeOptions !== null ? { axis: PRICE_AXIS_ID } : {}),
    renderer: 'bar',
    bar: { widthFraction: tickWidthFraction, alignFraction: side === 'open' ? 0 : 1, minExtent: tickExtent },
    missingValueMode: 'connect',
    partialRangeIsMissing: true,
    group: null,
    stack: null,
    showInLegend: false,
    followSeries: direction,
    valueLabel: side === 'open' ? openTitle : closeTitle,
    shapeStyle: {
      normal: {
        strokeColor: options.colors?.[direction] ?? DEFAULT_COLORS[direction],
        fillColor: options.colors?.[direction] ?? DEFAULT_COLORS[direction],
        fillOpacity: 1
      }
    }
  } as DeepPartial<SeriesConfig>)));

  return {
    candles,
    data,
    categoryAxis,
    series: [
      ...lineConfigs,
      ...tickConfigs,
      ...(volumeOptions !== null ? buildVolumeSeriesConfigs(volumeOptions, options.colors) : [])
    ],
    ...(volumeOptions !== null ? { valueAxes: buildVolumeValueAxisConfigs(volumeOptions) } : {})
  };
}
