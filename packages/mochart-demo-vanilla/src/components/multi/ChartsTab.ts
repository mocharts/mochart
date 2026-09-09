
import { getChartExportOptions, buildMochartDemoConfig, consumeShareState, getDataProvidersForDataCount, getPieSlices, getPieStepCycle, getPieStepFilteredIds, applyReportedSeriesFilter } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';
import { exportChartsPNG, exportChartsSVG } from '@mochart/export';

import { el, observeSize, setActiveClass, tabContainer } from '../misc/dom';
import { mountChart } from '../misc/chartHost';
import type { ChartHostHandle } from '../misc/chartHost';
import { chartsControls } from './ChartsControls';

import type { Demo, FilteredSeriesIds, ChartDataProviderLike } from '../../types';

export interface ChartsTabProps {
  demoObject: Demo;
  active?: boolean;
}

export interface ChartsTabHandle {
  el: HTMLElement;
  setActive(active: boolean): void;
  setDemoObject(demoObject: Demo): void;
  destroy(): void;
}

const scrollWidthOffset = 20;
const defaultChartRows = 2;
const defaultChartCols = 2;
const defaultRate = 2000;

export function chartsTab(props: ChartsTabProps): ChartsTabHandle {
  let demoObject = props.demoObject;
  let active = props.active ?? false;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  // A share link restores the grid size, playback step and interval.
  const shared = consumeShareState('multi');
  const sharedMulti = shared && shared.mode === 'multi' ? shared : null;

  let chartRows = sharedMulti ? sharedMulti.rows : defaultChartRows;
  let chartCols = sharedMulti ? sharedMulti.cols : defaultChartCols;
  let rate = sharedMulti ? sharedMulti.interval : defaultRate;
  let mochartDemoConfig = buildMochartDemoConfig(demoObject.config);
  let data = demoObject.data;
  let dataCount = demoObject.data.length;
  // Pie mode steps a filtering pattern instead of data prefixes: chart i at
  // step s filters the last (s + i) mod cycle slices, so the grid shows
  // different-sized views of the same pie and stepping animates all charts.
  let sliceIds = mochartDemoConfig.pieMode ? getPieSlices(mochartDemoConfig.mochartConfig).map(slice => slice.id) : [];
  const stepCycle = () => mochartDemoConfig.pieMode ? getPieStepCycle(sliceIds) : dataCount;
  // A shared step seeks the playback position; otherwise start on the full set
  // (pie mode starts at step 0 — the grid's staggered initial view).
  let currentDataCount = sharedMulti && stepCycle() > 0
    ? ((Math.round(sharedMulti.step) % stepCycle()) + stepCycle()) % stepCycle()
    : (mochartDemoConfig.pieMode ? 0 : dataCount);
  let dataProviders = getDataProvidersForDataCount(demoObject.data, chartRows * chartCols, currentDataCount);
  let focusedCategoryIndices: number[] = dataProviders.map(() => -1);
  let focusedCategoryIndex = -1;
  let focusedValueAxisId: string | null = null;
  let focusedSeriesId: string | null = null;
  let filteredSeriesIds: FilteredSeriesIds = {};

  // Measured size of the charts grid.
  let gridWidth = 0;
  let gridHeight = 0;

  let chartHosts: ChartHostHandle[] = [];

  function initFocusAndFiltered(): void {
    focusedCategoryIndex = -1;
    focusedValueAxisId = null;
    focusedSeriesId = null;
    filteredSeriesIds = {};
  }

  function getFocusedCategoryIndices(nextDataProviders: ChartDataProviderLike[]): number[] {
    const { mochartConfig } = mochartDemoConfig;
    if (focusedCategoryIndex >= 0) {
      const categoryValue = data[focusedCategoryIndex][mochartConfig.categoryAxis.property ?? ''];
      return getFocusedCategoryIndicesForValue(nextDataProviders, mochartConfig.categoryAxis.property ?? '', categoryValue);
    }
    else {
      return nextDataProviders.map(() => -1);
    }
  }

  function getFocusedCategoryIndicesForValue(nextDataProviders: ChartDataProviderLike[], categoryProperty: string, categoryValue: unknown): number[] {
    let count, i;
    return nextDataProviders.map(dataProvider => {
      let chartCategoryIndex = -1;
      const categoryValues = dataProvider.getPropertyValues(categoryProperty) ?? [];
      count = categoryValues.length;
      for (i = 0; i < count; i++) {
        if (categoryValues[i] === categoryValue) {
          chartCategoryIndex = i;
          break;
        }
      }
      return chartCategoryIndex;
    });
  }

  function refreshDataProviders(): void {
    dataProviders = getDataProvidersForDataCount(data, chartRows * chartCols, currentDataCount);
    focusedCategoryIndices = getFocusedCategoryIndices(dataProviders);
    syncCharts();
  }

  function onRateChange(nextRate: number): void {
    rate = nextRate;
  }

  function resetStep(): number {
    return mochartDemoConfig.pieMode ? 0 : dataCount;
  }

  function onRowsChange(nextChartRows: number): void {
    chartRows = nextChartRows;
    currentDataCount = resetStep();
    refreshDataProviders();
  }

  function onColsChange(nextChartCols: number): void {
    chartCols = nextChartCols;
    currentDataCount = resetStep();
    refreshDataProviders();
  }

  function onStepBackwardClick(): void {
    const cycle = stepCycle();
    currentDataCount = mochartDemoConfig.pieMode
      ? (currentDataCount - 1 + cycle) % cycle
      : cycle + (currentDataCount - 1) % cycle;
    refreshDataProviders();
  }

  function onStepForwardClick(): void {
    currentDataCount = (currentDataCount + 1) % stepCycle();
    refreshDataProviders();
  }

  function onPlayBackwardClick(): void {
    intervalId = setInterval(onStepBackwardClick, rate);
    controls.setPlaying(true);
  }

  function onPlayForwardClick(): void {
    intervalId = setInterval(onStepForwardClick, rate);
    controls.setPlaying(true);
  }

  function onStopClick(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
    intervalId = null;
    controls.setPlaying(false);
  }

  function onChartFocus(chartIndex: number, focusData: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }): void {
    const { focusedValueAxisId: valueAxisId, focusedSeriesId: seriesId } = focusData;
    let categoryIndex = focusData.focusedCategoryIndex;
    const { mochartConfig } = mochartDemoConfig;
    let nextFocusedCategoryIndices = focusedCategoryIndices;
    if (categoryIndex !== undefined && categoryIndex >= 0) {
      const categoryValue = (dataProviders[chartIndex].getPropertyValues(mochartConfig.categoryAxis.property ?? '') ?? [])[categoryIndex];
      const count = data.length;
      for (let i = 0; i < count; i++) {
        if (data[i][mochartConfig.categoryAxis.property ?? ''] === categoryValue) {
          categoryIndex = i;
          break;
        }
      }
      if (categoryIndex !== focusedCategoryIndex) {
        nextFocusedCategoryIndices = getFocusedCategoryIndicesForValue(dataProviders, mochartConfig.categoryAxis.property ?? '', categoryValue);
      }
    }
    else if (focusedCategoryIndex >= 0) {
      nextFocusedCategoryIndices = dataProviders.map(() => -1);
    }
    if (categoryIndex !== undefined) {
      focusedCategoryIndex = categoryIndex;
    }
    if (valueAxisId !== undefined) {
      focusedValueAxisId = valueAxisId;
    }
    if (seriesId !== undefined) {
      focusedSeriesId = seriesId;
    }
    focusedCategoryIndices = nextFocusedCategoryIndices;
    syncCharts();
  }

  // Pie mode unions the stepper's per-chart filtering with the user's
  // legend filtering, so the legend stays interactive while stepping.
  function chartFilteredSeriesIds(i: number): FilteredSeriesIds {
    return mochartDemoConfig.pieMode
      ? { ...filteredSeriesIds, ...getPieStepFilteredIds(sliceIds, i, currentDataCount) }
      : filteredSeriesIds;
  }

  // The chart reports the whole union it was shown; keep only the user delta.
  function onChartSeriesFilter(chartIndex: number, { filteredSeriesIds: reported }: { filteredSeriesIds: FilteredSeriesIds }): void {
    filteredSeriesIds = applyReportedSeriesFilter(filteredSeriesIds, chartFilteredSeriesIds(chartIndex), reported);
    syncCharts();
  }

  const chartsGrid = el('div', { className: 'multi-charts' });
  const sizer = el('div', { className: 'multi-charts-sizer' }, [chartsGrid]);

  // The whole grid exports as one tiled image; share captures the grid size,
  // playback step and interval so the link restores the same view.
  function getChartContainers(): Element[] {
    return Array.from(chartsGrid.querySelectorAll('.multi-mochart-chart'));
  }

  function onExportPng(): void {
    const containers = getChartContainers();
    if (containers.length > 0) {
      void exportChartsPNG(containers, { cols: chartCols, ...getChartExportOptions() });
    }
  }

  function onExportSvg(): void {
    const containers = getChartContainers();
    if (containers.length > 0) {
      exportChartsSVG(containers, { cols: chartCols, ...getChartExportOptions() });
    }
  }

  function getShareState(): ShareState {
    return { mode: 'multi', rows: chartRows, cols: chartCols, step: currentDataCount, interval: rate };
  }

  const controls = chartsControls({
    onRowsChange, onColsChange,
    onStepBackwardClick, onStepForwardClick,
    onPlayBackwardClick, onPlayForwardClick,
    onStopClick, onRateChange,
    initialRows: chartRows,
    initialCols: chartCols,
    initialRate: rate,
    exportPng: onExportPng,
    exportSvg: onExportSvg,
    getShareState
  });

  const container = tabContainer('demo-layout-col chart', active, [sizer, controls.el]);

  const stopObserving = observeSize(sizer, (nextWidth, nextHeight) => {
    gridWidth = nextWidth;
    gridHeight = nextHeight;
    syncCharts();
  });

  function destroyCharts(): void {
    for (const host of chartHosts) {
      host.destroy();
    }
    chartHosts = [];
    chartsGrid.replaceChildren();
  }

  function syncCharts(): void {
    if (gridWidth <= 0) {
      destroyCharts();
      return;
    }
    const chartWidth = Math.floor((gridWidth - scrollWidthOffset) / chartCols);
    const chartHeight = Math.floor(gridHeight / chartRows);

    while (chartHosts.length > dataProviders.length) {
      const host = chartHosts.pop()!;
      host.destroy();
      host.el.parentElement?.remove();
    }
    while (chartHosts.length < dataProviders.length) {
      const i = chartHosts.length;
      const host = mountChart({
        mochartConfig: mochartDemoConfig.mochartConfig,
        dataProvider: dataProviders[i],
        width: chartWidth,
        height: chartHeight,
        filteredSeriesIds: chartFilteredSeriesIds(i),
        focusedCategoryIndex: focusedCategoryIndices[i] ?? -1,
        focusedValueAxisId: focusedValueAxisId ?? null,
        focusedSeriesId: focusedSeriesId ?? null,
        onSeriesFilter: (filterData: { filteredSeriesIds: FilteredSeriesIds }) => onChartSeriesFilter(i, filterData),
        onFocus: (focusData: any) => onChartFocus(i, focusData)
      });
      chartHosts.push(host);
      chartsGrid.append(el('div', { className: 'multi-mochart-chart' }, [host.el]));
    }
    chartHosts.forEach((host, i) => {
      host.update({
        mochartConfig: mochartDemoConfig.mochartConfig,
        dataProvider: dataProviders[i],
        width: chartWidth,
        height: chartHeight,
        filteredSeriesIds: chartFilteredSeriesIds(i),
        focusedCategoryIndex: focusedCategoryIndices[i] ?? -1,
        focusedValueAxisId: focusedValueAxisId ?? null,
        focusedSeriesId: focusedSeriesId ?? null,
        onSeriesFilter: (filterData: { filteredSeriesIds: FilteredSeriesIds }) => onChartSeriesFilter(i, filterData),
        onFocus: (focusData: any) => onChartFocus(i, focusData)
      });
    });
  }

  return {
    el: container,
    setActive(nextActive: boolean) {
      if (nextActive !== active) {
        active = nextActive;
        setActiveClass(container, nextActive);
        onStopClick();
      }
    },
    setDemoObject(nextDemoObject: Demo) {
      if (nextDemoObject !== demoObject) {
        demoObject = nextDemoObject;
        mochartDemoConfig = buildMochartDemoConfig(nextDemoObject.config);
        initFocusAndFiltered();
        onStopClick();
        data = nextDemoObject.data;
        dataCount = data.length;
        sliceIds = mochartDemoConfig.pieMode ? getPieSlices(mochartDemoConfig.mochartConfig).map(slice => slice.id) : [];
        currentDataCount = resetStep();
        dataProviders = getDataProvidersForDataCount(data, chartRows * chartCols, currentDataCount);
        focusedCategoryIndices = dataProviders.map(() => -1);
        syncCharts();
      }
    },
    destroy() {
      onStopClick();
      stopObserving();
      controls.destroy();
      destroyCharts();
    }
  };
}
