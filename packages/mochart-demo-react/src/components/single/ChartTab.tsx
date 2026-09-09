import React, { useState, useRef } from 'react';

import { hasConfigStructureChange } from '@mochart/core';

import { buildMochartDemoConfig, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { useElementSize } from '../misc/useElementSize';
import EditableChart from './EditableChart';

import type { DemoConfig, DataObject, MochartDemoConfig, FilteredSeriesIds, FocusData } from '../../types';

const minChartWidthForSecondChart = 480;
const scrollWidthOffset = 20;
const defaultChartCount = 1;

interface Props {
  config?: DemoConfig | null;
  data?: DataObject[] | null;
  dataError?: string | boolean | null;
  active?: boolean;
}

interface FocusState {
  focusedValueAxisId: string | null;
  focusedSeriesId: string | null;
  focusedCategoryIndex: number;
  filteredSeriesIds: FilteredSeriesIds;
}

interface ChartTabState {
  chartCount: number;
  focusedValueAxisId: string | null;
  focusedSeriesId: string | null;
  focusedCategoryIndex: number;
  filteredSeriesIds: FilteredSeriesIds;
  mochartDemoConfig: MochartDemoConfig | null;
}

export default function MochartChartTab({ config = null, data = null, dataError = false, active }: Props) {
  // Measured width of the tab (the old code wrapped this tab in a sizer HOC
  // for the same purpose).
  const { elementRef, width } = useElementSize();

  // Authoritative focus/filter values (the old instance fields), mirrored to
  // state for rendering.
  const focus = useRef<FocusState>({
    focusedValueAxisId: null,
    focusedSeriesId: null,
    focusedCategoryIndex: -1,
    filteredSeriesIds: {}
  });

  const initFocusAndFiltered = () => {
    focus.current.focusedValueAxisId = null;
    focus.current.focusedSeriesId = null;
    focus.current.focusedCategoryIndex = -1;
    focus.current.filteredSeriesIds = {};
  };

  const [state, setState] = useState<ChartTabState>(() => ({
    chartCount: defaultChartCount,
    focusedValueAxisId: focus.current.focusedValueAxisId,
    focusedSeriesId: focus.current.focusedSeriesId,
    focusedCategoryIndex: focus.current.focusedCategoryIndex,
    filteredSeriesIds: focus.current.filteredSeriesIds,
    mochartDemoConfig: config ? buildMochartDemoConfig(config) : null
  }));

  // Mirror the old UNSAFE_componentWillReceiveProps derived-state logic: rebuild
  // the demo config and reset focus/filter on structural config change or data
  // error; remap the focused category index onto new data.
  const prev = useRef({ config, data, dataError });
  if (prev.current.config !== config || prev.current.data !== data || prev.current.dataError !== dataError) {
    const { config: oldConfig, data: oldData, dataError: oldDataError } = prev.current;
    prev.current = { config, data, dataError };

    const before = { ...focus.current };
    let nextMochartDemoConfig = state.mochartDemoConfig;

    let configChanged = false;
    if (config !== oldConfig) {
      nextMochartDemoConfig = config ? buildMochartDemoConfig(config) : null;
      if (nextMochartDemoConfig && state.mochartDemoConfig) {
        configChanged = hasConfigStructureChange(state.mochartDemoConfig.mochartConfig, nextMochartDemoConfig.mochartConfig);
      }
    }
    if (dataError || configChanged) {
      initFocusAndFiltered();
    }
    else if (data !== oldData) {
      const mdc = nextMochartDemoConfig;
      if (mdc) {
        const { configValidation, mochartConfig } = mdc;
        const { valid } = configValidation;
        if (!oldDataError && oldData && data && valid) {
          if (focus.current.focusedCategoryIndex >= 0) {
            const property = mochartConfig.categoryAxis.property ?? '';
            const categoryValue = oldData[focus.current.focusedCategoryIndex][property];
            let newFocusedCategoryIndex = -1;
            for (let i = 0; i < data.length; i++) {
              if (data[i][property] === categoryValue) {
                newFocusedCategoryIndex = i;
                break;
              }
            }
            focus.current.focusedCategoryIndex = newFocusedCategoryIndex;
          }
        }
        else {
          initFocusAndFiltered();
        }
      }
    }

    if (focus.current.focusedValueAxisId !== before.focusedValueAxisId ||
        focus.current.focusedSeriesId !== before.focusedSeriesId ||
        focus.current.focusedCategoryIndex !== before.focusedCategoryIndex ||
        focus.current.filteredSeriesIds !== before.filteredSeriesIds ||
        config !== oldConfig) {
      setState(prevState => ({
        ...prevState,
        focusedValueAxisId: focus.current.focusedValueAxisId,
        focusedSeriesId: focus.current.focusedSeriesId,
        focusedCategoryIndex: focus.current.focusedCategoryIndex,
        filteredSeriesIds: focus.current.filteredSeriesIds,
        mochartDemoConfig: nextMochartDemoConfig
      }));
    }
  }

  const onFocus = (focusData: FocusData = {}) => {
    const { valueAxisId, seriesId, categoryIndex } = focusData;
    if (valueAxisId !== undefined) {
      focus.current.focusedValueAxisId = valueAxisId;
    }
    if (seriesId !== undefined) {
      focus.current.focusedSeriesId = seriesId;
    }
    if (categoryIndex !== undefined) {
      focus.current.focusedCategoryIndex = categoryIndex;
    }
    setState(prevState => ({
      ...prevState,
      focusedValueAxisId: focus.current.focusedValueAxisId,
      focusedSeriesId: focus.current.focusedSeriesId,
      focusedCategoryIndex: focus.current.focusedCategoryIndex
    }));
  };

  // The chart owns filter toggling now and reports the whole map.
  const onSeriesFilter = ({ filteredSeriesIds }: { filteredSeriesIds: FilteredSeriesIds }) => {
    focus.current.filteredSeriesIds = { ...filteredSeriesIds };
    setState(prevState => ({ ...prevState, filteredSeriesIds: focus.current.filteredSeriesIds }));
  };

  const onChartCountToggle = () => setState(prevState => ({ ...prevState, chartCount: prevState.chartCount === 1 ? 2 : 1 }));

  const { chartCount, filteredSeriesIds, focusedCategoryIndex, focusedValueAxisId, focusedSeriesId, mochartDemoConfig } = state;

  const charts: React.ReactNode[] = [];
  if (mochartDemoConfig && width > 0) {
    const allowedChartCount = Math.floor(width / 2) > minChartWidthForSecondChart ? 2 : 1;
    const adjustedChartCount = Math.min(chartCount, allowedChartCount);
    const chartWidth = Math.floor((width - scrollWidthOffset) / adjustedChartCount);

    for (let i = 0; i < adjustedChartCount; i++) {
      charts.push(
        <EditableChart key={'chart-' + i} chartCount={chartCount} showChartCountControls={allowedChartCount > 1 && i === 0} showShareButton={i === 0}
          width={chartWidth} mochartDemoConfig={mochartDemoConfig} data={data ?? []} dataError={dataError}
          isActive={active} filteredSeriesIds={filteredSeriesIds} focusedCategoryIndex={focusedCategoryIndex}
          focusedValueAxisId={focusedValueAxisId} focusedSeriesId={focusedSeriesId} onChartCountToggle={onChartCountToggle}
          onFocus={onFocus} onSeriesFilter={onSeriesFilter} />
      );
    }
  }

  return (
    <div {...getDemoTabPanelAttrs('chart')} ref={elementRef} className={"mochart-demo-tab-container demo-layout-row chart" + (active ? " active" : "")} inert={!active}>
      <div className="editable-charts-sizer">
        <div className="editable-charts">
          {charts}
        </div>
      </div>
    </div>
  );
}
