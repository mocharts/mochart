import type {
  Bounds, ChartEventPayload, ChartFocus, ChartSeriesClickPayload, ChartSeriesFilter, ChartSliceClickPayload,
  ArrayOfObjectsData, DataProvider, MochartConfig, MochartInputConfig, ObjectOfArraysData
} from '@mochart/core';

/** Props mochart passes to placeholder templates (loading, error, and empty states). */
export interface PlaceholderProps {
  width?: number;
  height?: number;
  mochartConfig?: MochartConfig | null;
  dataProvider?: DataProvider | null;
  error?: unknown;
  hasData?: boolean;
}

/**
 * A lit-html template function rendered for one of the chart's placeholder
 * states. Returns anything lit-html can render (usually a `TemplateResult`).
 */
export type PlaceholderTemplate = (props: PlaceholderProps) => unknown;

export interface ChartCallbackProps {
  onChartClick?: (eventPayload: ChartEventPayload) => void;
  onSliceClick?: (payload: ChartSliceClickPayload) => void;
  onSeriesClick?: (payload: ChartSeriesClickPayload) => void;
  onChartMouseEnter?: (eventPayload: ChartEventPayload) => void;
  onChartMouseMove?: (eventPayload: ChartEventPayload) => void;
  onChartMouseLeave?: (eventPayload: ChartEventPayload) => void;
  onTitleClick?: () => void; // core calls it with no arguments
  onFocus?: (focusData: ChartFocus) => void;
  onSeriesFilter?: (filterData: ChartSeriesFilter) => void;
  onSeriesLayoutBoundsChange?: (bounds: Bounds) => void;
  loadingTemplate?: PlaceholderTemplate;
  errorTemplate?: PlaceholderTemplate;
  noDataTemplate?: PlaceholderTemplate;
  noSizeTemplate?: PlaceholderTemplate;
  noSeriesTemplate?: PlaceholderTemplate;
  configErrorTemplate?: PlaceholderTemplate;
}

/**
 * The imperative handle a `chartRef` callback receives. `refresh()` re-reads
 * the current config/data (rebuilding or re-indexing the data provider)
 * without needing new references — the escape hatch for hosts that mutate
 * data in place.
 */
export interface ChartRef {
  refresh(): void;
}

export interface BaseChartProps extends ChartCallbackProps {
  /**
   * Callback ref, like Lit's own `ref()` directive: called with the
   * `ChartRef` handle once the chart mounts and with `null` when the
   * directive disconnects.
   */
  chartRef?: (ref: ChartRef | null) => void;
  /** Explicit pixel width; omit to track the container element's width. */
  width?: number;
  /** Explicit pixel height; omit to track the container element's height. */
  height?: number;
  /**
   * CSS class for the container div the chart mounts into — the directive
   * equivalent of the class/style fallthrough the component wrappers get.
   */
  className?: string;
  /** Inline style for the container div; explicit `width`/`height` props win. */
  style?: string;
  /** `data-testid` attribute applied to the container div, for test selectors. */
  dataTestId?: string;
  loading?: boolean;
  error?: unknown;
  /**
   * Controlled focused category index (-1 = none). When set it overrides the
   * chart's internal focus on every render; pass back the value reported by
   * `onFocus` to keep several charts in sync. Omit to leave focus
   * chart-managed.
   */
  focusedCategoryIndex?: number;
  /** Controlled focused value-axis id (null = none). See `focusedCategoryIndex`. */
  focusedValueAxisId?: string | null;
  /** Controlled focused series id (null = none); use the id of a series that does not set `followSeries`. See `focusedCategoryIndex`. */
  focusedSeriesId?: string | null;
  /**
   * Controlled filter map (series id → true = filtered out); pass back the
   * map reported by `onSeriesFilter` to sync legend filtering across charts.
   * Key it by series that do not set `followSeries`: a series that follows another filters with it.
   */
  filteredSeriesIds?: Record<string, boolean>;
}

/** Props for the `chart` directive: a pre-enhanced config plus a data provider (null while loading). */
export interface ChartProps extends BaseChartProps {
  mochartConfig: MochartConfig | null;
  dataProvider: DataProvider | null;
}

/** Props for the `defaultChart` directive: a raw config plus a plain dataset — an array of objects or an object of arrays. */
export interface DefaultChartProps extends BaseChartProps {
  config: MochartInputConfig;
  data: ArrayOfObjectsData | ObjectOfArraysData;
}
