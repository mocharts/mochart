import type { EnhancedMochartConfig } from '../types/enhanced';
import type { ChartData, DataProvider } from '../types/data';
import type { FocusData } from '../types/animation';
import type { InternalFocus } from '../types/chart';

export type { InternalFocus };

/** Everything a data source needs to compute chartData/focusData for one chart state. */
export interface ChartDataSourceInput {
  // both null while the host is still loading them; the sources emit null chartData then
  mochartConfig: EnhancedMochartConfig | null;
  dataProvider: DataProvider | null;
  filteredSeriesIds: Record<string, boolean>;
  focusedCategoryIndex: number;
  focusedValueAxisId: string | null;
  focusedSeriesId: string | null;
}

/**
 * Turns chart input (config, data provider, focus/filter state) into the chartData/focusData the
 * Chart renderer consumes: static computes directly, animated re-emits on every tween frame.
 */
export interface ChartDataSource {
  readonly animated: boolean;
  /** Current output; the animated source advances these on tween frames. */
  readonly chartData: ChartData | null;
  readonly focusData: FocusData | null;
  /** 0..1 while the initial value tween runs (drives entrance effects like the pie sweep-in), else null. */
  readonly initialAnimationPercentage: number | null;
  /**
   * Initialize from scratch (also used when the animate flag flips). `fromChartData` is what the chart
   * already has on screen: the animated source picks up from it instead of replaying its entrance.
   */
  start(input: ChartDataSourceInput, fromChartData?: ChartData | null): void;
  /** Reconcile with changed input. */
  update(prevInput: ChartDataSourceInput, input: ChartDataSourceInput): void;
  /** Translate a focus event raised against the currently rendered (possibly mid-tween) data. */
  remapFocus(focus: InternalFocus): InternalFocus;
  dispose(): void;
}
