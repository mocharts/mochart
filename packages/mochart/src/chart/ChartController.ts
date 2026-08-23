import Chart from '../components/Chart';
import { isDataProviderValid } from '../data/ChartData';
import { readCategoryValues } from '../data/PropertyData';
import { getCategoryKeyProperty } from '../data/CategoryData';
import { FocusController } from './FocusController';
import { StaticDataSource } from './StaticDataSource';
import { AnimatedDataSource } from './AnimatedDataSource';
import type { ChartDataSource, ChartDataSourceInput, InternalFocus } from './ChartDataSource';
import type { FocusControllerInput } from './FocusController';
import type { ChartProps } from '../components/Chart';
import type { ManagedChartProps } from '../types/chart';
import type { CategoryValue, DataProvider } from '../types/data';
import type { EnhancedMochartConfig } from '../types/enhanced';

/**
 * Composes a managed chart: FocusController holds focus/filter state, the data source (static or
 * animated) turns config + data + focus into chartData/focusData, and this controller pushes the
 * result into the mounted Chart. In-chart focus events flow back through here (source-remapped
 * mid-tween) and out to the host callbacks.
 */
export class ChartController {
  private chart = new Chart();
  private focus = new FocusController();
  private source: ChartDataSource;
  private props: ManagedChartProps;
  /** What the sources read: a delegate for createChart, not the host's own props.dataProvider. */
  private readDataProvider: DataProvider | null;
  private lastInput: ChartDataSourceInput;
  private lastCategoryValues: readonly CategoryValue[] | null = null;
  private destroyed = false;
  private reducedMotion: MediaQueryList | null;

  constructor(container: Element, props: ManagedChartProps, readDataProvider: DataProvider | null) {
    // environments without matchMedia (SSR) count as no preference
    this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    this.reducedMotion?.addEventListener('change', this.handleReducedMotionChange);
    this.props = props;
    this.readDataProvider = readDataProvider;
    this.focus.applyExternal(props);
    this.source = this.createSource();
    this.lastInput = this.buildInput();
    this.captureCategoryValues();
    this.source.start(this.lastInput);
    this.chart.mount(container, null, this.chartProps());
  }

  update(props: ManagedChartProps, readDataProvider: DataProvider | null): void {
    if (this.destroyed) {
      return;
    }
    const changes = this.focus.reconcile(
      this.focusInput(this.props, this.readDataProvider), this.focusInput(props, readDataProvider), this.lastCategoryValues);
    this.props = props;
    this.readDataProvider = readDataProvider;
    this.applyInput();
    const filterGeneration = this.focus.filterGeneration;
    // notify after the commit, through the latest committed props: hosts replace callback
    // closures on every render, and a host may synchronously update() again from onFocus
    if (changes.focus) {
      this.props.onFocus?.(changes.focus);
    }
    // a host may also destroy() from the first callback, or change the filters from it, in which
    // case the second callback would reach a destroyed chart or report a superseded filter set
    if (changes.seriesFilter && !this.destroyed && this.focus.filterGeneration === filterGeneration) {
      this.props.onSeriesFilter?.(changes.seriesFilter);
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.reducedMotion?.removeEventListener('change', this.handleReducedMotionChange);
    this.source.dispose();
    this.chart.destroy();
  }

  private isAnimated(): boolean {
    const { mochartConfig } = this.props;
    if (!mochartConfig || !mochartConfig.animation.enabled) {
      return false;
    }
    return !(mochartConfig.accessibility.respectReducedMotion && this.reducedMotion?.matches);
  }

  /** applyInput swaps the data source when the effective animate flag flipped. */
  private handleReducedMotionChange = (): void => {
    if (!this.destroyed) {
      this.applyInput();
    }
  }

  private createSource(): ChartDataSource {
    return this.isAnimated() ? new AnimatedDataSource(this.push) : new StaticDataSource();
  }

  /** The props config as its enhanced view: ManagedChartProps carries the public MochartConfig type, but enhanceConfig always builds the enhanced one. */
  private enhancedConfig(): EnhancedMochartConfig | null {
    return this.props.mochartConfig as EnhancedMochartConfig | null;
  }

  /** What reconcile compares: the read provider, not the props one (refresh() changes only the delegate's identity), plus the controlled values. */
  private focusInput(props: ManagedChartProps, dataProvider: DataProvider | null): FocusControllerInput {
    const { mochartConfig, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId, filteredSeriesIds } = props;
    return { mochartConfig, dataProvider, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId, filteredSeriesIds };
  }

  /** Snapshot the committed category ordering (the sources' read gate); reconcile remaps focus from it. */
  private captureCategoryValues(): void {
    const mochartConfig = this.enhancedConfig();
    const dataProvider = this.readDataProvider;
    this.lastCategoryValues = mochartConfig?.validation.valid && dataProvider !== null && isDataProviderValid(dataProvider)
      ? readCategoryValues(dataProvider, getCategoryKeyProperty(mochartConfig.categoryAxis))
      : null;
  }

  private buildInput(): ChartDataSourceInput {
    const mochartConfig = this.enhancedConfig();
    const dataProvider = this.readDataProvider;
    const { filteredSeriesIds, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId } = this.focus;
    return { mochartConfig, dataProvider, filteredSeriesIds, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId };
  }

  /** Recompute the source output for the current props + focus state and push it into the Chart. */
  private applyInput(): void {
    if (this.destroyed) {
      return;
    }
    const prevInput = this.lastInput;
    const input = this.buildInput();
    this.lastInput = input;
    // the ordering can only change when the source re-reads: a config or provider identity change
    if (input.mochartConfig !== prevInput.mochartConfig || input.dataProvider !== prevInput.dataProvider) {
      this.captureCategoryValues();
    }
    if (this.source.animated !== this.isAnimated()) {
      // hand the settled frame to the new source: flipping the flag is not a reason to replay the entrance
      const renderedChartData = this.source.chartData;
      this.source.dispose();
      this.source = this.createSource();
      this.source.start(input, renderedChartData);
    }
    else {
      this.source.update(prevInput, input);
    }
    this.push();
  }

  /** Push current output into the Chart renderer. Also the animated source's per-frame emit. */
  private push = (): void => {
    if (this.destroyed) {
      return;
    }
    this.chart.update(this.chartProps());
  }

  private chartProps(): ChartProps {
    const {
      dataProvider, loading, error, style, width, height,
      onChartClick, onSliceClick, onSeriesClick, onChartMouseEnter, onChartMouseMove, onChartMouseLeave, onTitleClick, onSeriesLayoutBoundsChange,
      getLoadingComponent, getErrorComponent, getNoDataComponent, getNoSizeComponent, getNoSeriesComponent, getConfigErrorComponent
    } = this.props;
    // readDataProvider gets a fresh identity per refresh(), so the Chart re-syncs its loading/error reads even when chartData stays null
    return { mochartConfig: this.enhancedConfig(), dataProvider, readDataProvider: this.readDataProvider, loading, error, style, width, height, standalone: true,
      chartData: this.source.chartData, focusData: this.source.focusData,
      initialAnimationPercentage: this.source.initialAnimationPercentage,
      onFocus: this.handleFocus, onSeriesFilter: this.handleSeriesFilter,
      onChartClick, onSliceClick, onSeriesClick, onChartMouseEnter, onChartMouseMove, onChartMouseLeave, onTitleClick, onSeriesLayoutBoundsChange,
      getLoadingComponent, getErrorComponent, getNoDataComponent, getNoSizeComponent, getNoSeriesComponent, getConfigErrorComponent };
  }

  private handleFocus = (focus: InternalFocus): void => {
    if (this.destroyed) {
      return;
    }
    const snapshot = this.focus.applyFocus(this.source.remapFocus(focus));
    this.applyInput();
    this.props.onFocus?.(snapshot);
  }

  private handleSeriesFilter = (seriesId: string): void => {
    if (this.destroyed) {
      return;
    }
    const prevFocusedSeriesId = this.focus.focusedSeriesId;
    const snapshot = this.focus.toggleSeriesFilter(seriesId);
    this.applyInput();
    this.props.onSeriesFilter?.(snapshot);
    if (this.focus.focusedSeriesId !== prevFocusedSeriesId && !this.destroyed) {
      this.props.onFocus?.(this.focus.focus());
    }
  }
}
