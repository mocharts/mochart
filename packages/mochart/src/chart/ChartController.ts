import Chart from '../components/Chart.js';
import { isDataProviderValid } from '../data/ChartData.js';
import { readCategoryValues } from '../data/PropertyData.js';
import { getCategoryKeyProperty } from '../data/CategoryData.js';
import { hasConfigStructureChange } from '../config/core/mochartConfig.js';
import { FocusController } from './FocusController.js';
import { StaticDataSource } from './StaticDataSource.js';
import { AnimatedDataSource } from './AnimatedDataSource.js';
import type { ChartDataSource, ChartDataSourceInput, InternalFocus } from './ChartDataSource.js';
import type { FocusControllerInput } from './FocusController.js';
import type { ChartProps } from '../components/Chart.js';
import type { ChartEventPayload, ChartSeriesClickPayload, ManagedChartProps } from '../types/chart.js';
import type { CategoryValue, DataProvider } from '../types/data.js';
import type { EnhancedMochartConfig } from '../types/enhanced.js';

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
  /** The document's font set, when the environment has one: a web font arriving after mount changes every text measurement. */
  private fonts: FontFaceSet | null;
  private fontsVersion = 0;

  constructor(container: Element, props: ManagedChartProps, readDataProvider: DataProvider | null) {
    // environments without matchMedia (SSR) count as no preference
    this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    this.reducedMotion?.addEventListener('change', this.handleReducedMotionChange);
    this.fonts = typeof document !== 'undefined' && typeof document.fonts?.addEventListener === 'function' ? document.fonts : null;
    this.fonts?.addEventListener('loadingdone', this.handleFontsLoaded);
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
    // the render's measure step reaches the host through onSeriesLayoutBoundsChange, which may destroy the chart
    if (this.destroyed) {
      return;
    }
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
    this.fonts?.removeEventListener('loadingdone', this.handleFontsLoaded);
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
  /** A web font finished loading: text measured in the fallback font is measured again, and truncated text refitted. */
  private handleFontsLoaded = (): void => {
    if (this.destroyed) {
      return;
    }
    this.fontsVersion++;
    this.push();
  }

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
      // hand the settled frame to the new source: flipping the flag is not a reason to replay the entrance,
      // unless the same update changed the data structure, when the frame's series and categories may not exist in the new data
      const carryFrame = input.dataProvider === prevInput.dataProvider &&
        !hasConfigStructureChange(prevInput.mochartConfig, input.mochartConfig);
      const renderedChartData = carryFrame ? this.source.chartData : null;
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
    // the pointer callbacks are wrapped only when the host set them: the Chart reads their presence to decide what is interactive
    return { mochartConfig: this.enhancedConfig(), dataProvider, readDataProvider: this.readDataProvider, loading, error, style, width, height, standalone: true,
      chartData: this.source.chartData, focusData: this.source.focusData,
      initialAnimationPercentage: this.source.initialAnimationPercentage, fontsVersion: this.fontsVersion,
      onFocus: this.handleFocus, onSeriesFilter: this.handleSeriesFilter,
      onChartClick: onChartClick && this.handleChartClick, onSliceClick,
      onSeriesClick: onSeriesClick && this.handleSeriesClick,
      onChartMouseEnter: onChartMouseEnter && this.handleChartMouseEnter,
      onChartMouseMove: onChartMouseMove && this.handleChartMouseMove,
      onChartMouseLeave: onChartMouseLeave && this.handleChartMouseLeave,
      onTitleClick, onSeriesLayoutBoundsChange,
      getLoadingComponent, getErrorComponent, getNoDataComponent, getNoSizeComponent, getNoSeriesComponent, getConfigErrorComponent };
  }

  /** The Chart reports the category it draws; during a category add, remove or reorder that is the old or merged list, so the host gets the index in its own data, -1 for a departing category. */
  private remapCategoryIndex(categoryIndex: number): number {
    return categoryIndex === -1 ? -1 : (this.source.remapFocus({ categoryIndex }).categoryIndex ?? -1);
  }

  private remapEventPayload(payload: ChartEventPayload): ChartEventPayload {
    const categoryIndex = this.remapCategoryIndex(payload.categoryIndex);
    return categoryIndex === payload.categoryIndex ? payload : { ...payload, categoryIndex };
  }

  private handleChartClick = (payload: ChartEventPayload): void => {
    this.props.onChartClick?.(this.remapEventPayload(payload));
  }

  private handleChartMouseEnter = (payload: ChartEventPayload): void => {
    this.props.onChartMouseEnter?.(this.remapEventPayload(payload));
  }

  private handleChartMouseMove = (payload: ChartEventPayload): void => {
    this.props.onChartMouseMove?.(this.remapEventPayload(payload));
  }

  private handleChartMouseLeave = (payload: ChartEventPayload): void => {
    this.props.onChartMouseLeave?.(this.remapEventPayload(payload));
  }

  private handleSeriesClick = (payload: ChartSeriesClickPayload): void => {
    const categoryIndex = this.remapCategoryIndex(payload.categoryIndex);
    const nearestCategoryIndex = this.remapCategoryIndex(payload.nearestCategoryIndex);
    this.props.onSeriesClick?.(categoryIndex === payload.categoryIndex && nearestCategoryIndex === payload.nearestCategoryIndex
      ? payload : { ...payload, categoryIndex, nearestCategoryIndex });
  }

  private handleFocus = (focus: InternalFocus): void => {
    if (this.destroyed) {
      return;
    }
    const remappedFocus = this.source.remapFocus(focus);
    // a follow-pointer move names the same category on every mousemove: no change, so no render and no report
    if (this.focus.isCurrentFocus(remappedFocus)) {
      return;
    }
    const before = this.focus.focus();
    const snapshot = this.focus.applyFocus(remappedFocus);
    // a click that pins what hover already shows changes the pin alone: nothing to render or report
    if (before.focusedSeriesId === snapshot.focusedSeriesId && before.focusedValueAxisId === snapshot.focusedValueAxisId &&
        before.focusedCategoryIndex === snapshot.focusedCategoryIndex) {
      return;
    }
    this.applyInput();
    // the render's measure step reaches the host through onSeriesLayoutBoundsChange, which may destroy the chart
    if (this.destroyed) {
      return;
    }
    this.props.onFocus?.(snapshot);
  }

  private handleSeriesFilter = (seriesId: string): void => {
    if (this.destroyed) {
      return;
    }
    const prevFocusedSeriesId = this.focus.focusedSeriesId;
    const snapshot = this.focus.toggleSeriesFilter(seriesId);
    this.applyInput();
    if (this.destroyed) {
      return;
    }
    this.props.onSeriesFilter?.(snapshot);
    if (this.focus.focusedSeriesId !== prevFocusedSeriesId && !this.destroyed) {
      this.props.onFocus?.(this.focus.focus());
    }
  }
}
