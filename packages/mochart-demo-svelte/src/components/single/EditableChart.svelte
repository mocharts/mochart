<script lang="ts">
  import { untrack, onDestroy } from 'svelte';

  import { hasConfigStructureChange, NONE, ArrayOfObjectsDataProvider } from '@mochart/core';
  import type { DataProvider } from '@mochart/core';
  import { applyPieSliceValue, controlsMenuPlacement, createErrorDataProvider, getChartExportOptions, getCategoryIndexTitle, getPieSequenceSteps, getPieSlices, getSeriesIndexTitle, getSeriesValuesText, demoText, parseJson } from '@mochart/demo-common';
  import type { PieSliceInfo } from '@mochart/demo-common';
  import { exportPNG, exportSVG } from '@mochart/export';
  import { Chart } from '@mochart/svelte';

  import type { Snippet } from 'svelte';

  import ButtonWithTooltip from '../misc/ButtonWithTooltip.svelte';
  import ExportShareMenu from '../misc/ExportShareMenu.svelte';
  import Icon from '../misc/Icon.svelte';
  import OverflowMenu from '../misc/OverflowMenu.svelte';
  import { createPhoneViewport } from '../misc/phoneViewport.svelte';

  import type { MochartDemoConfig, FilteredSeriesIds, FocusData } from '../../types';

  // Mutable working rows are keyed by config-driven property names, so their
  // value type is intentionally loose.
  type Row = Record<string, any>;

  interface Props {
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

  type EditableDataProvider = DataProvider;

  interface FocusPayload {
    valueAxisId?: string | null;
    seriesId?: string | null;
    categoryIndex?: number;
  }

  const emptyCategoryText = demoText.editableChart.emptyCategoryText;

  let {
    width,
    mochartDemoConfig,
    data,
    dataError = false,
    isActive,
    chartCount,
    showChartCountControls,
    showShareButton = false,
    filteredSeriesIds,
    focusedCategoryIndex,
    focusedValueAxisId = null,
    focusedSeriesId = null,
    onFocus,
    onSeriesFilter,
    onChartCountToggle
  }: Props = $props();

  let chartContentElement = $state<HTMLDivElement | null>(null);

  // Working copies of the demo data; mutated in place by the category/series
  // editing controls (same pattern as the react demo's instance fields). The
  // rows are raw state (never a proxy — the data provider holds the same array)
  // so the category index label's tooltip re-reads them when the set is replaced.
  let filteredData = $state.raw<Row[]>([]);
  let removedData: Row[] = [];
  let sequenceId: ReturnType<typeof setInterval> | null = null;

  let dataProvider = $state.raw<EditableDataProvider | null>(null);
  let categoryIndex = $state(-1);
  let categoryValuesText = $state("");
  let seriesIndex = $state(0);
  let seriesValuesText = $state("");
  let selectionMode = $state('category');
  let sequencePlaying = $state(false);
  // pie-mode slice editing: slices are the series, so the category machinery has
  // nothing to operate on and a single slice panel replaces both panels
  let slices = $state.raw<PieSliceInfo[]>([]);
  let sliceIndex = $state(0);
  let sliceValueText = $state("");
  let filteredFocusedCategoryIndex = $state(-1);
  let orderChanged = $state(false);

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
  ) {
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
  }

  function initData() {
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
      return "";
    }
    const value = rows[0][slices[sliceIndex].property];
    return value === undefined || value === null ? "" : String(value);
  }

  function selectSlice(nextSliceIndex: number) {
    if (nextSliceIndex >= 0 && nextSliceIndex < slices.length) {
      sliceIndex = nextSliceIndex;
      sliceValueText = getSliceValueText(filteredData);
    }
  }

  function onChartSliceClick({ seriesId }: { seriesId: string }) {
    selectSlice(slices.findIndex(slice => slice.id === seriesId));
  }

  function applySliceChanges() {
    const value = parseFloat(sliceValueText);
    if (!isNaN(value) && isFinite(value) && filteredData.length > 0 && slices.length > 0) {
      applyPieSliceValue(filteredData[0], slices[sliceIndex].property, value);
      updateFilteredDataState({}, filteredData, removedData, false);
    }
  }

  function resetSliceChanges() {
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
  function startSliceSequence() {
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
    }
  }

  initData();

  // Props intentionally seed the previous-value snapshots with their initial
  // value only; the $effect.pre below re-syncs on later prop changes.
  // svelte-ignore state_referenced_locally
  let previousData = data;
  // svelte-ignore state_referenced_locally
  let previousDataError = dataError;
  // svelte-ignore state_referenced_locally
  let previousMochartDemoConfig = mochartDemoConfig;
  // svelte-ignore state_referenced_locally
  let previousFocusedCategoryIndex = focusedCategoryIndex;
  $effect.pre(() => {
    const nextData = data;
    const nextDataError = dataError;
    const nextMochartDemoConfig = mochartDemoConfig;
    const nextFocusedCategoryIndex = focusedCategoryIndex;
    const nextIsActive = isActive;
    untrack(() => {
      if (nextData !== previousData || nextDataError !== previousDataError ||
          (nextMochartDemoConfig !== previousMochartDemoConfig &&
           hasConfigStructureChange(previousMochartDemoConfig.mochartConfig, nextMochartDemoConfig.mochartConfig))) {
        previousData = nextData;
        previousDataError = nextDataError;
        previousMochartDemoConfig = nextMochartDemoConfig;
        previousFocusedCategoryIndex = nextFocusedCategoryIndex;
        initData();
      }
      else if (nextFocusedCategoryIndex !== previousFocusedCategoryIndex) {
        previousFocusedCategoryIndex = nextFocusedCategoryIndex;
        filteredFocusedCategoryIndex = getFilteredFocusedCategoryIndex(filteredData);
      }
      previousData = nextData;
      previousDataError = nextDataError;
      previousMochartDemoConfig = nextMochartDemoConfig;
      if (nextIsActive === false) {
        stopSequence();
      }
    });
  });

  // mochart's ManagedChart reports focus with the new payload shape; adapt it
  // to the { valueAxisId, seriesId, categoryIndex } shape this demo tracks.
  function onChartFocus({ focusedValueAxisId: valueAxisId, focusedSeriesId: seriesId, focusedCategoryIndex: chartCategoryIndex }: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }) {
    onLocalFocus({ valueAxisId, seriesId, categoryIndex: chartCategoryIndex });
  }

  function onLocalFocus({ valueAxisId, seriesId, categoryIndex: nextCategoryIndex }: FocusPayload) {
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

  function onChartClick({ categoryIndex: clickedCategoryIndex }: { categoryIndex: number }) {
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const clickedCategoryValue = "" + filteredData[clickedCategoryIndex][categoryProperty];
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
  }

  function onModeToggle() {
    selectionMode = selectionMode === 'category' ? 'series' : 'category';
  }

  function selectAllCategories() {
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const allCategoryValues: any[] = [];
    const count = data.length;
    for (let i = 0; i < count; i++) {
      allCategoryValues.push(data[i][categoryProperty]);
    }
    categoryValuesText = allCategoryValues.join(',');
  }

  function resetCategories() {
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryToObjectMap: Record<string, Row> = {};
    removedData.forEach(removedObject => {
      categoryToObjectMap[removedObject[categoryProperty]] = removedObject;
    });
    filteredData.forEach(oldObject => {
      categoryToObjectMap[oldObject[categoryProperty]] = oldObject;
    });
    const nextFilteredData = data.map(o => categoryToObjectMap[o[categoryProperty]]);
    updateFilteredDataState({ orderChanged: false }, nextFilteredData, []);
  }

  function reverseCategories() {
    if (filteredData && filteredData.length > 1) {
      const nextFilteredData = filteredData.slice().reverse();
      updateFilteredDataState({ orderChanged: true }, nextFilteredData, removedData);
    }
  }

  function decreaseCategoryOrder() {
    if (filteredData && filteredData.length > 1) {
      if (categoryIndex > 0) {
        const nextFilteredData = filteredData.slice();
        const temp = nextFilteredData[categoryIndex - 1];
        nextFilteredData[categoryIndex - 1] = nextFilteredData[categoryIndex];
        nextFilteredData[categoryIndex] = temp;
        updateFilteredDataState({ orderChanged: true, categoryIndex: categoryIndex - 1 }, nextFilteredData, removedData, false);
      }
    }
  }

  function increaseCategoryOrder() {
    if (filteredData && filteredData.length > 1) {
      if (categoryIndex < filteredData.length - 1) {
        const nextFilteredData = filteredData.slice();
        const temp = nextFilteredData[categoryIndex + 1];
        nextFilteredData[categoryIndex + 1] = nextFilteredData[categoryIndex];
        nextFilteredData[categoryIndex] = temp;
        updateFilteredDataState({ orderChanged: true, categoryIndex: categoryIndex + 1 }, nextFilteredData, removedData, false);
      }
    }
  }

  function addCategories() {
    const oldFilteredData = filteredData;
    const oldRemovedData = removedData;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToAdd = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(",");
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

  function removeCategories() {
    const oldFilteredData = filteredData;
    const nextRemovedData = removedData;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(",");
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

  function startAddSequence() {
    const oldFilteredData = filteredData;
    const oldRemovedData = removedData;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToAdd = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(",");
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
    }
  }

  function startRemoveSequence() {
    const oldFilteredData = filteredData;
    const oldRemovedData = removedData;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(",");
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
    }
  }

  function stopSequence() {
    stopSequenceInternal();
    sequencePlaying = false;
  }

  function stopSequenceInternal() {
    if (sequenceId !== null) {
      clearInterval(sequenceId);
      sequenceId = null;
    }
  }

  function prevSeries() {
    if (categoryIndex !== -1 && seriesIndex > 0) {
      seriesIndex--;
      seriesValuesText = getSeriesValuesText(mochartDemoConfig, filteredData, categoryIndex, seriesIndex);
    }
  }

  function nextSeries() {
    const { seriesCount } = mochartDemoConfig;
    if (categoryIndex !== -1 && seriesIndex < seriesCount - 1) {
      seriesIndex++;
      seriesValuesText = getSeriesValuesText(mochartDemoConfig, filteredData, categoryIndex, seriesIndex);
    }
  }

  function applySeriesChanges() {
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

      }
    }
  }

  function resetSeriesChanges() {
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

  onDestroy(() => {
    stopSequenceInternal();
  });

  const chartDataError = $derived(!!(dataProvider && dataProvider.getError && dataProvider.getError()));
  const configError = $derived(!mochartDemoConfig.valid);
  const error = $derived(chartDataError || configError);
  const filteredCategoryValues = $derived<readonly any[]>(error || !dataProvider ? [] : dataProvider.getPropertyValues(mochartDemoConfig.mochartConfig.categoryAxis.property ?? '') ?? []);
  const selectedCategoryValues = $derived((error || categoryValuesText === emptyCategoryText) ? [] : categoryValuesText.split(','));
  const filteredCategoryMap = $derived(filteredCategoryValues.reduce<Record<string, boolean>>((map, category) => { map[category] = true; return map; }, {}));
  const disableRemove = $derived(orderChanged || !selectedCategoryValues.some(category => filteredCategoryMap[category]));
  const disableAdd = $derived(orderChanged || !selectedCategoryValues.some(category => !filteredCategoryMap[category]));

  const seriesControlsDisabled = $derived(sequencePlaying || categoryIndex === -1);
  const categoryOrderControlsDisabled = $derived(sequencePlaying || categoryIndex === -1);
  const isFirstCategory = $derived(categoryIndex === 0);
  const isLastCategory = $derived(categoryIndex === filteredCategoryValues.length - 1);
  const hasPrevSeries = $derived(seriesIndex > 0);
  const hasNextSeries = $derived(seriesIndex < mochartDemoConfig.seriesCount - 1);

  const sliceControlsDisabled = $derived(error || sequencePlaying || slices.length === 0);

  // The phone fold. Which panel folds — and what each sends to the overflow
  // menu — mirrors the vanilla port's placeControls; the svelte expression of
  // "reparent, never duplicate" is that every control renders in exactly one
  // of the two places from the same snippet (see OverflowMenu.svelte).
  const phone = createPhoneViewport();
  const foldSlice = $derived(phone.isPhone && mochartDemoConfig.pieMode);
  const foldCategory = $derived(phone.isPhone && !mochartDemoConfig.pieMode && selectionMode === 'category');
  const foldSeries = $derived(phone.isPhone && !mochartDemoConfig.pieMode && selectionMode !== 'category');
  // The series readouts drop their 5px side margins while folded: the phone
  // tier's 6px field gap is separation enough, and the margins' 20px would
  // wrap the ▲ stepper onto a second row at 320px.
  const indexLabelMargin = $derived(foldSeries ? 0 : 5);
  let menuSpanElement = $state<HTMLElement | null>(null);

  function onExportPng() {
    if (chartContentElement) {
      void exportPNG(chartContentElement, getChartExportOptions());
    }
  }

  function onExportSvg() {
    if (chartContentElement) {
      exportSVG(chartContentElement, getChartExportOptions());
    }
  }
</script>

{#snippet chartCountControl()}
  {#if showChartCountControls}
    <div class="demo-btn-group">
      <ButtonWithTooltip label={demoText.editableChart.secondChart.label} pressed={chartCount === 2}
                         tooltipText={chartCount === 2 ? demoText.editableChart.secondChart.tooltipHide : demoText.editableChart.secondChart.tooltipShow} tooltipPlacement="right"
                         onClick={onChartCountToggle} aria-label={demoText.editableChart.secondChart.aria}>
        <Icon size="lg" fixedWidth={true} name={chartCount === 2 ? "window-maximize" : "window-restore"} />
      </ButtonWithTooltip>
    </div>
  {/if}
{/snippet}

{#snippet commonControls()}
  {@render chartCountControl()}
  <div class="demo-btn-group">
    <ButtonWithTooltip label={selectionMode === 'category' ? demoText.editableChart.editMode.labelToSeries : demoText.editableChart.editMode.labelToCategories}
                       tooltipText={selectionMode === 'category'
                         ? demoText.editableChart.editMode.tooltipToSeries
                         : demoText.editableChart.editMode.tooltipToCategories} tooltipPlacement="right"
                       onClick={onModeToggle} aria-label={demoText.editableChart.editMode.aria}>
      <Icon size="lg" fixedWidth={true} name={selectionMode === 'category' ? "bullseye" : "sliders"} />
    </ButtonWithTooltip>
  </div>
{/snippet}

{#snippet controlsMenu(overflowItems: Snippet | null)}
  <!-- The strip's trailing menus, pushed to the far right of the controls row
       (past the category/series input). Share is only offered on the chart
       flagged for it (the first, when two are shown). The ⋯ renders only
       while its panel is folded, and it lives INSIDE the span: the panel
       anchors to the whole span because the export trigger sits to the ⋯'s
       right, so aligning to the ⋯ alone would stop the panel short of the
       row's end and hang it off the left edge. -->
  <span class="chart-controls-menu" bind:this={menuSpanElement}>
    {#if overflowItems !== null}
      <OverflowMenu text={demoText.overflowMenu.chart}
                    placement={controlsMenuPlacement}
                    getAnchor={() => menuSpanElement}
                    disabled={!!error} active={isActive}>
        {@render overflowItems()}
      </OverflowMenu>
    {/if}
    <ExportShareMenu disabled={!!error} active={isActive} exportPng={onExportPng} exportSvg={onExportSvg}
                     getShareState={showShareButton ? () => ({ mode: 'single', config: mochartDemoConfig.config, data }) : undefined} />
  </span>
{/snippet}

{#snippet resetSliceButton()}
  <ButtonWithTooltip disabled={sliceControlsDisabled} label={demoText.editableChart.resetSlice.label}
                     tooltipText={demoText.editableChart.resetSlice.tooltip} tooltipPlacement="right"
                     onClick={resetSliceChanges} aria-label={demoText.editableChart.resetSlice.aria}>
    <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
  </ButtonWithTooltip>
{/snippet}

{#snippet sliceSequenceGroup()}
  <div class="demo-btn-group">
    <ButtonWithTooltip disabled={error || sequencePlaying || slices.length < 2}
                       menuLabel={demoText.editableChart.playSliceSequence.menuLabel}
                       tooltipText={demoText.editableChart.playSliceSequence.tooltip} tooltipPlacement="right"
                       onClick={startSliceSequence} aria-label={demoText.editableChart.playSliceSequence.aria}>
      <Icon size="lg" fixedWidth={true} name="play" />
    </ButtonWithTooltip>
    <ButtonWithTooltip disabled={error || !sequencePlaying}
                       menuLabel={demoText.editableChart.stopSliceSequence.menuLabel}
                       tooltipText={demoText.editableChart.stopSliceSequence.tooltip} tooltipPlacement="right"
                       onClick={stopSequence} aria-label={demoText.editableChart.stopSliceSequence.aria}>
      <Icon size="lg" fixedWidth={true} name="stop" />
    </ButtonWithTooltip>
  </div>
{/snippet}

{#snippet sliceMenuItems()}
  <div class="demo-btn-group">{@render resetSliceButton()}</div>
  <div class="demo-menu-divider"></div>
  {@render sliceSequenceGroup()}
  {#if showChartCountControls}
    <div class="demo-menu-divider"></div>
    {@render chartCountControl()}
  {/if}
{/snippet}

{#snippet resetCategoriesButton()}
  <ButtonWithTooltip disabled={error || sequencePlaying} label={demoText.editableChart.resetCategories.label}
                     tooltipText={demoText.editableChart.resetCategories.tooltip} tooltipPlacement="right"
                     onClick={resetCategories} aria-label={demoText.editableChart.resetCategories.aria}>
    <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
  </ButtonWithTooltip>
{/snippet}

{#snippet reverseCategoriesButton()}
  <ButtonWithTooltip disabled={error || sequencePlaying} label={demoText.editableChart.reverseCategories.label}
                     tooltipText={demoText.editableChart.reverseCategories.tooltip} tooltipPlacement="right"
                     onClick={reverseCategories} aria-label={demoText.editableChart.reverseCategories.aria}>
    <Icon size="lg" fixedWidth={true} name="right-left" />
  </ButtonWithTooltip>
{/snippet}

{#snippet addCategoriesButton()}
  <ButtonWithTooltip disabled={error || sequencePlaying || disableAdd} label={demoText.editableChart.addCategories.label}
                     tooltipText={demoText.editableChart.addCategories.tooltip} tooltipPlacement="right"
                     onClick={addCategories} aria-label={demoText.editableChart.addCategories.aria}>
    <Icon size="lg" fixedWidth={true} name="plus" />
  </ButtonWithTooltip>
{/snippet}

{#snippet removeCategoriesButton()}
  <ButtonWithTooltip disabled={error || sequencePlaying || disableRemove} label={demoText.editableChart.removeCategories.label}
                     tooltipText={demoText.editableChart.removeCategories.tooltip} tooltipPlacement="right"
                     onClick={removeCategories} aria-label={demoText.editableChart.removeCategories.aria}>
    <Icon size="lg" fixedWidth={true} name="minus" />
  </ButtonWithTooltip>
{/snippet}

{#snippet playAddButton()}
  <ButtonWithTooltip disabled={error || sequencePlaying || disableAdd}
                     menuLabel={demoText.editableChart.playAddCategories.menuLabel}
                     tooltipText={demoText.editableChart.playAddCategories.tooltip} tooltipPlacement="right"
                     onClick={startAddSequence} aria-label={demoText.editableChart.playAddCategories.aria}>
    <Icon size="lg" name="play" /><span style="padding-right: 2px;"></span><Icon size="lg" name="plus" />
  </ButtonWithTooltip>
{/snippet}

{#snippet playRemoveButton()}
  <ButtonWithTooltip disabled={error || sequencePlaying || disableRemove}
                     menuLabel={demoText.editableChart.playRemoveCategories.menuLabel}
                     tooltipText={demoText.editableChart.playRemoveCategories.tooltip} tooltipPlacement="right"
                     onClick={startRemoveSequence} aria-label={demoText.editableChart.playRemoveCategories.aria}>
    <Icon size="lg" name="play" /><span style="padding-right: 2px;"></span><Icon size="lg" name="minus" />
  </ButtonWithTooltip>
{/snippet}

{#snippet stopCategoriesButton()}
  <ButtonWithTooltip disabled={error || !sequencePlaying}
                     menuLabel={demoText.editableChart.stopSequence.menuLabel}
                     tooltipText={demoText.editableChart.stopSequence.tooltip} tooltipPlacement="right"
                     onClick={stopSequence} aria-label={demoText.editableChart.stopSequence.aria}>
    <Icon size="lg" fixedWidth={true} name="stop" />
  </ButtonWithTooltip>
{/snippet}

{#snippet selectAllButton()}
  <ButtonWithTooltip disabled={error || sequencePlaying} label={demoText.editableChart.selectAllCategories.label}
                     tooltipText={demoText.editableChart.selectAllCategories.tooltip} tooltipPlacement="right"
                     onClick={selectAllCategories} aria-label={demoText.editableChart.selectAllCategories.aria}>
    <Icon size="lg" fixedWidth={true} name="check-double" />
  </ButtonWithTooltip>
{/snippet}

{#snippet categoryMenuItems()}
  <div class="demo-btn-group">{@render resetCategoriesButton()}{@render reverseCategoriesButton()}{@render selectAllButton()}</div>
  <div class="demo-menu-divider"></div>
  <div class="demo-btn-group">{@render playAddButton()}{@render playRemoveButton()}{@render stopCategoriesButton()}</div>
  <div class="demo-menu-divider"></div>
  {@render commonControls()}
{/snippet}

{#snippet resetSeriesButton()}
  <ButtonWithTooltip disabled={error || seriesControlsDisabled} label={demoText.editableChart.resetSeries.label}
                     tooltipText={demoText.editableChart.resetSeries.tooltip} tooltipPlacement="right"
                     onClick={resetSeriesChanges} aria-label={demoText.editableChart.resetSeries.aria}>
    <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
  </ButtonWithTooltip>
{/snippet}

{#snippet applySeriesButton()}
  <ButtonWithTooltip disabled={error || seriesControlsDisabled} label={demoText.editableChart.applySeries.label}
                     tooltipText={demoText.editableChart.applySeries.tooltip} tooltipPlacement="right"
                     onClick={applySeriesChanges} aria-label={demoText.editableChart.applySeries.aria}>
    <Icon size="lg" fixedWidth={true} name="check" />
  </ButtonWithTooltip>
{/snippet}

{#snippet seriesMenuItems()}
  <div class="demo-btn-group">{@render resetSeriesButton()}</div>
  <div class="demo-menu-divider"></div>
  {@render commonControls()}
{/snippet}

<div class="editable-mochart-chart">
  <div class="editable-chart-container">
    <div class="editable-chart-content" bind:this={chartContentElement}>
      <!-- ManagedChart (behind mochart-svelte's Chart) picks animated vs static
           from the config; focus/filter is controlled by the parent ChartTab so
           the 1–2 charts stay in sync, with the category index translated into
           this chart's filtered-data coordinates (filteredFocusedCategoryIndex).
           Width is explicit; height tracks the container. -->
      <Chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
             {width} mochartConfig={mochartDemoConfig.mochartConfig} {dataProvider}
             {filteredSeriesIds} focusedCategoryIndex={filteredFocusedCategoryIndex}
             focusedValueAxisId={focusedValueAxisId ?? null} focusedSeriesId={focusedSeriesId ?? null}
             onFocus={onChartFocus} {onSeriesFilter} {onChartClick} onSliceClick={onChartSliceClick} />
    </div>
    <div class="editable-chart-controls">
      {#if mochartDemoConfig.pieMode}
        <!-- Pie-mode slice panel — replaces both panels when slices are the
             series: click a slice (or step prev/next) to select it, edit its
             value, or play the filter/restore sequence. -->
        <div class="chart-controls-container">
          <div class="chart-controls-buttons">
            <form>
              {#if !foldSlice}
                <!-- Kept on desktop even when empty — the empty field's gap is
                     part of the unfolded layout. -->
                <div class="demo-field">
                  <div class="demo-toolbar">
                    {@render chartCountControl()}
                  </div>
                </div>
              {/if}
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip disabled={sliceControlsDisabled || sliceIndex === 0}
                                       tooltipText={demoText.editableChart.previousSlice.tooltip} tooltipPlacement="right"
                                       onClick={() => selectSlice(sliceIndex - 1)} aria-label={demoText.editableChart.previousSlice.aria}>
                      <Icon size="lg" fixedWidth={true} name="chevron-left" />
                    </ButtonWithTooltip>
                  </div>
                </div>
              </div>
              <div class="demo-field">
                <span class="demo-label" style="margin-left: 5px; margin-right: 5px;" title={slices.length > 0 ? slices[sliceIndex].title : undefined}>{#if slices.length > 0}{demoText.editableChart.sliceIndexPrefix}<span class="demo-index-value">{sliceIndex}</span>{:else}{demoText.editableChart.selectASliceText}{/if}</span>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip disabled={sliceControlsDisabled || sliceIndex >= slices.length - 1}
                                       tooltipText={demoText.editableChart.nextSlice.tooltip} tooltipPlacement="right"
                                       onClick={() => selectSlice(sliceIndex + 1)} aria-label={demoText.editableChart.nextSlice.aria}>
                      <Icon size="lg" fixedWidth={true} name="chevron-right" />
                    </ButtonWithTooltip>
                  </div>
                  <div class="demo-btn-group">
                    {#if !foldSlice}{@render resetSliceButton()}{/if}
                    <ButtonWithTooltip disabled={sliceControlsDisabled} label={demoText.editableChart.applySlice.label}
                                       tooltipText={demoText.editableChart.applySlice.tooltip} tooltipPlacement="right"
                                       onClick={applySliceChanges} aria-label={demoText.editableChart.applySlice.aria}>
                      <Icon size="lg" fixedWidth={true} name="check" />
                    </ButtonWithTooltip>
                  </div>
                  {#if !foldSlice}{@render sliceSequenceGroup()}{/if}
                </div>
              </div>
            </form>
          </div>
          <span class="chart-controls-input">
            <form>
              <input type="text" class="demo-input" disabled={sliceControlsDisabled} bind:value={sliceValueText} />
            </form>
          </span>
          {@render controlsMenu(foldSlice ? sliceMenuItems : null)}
        </div>
      {:else if selectionMode === 'category'}
        <!-- The fold keeps Add and Remove — they act on what is typed in the
             input beside them — plus the input; everything else goes to the
             menu, split into the same sections the vanilla port uses (order
             edits, then the sequence transport, then the shared controls). -->
        <div class="chart-controls-container">
          <div class="chart-controls-buttons">
            <form>
              <div class="demo-field">
                <div class="demo-toolbar">
                  {#if !foldCategory}{@render commonControls()}{/if}
                  <div class="demo-btn-group">
                    {#if foldCategory}
                      {@render addCategoriesButton()}{@render removeCategoriesButton()}
                    {:else}
                      {@render resetCategoriesButton()}{@render reverseCategoriesButton()}{@render addCategoriesButton()}{@render removeCategoriesButton()}{@render playAddButton()}{@render playRemoveButton()}{@render stopCategoriesButton()}{@render selectAllButton()}
                    {/if}
                  </div>
                </div>
              </div>
            </form>
          </div>
          <span class="chart-controls-input">
            <form>
              <input type="text" class="demo-input" disabled={error || sequencePlaying} bind:value={categoryValuesText} />
            </form>
          </span>
          {@render controlsMenu(foldCategory ? categoryMenuItems : null)}
        </div>
      {:else}
        <!-- The fold keeps the steppers and their readouts — they are how a
             category and a series get picked at all. Apply stays visible too, but
             moves DOWN, onto the input row beside the JSON it applies: with it
             out of the stepper row the panel holds two rows even at 320x568.
             Reset is the one button with no partner anywhere, so it folds into
             the menu. The readout prefixes shrink to their one-letter,
             aria-hidden stand-ins (the full prefixes are sr-only clipped by
             the phone tier and keep carrying the accessible name). -->
        <div class="chart-controls-container">
          <div class="chart-controls-buttons">
            <form>
              {#if !foldSeries}
                <div class="demo-field">
                  <div class="demo-toolbar">
                    {@render commonControls()}
                  </div>
                </div>
              {/if}
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip disabled={error || categoryOrderControlsDisabled || isFirstCategory}
                                       tooltipText={demoText.editableChart.decreaseCategoryOrder.tooltip} tooltipPlacement="right"
                                       onClick={decreaseCategoryOrder} aria-label={demoText.editableChart.decreaseCategoryOrder.aria}>
                      <Icon size="lg" fixedWidth={true} name="arrow-left" />
                    </ButtonWithTooltip>
                  </div>
                </div>
              </div>
              <div class="demo-field">
                <span class="demo-label" style={`margin-left: ${indexLabelMargin}px; margin-right: ${indexLabelMargin}px;`} title={getCategoryIndexTitle(mochartDemoConfig, filteredData, categoryIndex)}><span class="demo-label-prefix">{demoText.editableChart.categoryIndexPrefix}</span><span class="demo-label-prefix-compact" aria-hidden="true">{demoText.editableChart.categoryIndexPrefixCompact}</span><span class="demo-index-value">{categoryIndex}</span></span>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip disabled={error || categoryOrderControlsDisabled || isLastCategory}
                                       tooltipText={demoText.editableChart.increaseCategoryOrder.tooltip} tooltipPlacement="right"
                                       onClick={increaseCategoryOrder} aria-label={demoText.editableChart.increaseCategoryOrder.aria}>
                      <Icon size="lg" fixedWidth={true} name="arrow-right" />
                    </ButtonWithTooltip>
                  </div>
                </div>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip disabled={error || seriesControlsDisabled || !hasPrevSeries}
                                       tooltipText={demoText.editableChart.previousSeries.tooltip} tooltipPlacement="right"
                                       onClick={prevSeries} aria-label={demoText.editableChart.previousSeries.aria}>
                      <Icon size="lg" fixedWidth={true} name="chevron-down" />
                    </ButtonWithTooltip>
                  </div>
                </div>
              </div>
              <div class="demo-field">
                <span class="demo-label" style={`margin-left: ${indexLabelMargin}px; margin-right: ${indexLabelMargin}px;`} title={getSeriesIndexTitle(mochartDemoConfig, seriesIndex)}><span class="demo-label-prefix">{demoText.editableChart.seriesIndexPrefix}</span><span class="demo-label-prefix-compact" aria-hidden="true">{demoText.editableChart.seriesIndexPrefixCompact}</span><span class="demo-index-value">{seriesIndex}</span></span>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip disabled={error || seriesControlsDisabled || !hasNextSeries}
                                       tooltipText={demoText.editableChart.nextSeries.tooltip} tooltipPlacement="right"
                                       onClick={nextSeries} aria-label={demoText.editableChart.nextSeries.aria}>
                      <Icon size="lg" fixedWidth={true} name="chevron-up" />
                    </ButtonWithTooltip>
                  </div>
                  {#if !foldSeries}
                    <div class="demo-btn-group">
                      {@render resetSeriesButton()}
                      {@render applySeriesButton()}
                    </div>
                  {/if}
                </div>
              </div>
            </form>
          </div>
          <span class="chart-controls-input">
            <form>
              <input type="text" class="demo-input" disabled={error || seriesControlsDisabled} bind:value={seriesValuesText} />
              {#if foldSeries}{@render applySeriesButton()}{/if}
            </form>
          </span>
          {@render controlsMenu(foldSeries ? seriesMenuItems : null)}
        </div>
      {/if}
    </div>
  </div>
</div>
