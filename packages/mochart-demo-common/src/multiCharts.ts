import { ArrayOfObjectsDataProvider } from '@mochart/core';

import type { DataObject, ChartDataProviderLike } from './types';

export function getChartDataCount(data: DataObject[], currentDataCount: number, i: number): number {
  const dataCount = data.length;
  let chartDataCount = (dataCount + currentDataCount - i) % dataCount;
  if (chartDataCount === 0) {
    chartDataCount = dataCount;
  }
  return chartDataCount;
}

export function getDataProvidersForDataCount(data: DataObject[], chartCount: number, currentDataCount: number): ChartDataProviderLike[] {
  const dataProviders: ChartDataProviderLike[] = [];
  let i, chartDataCount;
  for (i = 0; i < chartCount; i++) {
    chartDataCount = getChartDataCount(data, currentDataCount, i);
    dataProviders.push(new ArrayOfObjectsDataProvider(data.slice(0, chartDataCount)));
  }
  return dataProviders;
}
