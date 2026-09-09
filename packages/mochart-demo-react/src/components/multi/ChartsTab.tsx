import React, { useState, useRef, useEffect } from 'react';
import Icon from '../misc/Icon';

import type { MochartConfig } from '@mochart/core';
import { Chart } from '@mochart/react';
import { exportChartsPNG, exportChartsSVG } from '@mochart/export';

import { getChartExportOptions, buildMochartDemoConfig, consumeShareState, demoText, getDataProvidersForDataCount, getPieSlices, getPieStepCycle, getPieStepFilteredIds, applyReportedSeriesFilter } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import ButtonWithTooltip from '../misc/ButtonWithTooltip';
import ExportShareMenu from '../misc/ExportShareMenu';
import { useElementSize } from '../misc/useElementSize';

import type { Demo, DataObject, MochartDemoConfig, FilteredSeriesIds, ChartDataProviderLike } from '../../types';

const scrollWidthOffset = 20;

const defaultChartRows = 2;
const defaultChartCols = 2;

const defaultRate = 2000;

interface Props {
  demoObject: Demo;
  active?: boolean;
}

interface ChartsTabState {
  focusedCategoryIndex: number;
  focusedValueAxisId: string | null;
  focusedSeriesId: string | null;
  filteredSeriesIds: FilteredSeriesIds;
  playing: boolean;
  mochartDemoConfig: MochartDemoConfig;
  dataProviders: ChartDataProviderLike[];
  data: DataObject[];
  dataCount: number;
  currentDataCount: number;
  chartRows: number;
  chartCols: number;
  rate: number;
  focusedCategoryIndices: number[];
  sliceIds: string[];
}

// Pie mode steps a filtering pattern instead of data prefixes: chart i at
// step s filters the last (s + i) mod cycle slices, so the grid shows
// different-sized views of the same pie and stepping animates all charts.
function stepCycleOf(state: ChartsTabState): number {
  return state.mochartDemoConfig.pieMode ? getPieStepCycle(state.sliceIds) : state.dataCount;
}

function resetStepOf(state: ChartsTabState): number {
  return state.mochartDemoConfig.pieMode ? 0 : state.dataCount;
}

function buildInitial(demoObject: Demo, chartRows: number, chartCols: number, rate: number, step?: number): ChartsTabState {
  const mochartDemoConfig = buildMochartDemoConfig(demoObject.config);
  const { mochartConfig } = mochartDemoConfig;
  const data = demoObject.data;
  const dataCount = data.length;
  const sliceIds = mochartDemoConfig.pieMode ? getPieSlices(mochartConfig).map(slice => slice.id) : [];
  const stepCycle = mochartDemoConfig.pieMode ? getPieStepCycle(sliceIds) : dataCount;
  // A shared step seeks the playback position; otherwise start on the full set
  // (pie mode starts at step 0 — the grid's staggered initial view).
  const currentDataCount = step !== undefined && stepCycle > 0
    ? ((Math.round(step) % stepCycle) + stepCycle) % stepCycle
    : (mochartDemoConfig.pieMode ? 0 : dataCount);
  const dataProviders = getDataProvidersForDataCount(data, chartRows * chartCols, currentDataCount);
  const focusedCategoryIndices = dataProviders.map(() => -1);
  return {
    focusedCategoryIndex: -1,
    focusedValueAxisId: null,
    focusedSeriesId: null,
    filteredSeriesIds: {},
    playing: false,
    mochartDemoConfig,
    dataProviders,
    data,
    dataCount,
    currentDataCount,
    chartRows,
    chartCols,
    rate,
    focusedCategoryIndices,
    sliceIds
  };
}

export default function MultiMochartChartsTab({ demoObject, active }: Props) {
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A share link restores the grid size, playback step and interval.
  const [state, setState] = useState<ChartsTabState>(() => {
    const sharedState = consumeShareState('multi');
    const shared = sharedState && sharedState.mode === 'multi' ? sharedState : null;
    return buildInitial(
      demoObject,
      shared ? shared.rows : defaultChartRows,
      shared ? shared.cols : defaultChartCols,
      shared ? shared.interval : defaultRate,
      shared ? shared.step : undefined
    );
  });

  // Rebuild when the demo changes.
  const prevDemoObject = useRef(demoObject);
  if (prevDemoObject.current !== demoObject) {
    prevDemoObject.current = demoObject;
    setState(prev => buildInitial(demoObject, prev.chartRows, prev.chartCols, prev.rate));
  }

  const getFocusedCategoryIndicesForValue = (dataProviders: ChartDataProviderLike[], categoryProperty: string, categoryValue: unknown): number[] => {
    return dataProviders.map(dataProvider => {
      let chartCategoryIndex = -1;
      const categoryValues = dataProvider.getPropertyValues(categoryProperty) ?? [];
      const count = categoryValues.length;
      for (let i = 0; i < count; i++) {
        if (categoryValues[i] === categoryValue) {
          chartCategoryIndex = i;
          break;
        }
      }
      return chartCategoryIndex;
    });
  };

  const getFocusedCategoryIndices = (s: ChartsTabState, dataProviders: ChartDataProviderLike[]): number[] => {
    const { mochartDemoConfig, data, focusedCategoryIndex } = s;
    const { mochartConfig } = mochartDemoConfig;
    if (focusedCategoryIndex >= 0) {
      const categoryValue = data[focusedCategoryIndex][mochartConfig.categoryAxis.property ?? ''];
      return getFocusedCategoryIndicesForValue(dataProviders, mochartConfig.categoryAxis.property ?? '', categoryValue);
    }
    else {
      return dataProviders.map(() => -1);
    }
  };

  const onRateChange = (rate: number) => setState(prev => ({ ...prev, rate }));

  const onRowsChange = (chartRows: number) => {
    setState(prev => {
      const currentDataCount = resetStepOf(prev);
      const dataProviders = getDataProvidersForDataCount(prev.data, chartRows * prev.chartCols, currentDataCount);
      const focusedCategoryIndices = getFocusedCategoryIndices(prev, dataProviders);
      return { ...prev, chartRows, currentDataCount, dataProviders, focusedCategoryIndices };
    });
  };

  const onColsChange = (chartCols: number) => {
    setState(prev => {
      const currentDataCount = resetStepOf(prev);
      const dataProviders = getDataProvidersForDataCount(prev.data, prev.chartRows * chartCols, currentDataCount);
      const focusedCategoryIndices = getFocusedCategoryIndices(prev, dataProviders);
      return { ...prev, chartCols, currentDataCount, dataProviders, focusedCategoryIndices };
    });
  };

  const onStepBackwardClick = () => {
    setState(prev => {
      const cycle = stepCycleOf(prev);
      const currentDataCount = prev.mochartDemoConfig.pieMode
        ? (prev.currentDataCount - 1 + cycle) % cycle
        : cycle + (prev.currentDataCount - 1) % cycle;
      const dataProviders = getDataProvidersForDataCount(prev.data, prev.chartRows * prev.chartCols, currentDataCount);
      const focusedCategoryIndices = getFocusedCategoryIndices(prev, dataProviders);
      return { ...prev, currentDataCount, dataProviders, focusedCategoryIndices };
    });
  };

  const onStepForwardClick = () => {
    setState(prev => {
      const currentDataCount = (prev.currentDataCount + 1) % stepCycleOf(prev);
      const dataProviders = getDataProvidersForDataCount(prev.data, prev.chartRows * prev.chartCols, currentDataCount);
      const focusedCategoryIndices = getFocusedCategoryIndices(prev, dataProviders);
      return { ...prev, currentDataCount, dataProviders, focusedCategoryIndices };
    });
  };

  const onPlayBackwardClick = () => {
    setState(prev => ({ ...prev, playing: true }));
    intervalIdRef.current = setInterval(onStepBackwardClick, state.rate);
  };

  const onPlayForwardClick = () => {
    setState(prev => ({ ...prev, playing: true }));
    intervalIdRef.current = setInterval(onStepForwardClick, state.rate);
  };

  const onStopClick = () => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
    }
    intervalIdRef.current = null;
    setState(prev => (prev.playing ? { ...prev, playing: false } : prev));
  };

  // Stop playback when active toggles (matches the old cWRP behavior).
  useEffect(() => {
    onStopClick();
     
  }, [active]);

  // Clean up the interval on unmount.
  useEffect(() => () => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  const onChartFocus = (chartIndex: number, focusData: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }) => {
    const { focusedValueAxisId: valueAxisId, focusedSeriesId: seriesId } = focusData;
    let categoryIndex = focusData.focusedCategoryIndex;
    const { mochartDemoConfig, data, dataProviders, focusedCategoryIndex: currentFocusedCategoryIndex } = state;
    const { mochartConfig } = mochartDemoConfig;
    let focusedCategoryIndices = state.focusedCategoryIndices;
    if (categoryIndex !== undefined && categoryIndex >= 0) {
      const categoryValue = (dataProviders[chartIndex].getPropertyValues(mochartConfig.categoryAxis.property ?? '') ?? [])[categoryIndex];
      const count = data.length;
      for (let i = 0; i < count; i++) {
        if (data[i][mochartConfig.categoryAxis.property ?? ''] === categoryValue) {
          categoryIndex = i;
          break;
        }
      }
      if (categoryIndex !== currentFocusedCategoryIndex) {
        focusedCategoryIndices = getFocusedCategoryIndicesForValue(dataProviders, mochartConfig.categoryAxis.property ?? '', categoryValue);
      }
    }
    else if (currentFocusedCategoryIndex >= 0) {
      focusedCategoryIndices = dataProviders.map(() => -1);
    }
    const nextFocusedCategoryIndex = categoryIndex !== undefined ? categoryIndex : currentFocusedCategoryIndex;
    const nextFocusedValueAxisId = valueAxisId !== undefined ? valueAxisId : state.focusedValueAxisId;
    const nextFocusedSeriesId = seriesId !== undefined ? seriesId : state.focusedSeriesId;
    setState(prev => ({
      ...prev,
      focusedCategoryIndices,
      focusedCategoryIndex: nextFocusedCategoryIndex,
      focusedValueAxisId: nextFocusedValueAxisId,
      focusedSeriesId: nextFocusedSeriesId
    }));
  };

  // The chart reports the whole union it was shown; keep only the user delta.
  const onSeriesFilter = (chartIndex: number, { filteredSeriesIds: reported }: { filteredSeriesIds: FilteredSeriesIds }) => {
    setState(prev => {
      const shown = prev.mochartDemoConfig.pieMode
        ? { ...prev.filteredSeriesIds, ...getPieStepFilteredIds(prev.sliceIds, chartIndex, prev.currentDataCount) }
        : prev.filteredSeriesIds;
      return { ...prev, filteredSeriesIds: applyReportedSeriesFilter(prev.filteredSeriesIds, shown, reported) };
    });
  };

  const { filteredSeriesIds, focusedCategoryIndices, focusedValueAxisId, focusedSeriesId, playing, mochartDemoConfig, dataProviders, chartRows, chartCols } = state;
  const { mochartConfig } = mochartDemoConfig;

  // Measured size of the charts grid (the old code wrapped it in a sizer HOC).
  const { elementRef: gridRef, width: gridWidth, height: gridHeight } = useElementSize();

  // The whole grid exports as one tiled image; share captures the grid size,
  // playback step and interval so the link restores the same view.
  const getChartContainers = (): Element[] => {
    const grid = gridRef.current;
    return grid ? Array.from(grid.querySelectorAll('.multi-mochart-chart')) : [];
  };

  const onExportPng = () => {
    const containers = getChartContainers();
    if (containers.length > 0) {
      void exportChartsPNG(containers, { cols: state.chartCols, ...getChartExportOptions() });
    }
  };

  const onExportSvg = () => {
    const containers = getChartContainers();
    if (containers.length > 0) {
      exportChartsSVG(containers, { cols: state.chartCols, ...getChartExportOptions() });
    }
  };

  const getShareState = (): ShareState => ({
    mode: 'multi', rows: state.chartRows, cols: state.chartCols, step: state.currentDataCount, interval: state.rate
  });

  // Pie mode unions the stepper's per-chart filtering with the user's
  // legend filtering, so the legend stays interactive while stepping.
  const chartFilteredSeriesIds = (i: number): FilteredSeriesIds => mochartDemoConfig.pieMode
    ? { ...filteredSeriesIds, ...getPieStepFilteredIds(state.sliceIds, i, state.currentDataCount) }
    : filteredSeriesIds;

  return (
    <div className={"mochart-demo-tab-container demo-layout-col chart" + (active ? " active" : "")} inert={!active}>
      <div className="multi-charts-sizer" ref={gridRef}>
        {gridWidth > 0 ?
          <MultiMochartCharts width={gridWidth} height={gridHeight} mochartConfig={mochartConfig} dataProviders={dataProviders}
            chartRows={chartRows} chartCols={chartCols} chartFilteredSeriesIds={chartFilteredSeriesIds}
            focusedCategoryIndices={focusedCategoryIndices} focusedValueAxisId={focusedValueAxisId} focusedSeriesId={focusedSeriesId}
            onSeriesFilter={onSeriesFilter} onChartFocus={onChartFocus} />
          : null}
      </div>
      <MultiMochartControls playing={playing} initialRows={chartRows} initialCols={chartCols} initialRate={state.rate}
        onRowsChange={onRowsChange} onColsChange={onColsChange}
        onStepBackwardClick={onStepBackwardClick} onStepForwardClick={onStepForwardClick}
        onPlayBackwardClick={onPlayBackwardClick} onPlayForwardClick={onPlayForwardClick}
        onStopClick={onStopClick} onRateChange={onRateChange}
        exportPng={onExportPng} exportSvg={onExportSvg} getShareState={getShareState} />
    </div>
  );
}

interface ChartsProps {
  width: number;
  height: number;
  mochartConfig: MochartConfig;
  dataProviders: ChartDataProviderLike[];
  chartRows: number;
  chartCols: number;
  chartFilteredSeriesIds: (chartIndex: number) => FilteredSeriesIds;
  focusedCategoryIndices: number[];
  focusedValueAxisId?: string | null;
  focusedSeriesId?: string | null;
  onSeriesFilter: (chartIndex: number, filterData: { filteredSeriesIds: FilteredSeriesIds }) => void;
  onChartFocus: (chartIndex: number, focusData: any) => void;
}

function MultiMochartCharts({ width, height, mochartConfig, dataProviders, chartRows, chartCols,
  chartFilteredSeriesIds, focusedCategoryIndices, focusedValueAxisId, focusedSeriesId, onSeriesFilter, onChartFocus }: ChartsProps) {
  const chartWidth = Math.floor((width - scrollWidthOffset) / chartCols);
  const chartHeight = Math.floor(height / chartRows);

  const charts: React.ReactNode[] = [];
  const chartCount = chartRows * chartCols;
  for (let i = 0; i < chartCount; i++) {
    const chartIndex = i;
    charts.push(
      <div key={'chart-' + i} className="multi-mochart-chart">
        <Chart mochartConfig={mochartConfig} dataProvider={dataProviders[i]} width={chartWidth} height={chartHeight}
          filteredSeriesIds={chartFilteredSeriesIds(i)} focusedCategoryIndex={focusedCategoryIndices[i] ?? -1}
          focusedValueAxisId={focusedValueAxisId ?? null} focusedSeriesId={focusedSeriesId ?? null}
          onSeriesFilter={(fd) => onSeriesFilter(chartIndex, fd)} onFocus={(fd) => onChartFocus(chartIndex, fd)} />
      </div>
    );
  }

  return (
    <div className="multi-charts">
      {charts}
    </div>
  );
}

interface ControlsProps {
  playing: boolean;
  initialRows: number;
  initialCols: number;
  initialRate: number;
  onRowsChange: (rows: number) => void;
  onColsChange: (cols: number) => void;
  onStepBackwardClick: () => void;
  onStepForwardClick: () => void;
  onPlayBackwardClick: () => void;
  onPlayForwardClick: () => void;
  onStopClick: () => void;
  onRateChange: (rate: number) => void;
  exportPng: () => void;
  exportSvg: () => void;
  getShareState: () => ShareState;
}

function MultiMochartControls({ playing, initialRows, initialCols, initialRate, onRowsChange, onColsChange, onStepBackwardClick, onStepForwardClick, onPlayBackwardClick, onPlayForwardClick, onStopClick, onRateChange, exportPng, exportSvg, getShareState }: ControlsProps) {
  // Seed the inputs from the (possibly share-restored) initial values.
  const [rateText, setRateText] = useState<string | number>(initialRate);
  const [rowsText, setRowsText] = useState<string | number>(initialRows);
  const [colsText, setColsText] = useState<string | number>(initialCols);

  // Input values arrive as strings and are coerced to numbers in place, so the
  // working variable is intentionally loose (matching the original demo).
  const rowsChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    let rows: any = event.target.value;
    if (!isNaN(parseFloat(rows)) && isFinite(rows)) {
      rows = +rows;
      if (rows >= 1 && rows <= 4) {
        onRowsChange(rows);
      }
    }
    setRowsText(rows);
  };

  const colsChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    let cols: any = event.target.value;
    if (!isNaN(parseFloat(cols)) && isFinite(cols)) {
      cols = +cols;
      if (cols >= 1 && cols <= 4) {
        onColsChange(cols);
      }
    }
    setColsText(cols);
  };

  const rateChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    let rate: any = event.target.value;
    if (!isNaN(parseFloat(rate)) && isFinite(rate)) {
      rate = +rate;
      if (rate >= 5 && rate <= 60000) {
        onRateChange(rate);
      }
    }
    setRateText(rate);
  };

  return (
    <div className="multi-controls">
      <form>
        <div className="demo-field">
          <label className="demo-label" htmlFor="grid-rows">{demoText.multiChartsTab.gridLabel}</label>
          <input id="grid-rows" className="demo-input" disabled={playing} type="number" min={1} max={4} value={rowsText}
            onChange={rowsChanged} aria-label={demoText.multiChartsTab.gridRowsAria} />
          <span className="demo-label">&times;</span>
          <input id="grid-cols" className="demo-input" disabled={playing} type="number" min={1} max={4} value={colsText}
            onChange={colsChanged} aria-label={demoText.multiChartsTab.gridColsAria} />
        </div>
        <div className="demo-field">
          <div className="demo-toolbar">
            <div className="demo-btn-group">
              <ButtonWithTooltip id="step-back" disabled={playing} tooltipText={demoText.multiChartsTab.stepBackward.tooltip} tooltipPlacement="top-start"
                onClick={onStepBackwardClick} aria-label={demoText.multiChartsTab.stepBackward.aria}>
                <Icon size="lg" fixedWidth={true} name="backward-step" />
              </ButtonWithTooltip>
              <ButtonWithTooltip id="step-forward" disabled={playing} tooltipText={demoText.multiChartsTab.stepForward.tooltip} tooltipPlacement="top-start"
                onClick={onStepForwardClick} aria-label={demoText.multiChartsTab.stepForward.aria}>
                <Icon size="lg" fixedWidth={true} name="forward-step" />
              </ButtonWithTooltip>
              <ButtonWithTooltip id="play-backward" disabled={playing} tooltipText={demoText.multiChartsTab.playBackward.tooltip} tooltipPlacement="top-start"
                onClick={onPlayBackwardClick} aria-label={demoText.multiChartsTab.playBackward.aria}>
                <Icon size="lg" fixedWidth={true} name="play" flip="horizontal" />
              </ButtonWithTooltip>
              <ButtonWithTooltip id="play-forward" disabled={playing} tooltipText={demoText.multiChartsTab.playForward.tooltip} tooltipPlacement="top-start"
                onClick={onPlayForwardClick} aria-label={demoText.multiChartsTab.playForward.aria}>
                <Icon size="lg" fixedWidth={true} name="play" />
              </ButtonWithTooltip>
              <ButtonWithTooltip id="stop" disabled={!playing} tooltipText={demoText.multiChartsTab.stop.tooltip} tooltipPlacement="top-start"
                onClick={onStopClick} aria-label={demoText.multiChartsTab.stop.aria}>
                <Icon size="lg" fixedWidth={true} name="stop" />
              </ButtonWithTooltip>
            </div>
          </div>
        </div>
        <div className="demo-field">
          <label className="demo-label" htmlFor="multi-rate">{demoText.multiChartsTab.intervalLabel}</label>
          <input id="multi-rate" className="demo-input" disabled={playing} type="number" min={5} max={60000} step={100} value={rateText}
            onChange={rateChanged} aria-label={demoText.multiChartsTab.intervalAria} />
        </div>
        <div className="demo-field">
          <div className="demo-toolbar">
            <ExportShareMenu exportPng={exportPng} exportSvg={exportSvg} getShareState={getShareState} />
          </div>
        </div>
      </form>
    </div>
  );
}
