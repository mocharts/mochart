<script lang="ts">
  import { untrack, onDestroy } from 'svelte';

  import { Chart } from '@mochart/svelte';
  import { exportChartsPNG, exportChartsSVG } from '@mochart/export';

  import { getChartExportOptions, buildMochartDemoConfig, consumeShareState, getDataProvidersForDataCount, getPieSlices, getPieStepCycle, getPieStepFilteredIds, applyReportedSeriesFilter } from '@mochart/demo-common';
  import type { ShareState } from '@mochart/demo-common';

  import ChartsControls from './ChartsControls.svelte';

  import type { Demo, FilteredSeriesIds, ChartDataProviderLike } from '../../types';

  interface Props {
    demoObject: Demo;
    active?: boolean;
  }

  const scrollWidthOffset = 20;

  const defaultChartRows = 2;
  const defaultChartCols = 2;

  const defaultRate = 2000;

  let { demoObject, active = false }: Props = $props();

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let gridElement = $state<HTMLDivElement | null>(null);

  // A share link restores the grid size, playback step and interval; otherwise
  // start on the defaults / full data set.
  const sharedState = consumeShareState('multi');
  const shared = sharedState && sharedState.mode === 'multi' ? sharedState : null;

  const initialChartRows = shared ? shared.rows : defaultChartRows;
  const initialChartCols = shared ? shared.cols : defaultChartCols;
  const initialRate = shared ? shared.interval : defaultRate;

  let playing = $state(false);
  let chartRows = $state(initialChartRows);
  let chartCols = $state(initialChartCols);
  let rate = $state(initialRate);
  // Props intentionally seed local state with their initial value only; the
  // $effect.pre below re-syncs everything when the demo changes.
  // svelte-ignore state_referenced_locally
  let mochartDemoConfig = $state.raw(buildMochartDemoConfig(demoObject.config));
  // svelte-ignore state_referenced_locally
  let data = $state.raw(demoObject.data);
  // svelte-ignore state_referenced_locally
  let dataCount = $state(demoObject.data.length);
  // Pie mode steps a filtering pattern instead of data prefixes: chart i at
  // step s filters the last (s + i) mod cycle slices, so the grid shows
  // different-sized views of the same pie and stepping animates all charts.
  // svelte-ignore state_referenced_locally
  let sliceIds = $state.raw(mochartDemoConfig.pieMode ? getPieSlices(mochartDemoConfig.mochartConfig).map(slice => slice.id) : []);
  const stepCycle = () => mochartDemoConfig.pieMode ? getPieStepCycle(sliceIds) : dataCount;
  // A shared step seeks the playback position; otherwise start on the full set
  // (pie mode starts at step 0 — the grid's staggered initial view).
  // svelte-ignore state_referenced_locally
  let currentDataCount = $state(shared && stepCycle() > 0
    ? ((Math.round(shared.step) % stepCycle()) + stepCycle()) % stepCycle()
    : (mochartDemoConfig.pieMode ? 0 : demoObject.data.length));
  // svelte-ignore state_referenced_locally
  let dataProviders = $state.raw(getDataProvidersForDataCount(demoObject.data, initialChartRows * initialChartCols, currentDataCount));
  // svelte-ignore state_referenced_locally
  let focusedCategoryIndices = $state.raw<number[]>(dataProviders.map(() => -1));
  let focusedCategoryIndex = $state(-1);
  let focusedValueAxisId = $state.raw<string | null>(null);
  let focusedSeriesId = $state.raw<string | null>(null);
  let filteredSeriesIds = $state.raw<FilteredSeriesIds>({});

  function initFocusAndFiltered() {
    focusedCategoryIndex = -1;
    focusedValueAxisId = null;
    focusedSeriesId = null;
    filteredSeriesIds = {};
  }

  // svelte-ignore state_referenced_locally
  let previousDemoObject = demoObject;
  // svelte-ignore state_referenced_locally
  let previousActive = active;
  $effect.pre(() => {
    const nextDemoObject = demoObject;
    const nextActive = active;
    untrack(() => {
      if (nextDemoObject !== previousDemoObject) {
        previousDemoObject = nextDemoObject;
        mochartDemoConfig = buildMochartDemoConfig(nextDemoObject.config);
        initFocusAndFiltered();
        playing = false;
        data = nextDemoObject.data;
        dataCount = data.length;
        sliceIds = mochartDemoConfig.pieMode ? getPieSlices(mochartDemoConfig.mochartConfig).map(slice => slice.id) : [];
        currentDataCount = resetStep();
        dataProviders = getDataProvidersForDataCount(data, chartRows * chartCols, currentDataCount);
        focusedCategoryIndices = dataProviders.map(() => -1);
      }
      if (nextActive !== previousActive) {
        previousActive = nextActive;
        onStopClick();
      }
    });
  });

  function onRateChange(nextRate: number) {
    rate = nextRate;
  }

  function resetStep(): number {
    return mochartDemoConfig.pieMode ? 0 : dataCount;
  }

  function onRowsChange(nextChartRows: number) {
    chartRows = nextChartRows;
    currentDataCount = resetStep();
    dataProviders = getDataProvidersForDataCount(data, chartRows * chartCols, currentDataCount);
    focusedCategoryIndices = getFocusedCategoryIndices(dataProviders);
  }

  function onColsChange(nextChartCols: number) {
    chartCols = nextChartCols;
    currentDataCount = resetStep();
    dataProviders = getDataProvidersForDataCount(data, chartRows * chartCols, currentDataCount);
    focusedCategoryIndices = getFocusedCategoryIndices(dataProviders);
  }

  function onStepBackwardClick() {
    const cycle = stepCycle();
    currentDataCount = mochartDemoConfig.pieMode
      ? (currentDataCount - 1 + cycle) % cycle
      : cycle + (currentDataCount - 1) % cycle;
    dataProviders = getDataProvidersForDataCount(data, chartRows * chartCols, currentDataCount);
    focusedCategoryIndices = getFocusedCategoryIndices(dataProviders);
  }

  function onStepForwardClick() {
    currentDataCount = (currentDataCount + 1) % stepCycle();
    dataProviders = getDataProvidersForDataCount(data, chartRows * chartCols, currentDataCount);
    focusedCategoryIndices = getFocusedCategoryIndices(dataProviders);
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

  function onPlayBackwardClick() {
    playing = true;
    intervalId = setInterval(onStepBackwardClick, rate);
  }

  function onPlayForwardClick() {
    playing = true;
    intervalId = setInterval(onStepForwardClick, rate);
  }

  function onStopClick() {
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
    intervalId = null;
    playing = false;
  }

  onDestroy(() => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  function onChartFocus(chartIndex: number, focusData: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }) {
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
  }

  // Pie mode unions the stepper's per-chart filtering with the user's
  // legend filtering, so the legend stays interactive while stepping.
  function chartFilteredSeriesIds(i: number): FilteredSeriesIds {
    return mochartDemoConfig.pieMode
      ? { ...filteredSeriesIds, ...getPieStepFilteredIds(sliceIds, i, currentDataCount) }
      : filteredSeriesIds;
  }

  // The chart reports the whole union it was shown; keep only the user delta.
  function onSeriesFilter(chartIndex: number, { filteredSeriesIds: reported }: { filteredSeriesIds: FilteredSeriesIds }) {
    filteredSeriesIds = applyReportedSeriesFilter(filteredSeriesIds, chartFilteredSeriesIds(chartIndex), reported);
  }

  // The whole grid exports as one tiled image; share captures the grid size,
  // playback step and interval so the link restores the same view.
  function getChartContainers(): Element[] {
    return gridElement ? Array.from(gridElement.querySelectorAll('.multi-mochart-chart')) : [];
  }

  function onExportPng() {
    const containers = getChartContainers();
    if (containers.length > 0) {
      void exportChartsPNG(containers, { cols: chartCols, ...getChartExportOptions() });
    }
  }

  function onExportSvg() {
    const containers = getChartContainers();
    if (containers.length > 0) {
      exportChartsSVG(containers, { cols: chartCols, ...getChartExportOptions() });
    }
  }

  function getShareState(): ShareState {
    return { mode: 'multi', rows: chartRows, cols: chartCols, step: currentDataCount, interval: rate };
  }

  // Measured size of the charts grid.
  let gridWidth = $state(0);
  let gridHeight = $state(0);

  const chartWidth = $derived(Math.floor((gridWidth - scrollWidthOffset) / chartCols));
  const chartHeight = $derived(Math.floor(gridHeight / chartRows));
</script>

<div class={"mochart-demo-tab-container demo-layout-col chart" + (active ? " active" : "")} inert={!active}>
  <div class="multi-charts-sizer" bind:this={gridElement} bind:clientWidth={gridWidth} bind:clientHeight={gridHeight}>
    {#if gridWidth > 0}
      <div class="multi-charts">
        {#each dataProviders as dataProvider, i (i)}
          <div class="multi-mochart-chart">
            <Chart mochartConfig={mochartDemoConfig.mochartConfig} {dataProvider}
                   width={chartWidth} height={chartHeight}
                   filteredSeriesIds={chartFilteredSeriesIds(i)}
                   focusedCategoryIndex={focusedCategoryIndices[i] ?? -1}
                   focusedValueAxisId={focusedValueAxisId ?? null} focusedSeriesId={focusedSeriesId ?? null}
                   onSeriesFilter={(filterData) => onSeriesFilter(i, filterData)} onFocus={(focusData) => onChartFocus(i, focusData)} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
  <ChartsControls {playing} initialRows={initialChartRows} initialCols={initialChartCols} {initialRate}
                  {onRowsChange} {onColsChange}
                  {onStepBackwardClick} {onStepForwardClick}
                  {onPlayBackwardClick} {onPlayForwardClick}
                  {onStopClick} {onRateChange}
                  exportPng={onExportPng} exportSvg={onExportSvg} {getShareState} />
</div>
