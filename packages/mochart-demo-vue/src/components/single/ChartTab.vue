<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';

import { hasConfigStructureChange } from '@mochart/core';

import { buildMochartDemoConfig, getDemoTabPanelAttrs } from '@mochart/demo-common';

import EditableChart from './EditableChart.vue';
import { useElementSize } from '../misc/useElementSize';

import type { DemoConfig, DataObject, MochartDemoConfig, FocusData, FilteredSeriesIds } from '../../types';

interface Props {
  config?: DemoConfig | null;
  data?: DataObject[] | null;
  dataError?: string | boolean | null;
  active?: boolean;
}

const minChartWidthForSecondChart = 480;
const scrollWidthOffset = 20;
const defaultChartCount = 1;

const props = withDefaults(defineProps<Props>(), {
  config: null,
  data: null,
  dataError: false,
  active: false
});

// Measured width of the tab. The sizer element is attached through a function
// ref so the binding is visible to the type checker (a string ref is not).
const { elementRef, width } = useElementSize();
function attachSizer(el: unknown): void {
  elementRef.value = el instanceof HTMLElement ? el : null;
}

const chartCount = ref(defaultChartCount);
const focusedValueAxisId = shallowRef<string | null>(null);
const focusedSeriesId = shallowRef<string | null>(null);
const focusedCategoryIndex = ref(-1);
const filteredSeriesIds = shallowRef<FilteredSeriesIds>({});
const mochartDemoConfig = shallowRef<MochartDemoConfig | null>(props.config ? buildMochartDemoConfig(props.config) : null);

function resetFocusAndFiltered() {
  focusedValueAxisId.value = null;
  focusedSeriesId.value = null;
  focusedCategoryIndex.value = -1;
  filteredSeriesIds.value = {};
}

// Mirror the react lifecycle: a config change rebuilds the demo config and
// resets focus/filter state when the structure changed (or on data errors);
// a data change remaps the focused category index onto the new data.
watch(
  () => [props.config, props.data, props.dataError] as const,
  ([nextConfig, nextData, nextDataError], [previousConfig, previousData, previousDataError]) => {
    let configChanged = false;
    if (nextConfig !== previousConfig) {
      const nextDemoConfig = nextConfig ? buildMochartDemoConfig(nextConfig) : null;
      if (nextDemoConfig && mochartDemoConfig.value) {
        configChanged = hasConfigStructureChange(mochartDemoConfig.value.mochartConfig, nextDemoConfig.mochartConfig);
      }
      mochartDemoConfig.value = nextDemoConfig;
    }
    if (nextDataError || configChanged) {
      resetFocusAndFiltered();
    }
    else if (nextData !== previousData) {
      const { configValidation, mochartConfig } = mochartDemoConfig.value ?? {};
      const valid = configValidation?.valid ?? false;
      if (!previousDataError && previousData && nextData && valid && mochartConfig) {
        if (focusedCategoryIndex.value >= 0) {
          const property = mochartConfig.categoryAxis.property ?? '';
          const categoryValue = previousData[focusedCategoryIndex.value][property];
          let newFocusedCategoryIndex = -1;
          const count = nextData.length;
          for (let i = 0; i < count; i++) {
            if (nextData[i][property] === categoryValue) {
              newFocusedCategoryIndex = i;
              break;
            }
          }
          focusedCategoryIndex.value = newFocusedCategoryIndex;
        }
      }
      else {
        resetFocusAndFiltered();
      }
    }
  }
);

function onFocus(focusData: FocusData = {}) {
  const { valueAxisId, seriesId, categoryIndex } = focusData;
  if (valueAxisId !== undefined) {
    focusedValueAxisId.value = valueAxisId;
  }
  if (seriesId !== undefined) {
    focusedSeriesId.value = seriesId;
  }
  if (categoryIndex !== undefined) {
    focusedCategoryIndex.value = categoryIndex;
  }
}

// The chart owns filter toggling now and reports the whole map.
function onSeriesFilter({ filteredSeriesIds: nextFilteredSeriesIds }: { filteredSeriesIds: FilteredSeriesIds }) {
  filteredSeriesIds.value = { ...nextFilteredSeriesIds };
}

function onChartCountToggle() {
  chartCount.value = chartCount.value === 1 ? 2 : 1;
}

const allowedChartCount = computed(() => Math.floor(width.value / 2) > minChartWidthForSecondChart ? 2 : 1);
const adjustedChartCount = computed(() => Math.min(chartCount.value, allowedChartCount.value));
const chartWidth = computed(() => Math.floor((width.value - scrollWidthOffset) / adjustedChartCount.value));

const panelAttrs = getDemoTabPanelAttrs('chart');
</script>

<template>
  <div v-bind="panelAttrs" :ref="attachSizer" :class="'mochart-demo-tab-container demo-layout-row chart' + (props.active ? ' active' : '')" :inert="!props.active">
    <div class="editable-charts-sizer">
      <div class="editable-charts">
        <template v-if="mochartDemoConfig && width > 0">
          <EditableChart v-for="i in adjustedChartCount" :key="i"
                         :chart-count="chartCount" :show-chart-count-controls="allowedChartCount > 1 && i === 1" :show-share-button="i === 1"
                         :width="chartWidth" :mochart-demo-config="mochartDemoConfig" :data="props.data ?? []" :data-error="props.dataError"
                         :is-active="props.active" :filtered-series-ids="filteredSeriesIds" :focused-category-index="focusedCategoryIndex"
                         :focused-value-axis-id="focusedValueAxisId" :focused-series-id="focusedSeriesId" :on-chart-count-toggle="onChartCountToggle"
                         :on-focus="onFocus" :on-series-filter="onSeriesFilter" />
        </template>
      </div>
    </div>
  </div>
</template>
