import { checkUniqueLabels } from './labels';
import { roundToSignificant } from '../utils/utils';
import type { DeepPartial, CategoryAxisConfig, ValueAxisConfig, SeriesConfig } from '../types/config';

export type CandlestickDirection = 'up' | 'down';

export interface CandlestickItem {
  /** The candle label (e.g. the trading day), used as the category value when charted. */
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** The traded volume of the candle, charted when the `volume` option enables the volume pane. */
  volume?: number;
}

export interface Candlestick {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** The traded volume of the candle, when the input item carried one. */
  volume?: number;
  /** The signed change of the candle (close minus open). */
  change: number;
  /** `down` when the close is below the open, otherwise `up`. */
  direction: CandlestickDirection;
}

export interface CandlestickVolumeOptions {
  /**
   * The fraction (above 0, below 1) of the plot height used by the volume pane.
   * `heightFraction + gapFraction` must stay below 1; anything else throws.
   *
   * @default 0.2
   */
  heightFraction?: number;
  /**
   * The fraction (0 - 1, excluding 1) of the plot height left empty between the panes.
   * `heightFraction + gapFraction` must stay below 1; anything else throws.
   *
   * @default 0.05
   */
  gapFraction?: number;
  /**
   * The tooltip label shown for the volume rows.
   *
   * @default "Volume"
   */
  valueLabel?: string;
}

export interface CreateCandlestickOptions {
  /** The per-direction series titles, e.g. shown in the legend and tooltip. */
  seriesTitles?: Partial<Record<CandlestickDirection, string>>;
  /**
   * The per-direction candle colors, used for both the body and its wick. The
   * defaults pass the palette validation for adjacent bars on both light and
   * dark surfaces.
   */
  colors?: Partial<Record<CandlestickDirection, string>>;
  /**
   * The fraction (0 - 1) of the category slot used by the low/high wick bars.
   *
   * @default 0.15
   */
  wickWidthFraction?: number;
  /**
   * The fraction (0 - 1) of the category slot used by the open/close body bars.
   *
   * @default 1
   */
  bodyWidthFraction?: number;
  /**
   * The tooltip label shown for the low/high wick rows.
   *
   * @default "Range"
   */
  rangeTitle?: string;
  /**
   * Add a volume pane: direction-colored volume bars along the bottom of the
   * plot on their own hidden `volume` axis, with the price series moved to a
   * `price` axis whose enlarged minimum margin reserves the lower plot band.
   * Requires `volume` values on the items; pass `true` for the defaults or an
   * options object to tune the pane. The result gains a `valueAxes`
   * fragment to spread into the chart config alongside the series.
   *
   * @default false
   */
  volume?: boolean | CandlestickVolumeOptions;
  /**
   * Draw up candles hollow — outlined open/close bodies instead of filled —
   * the classic hollow-candle style where a filled body means down. The wicks
   * split into segments above and below each body so they don't show through
   * the hollow interior, the tooltip keeps its single low–high range row, and
   * the data objects gain an `upOpen` property for the below-body wick segment.
   *
   * @default false
   */
  hollow?: boolean;
}

export interface CandlestickData {
  candles: Candlestick[];
  /**
   * One row per candle: `label` (the category value), the raw `open`/`high`/
   * `low`/`close` plus `change` and `direction`, and the close under the
   * property matching its direction (`up` or `down` — the other stays
   * undefined) with the high mirrored the same way (`upHigh`/`downHigh`) so
   * the wicks split by direction too.
   */
  data: Record<string, number | string | undefined>[];
  /** Fragment to spread into the chart config's `categoryAxis`. */
  categoryAxis: Partial<CategoryAxisConfig>;
  /**
   * Fragments to spread into the chart config's `series`, wicks first
   * so the bodies paint over them, in up/down order. Directions absent from
   * the data keep their series so the config stays stable across data updates.
   * With the `hollow` option the wick series turn shapeless (tooltip row
   * only) and per-direction upper/lower wick segment series slot in between
   * them and the bodies. With the `volume` option per-direction volume bar
   * series are appended.
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

// Shared with the OHLC helper (src/data/Ohlc.ts); not part of the public API.
export const CATEGORY_PROPERTY = 'label';
export const DIRECTIONS: CandlestickDirection[] = ['up', 'down'];

export const DEFAULT_TITLES: Record<CandlestickDirection, string> = {
  up: 'Up',
  down: 'Down'
};

// Teal-green/red, not pure green/red: teal dodges the classic red-green-blindness collision and
// keeps ≥3:1 contrast on light and dark chart surfaces. Matches the waterfall helper's colors.
export const DEFAULT_COLORS: Record<CandlestickDirection, string> = {
  up: '#1baf7a',
  down: '#e34948'
};

const DEFAULT_BODY_MIN_EXTENT = 2;
const DEFAULT_WICK_WIDTH_FRACTION = 0.15;
export const DEFAULT_RANGE_TITLE = 'Range';

export const PRICE_AXIS_ID = 'price';
export const VOLUME_AXIS_ID = 'volume';
const DEFAULT_VOLUME_HEIGHT_FRACTION = 0.2;
const DEFAULT_VOLUME_GAP_FRACTION = 0.05;
const DEFAULT_VOLUME_LABEL = 'Volume';

export function computeCandlesticks(items: readonly CandlestickItem[]): Candlestick[] {
  return computeCandlesticksFor('computeCandlesticks', items);
}

/** computeCandlesticks naming the public helper it serves, so its errors name the function the caller called */
export function computeCandlesticksFor(helperName: string, items: readonly CandlestickItem[]): Candlestick[] {
  checkUniqueLabels(helperName, 'labels', items.map((item) => item.label));
  return items.map((item) => {
    const { label, open, high, low, close, volume } = item;
    checkCandleValues(helperName, label, { open, high, low, close });
    return {
      label, open, high, low, close,
      ...(volume !== undefined ? { volume } : {}),
      change: close - open,
      direction: close < open ? 'down' as const : 'up' as const
    };
  });
}

// one bad tick would otherwise reach getDataErrors, which blanks the entire chart
function checkCandleValues(helperName: string, label: string, values: Record<string, number | undefined>): void {
  for (const key of ['open', 'high', 'low', 'close']) {
    const value = values[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${helperName}: ${label} has a missing or non-finite ${key}: ${String(value)}`);
    }
  }
  const high = values['high']!;
  const low = values['low']!;
  if (high < low) {
    throw new Error(`${helperName}: ${label} has high ${high} below low ${low}`);
  }
  for (const key of ['open', 'close']) {
    const value = values[key]!;
    if (value < low || value > high) {
      throw new Error(`${helperName}: ${label} has ${key} ${value} outside low ${low} – high ${high}`);
    }
  }
}

/** Resolves the shared candlestick/OHLC `volume` option; null when disabled. */
export function getVolumeOptions(helperName: string, volume: boolean | CandlestickVolumeOptions | undefined): Required<CandlestickVolumeOptions> | null {
  if (volume === undefined || volume === false) {
    return null;
  }
  const options = volume === true ? {} : volume;
  const heightFraction = options.heightFraction ?? DEFAULT_VOLUME_HEIGHT_FRACTION;
  const gapFraction = options.gapFraction ?? DEFAULT_VOLUME_GAP_FRACTION;
  // the pane split divides by heightFraction and by the price share, so each pane needs a real slice
  if (!(heightFraction > 0 && heightFraction < 1)) {
    throw new Error(`${helperName}: volume heightFraction must be between 0 and 1, got ${heightFraction}`);
  }
  if (!(gapFraction >= 0 && gapFraction < 1)) {
    throw new Error(`${helperName}: volume gapFraction must be at least 0 and below 1, got ${gapFraction}`);
  }
  if (heightFraction + gapFraction >= 1) {
    throw new Error(`${helperName}: volume heightFraction + gapFraction must be below 1, got ${heightFraction} + ${gapFraction}`);
  }
  return {
    heightFraction,
    gapFraction,
    valueLabel: options.valueLabel ?? DEFAULT_VOLUME_LABEL
  };
}

// the value axis default, set explicitly because the split below has to account for it
const PRICE_MAX_MARGIN_FRACTION = 0.05;

// The pane split is pure domain margins, adapting to every data update: volume pins its min at 0 and
// inflates its max until bars fill `heightFraction`; price pads its min clear of the band + gap.
// Margins are relative to the pre-margin extent, so a band fraction `f` needs a margin of (1 - f) / f
// when it is the only margin; the price axis keeps its top margin too, and both come out of the same
// extent, so its bottom margin m1 has to satisfy m1 / (1 + m1 + m2) = f.
export function buildVolumeValueAxisConfigs(volumeOptions: Required<CandlestickVolumeOptions>): Partial<ValueAxisConfig>[] {
  const { heightFraction, gapFraction } = volumeOptions;
  const priceHeightFraction = 1 - heightFraction - gapFraction;
  return [
    {
      id: PRICE_AXIS_ID,
      minMarginFraction: roundToSignificant((heightFraction + gapFraction) * (1 + PRICE_MAX_MARGIN_FRACTION) / priceHeightFraction),
      maxMarginFraction: PRICE_MAX_MARGIN_FRACTION
    },
    {
      id: VOLUME_AXIS_ID,
      min: 0,
      maxMarginFraction: roundToSignificant((1 - heightFraction) / heightFraction),
      visible: false
    }
  ];
}

// One volume bar series per direction, out of the legend but following its direction series, so
// filtering/focusing a direction takes its volume bars along; one tooltip volume row per category.
export function buildVolumeSeriesConfigs(volumeOptions: Required<CandlestickVolumeOptions>, colors: Partial<Record<CandlestickDirection, string>> | undefined): DeepPartial<SeriesConfig>[] {
  return DIRECTIONS.map((direction) => {
    const color = colors?.[direction] ?? DEFAULT_COLORS[direction];
    return {
      id: direction + 'Volume',
      property: direction + 'Volume',
      axis: VOLUME_AXIS_ID,
      renderer: 'bar',
      missingValueMode: 'connect',
      group: null,
      stack: null,
      showInLegend: false,
      followSeries: direction,
      valueLabel: volumeOptions.valueLabel,
      shapeStyle: { normal: { strokeColor: color, fillColor: color, fillOpacity: 1 } }
    } as DeepPartial<SeriesConfig>;
  });
}

// One chart row per candle: the shared price fields plus the close/high (and, per openDirections and
// the volume option, the open/volume) under direction-gated properties so each direction's series
// only draws its own candles.
export function buildDirectionRows(
  candles: readonly Candlestick[],
  openDirections: readonly CandlestickDirection[],
  volumeOptions: Required<CandlestickVolumeOptions> | null
): Record<string, number | string | undefined>[] {
  return candles.map((candle) => {
    const gated = (direction: CandlestickDirection, value: number | undefined) => candle.direction === direction ? value : undefined;
    const openProperties: Record<string, number | undefined> = {};
    for (const direction of openDirections) {
      openProperties[direction + 'Open'] = gated(direction, candle.open);
    }
    return {
      [CATEGORY_PROPERTY]: candle.label,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      up: gated('up', candle.close),
      down: gated('down', candle.close),
      upHigh: gated('up', candle.high),
      downHigh: gated('down', candle.high),
      ...openProperties,
      ...(volumeOptions !== null ? {
        volume: candle.volume,
        upVolume: gated('up', candle.volume),
        downVolume: gated('down', candle.volume)
      } : {}),
      change: candle.change,
      direction: candle.direction
    };
  });
}

export function createCandlestick(items: readonly CandlestickItem[], options: CreateCandlestickOptions = {}): CandlestickData {
  const candles = computeCandlesticksFor('createCandlestick', items);
  const wickWidthFraction = options.wickWidthFraction ?? DEFAULT_WICK_WIDTH_FRACTION;
  const bodyWidthFraction = options.bodyWidthFraction ?? 1;
  const rangeTitle = options.rangeTitle ?? DEFAULT_RANGE_TITLE;
  const hollow = options.hollow ?? false;
  const volumeOptions = getVolumeOptions('createCandlestick', options.volume);

  // The hollow up candle's below-body wick segment spans low→open and needs the open under an
  // up-only property (the shared `open` exists on every row, so it can't gate by direction).
  const data = buildDirectionRows(candles, hollow ? ['up'] : [], volumeOptions);

  // An ordinal scale so the candles keep even spacing when labels are dates
  // with gaps (weekends, holidays) — a linear/time scale would leave holes.
  const categoryAxis: Partial<CategoryAxisConfig> = {
    property: CATEGORY_PROPERTY,
    type: 'string',
    scale: 'ordinal'
  };

  // Two bar series per direction, gated to one direction per category (missingValueMode 'connect' + partialRangeIsMissing,
  // as in the waterfall helper): a thin low→high wick under an opaque full-width open→close body. Wicks skip the legend
  // but follow their body via followSeries, carrying the range title as their tooltip row (low – high).
  // In hollow mode the wick would show through the see-through up body, so this series turns shapeless
  // (tooltip row and interaction only) and the segment series below draw the visible wick instead.
  const wickConfigs = DIRECTIONS.map((direction) => {
    const color = options.colors?.[direction] ?? DEFAULT_COLORS[direction];
    return {
      id: direction + 'Wick',
      property: direction + 'High',
      rangeProperty: 'low',
      ...(volumeOptions !== null ? { axis: PRICE_AXIS_ID } : {}),
      renderer: hollow ? 'none' : 'bar',
      bar: { widthFraction: wickWidthFraction },
      missingValueMode: 'connect',
      partialRangeIsMissing: true,
      group: null,
      stack: null,
      showInLegend: false,
      followSeries: direction,
      valueLabel: rangeTitle,
      // strokeColor matches the fill: focused bars grow a 1px outline, and the default strokeColor
      // is the palette color for the series *index*, which would rim the wick in an unrelated color.
      shapeStyle: { normal: { strokeColor: color, fillColor: color, fillOpacity: 1 } },
      // marker.shape null overrides the renderer-none default (circle markers); the label fill
      // color/opacity color the tooltip icon, which falls back to them for shapeless series.
      ...(hollow ? { marker: { shape: null }, label: { textStyle: { normal: { fillColor: color, fillOpacity: 1 } } } } : {})
    } as DeepPartial<SeriesConfig>;
  });

  // The visible hollow-mode wick: direction-gated segments above (body top → high) and below (low →
  // body bottom) the body; tooltip rows stay on the shapeless wick series above (one low – high row).
  const wickSegmentConfigs = hollow ? DIRECTIONS.flatMap((direction) => {
    const shared = {
      ...(volumeOptions !== null ? { axis: PRICE_AXIS_ID } : {}),
      renderer: 'bar',
      bar: { widthFraction: wickWidthFraction },
      missingValueMode: 'connect',
      partialRangeIsMissing: true,
      group: null,
      stack: null,
      showInLegend: false,
      showInTooltip: false,
      followSeries: direction,
      shapeStyle: {
        normal: {
          strokeColor: options.colors?.[direction] ?? DEFAULT_COLORS[direction],
          fillColor: options.colors?.[direction] ?? DEFAULT_COLORS[direction],
          fillOpacity: 1
        }
      }
    };
    return [
      { id: direction + 'WickUpper', property: direction + 'High', rangeProperty: direction === 'up' ? 'up' : 'open', ...shared } as DeepPartial<SeriesConfig>,
      { id: direction + 'WickLower', property: direction === 'up' ? 'upOpen' : 'down', rangeProperty: 'low', ...shared } as DeepPartial<SeriesConfig>
    ];
  }) : [];

  const bodyConfigs = DIRECTIONS.map((direction) => {
    const color = options.colors?.[direction] ?? DEFAULT_COLORS[direction];
    const hollowBody = hollow && direction === 'up';
    return {
      id: direction,
      property: direction,
      rangeProperty: 'open',
      ...(volumeOptions !== null ? { axis: PRICE_AXIS_ID } : {}),
      renderer: 'bar',
      // a doji (open === close) has a zero-height body; a filled one would draw nothing at all,
      // while a hollow one already shows its outline
      bar: { widthFraction: bodyWidthFraction, ...(hollowBody ? {} : { minExtent: DEFAULT_BODY_MIN_EXTENT }) },
      missingValueMode: 'connect',
      partialRangeIsMissing: true,
      group: null,
      stack: null,
      title: options.seriesTitles?.[direction] ?? DEFAULT_TITLES[direction],
      // Outline-only hollow body: the fill stays transparent in every focus state, and focus
      // thickens the outline instead of the default bar behavior of thinning it back to 1px.
      shapeStyle: hollowBody ? {
        normal: { strokeColor: color, strokeOpacity: 1, strokeWidth: 2, fillColor: color, fillOpacity: 0 },
        focused: { strokeWidth: 3, fillOpacity: 0 },
        defocused: { strokeWidth: 2, fillOpacity: 0 }
      } : {
        normal: { strokeColor: color, fillColor: color, fillOpacity: 1 }
      }
    } as DeepPartial<SeriesConfig>;
  });

  return {
    candles,
    data,
    categoryAxis,
    series: [
      ...wickConfigs,
      ...wickSegmentConfigs,
      ...bodyConfigs,
      ...(volumeOptions !== null ? buildVolumeSeriesConfigs(volumeOptions, options.colors) : [])
    ],
    ...(volumeOptions !== null ? { valueAxes: buildVolumeValueAxisConfigs(volumeOptions) } : {})
  };
}
