import { getChartDataWithSeriesData, getChartDataCategoryCount } from '../data/ChartData';

import { getSeriesDataWithSeriesCounts, getSeriesDataWithFilteredFlags } from '../data/SeriesData';

import { getInitialCategoryDeltaData, getCategoryDeltaData } from './CategoryAnimationData';

import { emptyAxisDeltaData, getTransitionAxisExpansionData, getTransitionAxisContractionData } from './DomainAnimationData';

import { getInitialValueChangeData, getFilterDeltaData, getTransitionValueChangeData } from './SeriesAnimationData';

import type { EnhancedMochartConfig } from '../types/enhanced';
import type {
  AnimationChartData,
  AxisTransitionData,
  ChartAnimationData,
  CategoryDeltaData,
  ValueChangeData
} from '../types/animation';

// Main animation logic functions

/** `continueInitial`: a tween rebuilt mid-entrance from rendered data stays the initial animation. */
export function getChartAnimationData(
  mochartConfig: EnhancedMochartConfig,
  oldChartData: AnimationChartData | null,
  newChartData: AnimationChartData,
  continueInitial = false
): ChartAnimationData {
  let categoryDeltaData: CategoryDeltaData;
  let axisExpansionData: AxisTransitionData;
  let valueChangeData: ValueChangeData;
  let axisContractionData: AxisTransitionData;

  const fromEmpty = getChartDataCategoryCount(oldChartData) === 0;
  const initialAnimation = fromEmpty || continueInitial;

  if (fromEmpty) {
    categoryDeltaData = getInitialCategoryDeltaData(mochartConfig.categoryAxis, newChartData.categoryData);
    axisExpansionData = emptyAxisDeltaData();
    valueChangeData = getInitialValueChangeData(mochartConfig, newChartData) as ValueChangeData;
    axisContractionData = emptyAxisDeltaData();
  }
  else {
    if (oldChartData === null) {
      throw new Error('A previous chart data value is required for a transition animation');
    }
    categoryDeltaData = getCategoryDeltaData(mochartConfig.categoryAxis, oldChartData.categoryData, newChartData.categoryData);
    const filterDeltaData = getFilterDeltaData(mochartConfig, oldChartData.seriesData, newChartData.seriesData);
    let startSeriesData = getSeriesDataWithSeriesCounts(oldChartData.seriesData, filterDeltaData.axisSeriesCounts);
    startSeriesData = getSeriesDataWithFilteredFlags(startSeriesData, newChartData.seriesData.filteredFlags);
    const startChartData = getChartDataWithSeriesData(oldChartData, startSeriesData);
    axisExpansionData = getTransitionAxisExpansionData(mochartConfig, startChartData, newChartData, categoryDeltaData) as AxisTransitionData;
    if (axisExpansionData.final === null || axisExpansionData.final === undefined) {
      throw new Error('Axis expansion did not produce final chart data');
    }
    valueChangeData = getTransitionValueChangeData(mochartConfig, axisExpansionData.final, newChartData, categoryDeltaData) as ValueChangeData;
    axisContractionData = getTransitionAxisContractionData(mochartConfig, valueChangeData.final, newChartData, categoryDeltaData) as AxisTransitionData;
  }

  return {
    initialAnimation,
    categoryDeltaData,
    axisExpansionData,
    valueChangeData,
    axisContractionData
  }
}

export function getStartChartData(chartAnimationData: ChartAnimationData): AnimationChartData {
  const { valueChangeData } = chartAnimationData;
  return valueChangeData.start;
}

export function getEndChartData(chartAnimationData: ChartAnimationData): AnimationChartData {
  const { valueChangeData } = chartAnimationData;
  return valueChangeData.end;
}
