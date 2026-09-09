import React, { useState, useRef, useEffect } from 'react';
import Icon from '../misc/Icon';

import { hasConfigStructureChange, NONE, ArrayOfObjectsDataProvider } from '@mochart/core';
import type { DataProvider } from '@mochart/core';
import { Chart } from '@mochart/react';
import { exportPNG, exportSVG } from '@mochart/export';

import { applyPieSliceValue, controlsMenuPlacement, createErrorDataProvider, getChartExportOptions, getCategoryIndexTitle, getPieSequenceSteps, getPieSlices, getSeriesIndexTitle, getSeriesValuesText, demoText, parseJson } from '@mochart/demo-common';

import type { PieSliceInfo } from '@mochart/demo-common';

import ButtonWithTooltip from '../misc/ButtonWithTooltip';
import ExportShareMenu from '../misc/ExportShareMenu';
import OverflowMenu, { MenuDivider } from '../misc/OverflowMenu';
import { usePhoneViewport } from '../misc/usePhoneViewport';

import type { MochartDemoConfig, FilteredSeriesIds, FocusData } from '../../types';

const emptyCategoryText = demoText.editableChart.emptyCategoryText;

// Mutable working rows are keyed by config-driven property names, so their
// value type is intentionally loose.
type Row = Record<string, any>;

type EditableDataProvider = DataProvider;

interface FocusPayload {
  valueAxisId?: string | null;
  seriesId?: string | null;
  categoryIndex?: number;
}

interface Props {
  width: number;
  mochartDemoConfig: MochartDemoConfig;
  data: Row[];
  dataError?: string | boolean | null;
  isActive?: boolean;
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

interface EditableState {
  dataProvider: EditableDataProvider | null;
  categoryIndex: number;
  categoryValuesText: string;
  seriesIndex: number;
  seriesValuesText: string;
  selectionMode: string;
  filteredData: Row[] | null;
  sequencePlaying: boolean;
  filteredFocusedCategoryIndex: number;
  orderChanged: boolean;
  // pie-mode slice editing: slices are the series, so the category machinery has
  // nothing to operate on and a single slice panel replaces both panels
  slices: PieSliceInfo[];
  sliceIndex: number;
  sliceValueText: string;
}

function getSliceValueText(slices: PieSliceInfo[], sliceIndex: number, rows: Row[]): string {
  if (slices.length === 0 || rows.length === 0) {
    return "";
  }
  const value = rows[0][slices[sliceIndex].property];
  return value === undefined || value === null ? "" : String(value);
}

export default function EditableChart(props: Props) {
  // Keep the latest props reachable from the timer callbacks / render-phase
  // derived-state logic (the old `this.props`).
  const propsRef = useRef(props);
  propsRef.current = props;

  // Non-reactive working copies (the old instance fields).
  const chartContentRef = useRef<HTMLDivElement>(null);
  const filteredDataRef = useRef<Row[]>([]);
  const removedDataRef = useRef<Row[]>([]);
  const sequenceIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function getFilteredFocusedCategoryIndex(filteredData: Row[]): number {
    const { mochartDemoConfig, data, focusedCategoryIndex } = propsRef.current;
    let filteredFocusedCategoryIndex = -1;
    if (focusedCategoryIndex >= 0) {
      const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
      // a stale index (combined config+data update) must degrade to no focus, not throw
      const categoryValue = data[focusedCategoryIndex]?.[categoryProperty];
      const count = filteredData.length;
      for (let i = 0; i < count; i++) {
        if (filteredData[i][categoryProperty] === categoryValue) {
          filteredFocusedCategoryIndex = i;
          break;
        }
      }
    }
    return filteredFocusedCategoryIndex;
  }

  function buildFilteredState(prev: EditableState, partial: Partial<EditableState>, filteredData: Row[], removedData: Row[], resetCategoryIndex: boolean): EditableState {
    const { mochartDemoConfig, dataError } = propsRef.current;
    filteredDataRef.current = filteredData;
    removedDataRef.current = removedData;
    const next: EditableState = { ...prev, ...partial };
    if (resetCategoryIndex === true) {
      next.categoryIndex = -1;
      next.seriesValuesText = demoText.editableChart.selectACategoryText;
    }
    next.filteredFocusedCategoryIndex = dataError ? -1 : getFilteredFocusedCategoryIndex(filteredData);
    next.filteredData = filteredData;
    if (!dataError && mochartDemoConfig.mochartConfig.validation.valid) {
      next.dataProvider = new ArrayOfObjectsDataProvider(filteredData);
    }
    else if (dataError) {
      next.dataProvider = createErrorDataProvider(dataError);
    }
    else {
      next.dataProvider = null;
    }
    return next;
  }

  const updateFilteredDataState = (partial: Partial<EditableState>, filteredData: Row[], removedData: Row[], resetCategoryIndex = true) => {
    setState(prev => buildFilteredState(prev, partial, filteredData, removedData, resetCategoryIndex));
  };

  const [state, setState] = useState<EditableState>(() => {
    const { data, dataError, mochartDemoConfig } = props;
    const slices = mochartDemoConfig.pieMode ? getPieSlices(mochartDemoConfig.mochartConfig) : [];
    const base: EditableState = {
      dataProvider: null,
      categoryIndex: -1,
      categoryValuesText: "",
      seriesIndex: 0,
      seriesValuesText: "",
      selectionMode: 'category',
      filteredData: null,
      sequencePlaying: false,
      filteredFocusedCategoryIndex: -1,
      orderChanged: false,
      slices,
      sliceIndex: 0,
      sliceValueText: ""
    };
    const filteredData: Row[] = [];
    if (data && !dataError) {
      for (let i = 0; i < data.length; i++) {
        filteredData.push(Object.assign({}, data[i]));
      }
    }
    return buildFilteredState(base, {
      orderChanged: false, seriesIndex: 0, categoryValuesText: emptyCategoryText,
      sliceValueText: getSliceValueText(slices, 0, filteredData)
    }, filteredData, [], true);
  });

  function initData() {
    const { data, dataError, mochartDemoConfig } = propsRef.current;
    const filteredData: Row[] = [];
    if (data && !dataError) {
      for (let i = 0; i < data.length; i++) {
        filteredData.push(Object.assign({}, data[i]));
      }
    }
    const slices = mochartDemoConfig.pieMode ? getPieSlices(mochartDemoConfig.mochartConfig) : [];
    setState(prev => {
      const sliceIndex = prev.sliceIndex >= slices.length ? 0 : prev.sliceIndex;
      return buildFilteredState(prev, {
        orderChanged: false, seriesIndex: 0, categoryValuesText: emptyCategoryText,
        slices, sliceIndex, sliceValueText: getSliceValueText(slices, sliceIndex, filteredData)
      }, filteredData, [], true);
    });
  }

  // Reload/remap derived state when the demo config or data changes (the old
  // UNSAFE_componentWillReceiveProps behavior).
  const prevData = useRef(props.data);
  const prevDataError = useRef(props.dataError);
  const prevMochartDemoConfig = useRef(props.mochartDemoConfig);
  const prevFocusedCategoryIndex = useRef(props.focusedCategoryIndex);
  {
    const { data, dataError, mochartDemoConfig, focusedCategoryIndex } = props;
    const pd = prevData.current;
    const pde = prevDataError.current;
    const pmdc = prevMochartDemoConfig.current;
    const pfgi = prevFocusedCategoryIndex.current;
    if (pd !== data || pde !== dataError || pmdc !== mochartDemoConfig || pfgi !== focusedCategoryIndex) {
      prevData.current = data;
      prevDataError.current = dataError;
      prevMochartDemoConfig.current = mochartDemoConfig;
      prevFocusedCategoryIndex.current = focusedCategoryIndex;
      if (data !== pd || dataError !== pde ||
          (mochartDemoConfig !== pmdc && hasConfigStructureChange(pmdc.mochartConfig, mochartDemoConfig.mochartConfig))) {
        initData();
      }
      else if (focusedCategoryIndex !== pfgi) {
        setState(prev => ({ ...prev, filteredFocusedCategoryIndex: getFilteredFocusedCategoryIndex(filteredDataRef.current) }));
      }
    }
  }

  const stopSequenceInternal = () => {
    if (sequenceIdRef.current !== null) {
      clearInterval(sequenceIdRef.current);
      sequenceIdRef.current = null;
    }
  };

  const stopSequence = () => {
    stopSequenceInternal();
    setState(prev => (prev.sequencePlaying ? { ...prev, sequencePlaying: false } : prev));
  };

  // Stop any running sequence when the tab becomes inactive.
  useEffect(() => {
    if (props.isActive === false) {
      stopSequence();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.isActive]);

  // Clean up the interval on unmount.
  useEffect(() => stopSequenceInternal, []);

  const { mochartDemoConfig } = props;

  // mochart's ManagedChart reports focus with the new payload shape; adapt it
  // to the { valueAxisId, seriesId, categoryIndex } shape this demo tracks.
  const onChartFocus = ({ focusedValueAxisId, focusedSeriesId, focusedCategoryIndex }: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }) => {
    onLocalFocus({ valueAxisId: focusedValueAxisId, seriesId: focusedSeriesId, categoryIndex: focusedCategoryIndex });
  };

  const onLocalFocus = ({ valueAxisId, seriesId, categoryIndex }: FocusPayload) => {
    const { data, onFocus } = propsRef.current;
    if (categoryIndex !== undefined) {
      const filteredFocusedCategoryIndex = categoryIndex;
      let newFocusedCategoryIndex = -1;
      if (filteredFocusedCategoryIndex >= 0) {
        const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
        const filteredData = filteredDataRef.current;
        const categoryValue = filteredData[filteredFocusedCategoryIndex][categoryProperty];
        const count = data.length;
        for (let i = 0; i < count; i++) {
          if (data[i][categoryProperty] === categoryValue) {
            newFocusedCategoryIndex = i;
            break;
          }
        }
      }
      setState(prev => ({ ...prev, filteredFocusedCategoryIndex }));
      onFocus({ valueAxisId, seriesId, categoryIndex: newFocusedCategoryIndex });
    }
    else {
      onFocus({ valueAxisId, seriesId, categoryIndex });
    }
  };

  const onChartClick = ({ categoryIndex }: { categoryIndex: number }) => {
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const { filteredData, selectionMode, categoryValuesText, seriesIndex } = state;
    if (filteredData === null) {
      return;
    }
    const clickedCategoryValue = "" + filteredData[categoryIndex][categoryProperty];
    if (selectionMode === 'series') {
      const seriesValuesText = getSeriesValuesText(mochartDemoConfig, filteredData, categoryIndex, seriesIndex);
      setState(prev => ({ ...prev, categoryIndex, seriesValuesText }));
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
      setState(prev => ({ ...prev, categoryValuesText: parsedCategoryValues.length === 0 ? emptyCategoryText : parsedCategoryValues.join(',') }));
    }
  };

  const onModeToggle = () => setState(prev => ({ ...prev, selectionMode: prev.selectionMode === 'category' ? 'series' : 'category' }));

  const selectAllCategories = () => {
    const { data } = props;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const allCategoryValues: any[] = [];
    const count = data.length;
    for (let i = 0; i < count; i++) {
      allCategoryValues.push(data[i][categoryProperty]);
    }
    setState(prev => ({ ...prev, categoryValuesText: allCategoryValues.join(',') }));
  };

  const resetCategories = () => {
    const { data } = props;
    const oldFilteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryToObjectMap: Record<string, Row> = {};
    removedData.forEach(removedObject => {
      categoryToObjectMap[removedObject[categoryProperty]] = removedObject;
    });
    oldFilteredData.forEach(oldObject => {
      categoryToObjectMap[oldObject[categoryProperty]] = oldObject;
    });
    const filteredData = data.map(o => categoryToObjectMap[o[categoryProperty]]);
    updateFilteredDataState({ orderChanged: false }, filteredData, []);
  };

  const reverseCategories = () => {
    const oldFilteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    if (oldFilteredData && oldFilteredData.length > 1) {
      const filteredData = oldFilteredData.slice().reverse();
      updateFilteredDataState({ orderChanged: true }, filteredData, removedData);
    }
  };

  const decreaseCategoryOrder = () => {
    const oldFilteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    if (oldFilteredData && oldFilteredData.length > 1) {
      const { categoryIndex } = state;
      if (categoryIndex > 0) {
        const filteredData = oldFilteredData.slice();
        const temp = filteredData[categoryIndex - 1];
        filteredData[categoryIndex - 1] = filteredData[categoryIndex];
        filteredData[categoryIndex] = temp;
        updateFilteredDataState({ orderChanged: true, categoryIndex: categoryIndex - 1 }, filteredData, removedData, false);
      }
    }
  };

  const increaseCategoryOrder = () => {
    const oldFilteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    if (oldFilteredData && oldFilteredData.length > 1) {
      const { categoryIndex } = state;
      if (categoryIndex < oldFilteredData.length - 1) {
        const filteredData = oldFilteredData.slice();
        const temp = filteredData[categoryIndex + 1];
        filteredData[categoryIndex + 1] = filteredData[categoryIndex];
        filteredData[categoryIndex] = temp;
        updateFilteredDataState({ orderChanged: true, categoryIndex: categoryIndex + 1 }, filteredData, removedData, false);
      }
    }
  };

  const categoryValuesChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const categoryValuesText = event.target.value;
    setState(prev => ({ ...prev, categoryValuesText }));
  };

  const addCategories = () => {
    const { data } = props;
    const oldFilteredData = filteredDataRef.current;
    const oldRemovedData = removedDataRef.current;
    const { categoryValuesText } = state;
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
    const filteredData: Row[] = [];
    for (let i = 0, fi = 0; i < count; i++) {
      if (fi < filteredCount) {
        if (data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
          if (categoryValueToAddMap[data[i][categoryProperty]] === true) {
            filteredData.push(removedMap[data[i][categoryProperty]]);
            delete removedMap[data[i][categoryProperty]];
          }
        }
        else {
          filteredData.push(oldFilteredData[fi]);
          fi++;
        }
      }
      else if (categoryValueToAddMap[data[i][categoryProperty]] === true) {
        filteredData.push(removedMap[data[i][categoryProperty]]);
        delete removedMap[data[i][categoryProperty]];
      }
    }
    const removedData: Row[] = [];
    oldRemovedData.forEach(removedObject => {
      if (removedMap[removedObject[categoryProperty]] !== undefined) {
        removedData.push(removedMap[removedObject[categoryProperty]]);
      }
    });
    updateFilteredDataState({}, filteredData, removedData);
  };

  const removeCategories = () => {
    const oldFilteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    const { categoryValuesText } = state;
    const categoryProperty = mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = categoryValuesText === emptyCategoryText ? [] : categoryValuesText.split(",");
    const categoryValueToRemoveMap: Record<string, boolean> = {};
    categoryValuesToRemove.forEach(categoryValueToRemove => {
      categoryValueToRemoveMap[categoryValueToRemove] = true;
    });
    const count = oldFilteredData.length;
    const filteredData: Row[] = [];
    for (let i = 0; i < count; i++) {
      if (categoryValueToRemoveMap[oldFilteredData[i][categoryProperty]] !== true) {
        filteredData.push(oldFilteredData[i]);
      }
      else {
        removedData.push(oldFilteredData[i]);
      }
    }
    updateFilteredDataState({}, filteredData, removedData);
  };

  const startAddSequence = () => {
    const { data } = props;
    const oldFilteredData = filteredDataRef.current;
    const oldRemovedData = removedDataRef.current;
    const { categoryValuesText } = state;
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
      setState(prev => ({ ...prev, sequencePlaying: true }));
      let addCount = 0;
      sequenceIdRef.current = setInterval(() => {
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
  };

  const startRemoveSequence = () => {
    const { data } = props;
    const oldFilteredData = filteredDataRef.current;
    const oldRemovedData = removedDataRef.current;
    const { categoryValuesText } = state;
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
      setState(prev => ({ ...prev, sequencePlaying: true }));
      let removeCount = 0;
      sequenceIdRef.current = setInterval(() => {
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
  };

  const prevSeries = () => {
    const { categoryIndex } = state;
    const filteredData = filteredDataRef.current;
    let { seriesIndex } = state;
    if (categoryIndex !== -1 && seriesIndex > 0) {
      seriesIndex--;
      const seriesValuesText = getSeriesValuesText(mochartDemoConfig, filteredData, categoryIndex, seriesIndex);
      setState(prev => ({ ...prev, seriesIndex, seriesValuesText }));
    }
  };

  const nextSeries = () => {
    const { categoryIndex } = state;
    const filteredData = filteredDataRef.current;
    const { seriesCount } = mochartDemoConfig;
    let { seriesIndex } = state;
    if (categoryIndex !== -1 && seriesIndex < seriesCount - 1) {
      seriesIndex++;
      const seriesValuesText = getSeriesValuesText(mochartDemoConfig, filteredData, categoryIndex, seriesIndex);
      setState(prev => ({ ...prev, seriesIndex, seriesValuesText }));
    }
  };

  const seriesValuesChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const seriesValuesText = event.target.value;
    setState(prev => ({ ...prev, seriesValuesText }));
  };

  const applySeriesChanges = () => {
    const filteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    const { categoryIndex, seriesIndex, seriesValuesText } = state;
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
        // ignore invalid JSON
      }
    }
  };

  const resetSeriesChanges = () => {
    const filteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    const { data } = props;
    const { categoryIndex, seriesIndex } = state;
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
  };

  const selectSlice = (sliceIndex: number) => {
    const { slices } = state;
    if (sliceIndex >= 0 && sliceIndex < slices.length) {
      const sliceValueText = getSliceValueText(slices, sliceIndex, filteredDataRef.current);
      setState(prev => ({ ...prev, sliceIndex, sliceValueText }));
    }
  };

  const onChartSliceClick = ({ seriesId }: { seriesId: string }) => {
    selectSlice(state.slices.findIndex(slice => slice.id === seriesId));
  };

  const sliceValueChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sliceValueText = event.target.value;
    setState(prev => ({ ...prev, sliceValueText }));
  };

  const applySliceChanges = () => {
    const filteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    const { slices, sliceIndex, sliceValueText } = state;
    const value = parseFloat(sliceValueText);
    if (!isNaN(value) && isFinite(value) && filteredData.length > 0 && slices.length > 0) {
      applyPieSliceValue(filteredData[0], slices[sliceIndex].property, value);
      updateFilteredDataState({}, filteredData, removedData, false);
    }
  };

  const resetSliceChanges = () => {
    const { data } = props;
    const filteredData = filteredDataRef.current;
    const removedData = removedDataRef.current;
    const { slices, sliceIndex } = state;
    if (filteredData.length > 0 && data.length > 0 && slices.length > 0) {
      const property = slices[sliceIndex].property;
      applyPieSliceValue(filteredData[0], property, data[0][property] as number);
      updateFilteredDataState({ sliceValueText: getSliceValueText(slices, sliceIndex, filteredData) }, filteredData, removedData, false);
    }
  };

  // The pie analog of the category add/remove sequences: filter the slices one
  // at a time (via the shared legend filter, so the remaining slices re-sweep
  // and center totals count along), then restore them.
  const startSliceSequence = () => {
    const { slices } = state;
    const steps = getPieSequenceSteps(slices.map(slice => slice.id));
    if (steps.length > 0) {
      setState(prev => ({ ...prev, sequencePlaying: true }));
      let stepCount = 0;
      sequenceIdRef.current = setInterval(() => {
        propsRef.current.onSeriesFilter({ filteredSeriesIds: steps[stepCount] });
        if (stepCount < steps.length - 1) {
          stepCount++;
        }
        else {
          stopSequence();
        }
      }, 2000);
    }
  };

  // The phone fold. Which panel folds — and what each sends to the overflow
  // menu — mirrors the vanilla port's placeControls; the react expression of
  // "reparent, never duplicate" is that every control renders in exactly one
  // of the two places from the same element (see OverflowMenu.tsx).
  const isPhone = usePhoneViewport();
  const menuSpanRef = useRef<HTMLSpanElement>(null);

  const {
    width, chartCount, showChartCountControls, showShareButton, onChartCountToggle, onSeriesFilter,
    filteredSeriesIds, focusedValueAxisId, focusedSeriesId
  } = props;
  const {
    sequencePlaying, selectionMode, dataProvider, categoryValuesText, categoryIndex, seriesIndex, seriesValuesText, orderChanged,
    filteredFocusedCategoryIndex, slices, sliceIndex, sliceValueText
  } = state;

  const dataError = !!(dataProvider && dataProvider.getError && dataProvider.getError());
  const configError = !mochartDemoConfig.valid;
  const error = dataError || configError;
  const filteredCategoryValues: readonly any[] = error || !dataProvider ? [] : dataProvider.getPropertyValues(mochartDemoConfig.mochartConfig.categoryAxis.property ?? '') ?? [];
  const selectedCategoryValues = (error || categoryValuesText === emptyCategoryText) ? [] : categoryValuesText.split(',');
  const filteredCategoryMap = filteredCategoryValues.reduce<Record<string, boolean>>((map, category) => { map[category] = true; return map; }, {});
  const disableRemove = orderChanged || !selectedCategoryValues.some(category => filteredCategoryMap[category]);
  const disableAdd = orderChanged || !selectedCategoryValues.some(category => !filteredCategoryMap[category]);

  const modeControlContent = (
    <div className="demo-btn-group" key="modeControls">
      <ButtonWithTooltip label={selectionMode === 'category' ? demoText.editableChart.editMode.labelToSeries : demoText.editableChart.editMode.labelToCategories}
        tooltipText={selectionMode === 'category'
          ? demoText.editableChart.editMode.tooltipToSeries
          : demoText.editableChart.editMode.tooltipToCategories} tooltipPlacement="right"
        onClick={onModeToggle} aria-label={demoText.editableChart.editMode.aria}>
        <Icon size="lg" fixedWidth={true} name={selectionMode === 'category' ? "bullseye" : "sliders"} />
      </ButtonWithTooltip>
    </div>
  );

  const onExportPng = () => {
    const container = chartContentRef.current;
    if (container) {
      void exportPNG(container, getChartExportOptions());
    }
  };

  const onExportSvg = () => {
    const container = chartContentRef.current;
    if (container) {
      exportSVG(container, getChartExportOptions());
    }
  };

  // The export/share menu sits at the end of the controls row. Share is only
  // offered on the chart flagged for it (the first, when two are shown).
  const exportShareControlContent = (
    <ExportShareMenu key="exportShareControls" disabled={error}
      active={props.isActive !== false}
      exportPng={onExportPng} exportSvg={onExportSvg}
      getShareState={showShareButton ? () => {
        const { mochartDemoConfig, data } = propsRef.current;
        return { mode: 'single', config: mochartDemoConfig.config, data };
      } : undefined} />
  );

  const foldSlice = isPhone && mochartDemoConfig.pieMode;
  const foldCategory = isPhone && !mochartDemoConfig.pieMode && selectionMode === 'category';
  const foldSeries = isPhone && !mochartDemoConfig.pieMode && selectionMode !== 'category';

  // The strip's trailing menus, pushed to the far right of the controls row.
  // The ⋯ renders only while its panel is folded, and it lives INSIDE the
  // `.chart-controls-menu` span: the panel anchors to the whole span because
  // the export trigger sits to the ⋯'s right, so aligning to the ⋯ alone would
  // stop the panel short of the row's end and hang it off the left edge.
  const controlsMenu = (overflowChildren: React.ReactNode) => (
    <span className="chart-controls-menu" ref={menuSpanRef}>
      {overflowChildren !== null ? (
        <OverflowMenu text={demoText.overflowMenu.chart} placement={controlsMenuPlacement}
          anchorRef={menuSpanRef} disabled={error} active={props.isActive !== false}>
          {overflowChildren}
        </OverflowMenu>
      ) : null}
      {exportShareControlContent}
    </span>
  );

  const chartCountControlContent = showChartCountControls ? (
    <div className="demo-btn-group" key="chartCountControls">
      <ButtonWithTooltip label={demoText.editableChart.secondChart.label} pressed={chartCount === 2}
        tooltipText={chartCount === 2 ? demoText.editableChart.secondChart.tooltipHide : demoText.editableChart.secondChart.tooltipShow} tooltipPlacement="right"
        onClick={onChartCountToggle} aria-label={demoText.editableChart.secondChart.aria}>
        <Icon size="lg" fixedWidth={true} name={chartCount === 2 ? "window-maximize" : "window-restore"} />
      </ButtonWithTooltip>
    </div>
  ) : null;

  let commonControlContent: React.ReactNode;
  if (chartCountControlContent) {
    commonControlContent = [chartCountControlContent, modeControlContent];
  }
  else {
    commonControlContent = [modeControlContent];
  }

  let controlContent: React.ReactNode;
  if (mochartDemoConfig.pieMode) {
    // Pie-mode slice panel — replaces both panels (and the mode toggle) when
    // slices are the series: click a slice (or step prev/next) to select it,
    // edit its value, or play the filter/restore sequence.
    //
    // The fold keeps the steppers, the readout, Apply and the input; Reset and
    // the play/stop pair go to the menu, with the 2nd-chart toggle as the tail
    // (never offered on a phone, but the fold can run in a narrow window).
    const sliceControlsDisabled = error || sequencePlaying || slices.length === 0;
    const resetSliceButton = (
      <ButtonWithTooltip disabled={sliceControlsDisabled} label={demoText.editableChart.resetSlice.label}
        tooltipText={demoText.editableChart.resetSlice.tooltip} tooltipPlacement="right"
        onClick={resetSliceChanges} aria-label={demoText.editableChart.resetSlice.aria}>
        <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
      </ButtonWithTooltip>
    );
    const sliceSequenceGroup = (
      <div className="demo-btn-group">
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
    );
    controlContent = (
      <div className="chart-controls-container">
        <div className="chart-controls-buttons">
          <form>
            {foldSlice ? null : (
              // Kept on desktop even when empty — the empty field's gap is
              // part of the unfolded layout.
              <div className="demo-field">
                <div className="demo-toolbar">
                  {chartCountControlContent}
                </div>
              </div>
            )}
            <div className="demo-field">
              <div className="demo-toolbar">
                <div className="demo-btn-group">
                  <ButtonWithTooltip disabled={sliceControlsDisabled || sliceIndex === 0}
                    tooltipText={demoText.editableChart.previousSlice.tooltip} tooltipPlacement="right"
                    onClick={() => selectSlice(sliceIndex - 1)} aria-label={demoText.editableChart.previousSlice.aria}>
                    <Icon size="lg" fixedWidth={true} name="chevron-left" />
                  </ButtonWithTooltip>
                </div>
              </div>
            </div>
            <div className="demo-field">
              <span className="demo-label" style={{ marginLeft: 5, marginRight: 5 }} title={slices.length > 0 ? slices[sliceIndex].title : undefined}>
                {slices.length > 0
                  ? <>{demoText.editableChart.sliceIndexPrefix}<span className="demo-index-value">{sliceIndex}</span></>
                  : demoText.editableChart.selectASliceText}
              </span>
            </div>
            <div className="demo-field">
              <div className="demo-toolbar">
                <div className="demo-btn-group">
                  <ButtonWithTooltip disabled={sliceControlsDisabled || sliceIndex >= slices.length - 1}
                    tooltipText={demoText.editableChart.nextSlice.tooltip} tooltipPlacement="right"
                    onClick={() => selectSlice(sliceIndex + 1)} aria-label={demoText.editableChart.nextSlice.aria}>
                    <Icon size="lg" fixedWidth={true} name="chevron-right" />
                  </ButtonWithTooltip>
                </div>
                <div className="demo-btn-group">
                  {foldSlice ? null : resetSliceButton}
                  <ButtonWithTooltip disabled={sliceControlsDisabled} label={demoText.editableChart.applySlice.label}
                    tooltipText={demoText.editableChart.applySlice.tooltip} tooltipPlacement="right"
                    onClick={applySliceChanges} aria-label={demoText.editableChart.applySlice.aria}>
                    <Icon size="lg" fixedWidth={true} name="check" />
                  </ButtonWithTooltip>
                </div>
                {foldSlice ? null : sliceSequenceGroup}
              </div>
            </div>
          </form>
        </div>
        <span className="chart-controls-input">
          <form>
            <input type="text" className="demo-input" disabled={sliceControlsDisabled} value={sliceValueText} onChange={sliceValueChanged} />
          </form>
        </span>
        {controlsMenu(foldSlice ? (
          <>
            <div className="demo-btn-group">{resetSliceButton}</div>
            <MenuDivider />
            {sliceSequenceGroup}
            {chartCountControlContent !== null ? <><MenuDivider />{chartCountControlContent}</> : null}
          </>
        ) : null)}
      </div>
    );
  }
  else if (selectionMode === 'category') {
    // The fold keeps Add and Remove — they act on what is typed in the input
    // beside them — plus the input; everything else goes to the menu, split
    // into the same sections the vanilla port uses (order edits, then the
    // sequence transport, then the shared controls).
    const resetCategoriesButton = (
      <ButtonWithTooltip disabled={error || sequencePlaying} label={demoText.editableChart.resetCategories.label}
        tooltipText={demoText.editableChart.resetCategories.tooltip} tooltipPlacement="right"
        onClick={resetCategories} aria-label={demoText.editableChart.resetCategories.aria}>
        <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
      </ButtonWithTooltip>
    );
    const reverseCategoriesButton = (
      <ButtonWithTooltip disabled={error || sequencePlaying} label={demoText.editableChart.reverseCategories.label}
        tooltipText={demoText.editableChart.reverseCategories.tooltip} tooltipPlacement="right"
        onClick={reverseCategories} aria-label={demoText.editableChart.reverseCategories.aria}>
        <Icon size="lg" fixedWidth={true} name="right-left" />
      </ButtonWithTooltip>
    );
    const addCategoriesButton = (
      <ButtonWithTooltip disabled={error || sequencePlaying || disableAdd} label={demoText.editableChart.addCategories.label}
        tooltipText={demoText.editableChart.addCategories.tooltip} tooltipPlacement="right"
        onClick={addCategories} aria-label={demoText.editableChart.addCategories.aria}>
        <Icon size="lg" fixedWidth={true} name="plus" />
      </ButtonWithTooltip>
    );
    const removeCategoriesButton = (
      <ButtonWithTooltip disabled={error || sequencePlaying || disableRemove} label={demoText.editableChart.removeCategories.label}
        tooltipText={demoText.editableChart.removeCategories.tooltip} tooltipPlacement="right"
        onClick={removeCategories} aria-label={demoText.editableChart.removeCategories.aria}>
        <Icon size="lg" fixedWidth={true} name="minus" />
      </ButtonWithTooltip>
    );
    const playAddButton = (
      <ButtonWithTooltip disabled={error || sequencePlaying || disableAdd}
        menuLabel={demoText.editableChart.playAddCategories.menuLabel}
        tooltipText={demoText.editableChart.playAddCategories.tooltip} tooltipPlacement="right"
        onClick={startAddSequence} aria-label={demoText.editableChart.playAddCategories.aria}>
        <Icon size="lg" name="play" /><span style={{ paddingRight: 2 }}></span><Icon size="lg" name="plus" />
      </ButtonWithTooltip>
    );
    const playRemoveButton = (
      <ButtonWithTooltip disabled={error || sequencePlaying || disableRemove}
        menuLabel={demoText.editableChart.playRemoveCategories.menuLabel}
        tooltipText={demoText.editableChart.playRemoveCategories.tooltip} tooltipPlacement="right"
        onClick={startRemoveSequence} aria-label={demoText.editableChart.playRemoveCategories.aria}>
        <Icon size="lg" name="play" /><span style={{ paddingRight: 2 }}></span><Icon size="lg" name="minus" />
      </ButtonWithTooltip>
    );
    const stopButton = (
      <ButtonWithTooltip disabled={error || !sequencePlaying}
        menuLabel={demoText.editableChart.stopSequence.menuLabel}
        tooltipText={demoText.editableChart.stopSequence.tooltip} tooltipPlacement="right"
        onClick={stopSequence} aria-label={demoText.editableChart.stopSequence.aria}>
        <Icon size="lg" fixedWidth={true} name="stop" />
      </ButtonWithTooltip>
    );
    const selectAllButton = (
      <ButtonWithTooltip disabled={error || sequencePlaying} label={demoText.editableChart.selectAllCategories.label}
        tooltipText={demoText.editableChart.selectAllCategories.tooltip} tooltipPlacement="right"
        onClick={selectAllCategories} aria-label={demoText.editableChart.selectAllCategories.aria}>
        <Icon size="lg" fixedWidth={true} name="check-double" />
      </ButtonWithTooltip>
    );
    controlContent = (
      <div className="chart-controls-container">
        <div className="chart-controls-buttons">
          <form>
            <div className="demo-field">
              <div className="demo-toolbar">
                {foldCategory ? null : commonControlContent}
                <div className="demo-btn-group">
                  {foldCategory
                    ? <>{addCategoriesButton}{removeCategoriesButton}</>
                    : <>{resetCategoriesButton}{reverseCategoriesButton}{addCategoriesButton}{removeCategoriesButton}{playAddButton}{playRemoveButton}{stopButton}{selectAllButton}</>}
                </div>
              </div>
            </div>
          </form>
        </div>
        <span className="chart-controls-input">
          <form>
            <input type="text" className="demo-input" disabled={error || sequencePlaying} value={categoryValuesText} onChange={categoryValuesChanged} />
          </form>
        </span>
        {controlsMenu(foldCategory ? (
          <>
            <div className="demo-btn-group">{resetCategoriesButton}{reverseCategoriesButton}{selectAllButton}</div>
            <MenuDivider />
            <div className="demo-btn-group">{playAddButton}{playRemoveButton}{stopButton}</div>
            <MenuDivider />
            {commonControlContent}
          </>
        ) : null)}
      </div>
    );
  }
  else {
    const categoryIndexText = demoText.editableChart.categoryIndexPrefix;
    const seriesIndexText = demoText.editableChart.seriesIndexPrefix;
    // the index labels are fixed-width, so which category/series is selected is
    // named by the native tooltip instead
    const categoryIndexTitle = getCategoryIndexTitle(mochartDemoConfig, filteredDataRef.current, categoryIndex);
    const seriesIndexTitle = getSeriesIndexTitle(mochartDemoConfig, seriesIndex);
    const seriesControlsDisabled = sequencePlaying || categoryIndex === -1;
    const categoryOrderControlsDisabled = sequencePlaying || categoryIndex === -1;
    const isFirstCategory = categoryIndex === 0;
    const isLastCategory = categoryIndex === filteredCategoryValues.length - 1;
    const hasPrevSeries = seriesIndex > 0;
    const hasNextSeries = seriesIndex < mochartDemoConfig.seriesCount - 1;

    // The fold keeps the steppers and their readouts — they are how a category
    // and a series get picked at all. Apply stays visible too, but moves DOWN,
    // onto the input row beside the JSON it applies: with it out of the
    // stepper row the panel holds two rows even at 320x568. Reset is the one
    // button with no partner anywhere, so it folds into the menu. The readout
    // prefixes shrink to their one-letter, aria-hidden stand-ins there (the
    // full prefixes are sr-only clipped by the phone tier and keep carrying
    // the accessible name), and the labels drop their 5px side margins — the
    // phone tier's 6px field gap is separation enough, and the margins' 20px
    // would wrap the ▲ stepper onto a second row at 320px.
    const resetSeriesButton = (
      <ButtonWithTooltip disabled={error || seriesControlsDisabled} label={demoText.editableChart.resetSeries.label}
        tooltipText={demoText.editableChart.resetSeries.tooltip} tooltipPlacement="right"
        onClick={resetSeriesChanges} aria-label={demoText.editableChart.resetSeries.aria}>
        <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
      </ButtonWithTooltip>
    );
    const applySeriesButton = (
      <ButtonWithTooltip disabled={error || seriesControlsDisabled} label={demoText.editableChart.applySeries.label}
        tooltipText={demoText.editableChart.applySeries.tooltip} tooltipPlacement="right"
        onClick={applySeriesChanges} aria-label={demoText.editableChart.applySeries.aria}>
        <Icon size="lg" fixedWidth={true} name="check" />
      </ButtonWithTooltip>
    );
    const indexLabelMargin = foldSeries ? 0 : 5;
    controlContent = (
      <div className="chart-controls-container">
        <div className="chart-controls-buttons">
          <form>
            {foldSeries ? null : (
              <div className="demo-field">
                <div className="demo-toolbar">
                  {commonControlContent}
                </div>
              </div>
            )}
            <div className="demo-field">
              <div className="demo-toolbar">
                <div className="demo-btn-group">
                  <ButtonWithTooltip disabled={error || categoryOrderControlsDisabled || isFirstCategory}
                    tooltipText={demoText.editableChart.decreaseCategoryOrder.tooltip} tooltipPlacement="right"
                    onClick={decreaseCategoryOrder} aria-label={demoText.editableChart.decreaseCategoryOrder.aria}>
                    <Icon size="lg" fixedWidth={true} name="arrow-left" />
                  </ButtonWithTooltip>
                </div>
              </div>
            </div>
            <div className="demo-field">
              <span className="demo-label" style={{ marginLeft: indexLabelMargin, marginRight: indexLabelMargin }} title={categoryIndexTitle}>
                <span className="demo-label-prefix">{categoryIndexText}</span>
                <span className="demo-label-prefix-compact" aria-hidden="true">{demoText.editableChart.categoryIndexPrefixCompact}</span>
                <span className="demo-index-value">{categoryIndex}</span>
              </span>
            </div>
            <div className="demo-field">
              <div className="demo-toolbar">
                <div className="demo-btn-group">
                  <ButtonWithTooltip disabled={error || categoryOrderControlsDisabled || isLastCategory}
                    tooltipText={demoText.editableChart.increaseCategoryOrder.tooltip} tooltipPlacement="right"
                    onClick={increaseCategoryOrder} aria-label={demoText.editableChart.increaseCategoryOrder.aria}>
                    <Icon size="lg" fixedWidth={true} name="arrow-right" />
                  </ButtonWithTooltip>
                </div>
              </div>
            </div>
            <div className="demo-field">
              <div className="demo-toolbar">
                <div className="demo-btn-group">
                  <ButtonWithTooltip disabled={error || seriesControlsDisabled || !hasPrevSeries}
                    tooltipText={demoText.editableChart.previousSeries.tooltip} tooltipPlacement="right"
                    onClick={prevSeries} aria-label={demoText.editableChart.previousSeries.aria}>
                    <Icon size="lg" fixedWidth={true} name="chevron-down" />
                  </ButtonWithTooltip>
                </div>
              </div>
            </div>
            <div className="demo-field">
              <span className="demo-label" style={{ marginLeft: indexLabelMargin, marginRight: indexLabelMargin }} title={seriesIndexTitle}>
                <span className="demo-label-prefix">{seriesIndexText}</span>
                <span className="demo-label-prefix-compact" aria-hidden="true">{demoText.editableChart.seriesIndexPrefixCompact}</span>
                <span className="demo-index-value">{seriesIndex}</span>
              </span>
            </div>
            <div className="demo-field">
              <div className="demo-toolbar">
                <div className="demo-btn-group">
                  <ButtonWithTooltip disabled={error || seriesControlsDisabled || !hasNextSeries}
                    tooltipText={demoText.editableChart.nextSeries.tooltip} tooltipPlacement="right"
                    onClick={nextSeries} aria-label={demoText.editableChart.nextSeries.aria}>
                    <Icon size="lg" fixedWidth={true} name="chevron-up" />
                  </ButtonWithTooltip>
                </div>
                {foldSeries ? null : (
                  <div className="demo-btn-group">
                    {resetSeriesButton}
                    {applySeriesButton}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
        <span className="chart-controls-input">
          <form>
            <input type="text" className="demo-input" disabled={error || seriesControlsDisabled} value={seriesValuesText} onChange={seriesValuesChanged} />
            {foldSeries ? applySeriesButton : null}
          </form>
        </span>
        {controlsMenu(foldSeries ? (
          <>
            <div className="demo-btn-group">{resetSeriesButton}</div>
            <MenuDivider />
            {commonControlContent}
          </>
        ) : null)}
      </div>
    );
  }

  const { mochartConfig } = mochartDemoConfig;
  // Width comes from the parent as an explicit prop; Chart self-measures the
  // available height (the old code used a sizer HOC for the same purpose).
  // Focus/filter is controlled by the parent ChartTab so the 1–2 charts stay
  // in sync; the category index is translated into this chart's filtered-data
  // coordinates (filteredFocusedCategoryIndex).
  const chartContent = (
    <Chart style={{ flex: '1 1 auto', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
      width={width} mochartConfig={mochartConfig} dataProvider={dataProvider}
      filteredSeriesIds={filteredSeriesIds} focusedCategoryIndex={filteredFocusedCategoryIndex}
      focusedValueAxisId={focusedValueAxisId ?? null} focusedSeriesId={focusedSeriesId ?? null}
      onFocus={onChartFocus} onSeriesFilter={onSeriesFilter} onChartClick={onChartClick} onSliceClick={onChartSliceClick} />
  );

  return (
    <div className="editable-mochart-chart">
      <div className="editable-chart-container">
        <div className="editable-chart-content" ref={chartContentRef}>
          {chartContent}
        </div>
        <div className="editable-chart-controls">
          {controlContent}
        </div>
      </div>
    </div>
  );
}
