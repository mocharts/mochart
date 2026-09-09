import { hasConfigStructureChange } from '../config/core/mochartConfig';
import { isDataProviderValid, getChartData } from '../data/ChartData';
import { getFocusData, getFocusDataWithDomainPercentages, getFocusDataWithMutations, getFocusDataWithCategoryChanges } from '../data/FocusData';
import { getChartAnimationData } from '../animation/ChartAnimationData';
import {
  mergedIndexForNewIndex, oldIndexForNewIndex, newIndexForMergedIndex, newIndexForOldIndex,
  hasCategoryAdditions, hasCategoryRemovals, hasCategoryReorder } from '../animation/CategoryAnimationData';
import { getFocusAnimationData } from '../animation/FocusAnimationData';
import { getChartTweenManager, dataTweenValueStart, dataTweenValueUpdate, dataTweenValueComplete } from '../animation/ChartTweens';
import type { ChartTweenManager, DataTweenEvent } from '../animation/ChartTweens';
import type { ChartData } from '../types/data';
import type { ChartAnimationData, FocusData } from '../types/animation';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { ChartDataSource, ChartDataSourceInput, InternalFocus } from './ChartDataSource';

function hasFollowSeriesChange(previous: EnhancedMochartConfig, next: EnhancedMochartConfig): boolean {
  return next.series.some((seriesConfig, seriesIndex) =>
    seriesConfig.followSeries !== previous.series[seriesIndex]?.followSeries);
}

/**
 * The animation pipeline (was AnimatedChart): owns the tween manager, drives
 * chartData/focusData through data/focus tweens, and calls `emit` per frame.
 */
export class AnimatedDataSource implements ChartDataSource {
  readonly animated = true;
  /** Rendered output — null until the data tween's first frame. */
  chartData: ChartData | null = null;
  focusData: FocusData | null = null;
  /** 0..1 while the initial animation's value tween runs, else null. */
  initialAnimationPercentage: number | null = null;

  private input!: ChartDataSourceInput;
  private disposed = false;
  /** Entrance progress already rendered when a config-only change rebuilt the tween; its percentages resume from here. */
  private initialAnimationOffset = 0;
  /** The running data tween's destination data (chartData lags it by a frame). */
  private targetChartData: ChartData | null = null;
  private chartAnimationData: ChartAnimationData | null = null;
  private hasCategoryAdditions = false;
  private hasCategoryRemovals = false;
  private hasCategoryReorder = false;
  private dataTweening = false;
  private valuesTweening = false;
  private valuesTweened = false;
  private focusTweening = false;
  /** Validity of the provider as last read: prevInput's provider reads live after refresh(), so it can't tell us. */
  private lastDataProviderValid = false;
  private tweenManager: ChartTweenManager;
  private emit: () => void;

  constructor(emit: () => void) {
    this.tweenManager = getChartTweenManager();
    this.emit = emit;
  }

  start(input: ChartDataSourceInput, fromChartData: ChartData | null = null): void {
    if (this.disposed) {
      return;
    }
    this.input = input;
    const { mochartConfig, dataProvider, filteredSeriesIds, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId } = input;
    this.chartAnimationData = null;
    this.hasCategoryAdditions = false;
    this.hasCategoryRemovals = false;
    this.hasCategoryReorder = false;
    this.dataTweening = false;
    this.valuesTweening = false;
    this.valuesTweened = false;
    this.focusTweening = false;
    this.initialAnimationPercentage = null;
    this.initialAnimationOffset = 0;
    this.tweenManager.cancelTweens();
    this.lastDataProviderValid = isDataProviderValid(dataProvider);
    if (mochartConfig !== null && mochartConfig.validation.valid && dataProvider !== null && this.lastDataProviderValid) {
      const newChartData = getChartData(mochartConfig, dataProvider, filteredSeriesIds);
      this.targetChartData = newChartData;
      this.chartAnimationData = getChartAnimationData(mochartConfig, fromChartData, newChartData);

      this.startDataTween(mochartConfig, this.chartAnimationData);

      // keep the chart data null until the animation starts, unless the chart already has a frame on
      // screen — an animate flag flip carries it over rather than blanking and replaying the entrance
      this.chartData = fromChartData;
      // don't bother animating focus when initializing the data...
      this.focusData = getFocusData(mochartConfig, newChartData, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId);
    }
    else {
      this.chartData = null;
      this.focusData = null;
      this.targetChartData = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.tweenManager.cancelTweens();
  }

  update(prevInput: ChartDataSourceInput, input: ChartDataSourceInput): void {
    if (this.disposed) {
      return;
    }
    this.input = input;
    const { mochartConfig, dataProvider, filteredSeriesIds, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId } = input;

    const configChanged = mochartConfig !== prevInput.mochartConfig;
    const dataProviderChanged = dataProvider !== prevInput.dataProvider;
    const liveDataProviderValid = isDataProviderValid(dataProvider);
    const dataProviderValidityChanged = dataProviderChanged && liveDataProviderValid !== this.lastDataProviderValid;
    // an in-place flip is only recorded once refresh() hands over a fresh identity, so it always routes through start()
    if (dataProviderChanged) {
      this.lastDataProviderValid = liveDataProviderValid;
    }
    const dataProviderValid = liveDataProviderValid && this.lastDataProviderValid;
    const filteredSeriesChanged = filteredSeriesIds !== prevInput.filteredSeriesIds;
    const dataChanged = dataProviderChanged || filteredSeriesChanged;
    const focusCategoryChanged = focusedCategoryIndex !== prevInput.focusedCategoryIndex;
    const focusValueAxisChanged = focusedValueAxisId !== prevInput.focusedValueAxisId;
    const focusSeriesChanged = focusedSeriesId !== prevInput.focusedSeriesId;
    const focusChanged = focusCategoryChanged || focusValueAxisChanged || focusSeriesChanged;
    const configValid = mochartConfig !== null && mochartConfig.validation.valid;
    const mochartConfigStructureChanged = configChanged && hasConfigStructureChange(prevInput.mochartConfig, mochartConfig);
    // a config appearing or going away is structural, so a non-structural change has both configs non-null
    const focusConfigChanged = configChanged && !mochartConfigStructureChanged && focusedSeriesId !== null &&
      mochartConfig !== null && prevInput.mochartConfig !== null &&
      hasFollowSeriesChange(prevInput.mochartConfig, mochartConfig);
    if (dataProviderValidityChanged || mochartConfigStructureChanged) {
      this.start(input);
    }
    else if (dataProvider !== null && dataProviderValid && configValid && (configChanged || dataChanged || focusChanged)) {
      let categoriesChanged = false;
      if (configChanged || dataChanged) {
        const chartData = getChartData(mochartConfig, dataProvider, filteredSeriesIds);
        this.targetChartData = chartData;
        // a config-only change mid-entrance keeps the entrance: initialDuration pacing and continuous progress
        const continueInitial = !dataChanged && this.chartAnimationData !== null && this.chartAnimationData.initialAnimation &&
          this.dataTweening && !this.valuesTweened;
        this.initialAnimationOffset = continueInitial ? (this.initialAnimationPercentage ?? 0) : 0;
        const chartAnimationData = this.chartAnimationData = getChartAnimationData(mochartConfig, this.chartData, chartData, continueInitial);

        this.startDataTween(mochartConfig, chartAnimationData);
        categoriesChanged = this.hasCategoryAdditions || this.hasCategoryRemovals || this.hasCategoryReorder;
      }

      if (this.chartData === null) {
        if (focusChanged || focusConfigChanged) {
          // no frame has landed yet, so there is nothing to animate from: snap
          // focus against the tween's target data, exactly like start() does
          this.focusData = getFocusData(mochartConfig, this.targetChartData!, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId);
        }
      }
      else if (focusChanged || categoriesChanged || focusConfigChanged) {
        // The category target always derives from the input (mapped into the running tween's index
        // space), never this.focusData — the cancel-window delay can leave it holding a stale pre-pin index.
        if (focusedCategoryIndex >= 0 && this.dataTweening && !this.valuesTweened) {
          if (this.valuesTweening) {
            this.startFocusTween(mochartConfig, input, mergedIndexForNewIndex(this.chartAnimationData!.categoryDeltaData, focusedCategoryIndex));
          }
          else {
            this.startFocusTween(mochartConfig, input, oldIndexForNewIndex(this.chartAnimationData!.categoryDeltaData, focusedCategoryIndex));
          }
        }
        else {
          this.startFocusTween(mochartConfig, input);
        }
      }
    }
  }

  private startDataTween(mochartConfig: EnhancedMochartConfig, chartAnimationData: ChartAnimationData): void {
    const { categoryDeltaData } = chartAnimationData;
    // an entrance from no categories has no old focus state to remap: every category is "added" but focus is already snapped
    const fromEmpty = categoryDeltaData.values.old.length === 0;
    this.hasCategoryAdditions = !fromEmpty && hasCategoryAdditions(categoryDeltaData);
    this.hasCategoryRemovals = hasCategoryRemovals(categoryDeltaData);
    this.hasCategoryReorder = !fromEmpty && hasCategoryReorder(categoryDeltaData);

    this.dataTweening = true;
    this.valuesTweening = false;
    this.valuesTweened = false;
    this.tweenManager.tweenData(mochartConfig, chartAnimationData, this.updateChartData, {
      startCallback: () => {
        this.dataTweening = true;
      },
      startValueChangeCallback: () => {
        this.valuesTweening = true;

      },
      completeValueChangeCallback: () => {
        this.valuesTweening = false;
        this.valuesTweened = true;
      },
      completeCallback: () => {
        this.dataTweening = false;
        this.valuesTweening = false;
        this.valuesTweened = false;
      }
    });
  }

  private startFocusTween(mochartConfig: EnhancedMochartConfig, input: ChartDataSourceInput, overrideFocusedCategoryIndex?: number): void {
    const { focusedCategoryIndex, focusedValueAxisId, focusedSeriesId } = input;
    const newFocusedCategoryIndex = overrideFocusedCategoryIndex !== undefined ? overrideFocusedCategoryIndex : focusedCategoryIndex;
    const focusData = getFocusDataWithMutations(this.focusData!, getFocusData(mochartConfig, this.chartData!, newFocusedCategoryIndex, focusedValueAxisId, focusedSeriesId));
    const focusAnimationData = getFocusAnimationData(mochartConfig, this.focusData!, focusData);
    this.focusTweening = true;
    this.tweenManager.tweenFocus(mochartConfig, focusAnimationData, this.updateFocusData, {
      startCallback: () => {
        this.focusTweening = true;
      },
      completeCallback: () => {
        this.focusTweening = false;
      }
    });
  }

  private updateChartData = (chartData: ChartData, updateType: DataTweenEvent, percentage?: number): void => {
    const { focusedCategoryIndex } = this.input;
    // tween callbacks only fire while tweens run, and a config going null/invalid cancels them via start()
    const mochartConfig = this.input.mochartConfig!;
    this.chartData = chartData;
    // Expose the initial value tween's progress (chart types with entrance
    // effects — the pie sweep-in — consume it); cleared once values settle.
    if (this.chartAnimationData !== null && this.chartAnimationData.initialAnimation) {
      const offset = this.initialAnimationOffset;
      if (updateType === dataTweenValueStart) {
        this.initialAnimationPercentage = offset;
      }
      else if (updateType === dataTweenValueUpdate && percentage !== undefined) {
        this.initialAnimationPercentage = offset + (1 - offset) * percentage;
      }
      else if (updateType === dataTweenValueComplete) {
        this.initialAnimationPercentage = null;
      }
    }
    else {
      this.initialAnimationPercentage = null;
    }
    if ((this.hasCategoryAdditions || this.hasCategoryReorder) && updateType === dataTweenValueStart) {
      this.focusData = getFocusDataWithMutations(this.focusData!, getFocusDataWithCategoryChanges(
        this.focusData!, mochartConfig, chartData, this.chartAnimationData!.categoryDeltaData, true, this.focusTweening));
      this.focusData = getFocusDataWithMutations(this.focusData!, getFocusDataWithDomainPercentages(this.focusData!, mochartConfig, chartData));
      if (this.focusTweening || focusedCategoryIndex >= 0) {
        const newFocusedCategoryIndex = focusedCategoryIndex >= 0 ? mergedIndexForNewIndex(this.chartAnimationData!.categoryDeltaData, focusedCategoryIndex) : -1;
        this.startFocusTween(mochartConfig, this.input, newFocusedCategoryIndex);
      }
    }
    else if (this.hasCategoryRemovals && updateType === dataTweenValueComplete) {
      this.focusData = getFocusDataWithMutations(this.focusData!, getFocusDataWithCategoryChanges(
        this.focusData!, mochartConfig, chartData, this.chartAnimationData!.categoryDeltaData, false, this.focusTweening));
      this.focusData = getFocusDataWithMutations(this.focusData!, getFocusDataWithDomainPercentages(this.focusData!, mochartConfig, chartData));
      if (this.focusTweening || focusedCategoryIndex >= 0 && this.focusData!.focusedCategoryIndex !== focusedCategoryIndex) {
        this.startFocusTween(mochartConfig, this.input);
      }
    }
    else {
      this.focusData = getFocusDataWithMutations(this.focusData!, getFocusDataWithDomainPercentages(this.focusData!, mochartConfig, chartData));
    }
    // one render per frame: chained steps and the focus tween all land in the same engine pass
    this.tweenManager.afterUpdate(this.emit);
  }

  private updateFocusData = (focusData: FocusData): void => {
    // same invariant as updateChartData: the running tween implies a valid config
    const mochartConfig = this.input.mochartConfig!;
    this.focusData = getFocusDataWithMutations(this.focusData!, getFocusDataWithDomainPercentages(focusData, mochartConfig, this.chartData!));
    this.tweenManager.afterUpdate(this.emit);
  }

  remapFocus({ valueAxisId, seriesId, categoryIndex }: InternalFocus): InternalFocus {
    if (categoryIndex !== undefined) {
      categoryIndex = categoryIndex ?? -1;
      if (categoryIndex !== -1 && this.dataTweening && !this.valuesTweened) {
        if (this.valuesTweening) {
          categoryIndex = newIndexForMergedIndex(this.chartAnimationData!.categoryDeltaData, categoryIndex);
        }
        else {
          categoryIndex = newIndexForOldIndex(this.chartAnimationData!.categoryDeltaData, categoryIndex);
        }
      }
    }
    return { valueAxisId, seriesId, categoryIndex };
  }
}
