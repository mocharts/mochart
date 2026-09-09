import { getCategoryData, getCategoryDataWithRenderAxisDomain, getCategoryValueObject } from './CategoryData';
import { getSeriesData, getSeriesDataWithRenderAxisDomains, getSeriesDataWithDomains, getSeriesDataWithSeriesValues, getSeriesValueObjects } from './SeriesData';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { AxisDomains, ChartData, DataProvider, CategoryAxisDomain, CategoryData, SeriesData, SeriesDomainObjects, SeriesValueObjects } from '../types/data';

/** The members every provider must implement; getError/getLoading/refresh are optional. */
const requiredDataProviderMembers = ['getPropertyValues'] as const;

/** Names the required members a provider is missing, so getDataErrors can report them. */
export function getMissingDataProviderMembers(dataProvider: DataProvider): string[] {
  const missingMembers: string[] = [];
  for (const member of requiredDataProviderMembers) {
    if (typeof dataProvider[member] !== 'function') {
      missingMembers.push(member);
    }
  }
  return missingMembers;
}

export function isDataProviderValid(dataProvider: DataProvider | null | undefined): boolean {
  // checked inline rather than through getMissingDataProviderMembers: this runs on every sync, including animation frames
  if (!dataProvider || typeof dataProvider.getPropertyValues !== 'function') {
    return false;
  }
  // '' and 0 count as errors, matching the error prop; only null/undefined don't
  const dataProviderError = dataProvider.getError instanceof Function ? dataProvider.getError() : undefined;
  return dataProviderError == null;
}

export function getChartData(mochartConfig: EnhancedMochartConfig, dataProvider: DataProvider, filteredSeriesMap: Record<string, unknown>): ChartData {
  const categoryData = getCategoryData(mochartConfig.categoryAxis, dataProvider);
  const seriesData = getSeriesData(mochartConfig, dataProvider, filteredSeriesMap, categoryData);

  return {
    categoryData,
    seriesData
  };
}

export function getChartDataWithCategoryData(chartData: ChartData, categoryData: CategoryData): ChartData {
  return Object.assign({}, chartData, { categoryData });
}

export function getChartDataWithSeriesData(chartData: ChartData, seriesData: SeriesData): ChartData {
  return Object.assign({}, chartData, { seriesData });
}

export function getChartDataWithData(chartData: ChartData, categoryData: CategoryData, seriesData: SeriesData): ChartData {
  return Object.assign({}, chartData, { categoryData, seriesData });
}

export function getChartDataWithRenderAxisDomains(chartData: ChartData, categoryRenderAxisDomain: CategoryAxisDomain, rawRenderAxisDomains: AxisDomains, filteredRenderAxisDomains: AxisDomains): ChartData {
  return getChartDataWithData(chartData, getCategoryDataWithRenderAxisDomain(chartData.categoryData, categoryRenderAxisDomain),
    getSeriesDataWithRenderAxisDomains(chartData.seriesData, rawRenderAxisDomains, filteredRenderAxisDomains));
}

export function getChartDataWithSeriesDomains(chartData: ChartData, rawSeriesDomains: SeriesDomainObjects, filteredSeriesDomains: SeriesDomainObjects): ChartData {
  return getChartDataWithSeriesData(chartData, getSeriesDataWithDomains(chartData.seriesData, rawSeriesDomains, filteredSeriesDomains));
}

export function getChartDataWithValues(chartData: ChartData, values: SeriesValueObjects, filteredValues: SeriesValueObjects): ChartData {
  return getChartDataWithSeriesData(chartData, getSeriesDataWithSeriesValues(chartData.seriesData, values, filteredValues));
}

export function getCategorySeriesValueObject(chartData: ChartData, categoryIndex: number) {
  const { categoryData, seriesData } = chartData;

  return {
    category: getCategoryValueObject(categoryData, categoryIndex),
    series: getSeriesValueObjects(seriesData, categoryIndex),
  }
}

export type CategorySeriesValueObject = ReturnType<typeof getCategorySeriesValueObject>;

export function getChartDataCategoryCount(chartData: ChartData | null): number {
  return chartData ? chartData.categoryData.values.key.length : 0;
}
