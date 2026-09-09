<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import { hasConfigStructureChange, NONE, ArrayOfObjectsDataProvider } from '@mochart/core';
import type { DataProvider } from '@mochart/core';
import { Chart } from '@mochart/vue';
import { exportPNG, exportSVG } from '@mochart/export';

import { applyPieSliceValue, controlsMenuPlacement, createErrorDataProvider, getChartExportOptions, getCategoryIndexTitle, getPieSequenceSteps, getPieSlices, getSeriesIndexTitle, getSeriesValuesText, demoText, parseJson } from '@mochart/demo-common';
import type { PieSliceInfo, ShareState } from '@mochart/demo-common';

import ButtonWithTooltip from '../misc/ButtonWithTooltip.vue';
import ExportShareMenu from '../misc/ExportShareMenu.vue';
import Icon from '../misc/Icon.vue';
import OverflowMenu from '../misc/OverflowMenu.vue';
import { usePhoneViewport } from '../misc/usePhoneViewport';

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

const props = withDefaults(defineProps<Props>(), {
  dataError: false,
  focusedValueAxisId: null,
  focusedSeriesId: null
});

// Working copies of the demo data; mutated in place by the category/series
// editing controls (same pattern as the react demo's instance fields).
let filteredData: Row[] = [];
let removedData: Row[] = [];
let sequenceId: ReturnType<typeof setInterval> | null = null;

const dataProvider = shallowRef<EditableDataProvider | null>(null);
const chartContentElement = ref<HTMLDivElement | null>(null);
const categoryIndex = ref(-1);
const categoryValuesText = ref("");
const seriesIndex = ref(0);
const seriesValuesText = ref("");
const selectionMode = ref('category');
const sequencePlaying = ref(false);
// pie-mode slice editing: slices are the series, so the category machinery has
// nothing to operate on and a single slice panel replaces both panels
const slices = shallowRef<PieSliceInfo[]>([]);
const sliceIndex = ref(0);
const sliceValueText = ref("");
const filteredFocusedCategoryIndex = ref(-1);
const orderChanged = ref(false);

function getFilteredFocusedCategoryIndex(nextFilteredData: Row[]): number {
  let nextFilteredFocusedCategoryIndex = -1;
  if (props.focusedCategoryIndex >= 0) {
    const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
    // a stale index (combined config+data update) must degrade to no focus, not throw
    const categoryValue = props.data[props.focusedCategoryIndex]?.[categoryProperty];
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
    categoryIndex.value = -1;
    seriesValuesText.value = demoText.editableChart.selectACategoryText;
  }
  filteredFocusedCategoryIndex.value = props.dataError ? -1 : getFilteredFocusedCategoryIndex(nextFilteredData);
  if (!props.dataError && props.mochartDemoConfig.mochartConfig.validation.valid) {
    dataProvider.value = new ArrayOfObjectsDataProvider(nextFilteredData);
  }
  else if (props.dataError) {
    dataProvider.value = createErrorDataProvider(props.dataError);
  }
  else {
    dataProvider.value = null;
  }
  if (nextState.orderChanged !== undefined) {
    orderChanged.value = nextState.orderChanged;
  }
  if (nextState.categoryIndex !== undefined) {
    categoryIndex.value = nextState.categoryIndex;
  }
  if (nextState.seriesIndex !== undefined) {
    seriesIndex.value = nextState.seriesIndex;
  }
  if (nextState.categoryValuesText !== undefined) {
    categoryValuesText.value = nextState.categoryValuesText;
  }
  if (nextState.seriesValuesText !== undefined) {
    seriesValuesText.value = nextState.seriesValuesText;
  }
}

function initData() {
  const nextFilteredData = [];
  if (props.data && !props.dataError) {
    const count = props.data.length;
    for (let i = 0; i < count; i++) {
      nextFilteredData.push(Object.assign({}, props.data[i]));
    }
  }
  slices.value = props.mochartDemoConfig.pieMode ? getPieSlices(props.mochartDemoConfig.mochartConfig) : [];
  if (sliceIndex.value >= slices.value.length) {
    sliceIndex.value = 0;
  }
  sliceValueText.value = getSliceValueText(nextFilteredData);
  updateFilteredDataState({ orderChanged: false, seriesIndex: 0, categoryValuesText: emptyCategoryText }, nextFilteredData, []);
}

function getSliceValueText(rows: Row[]): string {
  if (slices.value.length === 0 || rows.length === 0) {
    return "";
  }
  const value = rows[0][slices.value[sliceIndex.value].property];
  return value === undefined || value === null ? "" : String(value);
}

function selectSlice(nextSliceIndex: number) {
  if (nextSliceIndex >= 0 && nextSliceIndex < slices.value.length) {
    sliceIndex.value = nextSliceIndex;
    sliceValueText.value = getSliceValueText(filteredData);
  }
}

function onChartSliceClick({ seriesId }: { seriesId: string }) {
  selectSlice(slices.value.findIndex(slice => slice.id === seriesId));
}

function applySliceChanges() {
  const value = parseFloat(sliceValueText.value);
  if (!isNaN(value) && isFinite(value) && filteredData.length > 0 && slices.value.length > 0) {
    applyPieSliceValue(filteredData[0], slices.value[sliceIndex.value].property, value);
    updateFilteredDataState({}, filteredData, removedData, false);
  }
}

function resetSliceChanges() {
  if (filteredData.length > 0 && props.data.length > 0 && slices.value.length > 0) {
    const property = slices.value[sliceIndex.value].property;
    applyPieSliceValue(filteredData[0], property, props.data[0][property] as number);
    sliceValueText.value = getSliceValueText(filteredData);
    updateFilteredDataState({}, filteredData, removedData, false);
  }
}

// The pie analog of the category add/remove sequences: filter the slices one
// at a time (via the shared legend filter, so the remaining slices re-sweep
// and center totals count along), then restore them.
function startSliceSequence() {
  const steps = getPieSequenceSteps(slices.value.map(slice => slice.id));
  if (steps.length > 0) {
    sequencePlaying.value = true;
    let stepCount = 0;
    sequenceId = setInterval(() => {
      props.onSeriesFilter({ filteredSeriesIds: steps[stepCount] });
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

watch(
  () => [props.data, props.dataError, props.mochartDemoConfig, props.focusedCategoryIndex, props.isActive] as const,
  ([nextData, nextDataError, nextMochartDemoConfig, nextFocusedCategoryIndex, nextIsActive],
   [previousData, previousDataError, previousMochartDemoConfig, previousFocusedCategoryIndex]) => {
    if (nextData !== previousData || nextDataError !== previousDataError ||
        (nextMochartDemoConfig !== previousMochartDemoConfig &&
         hasConfigStructureChange(previousMochartDemoConfig.mochartConfig, nextMochartDemoConfig.mochartConfig))) {
      initData();
    }
    else if (nextFocusedCategoryIndex !== previousFocusedCategoryIndex) {
      filteredFocusedCategoryIndex.value = getFilteredFocusedCategoryIndex(filteredData);
    }
    if (nextIsActive === false) {
      stopSequence();
    }
  }
);

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
      const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
      const categoryValue = filteredData[nextFilteredFocusedCategoryIndex][categoryProperty];
      const count = props.data.length;
      for (let i = 0; i < count; i++) {
        if (props.data[i][categoryProperty] === categoryValue) {
          newFocusedCategoryIndex = i;
          break;
        }
      }
    }
    filteredFocusedCategoryIndex.value = nextFilteredFocusedCategoryIndex;
    props.onFocus({ valueAxisId, seriesId, categoryIndex: newFocusedCategoryIndex });
  }
  else {
    props.onFocus({ valueAxisId, seriesId, categoryIndex: nextCategoryIndex });
  }
}

function onChartClick({ categoryIndex: clickedCategoryIndex }: { categoryIndex: number }) {
  const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
  const clickedCategoryValue = "" + filteredData[clickedCategoryIndex][categoryProperty];
  if (selectionMode.value === 'series') {
    categoryIndex.value = clickedCategoryIndex;
    seriesValuesText.value = getSeriesValuesText(props.mochartDemoConfig, filteredData, clickedCategoryIndex, seriesIndex.value);
  }
  else if (selectionMode.value === 'category') {
    const dataCategoryValues: any[] = [];
    const count = filteredData.length;
    for (let i = 0; i < count; i++) {
      dataCategoryValues.push(filteredData[i][categoryProperty]);
    }
    let parsedCategoryValues = categoryValuesText.value === emptyCategoryText ? [] : categoryValuesText.value.split(',');
    parsedCategoryValues = parsedCategoryValues.filter((parsedCategoryValue) => dataCategoryValues.indexOf(parsedCategoryValue) !== -1 || dataCategoryValues.indexOf(+parsedCategoryValue) !== -1);
    const clickedIndex = parsedCategoryValues.indexOf(clickedCategoryValue);
    if (clickedIndex === -1) {
      parsedCategoryValues = parsedCategoryValues.concat(clickedCategoryValue);
    }
    else {
      parsedCategoryValues.splice(clickedIndex, 1);
    }
    categoryValuesText.value = parsedCategoryValues.length === 0 ? emptyCategoryText : parsedCategoryValues.join(',');
  }
}

function onModeToggle() {
  selectionMode.value = selectionMode.value === 'category' ? 'series' : 'category';
}

function selectAllCategories() {
  const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
  const allCategoryValues: any[] = [];
  const count = props.data.length;
  for (let i = 0; i < count; i++) {
    allCategoryValues.push(props.data[i][categoryProperty]);
  }
  categoryValuesText.value = allCategoryValues.join(',');
}

function resetCategories() {
  const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
  const categoryToObjectMap: Record<string, Row> = {};
  removedData.forEach(removedObject => {
    categoryToObjectMap[removedObject[categoryProperty]] = removedObject;
  });
  filteredData.forEach(oldObject => {
    categoryToObjectMap[oldObject[categoryProperty]] = oldObject;
  });
  const nextFilteredData = props.data.map(o => categoryToObjectMap[o[categoryProperty]]);
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
    if (categoryIndex.value > 0) {
      const nextFilteredData = filteredData.slice();
      const temp = nextFilteredData[categoryIndex.value - 1];
      nextFilteredData[categoryIndex.value - 1] = nextFilteredData[categoryIndex.value];
      nextFilteredData[categoryIndex.value] = temp;
      updateFilteredDataState({ orderChanged: true, categoryIndex: categoryIndex.value - 1 }, nextFilteredData, removedData, false);
    }
  }
}

function increaseCategoryOrder() {
  if (filteredData && filteredData.length > 1) {
    if (categoryIndex.value < filteredData.length - 1) {
      const nextFilteredData = filteredData.slice();
      const temp = nextFilteredData[categoryIndex.value + 1];
      nextFilteredData[categoryIndex.value + 1] = nextFilteredData[categoryIndex.value];
      nextFilteredData[categoryIndex.value] = temp;
      updateFilteredDataState({ orderChanged: true, categoryIndex: categoryIndex.value + 1 }, nextFilteredData, removedData, false);
    }
  }
}

function addCategories() {
  const oldFilteredData = filteredData;
  const oldRemovedData = removedData;
  const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
  const categoryValuesToAdd = categoryValuesText.value === emptyCategoryText ? [] : categoryValuesText.value.split(",");
  const categoryValueToAddMap: Record<string, boolean> = {};
  categoryValuesToAdd.forEach(categoryValueToAdd => {
    categoryValueToAddMap[categoryValueToAdd] = true;
  });
  const removedMap: Record<string, Row> = {};
  oldRemovedData.forEach(removedObject => {
    removedMap[removedObject[categoryProperty]] = removedObject;
  });
  const count = props.data.length;
  const filteredCount = oldFilteredData.length;
  const nextFilteredData: Row[] = [];
  for (let i = 0, fi = 0; i < count; i++) {
    if (fi < filteredCount) {
      if (props.data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
        if (categoryValueToAddMap[props.data[i][categoryProperty]] === true) {
          nextFilteredData.push(removedMap[props.data[i][categoryProperty]]);
          delete removedMap[props.data[i][categoryProperty]];
        }
      }
      else {
        nextFilteredData.push(oldFilteredData[fi]);
        fi++;
      }
    }
    else if (categoryValueToAddMap[props.data[i][categoryProperty]] === true) {
      nextFilteredData.push(removedMap[props.data[i][categoryProperty]]);
      delete removedMap[props.data[i][categoryProperty]];
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
  const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
  const categoryValuesToRemove = categoryValuesText.value === emptyCategoryText ? [] : categoryValuesText.value.split(",");
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
  const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
  const categoryValuesToAdd = categoryValuesText.value === emptyCategoryText ? [] : categoryValuesText.value.split(",");
  const categoryValueToAddMap: Record<string, boolean> = {};
  categoryValuesToAdd.forEach(categoryValueToAdd => {
    categoryValueToAddMap[categoryValueToAdd] = true;
  });
  const removedIndexMap: Record<string, number> = {};
  oldRemovedData.forEach((removedObject, removedIndex) => {
    removedIndexMap[removedObject[categoryProperty]] = removedIndex;
  });
  const categoryObjectsToAdd: { removedIndex: number; dataIndex: number }[] = [];
  const count = props.data.length;
  const filteredCount = oldFilteredData.length;
  for (let i = 0, fi = 0; i < count; i++) {
    if (fi < filteredCount) {
      if (props.data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
        if (categoryValueToAddMap[props.data[i][categoryProperty]] === true) {
          categoryObjectsToAdd.push({
            removedIndex: removedIndexMap[props.data[i][categoryProperty]] - categoryObjectsToAdd.length,
            dataIndex: fi + categoryObjectsToAdd.length
          });
        }
      }
      else {
        fi++;
      }
    }
    else if (categoryValueToAddMap[props.data[i][categoryProperty]] === true) {
      categoryObjectsToAdd.push({
        removedIndex: removedIndexMap[props.data[i][categoryProperty]] - categoryObjectsToAdd.length,
        dataIndex: fi + categoryObjectsToAdd.length
      });
    }
  }
  if (categoryObjectsToAdd.length > 0) {
    sequencePlaying.value = true;
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
  const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
  const categoryValuesToRemove = categoryValuesText.value === emptyCategoryText ? [] : categoryValuesText.value.split(",");
  const categoryValueToRemoveMap: Record<string, boolean> = {};
  categoryValuesToRemove.forEach(categoryValueToRemove => {
    categoryValueToRemoveMap[categoryValueToRemove] = true;
  });
  const removedIndexMap: Record<string, number> = {};
  oldRemovedData.forEach((removedObject, removedIndex) => {
    removedIndexMap[removedObject[categoryProperty]] = removedIndex;
  });
  const categoryObjectsToRemove: { removedIndex: number; dataIndex: number }[] = [];
  const count = props.data.length;
  const filteredCount = oldFilteredData.length;
  for (let i = 0, fi = 0, ri = 0; i < count && fi < filteredCount; i++) {
    if (props.data[i][categoryProperty] === oldFilteredData[fi][categoryProperty]) {
      if (categoryValueToRemoveMap[props.data[i][categoryProperty]] === true) {
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
    sequencePlaying.value = true;
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
  sequencePlaying.value = false;
}

function stopSequenceInternal() {
  if (sequenceId !== null) {
    clearInterval(sequenceId);
    sequenceId = null;
  }
}

function prevSeries() {
  if (categoryIndex.value !== -1 && seriesIndex.value > 0) {
    seriesIndex.value--;
    seriesValuesText.value = getSeriesValuesText(props.mochartDemoConfig, filteredData, categoryIndex.value, seriesIndex.value);
  }
}

function nextSeries() {
  const { seriesCount } = props.mochartDemoConfig;
  if (categoryIndex.value !== -1 && seriesIndex.value < seriesCount - 1) {
    seriesIndex.value++;
    seriesValuesText.value = getSeriesValuesText(props.mochartDemoConfig, filteredData, categoryIndex.value, seriesIndex.value);
  }
}

function applySeriesChanges() {
  const filteredDataObject = filteredData[categoryIndex.value];
  const { mochartConfig } = props.mochartDemoConfig;
  const { series: seriesConfigs } = mochartConfig;
  if (seriesConfigs.length > 0) {
    try {
      const dataObject = parseJson(seriesValuesText.value) as Record<string, unknown>;
      const seriesConfig = seriesConfigs[seriesIndex.value];
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
  const { mochartConfig } = props.mochartDemoConfig;
  const categoryProperty = props.mochartDemoConfig.categoryProperty ?? '';
  const { series: seriesConfigs } = mochartConfig;
  if (seriesConfigs.length > 0) {
    const filteredDataObject = filteredData[categoryIndex.value];
    const filteredCategoryValue = filteredDataObject[categoryProperty];
    const count = props.data.length;
    let dataObject: Row | null = null;
    for (let i = 0; i < count; i++) {
      if (props.data[i][categoryProperty] === filteredCategoryValue) {
        dataObject = props.data[i];
      }
    }
    const seriesConfig = seriesConfigs[seriesIndex.value];
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
    updateFilteredDataState({ seriesValuesText: getSeriesValuesText(props.mochartDemoConfig, filteredData, categoryIndex.value, seriesIndex.value) }, filteredData, removedData, false);
  }
}

onBeforeUnmount(() => {
  stopSequenceInternal();
});

const chartDataError = computed(() => !!(dataProvider.value && dataProvider.value.getError && dataProvider.value.getError()));
const configError = computed(() => !props.mochartDemoConfig.valid);
const error = computed(() => chartDataError.value || configError.value);
const filteredCategoryValues = computed<readonly any[]>(() => error.value || !dataProvider.value ? [] : dataProvider.value.getPropertyValues(props.mochartDemoConfig.mochartConfig.categoryAxis.property ?? '') ?? []);
const selectedCategoryValues = computed(() => (error.value || categoryValuesText.value === emptyCategoryText) ? [] : categoryValuesText.value.split(','));
const filteredCategoryMap = computed(() => filteredCategoryValues.value.reduce<Record<string, boolean>>((map, category) => { map[category] = true; return map; }, {}));
const disableRemove = computed(() => orderChanged.value || !selectedCategoryValues.value.some(category => filteredCategoryMap.value[category]));
const disableAdd = computed(() => orderChanged.value || !selectedCategoryValues.value.some(category => !filteredCategoryMap.value[category]));

const seriesControlsDisabled = computed(() => sequencePlaying.value || categoryIndex.value === -1);
const categoryOrderControlsDisabled = computed(() => sequencePlaying.value || categoryIndex.value === -1);
const isFirstCategory = computed(() => categoryIndex.value === 0);
const isLastCategory = computed(() => categoryIndex.value === filteredCategoryValues.value.length - 1);
const hasPrevSeries = computed(() => seriesIndex.value > 0);
const hasNextSeries = computed(() => seriesIndex.value < props.mochartDemoConfig.seriesCount - 1);

// pie mode shows only the slice panel; the category/series machinery has
// nothing to edit there
const pieMode = computed(() => props.mochartDemoConfig.pieMode);
const sliceControlsDisabled = computed(() => sequencePlaying.value || slices.value.length === 0);

// The export/share menu sits at the far right of the controls row. Share is
// only offered on the chart flagged for it (the first, when two are shown).
function onExportPng() {
  const container = chartContentElement.value;
  if (container) {
    void exportPNG(container, getChartExportOptions());
  }
}

function onExportSvg() {
  const container = chartContentElement.value;
  if (container) {
    exportSVG(container, getChartExportOptions());
  }
}

function getSingleShareState(): ShareState {
  return { mode: 'single', config: props.mochartDemoConfig.config, data: props.data };
}

// ---------------------------------------------------------------------------
// The phone fold. Which panel folds — and what each sends to the overflow
// menu — mirrors the vanilla port's placeControls.
//
// SFC templates cannot render one template fragment in two alternative places,
// so every foldable control is defined ONCE below as a small functional
// component (h() is already house idiom in the vue binding) and rendered in
// exactly one of the two places — the strip above the phone tier, the overflow
// panel below it. Same contract as the other ports: no duplicate ids, no
// second accessible name, no mirrored state (see OverflowMenu.vue).
// ---------------------------------------------------------------------------
const isPhone = usePhoneViewport();
const foldSlice = computed(() => isPhone.value && pieMode.value);
const foldCategory = computed(() => isPhone.value && !pieMode.value && selectionMode.value === 'category');
const foldSeries = computed(() => isPhone.value && !pieMode.value && selectionMode.value !== 'category');
// The series readouts drop their 5px side margins while folded: the phone
// tier's 6px field gap is separation enough, and the margins' 20px would wrap
// the ▲ stepper onto a second row at 320px.
const indexLabelMargin = computed(() => (foldSeries.value ? '0px' : '5px'));
// The ⋯ anchors to the whole `.chart-controls-menu` span: the export trigger
// sits to its right, so aligning to the ⋯ alone would stop the panel short of
// the row's end and hang it off the left edge.
const menuSpanElement = ref<HTMLElement | null>(null);
const getMenuAnchor = () => menuSpanElement.value;

const iconChild = (name: string) => () => h(Icon, { size: 'lg', fixedWidth: true, name });

const ChartCountControl = () => (props.showChartCountControls
  ? h('div', { class: 'demo-btn-group' }, [
      h(ButtonWithTooltip, {
        label: demoText.editableChart.secondChart.label, pressed: props.chartCount === 2,
        tooltipText: props.chartCount === 2 ? demoText.editableChart.secondChart.tooltipHide : demoText.editableChart.secondChart.tooltipShow,
        tooltipPlacement: 'right', onClick: props.onChartCountToggle, 'aria-label': demoText.editableChart.secondChart.aria
      }, iconChild(props.chartCount === 2 ? 'window-maximize' : 'window-restore'))
    ])
  : null);

const ModeControl = () => h('div', { class: 'demo-btn-group' }, [
  h(ButtonWithTooltip, {
    label: selectionMode.value === 'category' ? demoText.editableChart.editMode.labelToSeries : demoText.editableChart.editMode.labelToCategories,
    tooltipText: selectionMode.value === 'category' ? demoText.editableChart.editMode.tooltipToSeries : demoText.editableChart.editMode.tooltipToCategories,
    tooltipPlacement: 'right', onClick: onModeToggle, 'aria-label': demoText.editableChart.editMode.aria
  }, iconChild(selectionMode.value === 'category' ? 'bullseye' : 'sliders'))
]);

const ResetSliceButton = () => h(ButtonWithTooltip, {
  disabled: error.value || sliceControlsDisabled.value, label: demoText.editableChart.resetSlice.label,
  tooltipText: demoText.editableChart.resetSlice.tooltip, tooltipPlacement: 'right',
  onClick: resetSliceChanges, 'aria-label': demoText.editableChart.resetSlice.aria
}, iconChild('arrow-rotate-left'));

const SliceSequenceCategory = () => h('div', { class: 'demo-btn-group' }, [
  h(ButtonWithTooltip, {
    disabled: error.value || sequencePlaying.value || slices.value.length < 2,
    menuLabel: demoText.editableChart.playSliceSequence.menuLabel,
    tooltipText: demoText.editableChart.playSliceSequence.tooltip, tooltipPlacement: 'right',
    onClick: startSliceSequence, 'aria-label': demoText.editableChart.playSliceSequence.aria
  }, iconChild('play')),
  h(ButtonWithTooltip, {
    disabled: error.value || !sequencePlaying.value,
    menuLabel: demoText.editableChart.stopSliceSequence.menuLabel,
    tooltipText: demoText.editableChart.stopSliceSequence.tooltip, tooltipPlacement: 'right',
    onClick: stopSequence, 'aria-label': demoText.editableChart.stopSliceSequence.aria
  }, iconChild('stop'))
]);

const ResetCategoriesButton = () => h(ButtonWithTooltip, {
  disabled: error.value || sequencePlaying.value, label: demoText.editableChart.resetCategories.label,
  tooltipText: demoText.editableChart.resetCategories.tooltip, tooltipPlacement: 'right',
  onClick: resetCategories, 'aria-label': demoText.editableChart.resetCategories.aria
}, iconChild('arrow-rotate-left'));

const ReverseCategoriesButton = () => h(ButtonWithTooltip, {
  disabled: error.value || sequencePlaying.value, label: demoText.editableChart.reverseCategories.label,
  tooltipText: demoText.editableChart.reverseCategories.tooltip, tooltipPlacement: 'right',
  onClick: reverseCategories, 'aria-label': demoText.editableChart.reverseCategories.aria
}, iconChild('right-left'));

const AddCategoriesButton = () => h(ButtonWithTooltip, {
  disabled: error.value || sequencePlaying.value || disableAdd.value, label: demoText.editableChart.addCategories.label,
  tooltipText: demoText.editableChart.addCategories.tooltip, tooltipPlacement: 'right',
  onClick: addCategories, 'aria-label': demoText.editableChart.addCategories.aria
}, iconChild('plus'));

const RemoveCategoriesButton = () => h(ButtonWithTooltip, {
  disabled: error.value || sequencePlaying.value || disableRemove.value, label: demoText.editableChart.removeCategories.label,
  tooltipText: demoText.editableChart.removeCategories.tooltip, tooltipPlacement: 'right',
  onClick: removeCategories, 'aria-label': demoText.editableChart.removeCategories.aria
}, iconChild('minus'));

const playIconPair = (second: string) => () => [
  h(Icon, { size: 'lg', name: 'play' }),
  h('span', { style: 'padding-right: 2px;' }),
  h(Icon, { size: 'lg', name: second })
];

const PlayAddButton = () => h(ButtonWithTooltip, {
  disabled: error.value || sequencePlaying.value || disableAdd.value,
  menuLabel: demoText.editableChart.playAddCategories.menuLabel,
  tooltipText: demoText.editableChart.playAddCategories.tooltip, tooltipPlacement: 'right',
  onClick: startAddSequence, 'aria-label': demoText.editableChart.playAddCategories.aria
}, playIconPair('plus'));

const PlayRemoveButton = () => h(ButtonWithTooltip, {
  disabled: error.value || sequencePlaying.value || disableRemove.value,
  menuLabel: demoText.editableChart.playRemoveCategories.menuLabel,
  tooltipText: demoText.editableChart.playRemoveCategories.tooltip, tooltipPlacement: 'right',
  onClick: startRemoveSequence, 'aria-label': demoText.editableChart.playRemoveCategories.aria
}, playIconPair('minus'));

const StopCategoriesButton = () => h(ButtonWithTooltip, {
  disabled: error.value || !sequencePlaying.value,
  menuLabel: demoText.editableChart.stopSequence.menuLabel,
  tooltipText: demoText.editableChart.stopSequence.tooltip, tooltipPlacement: 'right',
  onClick: stopSequence, 'aria-label': demoText.editableChart.stopSequence.aria
}, iconChild('stop'));

const SelectAllButton = () => h(ButtonWithTooltip, {
  disabled: error.value || sequencePlaying.value, label: demoText.editableChart.selectAllCategories.label,
  tooltipText: demoText.editableChart.selectAllCategories.tooltip, tooltipPlacement: 'right',
  onClick: selectAllCategories, 'aria-label': demoText.editableChart.selectAllCategories.aria
}, iconChild('check-double'));

const ResetSeriesButton = () => h(ButtonWithTooltip, {
  disabled: error.value || seriesControlsDisabled.value, label: demoText.editableChart.resetSeries.label,
  tooltipText: demoText.editableChart.resetSeries.tooltip, tooltipPlacement: 'right',
  onClick: resetSeriesChanges, 'aria-label': demoText.editableChart.resetSeries.aria
}, iconChild('arrow-rotate-left'));

const ApplySeriesButton = () => h(ButtonWithTooltip, {
  disabled: error.value || seriesControlsDisabled.value, label: demoText.editableChart.applySeries.label,
  tooltipText: demoText.editableChart.applySeries.tooltip, tooltipPlacement: 'right',
  onClick: applySeriesChanges, 'aria-label': demoText.editableChart.applySeries.aria
}, iconChild('check'));
</script>

<template>
  <div class="editable-mochart-chart">
    <div class="editable-chart-container">
      <div class="editable-chart-content" ref="chartContentElement">
        <!-- ManagedChart (behind mochart-vue's Chart) picks animated vs static
             from the config. Focus/filter is controlled by the parent ChartTab
             so the 1–2 charts stay in sync; the category index is translated into
             this chart's filtered-data coordinates (filteredFocusedCategoryIndex).
             Width is explicit; height tracks the container. -->
        <Chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
               :width="props.width" :mochart-config="props.mochartDemoConfig.mochartConfig" :data-provider="dataProvider"
               :filtered-series-ids="props.filteredSeriesIds" :focused-category-index="filteredFocusedCategoryIndex"
               :focused-value-axis-id="props.focusedValueAxisId ?? null" :focused-series-id="props.focusedSeriesId ?? null"
               :on-focus="onChartFocus" :on-series-filter="props.onSeriesFilter" :on-chart-click="onChartClick" :on-slice-click="onChartSliceClick" />
      </div>
      <div class="editable-chart-controls">
        <!-- Pie-mode slice panel — replaces both panels when slices are the
             series: click a slice (or step prev/next) to select it, edit its
             value, or play the filter/restore sequence. -->
        <!-- The fold keeps the steppers, the readout, Apply and the input;
             Reset and the play/stop pair go to the menu, with the 2nd-chart
             toggle as the tail. -->
        <div v-if="pieMode" class="chart-controls-container">
          <div class="chart-controls-buttons">
            <form>
              <!-- Kept on desktop even when empty — the empty field's gap is
                   part of the unfolded layout. -->
              <div v-if="!foldSlice" class="demo-field">
                <div class="demo-toolbar">
                  <ChartCountControl />
                </div>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip :disabled="error || sliceControlsDisabled || sliceIndex === 0" :tooltip-text="demoText.editableChart.previousSlice.tooltip" tooltip-placement="right"
                                       :on-click="() => selectSlice(sliceIndex - 1)" :aria-label="demoText.editableChart.previousSlice.aria">
                      <Icon size="lg" :fixed-width="true" name="chevron-left" />
                    </ButtonWithTooltip>
                  </div>
                </div>
              </div>
              <div class="demo-field">
                <span class="demo-label" style="margin-left: 5px; margin-right: 5px;" :title="slices.length > 0 ? slices[sliceIndex].title : undefined"><template v-if="slices.length > 0">{{ demoText.editableChart.sliceIndexPrefix }}<span class="demo-index-value">{{ sliceIndex }}</span></template><template v-else>{{ demoText.editableChart.selectASliceText }}</template></span>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip :disabled="error || sliceControlsDisabled || sliceIndex >= slices.length - 1" :tooltip-text="demoText.editableChart.nextSlice.tooltip" tooltip-placement="right"
                                       :on-click="() => selectSlice(sliceIndex + 1)" :aria-label="demoText.editableChart.nextSlice.aria">
                      <Icon size="lg" :fixed-width="true" name="chevron-right" />
                    </ButtonWithTooltip>
                  </div>
                  <div class="demo-btn-group">
                    <ResetSliceButton v-if="!foldSlice" />
                    <ButtonWithTooltip :disabled="error || sliceControlsDisabled" :label="demoText.editableChart.applySlice.label" :tooltip-text="demoText.editableChart.applySlice.tooltip" tooltip-placement="right"
                                       :on-click="applySliceChanges" :aria-label="demoText.editableChart.applySlice.aria">
                      <Icon size="lg" :fixed-width="true" name="check" />
                    </ButtonWithTooltip>
                  </div>
                  <SliceSequenceCategory v-if="!foldSlice" />
                </div>
              </div>
            </form>
          </div>
          <span class="chart-controls-input">
            <form>
              <input type="text" class="demo-input" :disabled="error || sliceControlsDisabled" v-model="sliceValueText" />
            </form>
          </span>
          <span class="chart-controls-menu" ref="menuSpanElement">
            <OverflowMenu v-if="foldSlice" :text="demoText.overflowMenu.chart"
                          :placement="controlsMenuPlacement"
                          :get-anchor="getMenuAnchor"
                          :disabled="error" :active="props.isActive">
              <div class="demo-btn-group"><ResetSliceButton /></div>
              <div class="demo-menu-divider"></div>
              <SliceSequenceCategory />
              <template v-if="props.showChartCountControls">
                <div class="demo-menu-divider"></div>
                <ChartCountControl />
              </template>
            </OverflowMenu>
            <ExportShareMenu :disabled="error" :active="props.isActive"
                             :export-png="onExportPng" :export-svg="onExportSvg"
                             :get-share-state="props.showShareButton ? getSingleShareState : undefined" />
          </span>
        </div>
        <!-- The fold keeps Add and Remove — they act on what is typed in the
             input beside them — plus the input; everything else goes to the
             menu, split into the same sections the vanilla port uses (order
             edits, then the sequence transport, then the shared controls). -->
        <div v-else-if="selectionMode === 'category'" class="chart-controls-container">
          <div class="chart-controls-buttons">
            <form>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <template v-if="!foldCategory">
                    <ChartCountControl />
                    <ModeControl />
                  </template>
                  <div class="demo-btn-group">
                    <template v-if="foldCategory">
                      <AddCategoriesButton />
                      <RemoveCategoriesButton />
                    </template>
                    <template v-else>
                      <ResetCategoriesButton />
                      <ReverseCategoriesButton />
                      <AddCategoriesButton />
                      <RemoveCategoriesButton />
                      <PlayAddButton />
                      <PlayRemoveButton />
                      <StopCategoriesButton />
                      <SelectAllButton />
                    </template>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <span class="chart-controls-input">
            <form>
              <input type="text" class="demo-input" :disabled="error || sequencePlaying" v-model="categoryValuesText" />
            </form>
          </span>
          <span class="chart-controls-menu" ref="menuSpanElement">
            <OverflowMenu v-if="foldCategory" :text="demoText.overflowMenu.chart"
                          :placement="controlsMenuPlacement"
                          :get-anchor="getMenuAnchor"
                          :disabled="error" :active="props.isActive">
              <div class="demo-btn-group"><ResetCategoriesButton /><ReverseCategoriesButton /><SelectAllButton /></div>
              <div class="demo-menu-divider"></div>
              <div class="demo-btn-group"><PlayAddButton /><PlayRemoveButton /><StopCategoriesButton /></div>
              <div class="demo-menu-divider"></div>
              <ChartCountControl />
              <ModeControl />
            </OverflowMenu>
            <ExportShareMenu :disabled="error" :active="props.isActive"
                             :export-png="onExportPng" :export-svg="onExportSvg"
                             :get-share-state="props.showShareButton ? getSingleShareState : undefined" />
          </span>
        </div>
        <!-- The fold keeps the steppers and their readouts — they are how a
             category and a series get picked at all. Apply stays visible too, but
             moves DOWN, onto the input row beside the JSON it applies: with it
             out of the stepper row the panel holds two rows even at 320x568.
             Reset is the one button with no partner anywhere, so it folds into
             the menu. The readout prefixes shrink to their one-letter,
             aria-hidden stand-ins (the full prefixes are sr-only clipped by
             the phone tier and keep carrying the accessible name). -->
        <div v-else class="chart-controls-container">
          <div class="chart-controls-buttons">
            <form>
              <div v-if="!foldSeries" class="demo-field">
                <div class="demo-toolbar">
                  <ChartCountControl />
                  <ModeControl />
                </div>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip :disabled="error || categoryOrderControlsDisabled || isFirstCategory" :tooltip-text="demoText.editableChart.decreaseCategoryOrder.tooltip" tooltip-placement="right"
                                       :on-click="decreaseCategoryOrder" :aria-label="demoText.editableChart.decreaseCategoryOrder.aria">
                      <Icon size="lg" :fixed-width="true" name="arrow-left" />
                    </ButtonWithTooltip>
                  </div>
                </div>
              </div>
              <div class="demo-field">
                <span class="demo-label" :style="{ marginLeft: indexLabelMargin, marginRight: indexLabelMargin }" :title="getCategoryIndexTitle(mochartDemoConfig, filteredData, categoryIndex)"><span class="demo-label-prefix">{{ demoText.editableChart.categoryIndexPrefix }}</span><span class="demo-label-prefix-compact" aria-hidden="true">{{ demoText.editableChart.categoryIndexPrefixCompact }}</span><span class="demo-index-value">{{ categoryIndex }}</span></span>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip :disabled="error || categoryOrderControlsDisabled || isLastCategory" :tooltip-text="demoText.editableChart.increaseCategoryOrder.tooltip" tooltip-placement="right"
                                       :on-click="increaseCategoryOrder" :aria-label="demoText.editableChart.increaseCategoryOrder.aria">
                      <Icon size="lg" :fixed-width="true" name="arrow-right" />
                    </ButtonWithTooltip>
                  </div>
                </div>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip :disabled="error || seriesControlsDisabled || !hasPrevSeries" :tooltip-text="demoText.editableChart.previousSeries.tooltip" tooltip-placement="right"
                                       :on-click="prevSeries" :aria-label="demoText.editableChart.previousSeries.aria">
                      <Icon size="lg" :fixed-width="true" name="chevron-down" />
                    </ButtonWithTooltip>
                  </div>
                </div>
              </div>
              <div class="demo-field">
                <span class="demo-label" :style="{ marginLeft: indexLabelMargin, marginRight: indexLabelMargin }" :title="getSeriesIndexTitle(mochartDemoConfig, seriesIndex)"><span class="demo-label-prefix">{{ demoText.editableChart.seriesIndexPrefix }}</span><span class="demo-label-prefix-compact" aria-hidden="true">{{ demoText.editableChart.seriesIndexPrefixCompact }}</span><span class="demo-index-value">{{ seriesIndex }}</span></span>
              </div>
              <div class="demo-field">
                <div class="demo-toolbar">
                  <div class="demo-btn-group">
                    <ButtonWithTooltip :disabled="error || seriesControlsDisabled || !hasNextSeries" :tooltip-text="demoText.editableChart.nextSeries.tooltip" tooltip-placement="right"
                                       :on-click="nextSeries" :aria-label="demoText.editableChart.nextSeries.aria">
                      <Icon size="lg" :fixed-width="true" name="chevron-up" />
                    </ButtonWithTooltip>
                  </div>
                  <div v-if="!foldSeries" class="demo-btn-group">
                    <ResetSeriesButton />
                    <ApplySeriesButton />
                  </div>
                </div>
              </div>
            </form>
          </div>
          <span class="chart-controls-input">
            <form>
              <input type="text" class="demo-input" :disabled="error || seriesControlsDisabled" v-model="seriesValuesText" />
              <ApplySeriesButton v-if="foldSeries" />
            </form>
          </span>
          <span class="chart-controls-menu" ref="menuSpanElement">
            <OverflowMenu v-if="foldSeries" :text="demoText.overflowMenu.chart"
                          :placement="controlsMenuPlacement"
                          :get-anchor="getMenuAnchor"
                          :disabled="error" :active="props.isActive">
              <div class="demo-btn-group"><ResetSeriesButton /></div>
              <div class="demo-menu-divider"></div>
              <ChartCountControl />
              <ModeControl />
            </OverflowMenu>
            <ExportShareMenu :disabled="error" :active="props.isActive"
                             :export-png="onExportPng" :export-svg="onExportSvg"
                             :get-share-state="props.showShareButton ? getSingleShareState : undefined" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
