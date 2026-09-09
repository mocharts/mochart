<script lang="ts">
  import { untrack } from 'svelte';

  import { hasConfigStructureChange } from '@mochart/core';

  import { buildMochartDemoConfig, getDemoTabPanelAttrs } from '@mochart/demo-common';

  import EditableChart from './EditableChart.svelte';

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

  let { config = null, data = null, dataError = false, active = false }: Props = $props();

  // Measured width of the tab.
  let width = $state(0);

  let chartCount = $state(defaultChartCount);
  let focusedValueAxisId = $state.raw<string | null>(null);
  let focusedSeriesId = $state.raw<string | null>(null);
  let focusedCategoryIndex = $state(-1);
  let filteredSeriesIds = $state.raw<FilteredSeriesIds>({});
  // Props intentionally seed local state with their initial value only; the
  // $effect.pre below re-syncs on later prop changes.
  // svelte-ignore state_referenced_locally
  let mochartDemoConfig = $state.raw<MochartDemoConfig | null>(config ? buildMochartDemoConfig(config) : null);

  function resetFocusAndFiltered() {
    focusedValueAxisId = null;
    focusedSeriesId = null;
    focusedCategoryIndex = -1;
    filteredSeriesIds = {};
  }

  // Mirror the react lifecycle: a config change rebuilds the demo config and
  // resets focus/filter state when the structure changed (or on data errors);
  // a data change remaps the focused category index onto the new data.
  // svelte-ignore state_referenced_locally
  let previousConfig = config;
  // svelte-ignore state_referenced_locally
  let previousData = data;
  // svelte-ignore state_referenced_locally
  let previousDataError = dataError;
  $effect.pre(() => {
    const nextConfig = config;
    const nextData = data;
    const nextDataError = dataError;
    untrack(() => {
      let configChanged = false;
      if (nextConfig !== previousConfig) {
        const nextDemoConfig = nextConfig ? buildMochartDemoConfig(nextConfig) : null;
        if (nextDemoConfig && mochartDemoConfig) {
          configChanged = hasConfigStructureChange(mochartDemoConfig.mochartConfig, nextDemoConfig.mochartConfig);
        }
        mochartDemoConfig = nextDemoConfig;
      }
      if (nextDataError || configChanged) {
        resetFocusAndFiltered();
      }
      else if (nextData !== previousData) {
        const { configValidation, mochartConfig } = mochartDemoConfig ?? {};
        const valid = configValidation?.valid ?? false;
        if (!previousDataError && previousData && nextData && valid && mochartConfig) {
          if (focusedCategoryIndex >= 0) {
            const property = mochartConfig.categoryAxis.property ?? '';
            const categoryValue = previousData[focusedCategoryIndex][property];
            let newFocusedCategoryIndex = -1;
            const count = nextData.length;
            for (let i = 0; i < count; i++) {
              if (nextData[i][property] === categoryValue) {
                newFocusedCategoryIndex = i;
                break;
              }
            }
            focusedCategoryIndex = newFocusedCategoryIndex;
          }
        }
        else {
          resetFocusAndFiltered();
        }
      }
      previousConfig = nextConfig;
      previousData = nextData;
      previousDataError = nextDataError;
    });
  });

  function onFocus(focusData: FocusData = {}) {
    const { valueAxisId, seriesId, categoryIndex } = focusData;
    if (valueAxisId !== undefined) {
      focusedValueAxisId = valueAxisId;
    }
    if (seriesId !== undefined) {
      focusedSeriesId = seriesId;
    }
    if (categoryIndex !== undefined) {
      focusedCategoryIndex = categoryIndex;
    }
  }

  // The chart owns filter toggling now and reports the whole map.
  function onSeriesFilter({ filteredSeriesIds: nextFilteredSeriesIds }: { filteredSeriesIds: FilteredSeriesIds }) {
    filteredSeriesIds = { ...nextFilteredSeriesIds };
  }

  function onChartCountToggle() {
    chartCount = chartCount === 1 ? 2 : 1;
  }

  const allowedChartCount = $derived(Math.floor(width / 2) > minChartWidthForSecondChart ? 2 : 1);
  const adjustedChartCount = $derived(Math.min(chartCount, allowedChartCount));
  const chartWidth = $derived(Math.floor((width - scrollWidthOffset) / adjustedChartCount));
</script>

<div {...getDemoTabPanelAttrs('chart')} class={"mochart-demo-tab-container demo-layout-row chart" + (active ? " active" : "")} inert={!active} bind:clientWidth={width}>
  <div class="editable-charts-sizer">
    <div class="editable-charts">
      {#if mochartDemoConfig && width > 0}
        {#each { length: adjustedChartCount } as _, i (i)}
          <EditableChart chartCount={chartCount} showChartCountControls={allowedChartCount > 1 && i === 0} showShareButton={i === 0}
            width={chartWidth} {mochartDemoConfig} data={data ?? []} {dataError}
            isActive={active} {filteredSeriesIds} {focusedCategoryIndex}
            {focusedValueAxisId} {focusedSeriesId} {onChartCountToggle}
            {onFocus} {onSeriesFilter} />
        {/each}
      {/if}
    </div>
  </div>
</div>
