import type { PropType } from 'vue';
import type {
  Bounds, ChartEventPayload, ChartFocus, ChartSeriesClickPayload, ChartSeriesFilter, ChartSliceClickPayload,
  ArrayOfObjectsData, DataProvider, MochartConfig, MochartInputConfig, ObjectOfArraysData
} from '@mochart/core';
import type { PlaceholderComponent } from './types.js';

// Runtime prop declarations shared by Chart and DefaultChart. Declaring the
// `on*` callbacks as props keeps them out of fallthrough attrs (they go to the
// chart, not the container div) while still letting templates use `@chart-click`.
// `type: null` skips runtime validation; the PropType cast still types the prop.
// The default is cast to unknown too: Vue infers an `unknown` prop from its default, so a plain `undefined` would type the prop as `undefined`.
const errorProp = { type: null as unknown as PropType<unknown>, default: undefined as unknown };
function requiredProp<T>() {
  return { type: null as unknown as PropType<T>, required: true as const };
}
function callbackProp<T>() {
  return { type: Function as PropType<(payload: T) => void>, default: undefined };
}
// Components are options objects or (functional) render functions.
const placeholderProp = { type: [Object, Function] as PropType<PlaceholderComponent>, default: undefined };

export const baseChartProps = {
  /** Explicit pixel width; omit to track the container element's width. */
  width: { type: Number, default: undefined },
  /** Explicit pixel height; omit to track the container element's height. */
  height: { type: Number, default: undefined },
  /** `data-testid` attribute applied to the container div, for test selectors. */
  dataTestId: { type: String, default: undefined },
  onChartClick: callbackProp<ChartEventPayload>(),
  onSliceClick: callbackProp<ChartSliceClickPayload>(),
  onSeriesClick: callbackProp<ChartSeriesClickPayload>(),
  onChartMouseEnter: callbackProp<ChartEventPayload>(),
  onChartMouseMove: callbackProp<ChartEventPayload>(),
  onChartMouseLeave: callbackProp<ChartEventPayload>(),
  onTitleClick: { type: Function as PropType<() => void>, default: undefined },
  onFocus: callbackProp<ChartFocus>(),
  onSeriesFilter: callbackProp<ChartSeriesFilter>(),
  onSeriesLayoutBoundsChange: callbackProp<Bounds>(),
  loadingComponent: placeholderProp,
  errorComponent: placeholderProp,
  noDataComponent: placeholderProp,
  noSizeComponent: placeholderProp,
  noSeriesComponent: placeholderProp,
  configErrorComponent: placeholderProp,
  loading: { type: Boolean, default: undefined },
  error: errorProp,
  /**
   * Controlled focused category index (-1 = none). When set it overrides the
   * chart's internal focus on every render; pass back the value reported by
   * `onFocus` to keep several charts in sync. Omit to leave focus
   * chart-managed.
   */
  focusedCategoryIndex: { type: Number, default: undefined },
  /** Controlled focused value-axis id (null = none). See `focusedCategoryIndex`. */
  focusedValueAxisId: { type: String as PropType<string | null>, default: undefined },
  /** Controlled focused series id (null = none); use the id of a series that does not set `followSeries`. See `focusedCategoryIndex`. */
  focusedSeriesId: { type: String as PropType<string | null>, default: undefined },
  /**
   * Controlled filter map (series id → true = filtered out); pass back the
   * map reported by `onSeriesFilter` to sync legend filtering across charts.
   * Key it by series that do not set `followSeries`: a series that follows another filters with it.
   */
  filteredSeriesIds: { type: Object as PropType<Record<string, boolean>>, default: undefined }
};

export const chartProps = {
  ...baseChartProps,
  mochartConfig: requiredProp<MochartConfig | null>(),
  dataProvider: requiredProp<DataProvider | null>()
};

export const defaultChartProps = {
  ...baseChartProps,
  config: requiredProp<MochartInputConfig>(),
  data: { type: [Array, Object] as PropType<ArrayOfObjectsData | ObjectOfArraysData>, required: true as const }
};
