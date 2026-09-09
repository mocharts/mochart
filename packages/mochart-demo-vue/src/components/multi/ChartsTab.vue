<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import { Chart } from '@mochart/vue';
import { exportChartsPNG, exportChartsSVG } from '@mochart/export';

import { getChartExportOptions, buildMochartDemoConfig, consumeShareState, getDataProvidersForDataCount, getPieSlices, getPieStepCycle, getPieStepFilteredIds, applyReportedSeriesFilter } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import ChartsControls from './ChartsControls.vue';
import { useElementSize } from '../misc/useElementSize';

import type { Demo, FilteredSeriesIds, ChartDataProviderLike } from '../../types';

interface Props {
  demoObject: Demo;
  active?: boolean;
}

const scrollWidthOffset = 20;

const defaultChartRows = 2;
const defaultChartCols = 2;

const defaultRate = 2000;

const props = withDefaults(defineProps<Props>(), {
  active: false
});

let intervalId: ReturnType<typeof setInterval> | null = null;

// A share link restores the grid size, playback step and interval.
const sharedState = consumeShareState('multi');
const shared = sharedState && sharedState.mode === 'multi' ? sharedState : null;

const initialDataCount = props.demoObject.data.length;
const initialRows = shared ? shared.rows : defaultChartRows;
const initialCols = shared ? shared.cols : defaultChartCols;
const initialRate = shared ? shared.interval : defaultRate;

const playing = ref(false);
const chartRows = ref(initialRows);
const chartCols = ref(initialCols);
const rate = ref(initialRate);
const mochartDemoConfig = shallowRef(buildMochartDemoConfig(props.demoObject.config));
const data = shallowRef(props.demoObject.data);
const dataCount = ref(initialDataCount);
// Pie mode steps a filtering pattern instead of data prefixes: chart i at
// step s filters the last (s + i) mod cycle slices, so the grid shows
// different-sized views of the same pie and stepping animates all charts.
const sliceIds = shallowRef(mochartDemoConfig.value.pieMode ? getPieSlices(mochartDemoConfig.value.mochartConfig).map(slice => slice.id) : []);
const stepCycle = () => mochartDemoConfig.value.pieMode ? getPieStepCycle(sliceIds.value) : dataCount.value;
// A shared step seeks the playback position; otherwise start on the full set
// (pie mode starts at step 0 — the grid's staggered initial view).
const initialCurrentDataCount = shared && stepCycle() > 0
  ? ((Math.round(shared.step) % stepCycle()) + stepCycle()) % stepCycle()
  : (mochartDemoConfig.value.pieMode ? 0 : initialDataCount);
const currentDataCount = ref(initialCurrentDataCount);
const dataProviders = shallowRef(getDataProvidersForDataCount(props.demoObject.data, initialRows * initialCols, initialCurrentDataCount));
const focusedCategoryIndices = shallowRef<number[]>(dataProviders.value.map(() => -1));
const focusedCategoryIndex = ref(-1);
const focusedValueAxisId = shallowRef<string | null>(null);
const focusedSeriesId = shallowRef<string | null>(null);
const filteredSeriesIds = shallowRef<FilteredSeriesIds>({});

function initFocusAndFiltered() {
  focusedCategoryIndex.value = -1;
  focusedValueAxisId.value = null;
  focusedSeriesId.value = null;
  filteredSeriesIds.value = {};
}

watch(
  () => [props.demoObject, props.active] as const,
  ([nextDemoObject, nextActive], [previousDemoObject, previousActive]) => {
    if (nextDemoObject !== previousDemoObject) {
      mochartDemoConfig.value = buildMochartDemoConfig(nextDemoObject.config);
      initFocusAndFiltered();
      playing.value = false;
      data.value = nextDemoObject.data;
      dataCount.value = data.value.length;
      sliceIds.value = mochartDemoConfig.value.pieMode ? getPieSlices(mochartDemoConfig.value.mochartConfig).map(slice => slice.id) : [];
      currentDataCount.value = resetStep();
      dataProviders.value = getDataProvidersForDataCount(data.value, chartRows.value * chartCols.value, currentDataCount.value);
      focusedCategoryIndices.value = dataProviders.value.map(() => -1);
    }
    if (nextActive !== previousActive) {
      onStopClick();
    }
  }
);

function onRateChange(nextRate: number) {
  rate.value = nextRate;
}

function resetStep(): number {
  return mochartDemoConfig.value.pieMode ? 0 : dataCount.value;
}

function onRowsChange(nextChartRows: number) {
  chartRows.value = nextChartRows;
  currentDataCount.value = resetStep();
  dataProviders.value = getDataProvidersForDataCount(data.value, chartRows.value * chartCols.value, currentDataCount.value);
  focusedCategoryIndices.value = getFocusedCategoryIndices(dataProviders.value);
}

function onColsChange(nextChartCols: number) {
  chartCols.value = nextChartCols;
  currentDataCount.value = resetStep();
  dataProviders.value = getDataProvidersForDataCount(data.value, chartRows.value * chartCols.value, currentDataCount.value);
  focusedCategoryIndices.value = getFocusedCategoryIndices(dataProviders.value);
}

function onStepBackwardClick() {
  const cycle = stepCycle();
  currentDataCount.value = mochartDemoConfig.value.pieMode
    ? (currentDataCount.value - 1 + cycle) % cycle
    : cycle + (currentDataCount.value - 1) % cycle;
  dataProviders.value = getDataProvidersForDataCount(data.value, chartRows.value * chartCols.value, currentDataCount.value);
  focusedCategoryIndices.value = getFocusedCategoryIndices(dataProviders.value);
}

function onStepForwardClick() {
  currentDataCount.value = (currentDataCount.value + 1) % stepCycle();
  dataProviders.value = getDataProvidersForDataCount(data.value, chartRows.value * chartCols.value, currentDataCount.value);
  focusedCategoryIndices.value = getFocusedCategoryIndices(dataProviders.value);
}

function getFocusedCategoryIndices(nextDataProviders: ChartDataProviderLike[]): number[] {
  const { mochartConfig } = mochartDemoConfig.value;
  if (focusedCategoryIndex.value >= 0) {
    const categoryValue = data.value[focusedCategoryIndex.value][mochartConfig.categoryAxis.property ?? ''];
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
  playing.value = true;
  intervalId = setInterval(onStepBackwardClick, rate.value);
}

function onPlayForwardClick() {
  playing.value = true;
  intervalId = setInterval(onStepForwardClick, rate.value);
}

function onStopClick() {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  intervalId = null;
  playing.value = false;
}

onBeforeUnmount(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
});

function onChartFocus(chartIndex: number, focusData: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }) {
  const { focusedValueAxisId: valueAxisId, focusedSeriesId: seriesId } = focusData;
  let categoryIndex = focusData.focusedCategoryIndex;
  const { mochartConfig } = mochartDemoConfig.value;
  let nextFocusedCategoryIndices = focusedCategoryIndices.value;
  if (categoryIndex !== undefined && categoryIndex >= 0) {
    const categoryValue = (dataProviders.value[chartIndex].getPropertyValues(mochartConfig.categoryAxis.property ?? '') ?? [])[categoryIndex];
    const count = data.value.length;
    for (let i = 0; i < count; i++) {
      if (data.value[i][mochartConfig.categoryAxis.property ?? ''] === categoryValue) {
        categoryIndex = i;
        break;
      }
    }
    if (categoryIndex !== focusedCategoryIndex.value) {
      nextFocusedCategoryIndices = getFocusedCategoryIndicesForValue(dataProviders.value, mochartConfig.categoryAxis.property ?? '', categoryValue);
    }
  }
  else if (focusedCategoryIndex.value >= 0) {
    nextFocusedCategoryIndices = dataProviders.value.map(() => -1);
  }
  if (categoryIndex !== undefined) {
    focusedCategoryIndex.value = categoryIndex;
  }
  if (valueAxisId !== undefined) {
    focusedValueAxisId.value = valueAxisId;
  }
  if (seriesId !== undefined) {
    focusedSeriesId.value = seriesId;
  }
  focusedCategoryIndices.value = nextFocusedCategoryIndices;
}

// The chart reports the whole union it was shown; keep only the user delta.
function onSeriesFilter(chartIndex: number, { filteredSeriesIds: reported }: { filteredSeriesIds: FilteredSeriesIds }) {
  filteredSeriesIds.value = applyReportedSeriesFilter(filteredSeriesIds.value, chartFilteredSeriesIds(chartIndex), reported);
}

// Pie mode unions the stepper's per-chart filtering with the user's
// legend filtering, so the legend stays interactive while stepping.
function chartFilteredSeriesIds(i: number): FilteredSeriesIds {
  return mochartDemoConfig.value.pieMode
    ? { ...filteredSeriesIds.value, ...getPieStepFilteredIds(sliceIds.value, i, currentDataCount.value) }
    : filteredSeriesIds.value;
}

// Measured size of the charts grid.
const { elementRef: gridRef, width: gridWidth, height: gridHeight } = useElementSize();

const chartWidth = computed(() => Math.floor((gridWidth.value - scrollWidthOffset) / chartCols.value));
const chartHeight = computed(() => Math.floor(gridHeight.value / chartRows.value));

// The whole grid exports as one tiled image; share captures the grid size,
// playback step and interval so the link restores the same view.
function getChartContainers(): Element[] {
  const grid = gridRef.value;
  return grid ? Array.from(grid.querySelectorAll('.multi-mochart-chart')) : [];
}

function onExportPng() {
  const containers = getChartContainers();
  if (containers.length > 0) {
    void exportChartsPNG(containers, { cols: chartCols.value, ...getChartExportOptions() });
  }
}

function onExportSvg() {
  const containers = getChartContainers();
  if (containers.length > 0) {
    exportChartsSVG(containers, { cols: chartCols.value, ...getChartExportOptions() });
  }
}

function getMultiShareState(): ShareState {
  return { mode: 'multi', rows: chartRows.value, cols: chartCols.value, step: currentDataCount.value, interval: rate.value };
}
</script>

<template>
  <div :class="'mochart-demo-tab-container demo-layout-col chart' + (props.active ? ' active' : '')" :inert="!props.active">
    <div ref="gridRef" class="multi-charts-sizer">
      <div v-if="gridWidth > 0" class="multi-charts">
        <div v-for="(dataProvider, i) in dataProviders" :key="i" class="multi-mochart-chart">
          <Chart :mochart-config="mochartDemoConfig.mochartConfig" :data-provider="dataProvider"
                 :width="chartWidth" :height="chartHeight"
                 :filtered-series-ids="chartFilteredSeriesIds(i)" :focused-category-index="focusedCategoryIndices[i] ?? -1"
                 :focused-value-axis-id="focusedValueAxisId ?? null" :focused-series-id="focusedSeriesId ?? null"
                 :on-series-filter="(filterData: any) => onSeriesFilter(i, filterData)" :on-focus="(focusData: any) => onChartFocus(i, focusData)" />
        </div>
      </div>
    </div>
    <ChartsControls :playing="playing" :initial-rows="initialRows" :initial-cols="initialCols" :initial-rate="initialRate"
                    :on-rows-change="onRowsChange" :on-cols-change="onColsChange"
                    :on-step-backward-click="onStepBackwardClick" :on-step-forward-click="onStepForwardClick"
                    :on-play-backward-click="onPlayBackwardClick" :on-play-forward-click="onPlayForwardClick"
                    :on-stop-click="onStopClick" :on-rate-change="onRateChange"
                    :export-png="onExportPng" :export-svg="onExportSvg" :get-share-state="getMultiShareState" />
  </div>
</template>
