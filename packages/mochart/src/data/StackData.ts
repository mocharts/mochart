import { getWithMutations } from '../utils/WithMutations';
import { keyPlain } from './constants';
import type { EnhancedMochartConfig, EnhancedSeriesConfig, EnhancedSeriesStackConfig } from '../types/enhanced';
import type { ChartData, NumericValues, StackData } from '../types/data';

type OuterSeriesIds = Record<string, (string | undefined)[]>;

function assignIdIfPositive(seriesIds: (string | undefined)[], seriesConfig: EnhancedSeriesConfig, values: NumericValues | null): void {
  const count = values ? values.length : 0;
  const { id } = seriesConfig;
  for (let i = 0; i < count; i++) {
    if (values !== null && values[i]! > 0) { // a missing value (NaN) fails the comparison
      seriesIds[i] = id;
    }
  }
}

function assignIdIfNegative(seriesIds: (string | undefined)[], seriesConfig: EnhancedSeriesConfig, values: NumericValues | null): void {
  const count = values ? values.length : 0;
  const { id } = seriesConfig;
  for (let i = 0; i < count; i++) {
    if (values !== null && values[i]! < 0) {
      seriesIds[i] = id;
    }
  }
}

function getStackOuterSeriesIds(seriesStackConfigs: EnhancedSeriesStackConfig[], categoryCount: number): OuterSeriesIds {
  const stackOuterSeriesIds: OuterSeriesIds = {};
  let outerSeriesIds: (string | undefined)[];
  const emptyCategoryValues: undefined[] = [];
  for (let i=0; i<categoryCount; i++) {
    emptyCategoryValues.push(undefined);
  }
  for (const { id } of seriesStackConfigs) {
    outerSeriesIds = emptyCategoryValues.slice();
    stackOuterSeriesIds[id] = outerSeriesIds;
  }
  return stackOuterSeriesIds;
}

export function getStackData(mochartConfig: EnhancedMochartConfig, chartData: ChartData): StackData {
  const { seriesStacks: seriesStackConfigs } = mochartConfig;
  const { raw, filtered } = chartData.seriesData;
  const { values: rawValues } = raw;
  const { values: filteredValues } = filtered;

  const categoryValues = chartData.categoryData.values.key;
  const outerPositiveSeriesIds = getStackOuterSeriesIds(seriesStackConfigs, categoryValues.length);
  const filteredOuterPositiveSeriesIds = getStackOuterSeriesIds(seriesStackConfigs, categoryValues.length);
  const outerNegativeSeriesIds = getStackOuterSeriesIds(seriesStackConfigs, categoryValues.length);
  const filteredOuterNegativeSeriesIds = getStackOuterSeriesIds(seriesStackConfigs, categoryValues.length);
  let stackPositiveIds, stackPositiveFilteredIds, stackNegativeIds, stackNegativeFilteredIds, id;
  for (const seriesStackConfig of seriesStackConfigs) {
    const { id: stackId } = seriesStackConfig;
    const seriesConfigs = seriesStackConfig.seriesConfigs!;
    stackPositiveIds = outerPositiveSeriesIds[stackId];
    stackPositiveFilteredIds = filteredOuterPositiveSeriesIds[stackId];
    stackNegativeIds = outerNegativeSeriesIds[stackId];
    stackNegativeFilteredIds = filteredOuterNegativeSeriesIds[stackId];
    for (const seriesConfig of seriesConfigs) {
      id = seriesConfig.id;
      // by the series' own contribution, not the cumulative stack: a zero-value series must not take the outer cap from the bar below it
      assignIdIfPositive(stackPositiveIds, seriesConfig, rawValues[id][keyPlain]);
      assignIdIfPositive(stackPositiveFilteredIds, seriesConfig, filteredValues[id][keyPlain]);
      assignIdIfNegative(stackNegativeIds, seriesConfig, rawValues[id][keyPlain]);
      assignIdIfNegative(stackNegativeFilteredIds, seriesConfig, filteredValues[id][keyPlain]);
    }
  }
  return {
    outerPositiveSeriesIds,
    filteredOuterPositiveSeriesIds,
    outerNegativeSeriesIds,
    filteredOuterNegativeSeriesIds
  }
}

export function getStackDataWithMutations(stackData: StackData | null, mochartConfig: EnhancedMochartConfig, chartData: ChartData): StackData {
  return getWithMutations(stackData, getStackData(mochartConfig, chartData));
}
