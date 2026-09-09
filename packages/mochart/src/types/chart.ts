import type { MochartConfig, MochartInputConfig } from './config';
import type { Bounds } from './geometry';
import type { ArrayOfObjectsData, DataProvider, ObjectOfArraysData } from './data';

/** Pointer event details reported by the plot-area callbacks. */
export interface ChartEventPayload {
  /** Pointer x relative to the plot area, in plot pixels. */
  chartX: number;
  /** Pointer y relative to the plot area, in plot pixels. */
  chartY: number;
  /** Pointer position along the category axis, in plot pixels. */
  categoryPosition: number;
  /** Pointer position along the value axis, in plot pixels. */
  valuePosition: number;
  /** Pointer position along the category axis as a 0–1 fraction of the plot. */
  categoryFraction: number;
  /** Pointer position along the value axis as a 0–1 fraction of the plot. */
  valueFraction: number;
  /** Index of the category nearest the pointer, -1 when none. */
  categoryIndex: number;
}

/** The chart's current focus, reported by `onFocus`. */
export interface ChartFocus {
  /** Id of the focused value axis, or null when no axis is focused. */
  focusedValueAxisId: string | null;
  /** Id of the focused series, or null when no series is focused. */
  focusedSeriesId: string | null;
  /** Index of the focused category, -1 when no category is focused. */
  focusedCategoryIndex: number;
}

/** Partial focus update raised from inside the chart (undefined = leave unchanged, null = clear). */
export interface InternalFocus {
  valueAxisId?: string | null;
  seriesId?: string | null;
  categoryIndex?: number | null;
}

/** The legend filtering state, reported by `onSeriesFilter`. */
export interface ChartSeriesFilter {
  /** Map of series id → true for every series currently filtered out. */
  filteredSeriesIds: Record<string, boolean>;
}

export interface ChartDomAccessors {
  getTitleTextDomElement(): SVGGraphicsElement | null;
  getTitleTextRawDomElement(): SVGGraphicsElement | null;
  getTitlePrefixDomElement(): SVGGraphicsElement | null;
  getTitleSuffixDomElement(): SVGGraphicsElement | null;
  getCategoryAxisTicksDomElements(): NodeListOf<SVGGraphicsElement>;
  getCategoryAxisSizeTickDomElement(): SVGGraphicsElement | null;
  getCategoryAxisTitleDomElement(): SVGGraphicsElement | null;
  getCategoryAxisThresholdTitleDomElements(): NodeListOf<SVGGraphicsElement>;
  getValueAxisTicksDomElementsForId(axisId: string): NodeListOf<SVGGraphicsElement>;
  getValueAxisTitleDomElementForId(axisId: string): SVGGraphicsElement | null;
  getValueAxisThresholdTitleDomElementsForId(axisId: string): NodeListOf<SVGGraphicsElement>;
  getLegendDomElement(): HTMLElement | null;
  getLegendItemTextDomElements(): NodeListOf<SVGGraphicsElement>;
  getLegendItemTextRawDomElements(): NodeListOf<SVGGraphicsElement>;
  getTooltipDomElement(): HTMLElement | null;
}

/** The argument every state factory receives; all six members are always present. */
export interface ChartFactoryContext {
  /**
   * Width in pixels of the box the content fills: the whole chart for the
   * no-size/config-error/no-config states, the plot area for the rest.
   */
  width: number;
  /** Height in pixels of the same box `width` measures. */
  height: number;
  /** The enhanced config as supplied (even the invalid one in the config-error state); null when none yet. */
  mochartConfig: MochartConfig | null;
  /** The current data provider, or null when there is none. */
  dataProvider: DataProvider | null;
  /** The active error — the `error` prop or the provider's; undefined outside the error state. */
  error: unknown;
  /** True when the committed dataset holds at least one category. */
  hasData: boolean;
}

/** Content accepted from loading, error, and empty-state factories. */
export type ChartFactoryContent = Node | string | number | false | null | undefined;
export type ChartContentFactory = (context: ChartFactoryContext) => ChartFactoryContent;

/** A pie/donut/gauge slice click, reported by `onSliceClick`. */
export interface ChartSliceClickPayload {
  /** Id of the clicked slice's series (the leader for follower series). */
  seriesId: string;
}

/** A cartesian series shape click, reported by `onSeriesClick`. */
export interface ChartSeriesClickPayload {
  /** Id of the clicked shape's series (the leader for follower series). */
  seriesId: string;
  /** Index of the clicked bar/marker/label's category; -1 for a whole-series shape (line/area path). */
  categoryIndex: number;
  /** Index of the category nearest the pointer, as `onChartClick` reports it; -1 when none. */
  nearestCategoryIndex: number;
}

/** Optional interaction callbacks accepted by both chart entry points. */
export interface ChartCallbacks {
  /** The plot area was clicked. */
  onChartClick?: (event: ChartEventPayload) => void;
  /** A pie-type slice was clicked; fires only on click (unlike hover-driven `onFocus`), so it can anchor selection. */
  onSliceClick?: (payload: ChartSliceClickPayload) => void;
  /**
   * A cartesian series shape (bar, marker, label, line/area path) was clicked.
   * Independent of `focusOnClick`; fires only on click, so it can anchor selection.
   */
  onSeriesClick?: (payload: ChartSeriesClickPayload) => void;
  /** The pointer entered the plot area. */
  onChartMouseEnter?: (event: ChartEventPayload) => void;
  /** The pointer moved within the plot area. */
  onChartMouseMove?: (event: ChartEventPayload) => void;
  /** The pointer left the plot area. */
  onChartMouseLeave?: (event: ChartEventPayload) => void;
  /** The chart title was clicked (see `title.link`/`title.linkDisabled`). */
  onTitleClick?: () => void;
  /**
   * The focused series/category/value axis — via pointer over/click on the
   * plot or the legend, per the `focusOnHover`/`focusOnClick` config.
   */
  onFocus?: (focus: ChartFocus) => void;
  /**
   * A legend click toggled a series in or out of the filtered set
   * (requires `legend.filterOnClick`).
   */
  onSeriesFilter?: (filter: ChartSeriesFilter) => void;
  /** The plot area was re-laid-out; reports its new bounds. */
  onSeriesLayoutBoundsChange?: (bounds: Bounds) => void;
}

/**
 * Factories customizing what renders in each non-chart state; each receives a
 * {@link ChartFactoryContext} (only `width`/`height` differ between the states).
 */
export interface ChartFactories {
  /** Rendered while the `loading` prop is true. */
  getLoadingComponent?: ChartContentFactory;
  /** Rendered while the `error` prop is set. */
  getErrorComponent?: ChartContentFactory;
  /** Rendered when the dataset has no categories. */
  getNoDataComponent?: ChartContentFactory;
  /** Rendered when width or height is not a positive number (0 before a container is laid out). */
  getNoSizeComponent?: ChartContentFactory;
  /** Rendered when the config declares no series. */
  getNoSeriesComponent?: ChartContentFactory;
  /** Rendered when the config fails validation. */
  getConfigErrorComponent?: ChartContentFactory;
}

/** Props shared by both chart entry points. */
export interface BaseChartProps extends ChartCallbacks, ChartFactories {
  /** Chart width in pixels (the framework bindings can derive it from the container). */
  width: number;
  /** Chart height in pixels (the framework bindings can derive it from the container). */
  height: number;
  /**
   * Inline style on the chart's root element, over the default `position: relative`
   * (the tooltip and live region anchor to the root — keep `position` non-`static`).
   * Object keys are camelCase and bare numbers get `px` (unitless properties
   * excepted); the string form is regular kebab-case CSS text.
   */
  style?: string | Record<string, string | number | null | undefined>;
  /** Switches the chart into its loading state (see `getLoadingComponent`). */
  loading?: boolean;
  /** Switches the chart into its error state when set to anything but null/undefined — `''` and `0` count (see `getErrorComponent`). */
  error?: unknown;
  /**
   * Externally-controlled focused category index (-1 = none; undefined = chart manages focus).
   * When set it overrides internal focus on every update; pass back `onFocus` values to sync charts.
   */
  focusedCategoryIndex?: number;
  /** Externally-controlled focused value-axis id (null = none). See `focusedCategoryIndex`. */
  focusedValueAxisId?: string | null;
  /**
   * Externally-controlled focused series id (null = none). See `focusedCategoryIndex`. Use the id of a
   * series that does not set `followSeries`: one that follows another has no focus state of its own.
   */
  focusedSeriesId?: string | null;
  /**
   * Externally-controlled filter map (series id → true = filtered out). When set it
   * overrides internal filter state on every update; pass back `onSeriesFilter` maps to sync.
   * Key it by series that do not set `followSeries` — a series that follows another filters with the
   * series it follows, and its own id has no effect.
   */
  filteredSeriesIds?: Record<string, boolean>;
}

/** Props accepted by createChart, which takes an already enhanced config. */
export interface ManagedChartProps extends BaseChartProps {
  /** The enhanced config produced by `enhanceConfig` (validated, defaults applied); null while the host is still loading it. */
  mochartConfig: MochartConfig | null;
  /** The data source; use a built-in provider or any `DataProvider` implementation. Null while the host is still loading it. */
  dataProvider: DataProvider | null;
}

/** Props accepted by createDefaultChart, which enhances a raw config. */
export interface DefaultChartProps extends BaseChartProps {
  /** The raw config; validated and enhanced internally on every change. */
  config: MochartInputConfig;
  /**
   * The dataset in either built-in shape — array of objects (one per category)
   * or object of arrays (one per property); wrapped in the matching provider.
   */
  data: ArrayOfObjectsData | ObjectOfArraysData;
}
