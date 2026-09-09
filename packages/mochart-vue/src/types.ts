import type { Component } from 'vue';
import type {
  Bounds, ChartEventPayload, ChartFocus, ChartSeriesClickPayload, ChartSeriesFilter, ChartSliceClickPayload,
  ArrayOfObjectsData, DataProvider, MochartConfig, MochartInputConfig, ObjectOfArraysData
} from '@mochart/core';

/**
 * The interface a template ref on `Chart`/`DefaultChart` exposes.
 * `refresh()` re-reads the current config/data (rebuilding or re-indexing the
 * data provider) without needing new references — the escape hatch for hosts
 * that mutate data in place.
 */
export interface ChartRef {
  refresh(): void;
}

/** Props mochart passes to placeholder components (loading, error, and empty states). */
export interface PlaceholderProps {
  width?: number;
  height?: number;
  mochartConfig?: MochartConfig | null;
  dataProvider?: DataProvider | null;
  error?: unknown;
  hasData?: boolean;
}

/** A Vue component rendered for one of the chart's placeholder states. */
export type PlaceholderComponent = Component<PlaceholderProps>;

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
  loadingComponent?: PlaceholderComponent;
  errorComponent?: PlaceholderComponent;
  noDataComponent?: PlaceholderComponent;
  noSizeComponent?: PlaceholderComponent;
  noSeriesComponent?: PlaceholderComponent;
  configErrorComponent?: PlaceholderComponent;
}

// `class`/`style` are not listed here: in Vue they are fallthrough attrs and
// land on the container div the chart mounts into automatically.
export interface BaseChartProps extends ChartCallbackProps {
  /** Explicit pixel width; omit to track the container element's width. */
  width?: number;
  /** Explicit pixel height; omit to track the container element's height. */
  height?: number;
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

/** Props for `Chart`: a pre-enhanced config plus a data provider (null while loading). */
export interface ChartProps extends BaseChartProps {
  mochartConfig: MochartConfig | null;
  dataProvider: DataProvider | null;
}

/** Props for `DefaultChart`: a raw config plus a plain dataset — an array of objects or an object of arrays. */
export interface DefaultChartProps extends BaseChartProps {
  config: MochartInputConfig;
  data: ArrayOfObjectsData | ObjectOfArraysData;
}
