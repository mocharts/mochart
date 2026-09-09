import { hasConfigStructureChange, NONE, ArrayOfObjectsDataProvider } from '@mochart/core';
import type { DataProvider } from '@mochart/core';
import { exportPNG, exportSVG } from '@mochart/export';

import { applyPieSliceValue, controlsMenuPlacement, createErrorDataProvider, getChartExportOptions, getCategoryIndexTitle, getPieSequenceSteps, getPieSlices, getSeriesIndexTitle, getSeriesValuesText, demoText, parseJson, isPhoneViewport, watchPhoneViewport } from '@mochart/demo-common';

import type { PieSliceInfo, ShareState } from '@mochart/demo-common';

import { buttonWithTooltip, el, icon, setChildren, withPreservedFocus } from '../misc/dom';
import { mountChart } from '../misc/chartHost';
import { exportShareMenu } from '../misc/ExportShareMenu';
import { menuDivider, overflowMenu } from '../misc/OverflowMenu';

import type { MenuItem } from '../misc/OverflowMenu';

import type { MochartDemoConfig, FilteredSeriesIds, FocusData } from '../../types';

// Mutable working rows are keyed by config-driven property names, so their
// value type is intentionally loose.
type Row = Record<string, any>;

export interface EditableChartProps {
  width: number;
  mochartDemoConfig: MochartDemoConfig;
  data: Row[];
  dataError?: string | boolean | null;
  isActive: boolean;
  chartCount: number;
  showChartCountControls: boolean;
  /** Set on the chart instance that should render the share button. */
  showShareButton?: boolean;
  filteredSeriesIds: FilteredSeriesIds;
  focusedCategoryIndex: number;
  focusedValueAxisId?: string | null;
  focusedSeriesId?: string | null;
  onFocus: (focusData: FocusData) => void;
  onSeriesFilter: (filterData: { filteredSeriesIds: FilteredSeriesIds }) => void;
  onChartCountToggle: () => void;
}

export interface EditableChartUpdate {
  width: number;
  mochartDemoConfig: MochartDemoConfig;
  data: Row[];
  dataError?: string | boolean | null;
  isActive: boolean;
  chartCount: number;
  showChartCountControls: boolean;
  filteredSeriesIds: FilteredSeriesIds;
  focusedCategoryIndex: number;
  focusedValueAxisId?: string | null;
  focusedSeriesId?: string | null;
}

export interface EditableChartHandle {
  el: HTMLElement;
  update(next: EditableChartUpdate): void;
  /**
   * Dismiss both of this strip's popovers. The tab that owns this chart calls it
   * on the way out: a pane is deactivated by being marked `inert` and shifted a
   * viewport-width left, and an open panel is `position: fixed` — inert stops it
   * being usable but not being *seen*, so it would hang over the pane that
   * replaced it.
   */
  closeMenus(): void;
  destroy(): void;
}

type EditableDataProvider = DataProvider;

interface FocusPayload {
  valueAxisId?: string | null;
  seriesId?: string | null;
  categoryIndex?: number;
}

const emptyCategoryText = demoText.editableChart.emptyCategoryText;

export function editableChart(props: EditableChartProps): EditableChartHandle {
  const { onFocus, onSeriesFilter, onChartCountToggle } = props;
  // recomputed on every resize: the second chart is only offered on a viewport that can hold two
  let showChartCountControls = props.showChartCountControls;

  let width = props.width;
  let mochartDemoConfig = props.mochartDemoConfig;
  let data = props.data;
  let dataError = props.dataError ?? false;
  let chartCount = props.chartCount;
  let filteredSeriesIds = props.filteredSeriesIds;
  let focusedCategoryIndex = props.focusedCategoryIndex;
  let focusedValueAxisId = props.focusedValueAxisId ?? null;
  let focusedSeriesId = props.focusedSeriesId ?? null;

  // Working copies of the demo data; mutated in place by the category/series
  // editing controls (same pattern as the framework demos).
  let filteredData: Row[] = [];
  let removedData: Row[] = [];
  let sequenceId: ReturnType<typeof setInterval> | null = null;

  let dataProvider: EditableDataProvider | null = null;
  let categoryIndex = -1;
  let categoryValuesText = '';
  let seriesIndex = 0;
  let seriesValuesText = '';
  let selectionMode = 'category';
  let sequencePlaying = false;
  // pie-mode slice editing: slices are the series, so the category machinery has
  // nothing to operate on and a single slice panel replaces both panels
  let slices: PieSliceInfo[] = [];
  let sliceIndex = 0;
  let sliceValueText = '';
  let filteredFocusedCategoryIndex = -1;
  let orderChanged = false;

  // The phone fold. Read once up front and kept current by the watcher below;
  // `sync()` re-lays the controls out from it (see placeControls).
  let isPhone = isPhoneViewport();
  const unwatchViewport = watchPhoneViewport(next => {
    isPhone = next;
    sync();
  });

  function getFilteredFocusedCategoryIndex(nextFilteredData: Row[]): number {
    let nextFilteredFocusedCategoryIndex = -1;
    if (focusedCategoryIndex >= 0) {
      const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
      // a stale index (combined config+data update) must degrade to no focus, not throw
      const categoryValue = data[focusedCategoryIndex]?.[categoryProperty];
      const count = nextFilteredData.length;
      for (let i = 0; i < count; i++) {
        if (nextFilteredData[i][categoryProperty] === categoryValue) {
          nextFilteredFocusedCategoryIndex = i;
          break;
        }
      }
    }
    return nextFilteredFocusedCategoryIndex;
  }

  function updateFilteredDataState(
    nextState: { orderChanged?: boolean; categoryIndex?: number; seriesIndex?: number; categoryValuesText?: string; seriesValuesText?: string },
    nextFilteredData: Row[],
    nextRemovedData: Row[],
    resetCategoryIndex = true
  ): void {
    filteredData = nextFilteredData;
    removedData = nextRemovedData;
    if (resetCategoryIndex === true) {
      categoryIndex = -1;
      seriesValuesText = demoText.editableChart.selectACategoryText;
    }
    filteredFocusedCategoryIndex = dataError ? -1 : getFilteredFocusedCategoryIndex(nextFilteredData);
    if (!dataError && mochartDemoConfig.mochartConfig.validation.valid) {
      dataProvider = new ArrayOfObjectsDataProvider(nextFilteredData);
    }
    else if (dataError) {
      dataProvider = createErrorDataProvider(dataError);
    }
    else {
      dataProvider = null;
    }
    if (nextState.orderChanged !== undefined) {
      orderChanged = nextState.orderChanged;
    }
    if (nextState.categoryIndex !== undefined) {
      categoryIndex = nextState.categoryIndex;
    }
    if (nextState.seriesIndex !== undefined) {
      seriesIndex = nextState.seriesIndex;
    }
    if (nextState.categoryValuesText !== undefined) {
      categoryValuesText = nextState.categoryValuesText;
    }
    if (nextState.seriesValuesText !== undefined) {
      seriesValuesText = nextState.seriesValuesText;
    }
    sync();
  }

  function initData(): void {
    const nextFilteredData = [];
    if (data && !dataError) {
      const count = data.length;
      for (let i = 0; i < count; i++) {
        nextFilteredData.push(Object.assign({}, data[i]));
      }
    }
    slices = mochartDemoConfig.pieMode ? getPieSlices(mochartDemoConfig.mochartConfig) : [];
    if (sliceIndex >= slices.length) {
      sliceIndex = 0;
    }
    sliceValueText = getSliceValueText(nextFilteredData);
    updateFilteredDataState({ orderChanged: false, seriesIndex: 0, categoryValuesText: emptyCategoryText }, nextFilteredData, []);
  }

  function getSliceValueText(rows: Row[]): string {
    if (slices.length === 0 || rows.length === 0) {
      return '';
    }
    const value = rows[0][slices[sliceIndex].property];
    return value === undefined || value === null ? '' : String(value);
  }

  function selectSlice(nextSliceIndex: number): void {
    if (nextSliceIndex >= 0 && nextSliceIndex < slices.length) {
      sliceIndex = nextSliceIndex;
      sliceValueText = getSliceValueText(filteredData);
      sync();
    }
  }

  function onChartSliceClick({ seriesId }: { seriesId: string }): void {
    selectSlice(slices.findIndex(slice => slice.id === seriesId));
  }

  function applySliceChanges(): void {
    const value = parseFloat(sliceValueText);
    if (!isNaN(value) && isFinite(value) && filteredData.length > 0 && slices.length > 0) {
      applyPieSliceValue(filteredData[0], slices[sliceIndex].property, value);
      updateFilteredDataState({}, filteredData, removedData, false);
    }
  }

  function resetSliceChanges(): void {
    if (filteredData.length > 0 && data.length > 0 && slices.length > 0) {
      const property = slices[sliceIndex].property;
      applyPieSliceValue(filteredData[0], property, data[0][property] as number);
      sliceValueText = getSliceValueText(filteredData);
      updateFilteredDataState({}, filteredData, removedData, false);
    }
  }

  // The pie analog of the category add/remove sequences: filter the slices one
  // at a time (via the shared legend filter, so the remaining slices re-sweep
  // and center totals count along), then restore them.
  function startSliceSequence(): void {
    const steps = getPieSequenceSteps(slices.map(slice => slice.id));
    if (steps.length > 0) {
      sequencePlaying = true;
      let stepCount = 0;
      sequenceId = setInterval(() => {
        onSeriesFilter({ filteredSeriesIds: steps[stepCount] });
        if (stepCount < steps.length - 1) {
          stepCount++;
        }
        else {
          stopSequence();
        }
      }, 2000);
      sync();
    }
  }

  // mochart reports focus with the new payload shape; adapt it to the
  // { valueAxisId, seriesId, categoryIndex } shape this demo tracks.
  function onChartFocus({ focusedValueAxisId: valueAxisId, focusedSeriesId: seriesId, focusedCategoryIndex: chartCategoryIndex }: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }): void {
    onLocalFocus({ valueAxisId, seriesId, categoryIndex: chartCategoryIndex });
  }

  function onLocalFocus({ valueAxisId, seriesId, categoryIndex: nextCategoryIndex }: FocusPayload): void {
    if (nextCategoryIndex !== undefined) {
      const nextFilteredFocusedCategoryIndex = nextCategoryIndex;
      let newFocusedCategoryIndex = -1;
      if (nextFilteredFocusedCategoryIndex >= 0) {
        const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
        const categoryValue = filteredData[nextFilteredFocusedCategoryIndex][categoryProperty];
        const count = data.length;
        for (let i = 0; i < count; i++) {
          if (data[i][categoryProperty] === categoryValue) {
            newFocusedCategoryIndex = i;
            break;
          }
        }
      }
      filteredFocusedCategoryIndex = nextFilteredFocusedCategoryIndex;
      onFocus({ valueAxisId, seriesId, categoryIndex: newFocusedCategoryIndex });
    }
    else {
      onFocus({ valueAxisId, seriesId, categoryIndex: nextCategoryIndex });
    }
  }

  function onChartClick({ categoryIndex: clickedCategoryIndex }: { categoryIndex: number }): void {
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const clickedCategoryValue = '' + filteredData[clickedCategoryIndex][categoryProperty];
    if (selectionMode === 'series') {
      categoryIndex = clickedCategoryIndex;
      seriesValuesText = getSeriesValuesText(mochartDemoConfig, filteredData, clickedCategoryIndex, seriesIndex);
    }
    else if (selectionMode === 'category') {
      const dataCategoryValues: any[] = [];
      const count = filteredData.length;
      for (let i = 0; i < count; i++) {
        dataCategoryValues.push(filteredData[i][categoryProperty]);
      }
      let parsedCategoryValues = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(',');
      parsedCategoryValues = parsedCategoryValues.filter((parsedCategoryValue) => dataCategoryValues.indexOf(parsedCategoryValue) !== -1 || dataCategoryValues.indexOf(+parsedCategoryValue) !== -1);
      const clickedIndex = parsedCategoryValues.indexOf(clickedCategoryValue);
      if (clickedIndex === -1) {
        parsedCategoryValues = parsedCategoryValues.concat(clickedCategoryValue);
      }
      else {
        parsedCategoryValues.splice(clickedIndex, 1);
      }
      categoryValuesText = parsedCategoryValues.length === 0 ? emptyCategoryText : parsedCategoryValues.join(',');
    }
    sync();
  }

  function onModeToggle(): void {
    selectionMode = selectionMode === 'category' ? 'series' : 'category';
    sync();
  }

  function selectAllCategories(): void {
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const allCategoryValues: any[] = [];
    const count = data.length;
    for (let i = 0; i < count; i++) {
      allCategoryValues.push(data[i][categoryProperty]);
    }
    categoryValuesText = allCategoryValues.join(',');
    sync();
  }

  function resetCategories(): void {
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryToObjectMap: Record<string, Row> = {};
    removedData.forEach(removedObject => {
      categoryToObjectMap[removedObject[categoryProperty]] = removedObject;
    });
    filteredData.forEach(oldObject => {
      categoryToObjectMap[oldObject[categoryProperty]] = oldObject;
    });
    const nextFilteredData = data.map(o => categoryToObjectMap[o[categoryProperty] as string]);
    updateFilteredDataState({ orderChanged: false }, nextFilteredData, []);
  }

  function reverseCategories(): void {
    if (filteredData && filteredData.length > 1) {
      const nextFilteredData = filteredData.slice().reverse();
      updateFilteredDataState({ orderChanged: true }, nextFilteredData, removedData);
    }
  }

  function decreaseCategoryOrder(): void {
    if (filteredData && filteredData.length > 1 && categoryIndex > 0) {
      const nextFilteredData = filteredData.slice();
      const temp = nextFilteredData[categoryIndex - 1];
      nextFilteredData[categoryIndex - 1] = nextFilteredData[categoryIndex];
      nextFilteredData[categoryIndex] = temp;
      updateFilteredDataState({ orderChanged: true, categoryIndex: categoryIndex - 1 }, nextFilteredData, removedData, false);
    }
  }

  function increaseCategoryOrder(): void {
    if (filteredData && filteredData.length > 1 && categoryIndex < filteredData.length - 1) {
      const nextFilteredData = filteredData.slice();
      const temp = nextFilteredData[categoryIndex + 1];
      nextFilteredData[categoryIndex + 1] = nextFilteredData[categoryIndex];
      nextFilteredData[categoryIndex] = temp;
      updateFilteredDataState({ orderChanged: true, categoryIndex: categoryIndex + 1 }, nextFilteredData, removedData, false);
    }
  }

  function addCategories(): void {
    const oldFilteredData = filteredData;
    const oldRemovedData = removedData;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToAdd = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(',');
    const categoryValueToAddMap: Record<string, boolean> = {};
    categoryValuesToAdd.forEach(categoryValueToAdd => {
      categoryValueToAddMap[categoryValueToAdd] = true;
    });
    const removedMap: Record<string, Row> = {};
    oldRemovedData.forEach(removedObject => {
      removedMap[removedObject[categoryProperty]] = removedObject;
    });
    const count = data.length;
    const filteredCount = oldFilteredData.length;
    const nextFilteredData: Row[] = [];
    for (let i = 0, fi = 0; i < count; i++) {
      if (fi < filteredCount) {
        if (data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
          if (categoryValueToAddMap[data[i][categoryProperty]] === true) {
            nextFilteredData.push(removedMap[data[i][categoryProperty]]);
            delete removedMap[data[i][categoryProperty]];
          }
        }
        else {
          nextFilteredData.push(oldFilteredData[fi]);
          fi++;
        }
      }
      else if (categoryValueToAddMap[data[i][categoryProperty]] === true) {
        nextFilteredData.push(removedMap[data[i][categoryProperty]]);
        delete removedMap[data[i][categoryProperty]];
      }
    }
    const nextRemovedData: Row[] = [];
    oldRemovedData.forEach(removedObject => {
      if (removedMap[removedObject[categoryProperty]] !== undefined) {
        nextRemovedData.push(removedMap[removedObject[categoryProperty]]);
      }
    });
    updateFilteredDataState({}, nextFilteredData, nextRemovedData);
  }

  function removeCategories(): void {
    const oldFilteredData = filteredData;
    const nextRemovedData = removedData;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(',');
    const categoryValueToRemoveMap: Record<string, boolean> = {};
    categoryValuesToRemove.forEach(categoryValueToRemove => {
      categoryValueToRemoveMap[categoryValueToRemove] = true;
    });
    const count = oldFilteredData.length;
    const nextFilteredData: Row[] = [];
    for (let i = 0; i < count; i++) {
      if (categoryValueToRemoveMap[oldFilteredData[i][categoryProperty]] !== true) {
        nextFilteredData.push(oldFilteredData[i]);
      }
      else {
        nextRemovedData.push(oldFilteredData[i]);
      }
    }
    updateFilteredDataState({}, nextFilteredData, nextRemovedData);
  }

  function startAddSequence(): void {
    const oldFilteredData = filteredData;
    const oldRemovedData = removedData;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToAdd = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(',');
    const categoryValueToAddMap: Record<string, boolean> = {};
    categoryValuesToAdd.forEach(categoryValueToAdd => {
      categoryValueToAddMap[categoryValueToAdd] = true;
    });
    const removedIndexMap: Record<string, number> = {};
    oldRemovedData.forEach((removedObject, removedIndex) => {
      removedIndexMap[removedObject[categoryProperty]] = removedIndex;
    });
    const categoryObjectsToAdd: { removedIndex: number; dataIndex: number }[] = [];
    const count = data.length;
    const filteredCount = oldFilteredData.length;
    for (let i = 0, fi = 0; i < count; i++) {
      if (fi < filteredCount) {
        if (data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
          if (categoryValueToAddMap[data[i][categoryProperty]] === true) {
            categoryObjectsToAdd.push({
              removedIndex: removedIndexMap[data[i][categoryProperty]] - categoryObjectsToAdd.length,
              dataIndex: fi + categoryObjectsToAdd.length
            });
          }
        }
        else {
          fi++;
        }
      }
      else if (categoryValueToAddMap[data[i][categoryProperty]] === true) {
        categoryObjectsToAdd.push({
          removedIndex: removedIndexMap[data[i][categoryProperty]] - categoryObjectsToAdd.length,
          dataIndex: fi + categoryObjectsToAdd.length
        });
      }
    }
    if (categoryObjectsToAdd.length > 0) {
      sequencePlaying = true;
      let addCount = 0;
      sequenceId = setInterval(() => {
        oldFilteredData.splice(categoryObjectsToAdd[addCount].dataIndex, 0, oldRemovedData.splice(categoryObjectsToAdd[addCount].removedIndex, 1)[0]);
        updateFilteredDataState({}, oldFilteredData, oldRemovedData);
        if (addCount < categoryObjectsToAdd.length - 1) {
          addCount++;
        }
        else {
          stopSequence();
        }
      }, 2000);
      sync();
    }
  }

  function startRemoveSequence(): void {
    const oldFilteredData = filteredData;
    const oldRemovedData = removedData;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(',');
    const categoryValueToRemoveMap: Record<string, boolean> = {};
    categoryValuesToRemove.forEach(categoryValueToRemove => {
      categoryValueToRemoveMap[categoryValueToRemove] = true;
    });
    const removedIndexMap: Record<string, number> = {};
    oldRemovedData.forEach((removedObject, removedIndex) => {
      removedIndexMap[removedObject[categoryProperty]] = removedIndex;
    });
    const categoryObjectsToRemove: { removedIndex: number; dataIndex: number }[] = [];
    const count = data.length;
    const filteredCount = oldFilteredData.length;
    for (let i = 0, fi = 0, ri = 0; i < count && fi < filteredCount; i++) {
      if (data[i][categoryProperty] === oldFilteredData[fi][categoryProperty]) {
        if (categoryValueToRemoveMap[data[i][categoryProperty]] === true) {
          categoryObjectsToRemove.push({
            removedIndex: ri,
            dataIndex: fi - categoryObjectsToRemove.length
          });
          ri++;
        }
        fi++;
      }
      else {
        ri++;
      }
    }
    if (categoryObjectsToRemove.length > 0) {
      sequencePlaying = true;
      let removeCount = 0;
      sequenceId = setInterval(() => {
        oldRemovedData.splice(categoryObjectsToRemove[removeCount].removedIndex, 0, oldFilteredData.splice(categoryObjectsToRemove[removeCount].dataIndex, 1)[0]);
        updateFilteredDataState({}, oldFilteredData, oldRemovedData);
        if (removeCount < categoryObjectsToRemove.length - 1) {
          removeCount++;
        }
        else {
          stopSequence();
        }
      }, 2000);
      sync();
    }
  }

  function stopSequence(): void {
    stopSequenceInternal();
    sequencePlaying = false;
    sync();
  }

  function stopSequenceInternal(): void {
    if (sequenceId !== null) {
      clearInterval(sequenceId);
      sequenceId = null;
    }
  }

  function prevSeries(): void {
    if (categoryIndex !== -1 && seriesIndex > 0) {
      seriesIndex--;
      seriesValuesText = getSeriesValuesText(mochartDemoConfig, filteredData, categoryIndex, seriesIndex);
      sync();
    }
  }

  function nextSeries(): void {
    const { seriesCount } = mochartDemoConfig;
    if (categoryIndex !== -1 && seriesIndex < seriesCount - 1) {
      seriesIndex++;
      seriesValuesText = getSeriesValuesText(mochartDemoConfig, filteredData, categoryIndex, seriesIndex);
      sync();
    }
  }

  function applySeriesChanges(): void {
    const filteredDataObject = filteredData[categoryIndex];
    const { mochartConfig } = mochartDemoConfig;
    const { series: seriesConfigs } = mochartConfig;
    if (seriesConfigs.length > 0) {
      try {
        const dataObject = parseJson(seriesValuesText) as Record<string, unknown>;
        const seriesConfig = seriesConfigs[seriesIndex];
        const { property, rangeProperty, markerProperty, labelProperty, colorProperty, tooltipProperty, errorLowProperty, errorHighProperty } = seriesConfig;
        filteredDataObject[property!] = dataObject['p'];
        if (rangeProperty !== NONE) {
          filteredDataObject[rangeProperty] = dataObject['r'];
        }
        if (markerProperty !== NONE) {
          filteredDataObject[markerProperty] = dataObject['m'];
        }
        if (labelProperty !== NONE) {
          filteredDataObject[labelProperty] = dataObject['l'];
        }
        if (colorProperty !== NONE) {
          filteredDataObject[colorProperty] = dataObject['c'];
        }
        if (tooltipProperty !== NONE) {
          filteredDataObject[tooltipProperty] = dataObject['t'];
        }
        if (errorLowProperty !== NONE) {
          filteredDataObject[errorLowProperty] = dataObject['el'];
        }
        if (errorHighProperty !== NONE) {
          filteredDataObject[errorHighProperty] = dataObject['eh'];
        }
        updateFilteredDataState({}, filteredData, removedData, false);
      }
      catch {
        // invalid JSON in the series input — ignore, matching the other demos
      }
    }
  }

  function resetSeriesChanges(): void {
    const { mochartConfig } = mochartDemoConfig;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const { series: seriesConfigs } = mochartConfig;
    if (seriesConfigs.length > 0) {
      const filteredDataObject = filteredData[categoryIndex];
      const filteredCategoryValue = filteredDataObject[categoryProperty];
      const count = data.length;
      let dataObject: Row | null = null;
      for (let i = 0; i < count; i++) {
        if (data[i][categoryProperty] === filteredCategoryValue) {
          dataObject = data[i];
        }
      }
      const seriesConfig = seriesConfigs[seriesIndex];
      const { property, rangeProperty, markerProperty, labelProperty, colorProperty, tooltipProperty, errorLowProperty, errorHighProperty } = seriesConfig;
      filteredDataObject[property!] = dataObject![property!];
      if (rangeProperty !== NONE) {
        filteredDataObject[rangeProperty] = dataObject![rangeProperty];
      }
      if (markerProperty !== NONE) {
        filteredDataObject[markerProperty] = dataObject![markerProperty];
      }
      if (labelProperty !== NONE) {
        filteredDataObject[labelProperty] = dataObject![labelProperty];
      }
      if (colorProperty !== NONE) {
        filteredDataObject[colorProperty] = dataObject![colorProperty];
      }
      if (tooltipProperty !== NONE) {
        filteredDataObject[tooltipProperty] = dataObject![tooltipProperty];
      }
      if (errorLowProperty !== NONE) {
        filteredDataObject[errorLowProperty] = dataObject![errorLowProperty];
      }
      if (errorHighProperty !== NONE) {
        filteredDataObject[errorHighProperty] = dataObject![errorHighProperty];
      }
      updateFilteredDataState({ seriesValuesText: getSeriesValuesText(mochartDemoConfig, filteredData, categoryIndex, seriesIndex) }, filteredData, removedData, false);
    }
  }

  // -------------------------------------------------------------------------
  // DOM
  // -------------------------------------------------------------------------

  const chartHost = mountChart(
    {
      width,
      mochartConfig: mochartDemoConfig.mochartConfig,
      dataProvider,
      filteredSeriesIds,
      focusedCategoryIndex: filteredFocusedCategoryIndex,
      focusedValueAxisId,
      focusedSeriesId,
      onFocus: onChartFocus,
      onSeriesFilter,
      onChartClick,
      onSliceClick: onChartSliceClick
    },
    { style: 'flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;' }
  );

  const chartContentElement = el('div', { className: 'editable-chart-content' }, [chartHost.el]);

  // Common controls shared by both panels; moved into whichever panel is
  // visible (the framework demos render them per-branch instead).
  const chartCountButton = buttonWithTooltip({
    label: demoText.editableChart.secondChart.label, pressed: chartCount === 2, ariaLabel: demoText.editableChart.secondChart.aria,
    tooltipText: chartCount === 2 ? demoText.editableChart.secondChart.tooltipHide : demoText.editableChart.secondChart.tooltipShow,
    onClick: onChartCountToggle,
    content: [icon(chartCount === 2 ? 'window-maximize' : 'window-restore', { size: 'lg', fixedWidth: true })]
  });
  const modeButton = buttonWithTooltip({
    label: demoText.editableChart.editMode.labelToSeries, ariaLabel: demoText.editableChart.editMode.aria,
    tooltipText: demoText.editableChart.editMode.tooltipToSeries,
    onClick: onModeToggle,
    content: [icon('bullseye', { size: 'lg', fixedWidth: true })]
  });
  // The export/share menu sits at the far right of the controls row (past the
  // category/series input). Share is only offered on the chart flagged for it
  // (the first, when two are shown).
  const exportShareMenuHandle = exportShareMenu({
    exportPng: () => { void exportPNG(chartContentElement, getChartExportOptions()); },
    exportSvg: () => { exportSVG(chartContentElement, getChartExportOptions()); },
    getShareState: props.showShareButton
      ? (): ShareState => ({ mode: 'single', config: mochartDemoConfig.config, data })
      : undefined
  });
  // The phone fold's trigger. It deliberately lives inside `menuSpan` rather
  // than beside the panels: `.editable-mochart-chart` and
  // `.editable-chart-container` are `display: contents`, so their children ARE
  // the grid items of `.editable-charts` — a third child of the container would
  // start a second implicit column and knock the two plots out of row alignment
  // when two charts are shown (fixed once already in 6ad187d). Inside
  // `menuSpan` it also inherits the re-parenting sync() already does to keep
  // the menus pinned to the right of whichever panel is visible.
  const overflowMenuHandle = overflowMenu({
    text: demoText.overflowMenu.chart,
    placement: controlsMenuPlacement,
    // Measured against the whole trailing group, not the trigger: the
    // export/share trigger sits to the ⋯'s right, so aligning to the ⋯ alone
    // would stop the panel ~50px short of the row's end — and on a 390px phone
    // a 320px panel pushed that far left hangs off the opposite edge.
    getAnchor: () => menuSpan
  });
  const menuSpan = el('span', { className: 'chart-controls-menu' }, [overflowMenuHandle.el, exportShareMenuHandle.el]);
  const chartCountControl = el('div', { className: 'demo-btn-group' }, [chartCountButton.el]);
  const modeControl = el('div', { className: 'demo-btn-group' }, [modeButton.el]);
  const commonControls = [chartCountControl, modeControl];

  // Category-mode panel
  const resetCategoriesButton = buttonWithTooltip({
    label: demoText.editableChart.resetCategories.label, ariaLabel: demoText.editableChart.resetCategories.aria,
    tooltipText: demoText.editableChart.resetCategories.tooltip,
    onClick: resetCategories,
    content: [icon('arrow-rotate-left', { size: 'lg', fixedWidth: true })]
  });
  const reverseCategoriesButton = buttonWithTooltip({
    label: demoText.editableChart.reverseCategories.label, ariaLabel: demoText.editableChart.reverseCategories.aria,
    tooltipText: demoText.editableChart.reverseCategories.tooltip,
    onClick: reverseCategories,
    content: [icon('right-left', { size: 'lg', fixedWidth: true })]
  });
  const addCategoriesButton = buttonWithTooltip({
    label: demoText.editableChart.addCategories.label, ariaLabel: demoText.editableChart.addCategories.aria,
    tooltipText: demoText.editableChart.addCategories.tooltip,
    onClick: addCategories,
    content: [icon('plus', { size: 'lg', fixedWidth: true })]
  });
  const removeCategoriesButton = buttonWithTooltip({
    label: demoText.editableChart.removeCategories.label, ariaLabel: demoText.editableChart.removeCategories.aria,
    tooltipText: demoText.editableChart.removeCategories.tooltip,
    onClick: removeCategories,
    content: [icon('minus', { size: 'lg', fixedWidth: true })]
  });
  // The three transport buttons are icon-only at every width by design, so they
  // carry `menuLabel` for the fold — without it they read as a column of bare
  // glyphs once they are inside the overflow panel.
  const playAddButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.playAddCategories.aria,
    menuLabel: demoText.editableChart.playAddCategories.menuLabel,
    tooltipText: demoText.editableChart.playAddCategories.tooltip,
    onClick: startAddSequence,
    content: [icon('play', { size: 'lg' }), el('span', { style: 'padding-right: 2px;' }), icon('plus', { size: 'lg' })]
  });
  const playRemoveButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.playRemoveCategories.aria,
    menuLabel: demoText.editableChart.playRemoveCategories.menuLabel,
    tooltipText: demoText.editableChart.playRemoveCategories.tooltip,
    onClick: startRemoveSequence,
    content: [icon('play', { size: 'lg' }), el('span', { style: 'padding-right: 2px;' }), icon('minus', { size: 'lg' })]
  });
  const stopButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.stopSequence.aria,
    menuLabel: demoText.editableChart.stopSequence.menuLabel,
    tooltipText: demoText.editableChart.stopSequence.tooltip,
    onClick: stopSequence,
    content: [icon('stop', { size: 'lg', fixedWidth: true })]
  });
  const selectAllButton = buttonWithTooltip({
    label: demoText.editableChart.selectAllCategories.label, ariaLabel: demoText.editableChart.selectAllCategories.aria,
    tooltipText: demoText.editableChart.selectAllCategories.tooltip,
    onClick: selectAllCategories,
    content: [icon('check-double', { size: 'lg', fixedWidth: true })]
  });

  const categoryInput = el('input', { className: 'demo-input', attrs: { type: 'text' } });
  categoryInput.addEventListener('input', () => {
    categoryValuesText = categoryInput.value;
    sync();
  });

  // The strip's order at desktop widths; also the list the fold restores.
  const categoryButtons = [
    resetCategoriesButton.el, reverseCategoriesButton.el, addCategoriesButton.el, removeCategoriesButton.el,
    playAddButton.el, playRemoveButton.el, stopButton.el, selectAllButton.el
  ];
  const categoryButtonGroup = el('div', { className: 'demo-btn-group' }, categoryButtons);
  const categoryToolbar = el('div', { className: 'demo-toolbar' }, [categoryButtonGroup]);

  // Menu-side homes for the loose buttons the fold takes out of the strip —
  // cached `.demo-btn-group`s; OverflowMenu.ts's header says why that shape.
  const menuOrderGroup = el('div', { className: 'demo-btn-group' });
  const menuSequenceGroup = el('div', { className: 'demo-btn-group' });
  const categoryPanel = el('div', { className: 'chart-controls-container' }, [
    el('div', { className: 'chart-controls-buttons' }, [
      el('form', {}, [
        el('div', { className: 'demo-field' }, [categoryToolbar])
      ])
    ]),
    el('span', { className: 'chart-controls-input' }, [
      el('form', {}, [categoryInput])
    ])
  ]);

  // Series-mode panel
  const categoryDecreaseButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.decreaseCategoryOrder.aria,
    tooltipText: demoText.editableChart.decreaseCategoryOrder.tooltip,
    onClick: decreaseCategoryOrder,
    content: [icon('arrow-left', { size: 'lg', fixedWidth: true })]
  });
  const categoryIncreaseButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.increaseCategoryOrder.aria,
    tooltipText: demoText.editableChart.increaseCategoryOrder.tooltip,
    onClick: increaseCategoryOrder,
    content: [icon('arrow-right', { size: 'lg', fixedWidth: true })]
  });
  const previousSeriesButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.previousSeries.aria,
    tooltipText: demoText.editableChart.previousSeries.tooltip,
    onClick: prevSeries,
    content: [icon('chevron-down', { size: 'lg', fixedWidth: true })]
  });
  const nextSeriesButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.nextSeries.aria,
    tooltipText: demoText.editableChart.nextSeries.tooltip,
    onClick: nextSeries,
    content: [icon('chevron-up', { size: 'lg', fixedWidth: true })]
  });
  const resetSeriesButton = buttonWithTooltip({
    label: demoText.editableChart.resetSeries.label, ariaLabel: demoText.editableChart.resetSeries.aria,
    tooltipText: demoText.editableChart.resetSeries.tooltip,
    onClick: resetSeriesChanges,
    content: [icon('arrow-rotate-left', { size: 'lg', fixedWidth: true })]
  });
  const applySeriesButton = buttonWithTooltip({
    label: demoText.editableChart.applySeries.label, ariaLabel: demoText.editableChart.applySeries.aria,
    tooltipText: demoText.editableChart.applySeries.tooltip,
    onClick: applySeriesChanges,
    content: [icon('check', { size: 'lg', fixedWidth: true })]
  });

  // The index sits in its own fixed-width span so stepping through indexes
  // never shifts the controls to the right of the label.
  //
  // The `Category: ` / `Series: ` prefixes get a span of their own so the phone
  // tier can take them out of the layout — see `.demo-label-prefix` in the
  // stylesheet's phone block, and the width arithmetic beside the margin
  // toggle in placeControls. They are CLIPPED there, not removed: the readout
  // has no other accessible name.
  //
  // The compact spans are the phone-tier stand-ins: a bare `-1` between two
  // arrows names nothing visually, so `G` / `S` carry the meaning in the space
  // the strip can actually spare. `aria-hidden`, so the accessible name stays
  // the clipped full prefix and never doubles up as "Category: G -1". Hidden by
  // the base stylesheet at every other width.
  const categoryIndexValue = el('span', { className: 'demo-index-value' });
  const seriesIndexValue = el('span', { className: 'demo-index-value' });
  const categoryIndexLabel = el('span', { className: 'demo-label', style: 'margin-left: 5px; margin-right: 5px;' }, [
    el('span', { className: 'demo-label-prefix', text: demoText.editableChart.categoryIndexPrefix }),
    el('span', { className: 'demo-label-prefix-compact', attrs: { 'aria-hidden': 'true' }, text: demoText.editableChart.categoryIndexPrefixCompact }),
    categoryIndexValue
  ]);
  const seriesIndexLabel = el('span', { className: 'demo-label', style: 'margin-left: 5px; margin-right: 5px;' }, [
    el('span', { className: 'demo-label-prefix', text: demoText.editableChart.seriesIndexPrefix }),
    el('span', { className: 'demo-label-prefix-compact', attrs: { 'aria-hidden': 'true' }, text: demoText.editableChart.seriesIndexPrefixCompact }),
    seriesIndexValue
  ]);

  const seriesInput = el('input', { className: 'demo-input', attrs: { type: 'text' } });
  seriesInput.addEventListener('input', () => {
    seriesValuesText = seriesInput.value;
    sync();
  });

  // Named (rather than inlined into the tree below) so the fold can swap its
  // contents: Reset moves into the menu on a phone, Apply stays beside the
  // input it applies. `seriesActionButtons` is also the list the unfold
  // restores, so the desktop order has exactly one definition.
  const seriesActionButtons = [resetSeriesButton.el, applySeriesButton.el];
  const seriesActionGroup = el('div', { className: 'demo-btn-group' }, seriesActionButtons);
  const seriesForm = el('form', {}, [
    el('div', { className: 'demo-field' }, [
      el('div', { className: 'demo-toolbar' }, [
        el('div', { className: 'demo-btn-group' }, [categoryDecreaseButton.el])
      ])
    ]),
    el('div', { className: 'demo-field' }, [categoryIndexLabel]),
    el('div', { className: 'demo-field' }, [
      el('div', { className: 'demo-toolbar' }, [
        el('div', { className: 'demo-btn-group' }, [categoryIncreaseButton.el])
      ])
    ]),
    el('div', { className: 'demo-field' }, [
      el('div', { className: 'demo-toolbar' }, [
        el('div', { className: 'demo-btn-group' }, [previousSeriesButton.el])
      ])
    ]),
    el('div', { className: 'demo-field' }, [seriesIndexLabel]),
    el('div', { className: 'demo-field' }, [
      el('div', { className: 'demo-toolbar' }, [
        el('div', { className: 'demo-btn-group' }, [nextSeriesButton.el]),
        seriesActionGroup
      ])
    ])
  ]);
  // Menu-side home for Reset (a cached `.demo-btn-group` — see OverflowMenu.ts).
  const menuSeriesActionGroup = el('div', { className: 'demo-btn-group' });
  const seriesCommonToolbar = el('div', { className: 'demo-toolbar' });
  // Emptied by the fold (commonControls move into the menu), and an empty flex
  // item still spends one of the form row's 10px column gaps — which the
  // tightest strip of the three cannot spare. placeControls hides it for the
  // duration of the fold.
  const seriesCommonField = el('div', { className: 'demo-field' }, [seriesCommonToolbar]);
  seriesForm.prepend(seriesCommonField);

  // Named so the fold can move Apply in beside the input it applies — see the
  // series branch of placeControls.
  const seriesInputForm = el('form', {}, [seriesInput]);
  const seriesPanel = el('div', { className: 'chart-controls-container' }, [
    el('div', { className: 'chart-controls-buttons' }, [seriesForm]),
    el('span', { className: 'chart-controls-input' }, [seriesInputForm])
  ]);

  // Pie-mode slice panel — replaces both panels when slices are the series:
  // click a slice (or step prev/next) to select it, edit its value, or play
  // the filter/restore sequence.
  const previousSliceButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.previousSlice.aria,
    tooltipText: demoText.editableChart.previousSlice.tooltip,
    onClick: () => selectSlice(sliceIndex - 1),
    content: [icon('chevron-left', { size: 'lg', fixedWidth: true })]
  });
  const nextSliceButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.nextSlice.aria,
    tooltipText: demoText.editableChart.nextSlice.tooltip,
    onClick: () => selectSlice(sliceIndex + 1),
    content: [icon('chevron-right', { size: 'lg', fixedWidth: true })]
  });
  const resetSliceButton = buttonWithTooltip({
    label: demoText.editableChart.resetSlice.label, ariaLabel: demoText.editableChart.resetSlice.aria,
    tooltipText: demoText.editableChart.resetSlice.tooltip,
    onClick: resetSliceChanges,
    content: [icon('arrow-rotate-left', { size: 'lg', fixedWidth: true })]
  });
  const applySliceButton = buttonWithTooltip({
    label: demoText.editableChart.applySlice.label, ariaLabel: demoText.editableChart.applySlice.aria,
    tooltipText: demoText.editableChart.applySlice.tooltip,
    onClick: applySliceChanges,
    content: [icon('check', { size: 'lg', fixedWidth: true })]
  });
  // Icon-only at every width by design, so — like the category panel's transport
  // buttons — they carry `menuLabel` for the fold, which renders only inside a
  // menu and so leaves the desktop strip untouched.
  const playSliceButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.playSliceSequence.aria,
    menuLabel: demoText.editableChart.playSliceSequence.menuLabel,
    tooltipText: demoText.editableChart.playSliceSequence.tooltip,
    onClick: startSliceSequence,
    content: [icon('play', { size: 'lg', fixedWidth: true })]
  });
  const stopSliceButton = buttonWithTooltip({
    ariaLabel: demoText.editableChart.stopSliceSequence.aria,
    menuLabel: demoText.editableChart.stopSliceSequence.menuLabel,
    tooltipText: demoText.editableChart.stopSliceSequence.tooltip,
    onClick: stopSequence,
    content: [icon('stop', { size: 'lg', fixedWidth: true })]
  });

  const sliceLabel = el('span', { className: 'demo-label', style: 'margin-left: 5px; margin-right: 5px;' });
  const sliceIndexValue = el('span', { className: 'demo-index-value' });

  const sliceInput = el('input', { className: 'demo-input', attrs: { type: 'text' } });
  sliceInput.addEventListener('input', () => {
    sliceValueText = sliceInput.value;
    sync();
  });

  const sliceCommonToolbar = el('div', { className: 'demo-toolbar' });
  // Same split as the series panel: Reset folds out of the action group, and
  // the whole play/stop group folds out of the toolbar (moving the group itself
  // rather than emptying it, so no empty flex item is left spending a gap).
  const sliceActionButtons = [resetSliceButton.el, applySliceButton.el];
  const sliceStepGroup = el('div', { className: 'demo-btn-group' }, [nextSliceButton.el]);
  const sliceActionGroup = el('div', { className: 'demo-btn-group' }, sliceActionButtons);
  const sliceSequenceGroup = el('div', { className: 'demo-btn-group' }, [playSliceButton.el, stopSliceButton.el]);
  const sliceToolbarGroups = [sliceStepGroup, sliceActionGroup, sliceSequenceGroup];
  const sliceToolbar = el('div', { className: 'demo-toolbar' }, sliceToolbarGroups);
  const menuSliceActionGroup = el('div', { className: 'demo-btn-group' });
  // The slice menu's optional tail. Built once, and empty rather than
  // `[divider, null]` when there is no second-chart button: `setItems` drops
  // nulls but keeps dividers, so the unconditional form would rule off the
  // bottom of the panel with nothing under it — which on a phone (where the
  // second chart is never offered) is the usual case, not the corner one.
  const sliceMenuTail = (): MenuItem[] => showChartCountControls ? [menuDivider, chartCountControl] : [];
  const menuCommonControls = (): MenuItem[] => showChartCountControls ? commonControls : [modeControl];
  const sliceCommonField = el('div', { className: 'demo-field' }, [sliceCommonToolbar]);
  const sliceForm = el('form', {}, [
    sliceCommonField,
    el('div', { className: 'demo-field' }, [
      el('div', { className: 'demo-toolbar' }, [
        el('div', { className: 'demo-btn-group' }, [previousSliceButton.el])
      ])
    ]),
    el('div', { className: 'demo-field' }, [sliceLabel]),
    el('div', { className: 'demo-field' }, [sliceToolbar])
  ]);
  const slicePanel = el('div', { className: 'chart-controls-container' }, [
    el('div', { className: 'chart-controls-buttons' }, [sliceForm]),
    el('span', { className: 'chart-controls-input' }, [
      el('form', {}, [sliceInput])
    ])
  ]);

  const controls = el('div', { className: 'editable-chart-controls' }, [categoryPanel, seriesPanel, slicePanel]);
  const container = el('div', { className: 'editable-mochart-chart' }, [
    el('div', { className: 'editable-chart-container' }, [chartContentElement, controls])
  ]);

  // -------------------------------------------------------------------------
  // sync — recompute derived state and patch the DOM
  // -------------------------------------------------------------------------

  let lastChartProps: {
    width: number;
    mochartConfig: unknown;
    dataProvider: unknown;
    filteredSeriesIds: FilteredSeriesIds;
    focusedCategoryIndex: number;
    focusedValueAxisId: string | null;
    focusedSeriesId: string | null;
  } | null = null;

  /**
   * Where every shared control lives right now — the single place that moves
   * `commonControls` between the three panels' toolbars, and (on a phone) folds
   * whichever panel is showing into the overflow menu.
   *
   * Reparenting, never duplication — see OverflowMenu.ts's header.
   *
   * Only the visible panel folds. The other two are `display: none` at this
   * point, so their strips are restored unconditionally — that is also what
   * pulls their controls back out of the menu when the active panel changes
   * (switching Edit Categories → Edit Series swaps the whole item list, which
   * detaches the category panel's menu rows; the restore below re-homes them).
   */
  function placeControls(pieMode: boolean, categoryMode: boolean): void {
    chartCountControl.style.display = showChartCountControls ? '' : 'none';
    const foldCategory = isPhone && !pieMode && categoryMode;
    const foldSeries = isPhone && !pieMode && !categoryMode;
    const foldSlice = isPhone && pieMode;

    // Do this first: emptying the panel detaches whatever it was hosting, so
    // the parent-identity guards below see an honest `null` and put the
    // controls back rather than believing they are already placed.
    //
    // The slice list carries `chartCountControl` but not `modeControl`: there
    // are no category/series panels to switch to in pie mode, which is why the
    // desktop branch removes that button rather than placing it.
    overflowMenuHandle.setItems(
      foldCategory ? [menuOrderGroup, menuDivider, menuSequenceGroup, menuDivider, ...menuCommonControls()]
        : foldSeries ? [menuSeriesActionGroup, menuDivider, ...menuCommonControls()]
          : foldSlice ? [menuSliceActionGroup, menuDivider, sliceSequenceGroup, ...sliceMenuTail()]
            : []);

    // Category panel. Add/Remove act on what is typed in the input beside them, so
    // they stay in the strip; everything else folds.
    setChildren(categoryButtonGroup, foldCategory ? [addCategoriesButton.el, removeCategoriesButton.el] : categoryButtons);
    if (foldCategory) {
      setChildren(menuOrderGroup, [resetCategoriesButton.el, reverseCategoriesButton.el, selectAllButton.el]);
      setChildren(menuSequenceGroup, [playAddButton.el, playRemoveButton.el, stopButton.el]);
    }

    // Series panel. The steppers and their readouts stay — they are how a category
    // and a series get picked at all. Apply stays visible too, but moves DOWN,
    // onto the input row beside the JSON it applies: with it gone the stepper
    // row is four buttons and two readouts, which is what lets the panel hold
    // two rows even at 320x568 (five buttons wrapped it to three). Reset is the
    // one button with no partner anywhere, so it folds into the menu. The
    // emptied action group is `display: none`d by `.demo-btn-group:empty`.
    setChildren(seriesActionGroup, foldSeries ? [] : seriesActionButtons);
    setChildren(seriesInputForm, foldSeries ? [seriesInput, applySeriesButton.el] : [seriesInput]);
    if (foldSeries) {
      setChildren(menuSeriesActionGroup, [resetSeriesButton.el]);
    }
    seriesCommonField.style.display = foldSeries ? 'none' : '';
    // The readouts' own 5px side margins go too: the folded stepper row (four
    // 44px buttons plus the two compact readouts) fits 320x568's ~274px with
    // only a few pixels to spare, and the margins' 20px would wrap the ▲
    // stepper onto a second row. The phone tier's 6px field gap either side is
    // already separation enough for a two-character readout.
    //
    // Inline, because the desktop values are inline too — a stylesheet rule
    // could not win against them without `!important`. Written on every sync
    // rather than toggled, so the desktop branch always restores the exact
    // string the elements were built with.
    const indexLabelMargin = foldSeries ? '0px' : '5px';
    categoryIndexLabel.style.marginLeft = indexLabelMargin;
    categoryIndexLabel.style.marginRight = indexLabelMargin;
    seriesIndexLabel.style.marginLeft = indexLabelMargin;
    seriesIndexLabel.style.marginRight = indexLabelMargin;

    // Slice panel. Same shape: steppers, readout, Apply and the input stay; the
    // play/stop pair folds as a whole group rather than being emptied, so no
    // stray empty flex item is left behind spending a gap.
    setChildren(sliceToolbar, foldSlice ? [sliceStepGroup, sliceActionGroup] : sliceToolbarGroups);
    setChildren(sliceActionGroup, foldSlice ? [applySliceButton.el] : sliceActionButtons);
    if (foldSlice) {
      setChildren(menuSliceActionGroup, [resetSliceButton.el]);
    }
    // Hidden only while folded, never merely because it is empty: above the
    // phone tier this field is empty in pie mode whenever the second chart is
    // not on offer, and that empty field's gap is part of today's layout.
    sliceCommonField.style.display = foldSlice ? 'none' : '';

    if (pieMode) {
      modeControl.remove();
      if (!foldSlice && chartCountControl.parentElement !== sliceCommonToolbar) {
        sliceCommonToolbar.append(chartCountControl);
      }
    }
    else if (foldCategory || foldSeries) {
      // commonControls are hosted by the overflow panel; setItems put them there.
    }
    else if (categoryMode) {
      if (commonControls[0].parentElement !== categoryToolbar) {
        categoryToolbar.prepend(...commonControls);
      }
    }
    else if (commonControls[0].parentElement !== seriesCommonToolbar) {
      seriesCommonToolbar.append(...commonControls);
    }
  }

  function sync(): void {
    const chartDataError = !!(dataProvider && dataProvider.getError && dataProvider.getError());
    const configError = !mochartDemoConfig.valid;
    const error = chartDataError || configError;
    const filteredCategoryValues: readonly any[] = error || !dataProvider ? [] : dataProvider.getPropertyValues(mochartDemoConfig.mochartConfig.categoryAxis.property ?? '') ?? [];
    const selectedCategoryValues = (error || categoryValuesText === emptyCategoryText) ? [] : categoryValuesText.split(',');
    const filteredCategoryMap = filteredCategoryValues.reduce<Record<string, boolean>>((map, category) => { map[category] = true; return map; }, {});
    const disableRemove = orderChanged || !selectedCategoryValues.some(category => filteredCategoryMap[category]);
    const disableAdd = orderChanged || !selectedCategoryValues.some(category => !filteredCategoryMap[category]);
    const seriesControlsDisabled = sequencePlaying || categoryIndex === -1;
    const categoryOrderControlsDisabled = sequencePlaying || categoryIndex === -1;
    const isFirstCategory = categoryIndex === 0;
    const isLastCategory = categoryIndex === filteredCategoryValues.length - 1;
    const hasPrevSeries = seriesIndex > 0;
    const hasNextSeries = seriesIndex < mochartDemoConfig.seriesCount - 1;

    // panel visibility + common controls placement (pie mode shows only the
    // slice panel; the category/series machinery has nothing to edit there)
    const pieMode = mochartDemoConfig.pieMode;
    const categoryMode = selectionMode === 'category';
    placeControls(pieMode, categoryMode);
    categoryPanel.style.display = !pieMode && categoryMode ? '' : 'none';
    seriesPanel.style.display = !pieMode && !categoryMode ? '' : 'none';
    slicePanel.style.display = pieMode ? '' : 'none';

    // Keep the export/share menu as the last child of the visible panel (after
    // its input), so it stays pinned to the far right of the active row.
    //
    // `withPreservedFocus` because on a phone `menuSpan` carries the overflow
    // panel too, and the press that switches panels is usually made *inside* it
    // — Edit Series is one of the rows the fold puts there. Moving the span
    // detaches the button that was just pressed, which drops focus to <body>
    // and, with it, the menu controller's ability to hand focus back to the
    // trigger when it closes a moment later.
    const activePanel = pieMode ? slicePanel : categoryMode ? categoryPanel : seriesPanel;
    if (menuSpan.parentElement !== activePanel) {
      withPreservedFocus(() => activePanel.append(menuSpan));
    }

    modeButton.setLabel(categoryMode ? demoText.editableChart.editMode.labelToSeries : demoText.editableChart.editMode.labelToCategories);
    modeButton.setTooltip(categoryMode
      ? demoText.editableChart.editMode.tooltipToSeries
      : demoText.editableChart.editMode.tooltipToCategories);
    modeButton.setContent([icon(categoryMode ? 'bullseye' : 'sliders', { size: 'lg', fixedWidth: true })]);
    chartCountButton.setPressed(chartCount === 2);
    chartCountButton.setTooltip(chartCount === 2 ? demoText.editableChart.secondChart.tooltipHide : demoText.editableChart.secondChart.tooltipShow);
    chartCountButton.setContent([icon(chartCount === 2 ? 'window-maximize' : 'window-restore', { size: 'lg', fixedWidth: true })]);
    exportShareMenuHandle.setDisabled(!!error);
    overflowMenuHandle.setDisabled(!!error);

    resetCategoriesButton.setDisabled(error || sequencePlaying);
    reverseCategoriesButton.setDisabled(error || sequencePlaying);
    addCategoriesButton.setDisabled(error || sequencePlaying || disableAdd);
    removeCategoriesButton.setDisabled(error || sequencePlaying || disableRemove);
    playAddButton.setDisabled(error || sequencePlaying || disableAdd);
    playRemoveButton.setDisabled(error || sequencePlaying || disableRemove);
    stopButton.setDisabled(error || !sequencePlaying);
    selectAllButton.setDisabled(error || sequencePlaying);
    categoryInput.disabled = error || sequencePlaying;
    if (categoryInput.value !== categoryValuesText) {
      categoryInput.value = categoryValuesText;
    }

    categoryDecreaseButton.setDisabled(error || categoryOrderControlsDisabled || isFirstCategory);
    categoryIncreaseButton.setDisabled(error || categoryOrderControlsDisabled || isLastCategory);
    previousSeriesButton.setDisabled(error || seriesControlsDisabled || !hasPrevSeries);
    nextSeriesButton.setDisabled(error || seriesControlsDisabled || !hasNextSeries);
    resetSeriesButton.setDisabled(error || seriesControlsDisabled);
    applySeriesButton.setDisabled(error || seriesControlsDisabled);
    categoryIndexValue.textContent = '' + categoryIndex;
    seriesIndexValue.textContent = '' + seriesIndex;
    categoryIndexLabel.title = getCategoryIndexTitle(mochartDemoConfig, filteredData, categoryIndex);
    seriesIndexLabel.title = getSeriesIndexTitle(mochartDemoConfig, seriesIndex);
    seriesInput.disabled = error || seriesControlsDisabled;
    if (seriesInput.value !== seriesValuesText) {
      seriesInput.value = seriesValuesText;
    }

    if (pieMode) {
      const sliceControlsDisabled = error || sequencePlaying || slices.length === 0;
      previousSliceButton.setDisabled(sliceControlsDisabled || sliceIndex === 0);
      nextSliceButton.setDisabled(sliceControlsDisabled || sliceIndex >= slices.length - 1);
      resetSliceButton.setDisabled(sliceControlsDisabled);
      applySliceButton.setDisabled(sliceControlsDisabled);
      playSliceButton.setDisabled(error || sequencePlaying || slices.length < 2);
      stopSliceButton.setDisabled(error || !sequencePlaying);
      if (slices.length > 0) {
        // The index lives in its own fixed-width span so stepping slices never
        // shifts the controls to the right; the slice name is the tooltip.
        sliceLabel.textContent = demoText.editableChart.sliceIndexPrefix;
        sliceIndexValue.textContent = '' + sliceIndex;
        sliceLabel.append(sliceIndexValue);
        sliceLabel.title = slices[sliceIndex].title;
      }
      else {
        sliceLabel.textContent = demoText.editableChart.selectASliceText;
        sliceLabel.title = '';
      }
      sliceInput.disabled = sliceControlsDisabled;
      if (sliceInput.value !== sliceValueText) {
        sliceInput.value = sliceValueText;
      }
    }

    // chart props
    if (lastChartProps === null || lastChartProps.width !== width ||
        lastChartProps.mochartConfig !== mochartDemoConfig.mochartConfig ||
        lastChartProps.dataProvider !== dataProvider ||
        lastChartProps.filteredSeriesIds !== filteredSeriesIds ||
        lastChartProps.focusedCategoryIndex !== filteredFocusedCategoryIndex ||
        lastChartProps.focusedValueAxisId !== focusedValueAxisId ||
        lastChartProps.focusedSeriesId !== focusedSeriesId) {
      lastChartProps = {
        width,
        mochartConfig: mochartDemoConfig.mochartConfig,
        dataProvider,
        filteredSeriesIds,
        focusedCategoryIndex: filteredFocusedCategoryIndex,
        focusedValueAxisId,
        focusedSeriesId
      };
      chartHost.update({
        width,
        mochartConfig: mochartDemoConfig.mochartConfig,
        dataProvider,
        filteredSeriesIds,
        focusedCategoryIndex: filteredFocusedCategoryIndex,
        focusedValueAxisId,
        focusedSeriesId,
        onFocus: onChartFocus,
        onSeriesFilter,
        onChartClick,
        onSliceClick: onChartSliceClick
      });
    }
  }

  initData();

  return {
    el: container,
    update(next: EditableChartUpdate) {
      const configStructureChanged = next.mochartDemoConfig !== mochartDemoConfig &&
        hasConfigStructureChange(mochartDemoConfig.mochartConfig, next.mochartDemoConfig.mochartConfig);
      const dataChanged = next.data !== data || (next.dataError ?? false) !== dataError;
      const focusChanged = next.focusedCategoryIndex !== focusedCategoryIndex;

      width = next.width;
      mochartDemoConfig = next.mochartDemoConfig;
      data = next.data;
      dataError = next.dataError ?? false;
      chartCount = next.chartCount;
      showChartCountControls = next.showChartCountControls;
      filteredSeriesIds = next.filteredSeriesIds;
      focusedCategoryIndex = next.focusedCategoryIndex;
      focusedValueAxisId = next.focusedValueAxisId ?? null;
      focusedSeriesId = next.focusedSeriesId ?? null;

      if (dataChanged || configStructureChanged) {
        initData();
      }
      else if (focusChanged) {
        filteredFocusedCategoryIndex = getFilteredFocusedCategoryIndex(filteredData);
        sync();
      }
      else {
        sync();
      }
      if (next.isActive === false) {
        stopSequence();
      }
    },
    closeMenus() {
      overflowMenuHandle.close();
      exportShareMenuHandle.close();
    },
    destroy() {
      stopSequenceInternal();
      unwatchViewport();
      overflowMenuHandle.destroy();
      exportShareMenuHandle.destroy();
      chartHost.destroy();
    }
  };
}
