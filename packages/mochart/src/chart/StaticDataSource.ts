import { isDataProviderValid, getChartData } from '../data/ChartData.js';
import { getFocusData, getFocusDataWithMutations } from '../data/FocusData.js';
import type { ChartData } from '../types/data.js';
import type { FocusData } from '../types/animation.js';
import type { ChartDataSource, ChartDataSourceInput, InternalFocus } from './ChartDataSource.js';

/** Computes chartData/focusData directly, with no animation (was StaticChart). */
export class StaticDataSource implements ChartDataSource {
  readonly animated = false;
  chartData: ChartData | null = null;
  focusData: FocusData | null = null;
  readonly initialAnimationPercentage = null;

  start(input: ChartDataSourceInput): void {
    const { mochartConfig, dataProvider, filteredSeriesIds, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId } = input;
    if (mochartConfig !== null && mochartConfig.validation.valid && dataProvider !== null && isDataProviderValid(dataProvider)) {
      const chartData = getChartData(mochartConfig, dataProvider, filteredSeriesIds);
      this.chartData = chartData;
      this.focusData = getFocusData(mochartConfig, chartData, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId);
    }
    else {
      this.chartData = null;
      this.focusData = null;
    }
  }

  update(prevInput: ChartDataSourceInput, input: ChartDataSourceInput): void {
    const { mochartConfig, dataProvider, filteredSeriesIds, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId } = input;
    const configChanged = mochartConfig !== prevInput.mochartConfig;
    const dataChanged = dataProvider !== prevInput.dataProvider || filteredSeriesIds !== prevInput.filteredSeriesIds;
    const focusChanged = focusedCategoryIndex !== prevInput.focusedCategoryIndex || focusedValueAxisId !== prevInput.focusedValueAxisId
      || focusedSeriesId !== prevInput.focusedSeriesId;
    if (configChanged || dataChanged || focusChanged) {
      if (mochartConfig !== null && mochartConfig.validation.valid && dataProvider !== null && isDataProviderValid(dataProvider)) {
        const chartData = (configChanged || dataChanged) ? getChartData(mochartConfig, dataProvider, filteredSeriesIds) : this.chartData;
        this.focusData = chartData ? getFocusDataWithMutations(this.focusData!, getFocusData(mochartConfig, chartData, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId)) : null;
        this.chartData = chartData;
      }
      else {
        this.chartData = null;
        this.focusData = null;
      }
    }
  }

  remapFocus(focus: InternalFocus): InternalFocus {
    return focus;
  }

  dispose(): void {}
}
