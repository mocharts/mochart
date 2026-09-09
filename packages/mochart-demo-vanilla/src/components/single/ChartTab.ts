import { hasConfigStructureChange } from '@mochart/core';

import { buildMochartDemoConfig } from '@mochart/demo-common';

import { el, observeSize, setActiveClass, tabContainer } from '../misc/dom';
import { editableChart } from './EditableChart';
import type { EditableChartHandle } from './EditableChart';

import type { DemoConfig, DataObject, MochartDemoConfig, FocusData, FilteredSeriesIds } from '../../types';

export interface ChartTabProps {
  config?: DemoConfig | null;
  data?: DataObject[] | null;
  dataError?: string | boolean | null;
  active?: boolean;
}

export interface ChartTabHandle {
  el: HTMLElement;
  setActive(active: boolean): void;
  update(next: { config: DemoConfig | null; data: DataObject[] | null; dataError: string | boolean | null }): void;
  destroy(): void;
}

const minChartWidthForSecondChart = 480;
const scrollWidthOffset = 20;
const defaultChartCount = 1;

export function chartTab(props: ChartTabProps): ChartTabHandle {
  let config = props.config ?? null;
  let data = props.data ?? null;
  let dataError: string | boolean | null = props.dataError ?? false;
  let active = props.active ?? false;

  // Measured width of the tab (the framework demos use measured containers
  // for the same purpose).
  let width = 0;

  let chartCount = defaultChartCount;
  let focusedValueAxisId: string | null = null;
  let focusedSeriesId: string | null = null;
  let focusedCategoryIndex = -1;
  let filteredSeriesIds: FilteredSeriesIds = {};
  let mochartDemoConfig: MochartDemoConfig | null = config ? buildMochartDemoConfig(config) : null;

  let charts: EditableChartHandle[] = [];

  function resetFocusAndFiltered(): void {
    focusedValueAxisId = null;
    focusedSeriesId = null;
    focusedCategoryIndex = -1;
    filteredSeriesIds = {};
  }

  function onFocus(focusData: FocusData = {}): void {
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
    syncCharts();
  }

  // The chart owns filter toggling now and reports the whole map.
  function onSeriesFilter({ filteredSeriesIds: nextFilteredSeriesIds }: { filteredSeriesIds: FilteredSeriesIds }): void {
    filteredSeriesIds = { ...nextFilteredSeriesIds };
    syncCharts();
  }

  function onChartCountToggle(): void {
    chartCount = chartCount === 1 ? 2 : 1;
    syncCharts();
  }

  const chartsHost = el('div', { className: 'editable-charts' });
  const sizer = el('div', { className: 'editable-charts-sizer' }, [chartsHost]);
  const container = tabContainer('demo-layout-row chart', active, [sizer], 'chart');

  const stopObserving = observeSize(container, (nextWidth) => {
    width = nextWidth;
    syncCharts();
  });

  function allowedChartCount(): number {
    return Math.floor(width / 2) > minChartWidthForSecondChart ? 2 : 1;
  }

  function destroyCharts(): void {
    for (const chart of charts) {
      chart.destroy();
    }
    charts = [];
    chartsHost.replaceChildren();
  }

  // Create/destroy chart instances to match the adjusted count, then push the
  // current props into the survivors.
  function syncCharts(): void {
    if (!mochartDemoConfig || width <= 0) {
      destroyCharts();
      return;
    }
    const allowed = allowedChartCount();
    const adjustedChartCount = Math.min(chartCount, allowed);
    const chartWidth = Math.floor((width - scrollWidthOffset) / adjustedChartCount);

    while (charts.length > adjustedChartCount) {
      const chart = charts.pop()!;
      chart.destroy();
      chart.el.remove();
    }
    while (charts.length < adjustedChartCount) {
      const showChartCountControls = allowed > 1 && charts.length === 0;
      const chart = editableChart({
        width: chartWidth,
        mochartDemoConfig,
        data: data ?? [],
        dataError,
        isActive: active,
        chartCount,
        showChartCountControls,
        showShareButton: charts.length === 0,
        filteredSeriesIds,
        focusedCategoryIndex,
        focusedValueAxisId,
        focusedSeriesId,
        onFocus,
        onSeriesFilter,
        onChartCountToggle
      });
      charts.push(chart);
      chartsHost.append(chart.el);
    }
    for (let index = 0; index < charts.length; index++) {
      charts[index].update({
        width: chartWidth,
        mochartDemoConfig,
        data: data ?? [],
        dataError,
        isActive: active,
        chartCount,
        showChartCountControls: allowed > 1 && index === 0,
        filteredSeriesIds,
        focusedCategoryIndex,
        focusedValueAxisId,
        focusedSeriesId
      });
    }
  }

  return {
    el: container,
    setActive(nextActive: boolean) {
      active = nextActive;
      // Before the pane goes inert, not after: an open menu is `position: fixed`
      // and would keep painting over whichever pane took this one's place.
      if (!nextActive) {
        for (const chart of charts) {
          chart.closeMenus();
        }
      }
      setActiveClass(container, nextActive);
      syncCharts();
    },
    // Mirror the framework lifecycle: a config change rebuilds the demo config
    // and resets focus/filter state when the structure changed (or on data
    // errors); a data change remaps the focused category index onto the new data.
    update(next: { config: DemoConfig | null; data: DataObject[] | null; dataError: string | boolean | null }) {
      const nextConfig = next.config;
      const nextData = next.data;
      const nextDataError = next.dataError;
      let configChanged = false;
      if (nextConfig !== config) {
        const nextDemoConfig = nextConfig ? buildMochartDemoConfig(nextConfig) : null;
        if (nextDemoConfig && mochartDemoConfig) {
          configChanged = hasConfigStructureChange(mochartDemoConfig.mochartConfig, nextDemoConfig.mochartConfig);
        }
        mochartDemoConfig = nextDemoConfig;
      }
      if (nextDataError || configChanged) {
        resetFocusAndFiltered();
      }
      else if (nextData !== data) {
        const { configValidation, mochartConfig } = mochartDemoConfig ?? {};
        const valid = configValidation?.valid ?? false;
        if (!dataError && data && nextData && valid && mochartConfig) {
          if (focusedCategoryIndex >= 0) {
            const property = mochartConfig.categoryAxis.property ?? '';
            const categoryValue = data[focusedCategoryIndex][property];
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
      config = nextConfig;
      data = nextData;
      dataError = nextDataError;
      syncCharts();
    },
    destroy() {
      stopObserving();
      destroyCharts();
    }
  };
}
