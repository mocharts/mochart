import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { hasConfigStructureChange, NONE, ArrayOfObjectsDataProvider } from '@mochart/core';
import type { DataProvider } from '@mochart/core';
import { chart } from '@mochart/lit';
import type { ChartProps } from '@mochart/lit';
import { exportPNG, exportSVG } from '@mochart/export';
import { applyPieSliceValue, controlsMenuPlacement, createErrorDataProvider, getChartExportOptions, getCategoryIndexTitle, getPieSequenceSteps, getPieSlices, getSeriesIndexTitle, getSeriesValuesText, demoText, parseJson } from '@mochart/demo-common';
import type { PieSliceInfo } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { PhoneViewportController } from '../misc/PhoneViewportController';
import { buttonWithTooltip, icon } from '../misc/templates';
import '../misc/export-share-menu';
import '../misc/overflow-menu';

import type { MochartDemoConfig, FilteredSeriesIds, FocusData } from '../../types';

// Mutable working rows are keyed by config-driven property names, so their
// value type is intentionally loose.
type Row = Record<string, any>;

type EditableDataProvider = DataProvider;

interface FocusPayload {
  valueAxisId?: string | null;
  seriesId?: string | null;
  categoryIndex?: number;
}

const emptyCategoryText = demoText.editableChart.emptyCategoryText;

@customElement('editable-chart')
export class EditableChart extends LightElement {
  @property({ attribute: false }) width = 0;
  @property({ attribute: false }) mochartDemoConfig!: MochartDemoConfig;
  @property({ attribute: false }) data: Row[] = [];
  @property({ attribute: false }) dataError: string | boolean | null = false;
  @property({ attribute: false }) isActive = false;
  @property({ attribute: false }) chartCount = 1;
  @property({ attribute: false }) showChartCountControls = false;
  /** Set on the chart instance that should render the share button. */
  @property({ attribute: false }) showShareButton = false;
  @property({ attribute: false }) filteredSeriesIds: FilteredSeriesIds = {};
  @property({ attribute: false }) focusedCategoryIndex = -1;
  @property({ attribute: false }) focusedValueAxisId: string | null = null;
  @property({ attribute: false }) focusedSeriesId: string | null = null;
  @property({ attribute: false }) onFocus!: (focusData: FocusData) => void;
  @property({ attribute: false }) onSeriesFilter!: (filterData: { filteredSeriesIds: FilteredSeriesIds }) => void;
  @property({ attribute: false }) onChartCountToggle!: () => void;

  // Working copies of the demo data; mutated in place by the category/series
  // editing controls (same pattern as the react demo's instance fields).
  private filteredData: Row[] = [];
  private removedData: Row[] = [];
  private sequenceId: ReturnType<typeof setInterval> | null = null;

  @state() private dataProvider: EditableDataProvider | null = null;
  @state() private categoryIndex = -1;
  @state() private categoryValuesText = "";
  @state() private seriesIndex = 0;
  @state() private seriesValuesText = "";
  @state() private selectionMode = 'category';
  @state() private sequencePlaying = false;
  // pie-mode slice editing: slices are the series, so the category machinery has
  // nothing to operate on and a single slice panel replaces both panels
  @state() private slices: PieSliceInfo[] = [];
  @state() private sliceIndex = 0;
  @state() private sliceValueText = "";
  @state() private filteredFocusedCategoryIndex = -1;
  @state() private orderChanged = false;

  // Translate the parent's focused category index (in full-data coordinates)
  // into this chart's filtered-data coordinates by category value.
  private getFilteredFocusedCategoryIndex(nextFilteredData: Row[]): number {
    let nextFilteredFocusedCategoryIndex = -1;
    if (this.focusedCategoryIndex >= 0) {
      const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
      // a stale index (combined config+data update) must degrade to no focus, not throw
      const categoryValue = this.data[this.focusedCategoryIndex]?.[categoryProperty];
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

  private updateFilteredDataState(
    nextState: { orderChanged?: boolean; categoryIndex?: number; seriesIndex?: number; categoryValuesText?: string; seriesValuesText?: string },
    nextFilteredData: Row[],
    nextRemovedData: Row[],
    resetCategoryIndex = true
  ): void {
    this.filteredData = nextFilteredData;
    this.removedData = nextRemovedData;
    if (resetCategoryIndex === true) {
      this.categoryIndex = -1;
      this.seriesValuesText = demoText.editableChart.selectACategoryText;
    }
    this.filteredFocusedCategoryIndex = this.dataError ? -1 : this.getFilteredFocusedCategoryIndex(nextFilteredData);
    if (!this.dataError && this.mochartDemoConfig.mochartConfig.validation.valid) {
      this.dataProvider = new ArrayOfObjectsDataProvider(nextFilteredData);
    }
    else if (this.dataError) {
      this.dataProvider = createErrorDataProvider(this.dataError);
    }
    else {
      this.dataProvider = null;
    }
    if (nextState.orderChanged !== undefined) {
      this.orderChanged = nextState.orderChanged;
    }
    if (nextState.categoryIndex !== undefined) {
      this.categoryIndex = nextState.categoryIndex;
    }
    if (nextState.seriesIndex !== undefined) {
      this.seriesIndex = nextState.seriesIndex;
    }
    if (nextState.categoryValuesText !== undefined) {
      this.categoryValuesText = nextState.categoryValuesText;
    }
    if (nextState.seriesValuesText !== undefined) {
      this.seriesValuesText = nextState.seriesValuesText;
    }
  }

  private initData(): void {
    const nextFilteredData = [];
    if (this.data && !this.dataError) {
      const count = this.data.length;
      for (let i = 0; i < count; i++) {
        nextFilteredData.push(Object.assign({}, this.data[i]));
      }
    }
    this.slices = this.mochartDemoConfig.pieMode ? getPieSlices(this.mochartDemoConfig.mochartConfig) : [];
    if (this.sliceIndex >= this.slices.length) {
      this.sliceIndex = 0;
    }
    this.sliceValueText = this.getSliceValueText(nextFilteredData);
    this.updateFilteredDataState({ orderChanged: false, seriesIndex: 0, categoryValuesText: emptyCategoryText }, nextFilteredData, []);
  }

  private getSliceValueText(rows: Row[]): string {
    if (this.slices.length === 0 || rows.length === 0) {
      return "";
    }
    const value = rows[0][this.slices[this.sliceIndex].property];
    return value === undefined || value === null ? "" : String(value);
  }

  private selectSlice(nextSliceIndex: number): void {
    if (nextSliceIndex >= 0 && nextSliceIndex < this.slices.length) {
      this.sliceIndex = nextSliceIndex;
      this.sliceValueText = this.getSliceValueText(this.filteredData);
    }
  }

  private onChartSliceClick = ({ seriesId }: { seriesId: string }): void => {
    this.selectSlice(this.slices.findIndex(slice => slice.id === seriesId));
  };

  private applySliceChanges = (): void => {
    const value = parseFloat(this.sliceValueText);
    if (!isNaN(value) && isFinite(value) && this.filteredData.length > 0 && this.slices.length > 0) {
      applyPieSliceValue(this.filteredData[0], this.slices[this.sliceIndex].property, value);
      this.updateFilteredDataState({}, this.filteredData, this.removedData, false);
    }
  };

  private resetSliceChanges = (): void => {
    if (this.filteredData.length > 0 && this.data.length > 0 && this.slices.length > 0) {
      const property = this.slices[this.sliceIndex].property;
      applyPieSliceValue(this.filteredData[0], property, this.data[0][property] as number);
      this.sliceValueText = this.getSliceValueText(this.filteredData);
      this.updateFilteredDataState({}, this.filteredData, this.removedData, false);
    }
  };

  // The pie analog of the category add/remove sequences: filter the slices one
  // at a time (via the shared legend filter, so the remaining slices re-sweep
  // and center totals count along), then restore them.
  private startSliceSequence = (): void => {
    const steps = getPieSequenceSteps(this.slices.map(slice => slice.id));
    if (steps.length > 0) {
      this.sequencePlaying = true;
      let stepCount = 0;
      this.sequenceId = setInterval(() => {
        this.onSeriesFilter({ filteredSeriesIds: steps[stepCount] });
        if (stepCount < steps.length - 1) {
          stepCount++;
        }
        else {
          this.stopSequence();
        }
      }, 2000);
    }
  };

  override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      this.initData();
      return;
    }
    const previousMochartDemoConfig = changed.has('mochartDemoConfig')
      ? (changed.get('mochartDemoConfig') as MochartDemoConfig)
      : this.mochartDemoConfig;
    if (changed.has('data') || changed.has('dataError') ||
        (changed.has('mochartDemoConfig') &&
         hasConfigStructureChange(previousMochartDemoConfig.mochartConfig, this.mochartDemoConfig.mochartConfig))) {
      this.initData();
    }
    else if (changed.has('focusedCategoryIndex')) {
      this.filteredFocusedCategoryIndex = this.getFilteredFocusedCategoryIndex(this.filteredData);
    }
    if (changed.has('isActive') && this.isActive === false) {
      this.stopSequence();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopSequenceInternal();
  }

  // mochart's ManagedChart reports focus with the new payload shape; adapt it
  // to the { valueAxisId, seriesId, categoryIndex } shape this demo tracks.
  private onChartFocus = ({ focusedValueAxisId: valueAxisId, focusedSeriesId: seriesId, focusedCategoryIndex: chartCategoryIndex }: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }): void => {
    this.onLocalFocus({ valueAxisId, seriesId, categoryIndex: chartCategoryIndex });
  };

  private onLocalFocus({ valueAxisId, seriesId, categoryIndex: nextCategoryIndex }: FocusPayload): void {
    if (nextCategoryIndex !== undefined) {
      const nextFilteredFocusedCategoryIndex = nextCategoryIndex;
      let newFocusedCategoryIndex = -1;
      if (nextFilteredFocusedCategoryIndex >= 0) {
        const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
        const categoryValue = this.filteredData[nextFilteredFocusedCategoryIndex][categoryProperty];
        const count = this.data.length;
        for (let i = 0; i < count; i++) {
          if (this.data[i][categoryProperty] === categoryValue) {
            newFocusedCategoryIndex = i;
            break;
          }
        }
      }
      this.filteredFocusedCategoryIndex = nextFilteredFocusedCategoryIndex;
      this.onFocus({ valueAxisId, seriesId, categoryIndex: newFocusedCategoryIndex });
    }
    else {
      this.onFocus({ valueAxisId, seriesId, categoryIndex: nextCategoryIndex });
    }
  }

  private onChartClick = ({ categoryIndex: clickedCategoryIndex }: { categoryIndex: number }): void => {
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const clickedCategoryValue = "" + this.filteredData[clickedCategoryIndex][categoryProperty];
    if (this.selectionMode === 'series') {
      this.categoryIndex = clickedCategoryIndex;
      this.seriesValuesText = getSeriesValuesText(this.mochartDemoConfig, this.filteredData, clickedCategoryIndex, this.seriesIndex);
    }
    else if (this.selectionMode === 'category') {
      const dataCategoryValues: any[] = [];
      const count = this.filteredData.length;
      for (let i = 0; i < count; i++) {
        dataCategoryValues.push(this.filteredData[i][categoryProperty]);
      }
      let parsedCategoryValues = this.categoryValuesText === emptyCategoryText ? [] : this.categoryValuesText.split(',');
      parsedCategoryValues = parsedCategoryValues.filter((parsedCategoryValue) => dataCategoryValues.indexOf(parsedCategoryValue) !== -1 || dataCategoryValues.indexOf(+parsedCategoryValue) !== -1);
      const clickedIndex = parsedCategoryValues.indexOf(clickedCategoryValue);
      if (clickedIndex === -1) {
        parsedCategoryValues = parsedCategoryValues.concat(clickedCategoryValue);
      }
      else {
        parsedCategoryValues.splice(clickedIndex, 1);
      }
      this.categoryValuesText = parsedCategoryValues.length === 0 ? emptyCategoryText : parsedCategoryValues.join(',');
    }
  };

  private onModeToggle = (): void => {
    this.selectionMode = this.selectionMode === 'category' ? 'series' : 'category';
  };

  private selectAllCategories = (): void => {
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const allCategoryValues: any[] = [];
    const count = this.data.length;
    for (let i = 0; i < count; i++) {
      allCategoryValues.push(this.data[i][categoryProperty]);
    }
    this.categoryValuesText = allCategoryValues.join(',');
  };

  private resetCategories = (): void => {
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryToObjectMap: Record<string, Row> = {};
    this.removedData.forEach(removedObject => {
      categoryToObjectMap[removedObject[categoryProperty]] = removedObject;
    });
    this.filteredData.forEach(oldObject => {
      categoryToObjectMap[oldObject[categoryProperty]] = oldObject;
    });
    const nextFilteredData = this.data.map(o => categoryToObjectMap[o[categoryProperty]]);
    this.updateFilteredDataState({ orderChanged: false }, nextFilteredData, []);
  };

  private reverseCategories = (): void => {
    if (this.filteredData && this.filteredData.length > 1) {
      const nextFilteredData = this.filteredData.slice().reverse();
      this.updateFilteredDataState({ orderChanged: true }, nextFilteredData, this.removedData);
    }
  };

  private decreaseCategoryOrder = (): void => {
    if (this.filteredData && this.filteredData.length > 1) {
      if (this.categoryIndex > 0) {
        const nextFilteredData = this.filteredData.slice();
        const temp = nextFilteredData[this.categoryIndex - 1];
        nextFilteredData[this.categoryIndex - 1] = nextFilteredData[this.categoryIndex];
        nextFilteredData[this.categoryIndex] = temp;
        this.updateFilteredDataState({ orderChanged: true, categoryIndex: this.categoryIndex - 1 }, nextFilteredData, this.removedData, false);
      }
    }
  };

  private increaseCategoryOrder = (): void => {
    if (this.filteredData && this.filteredData.length > 1) {
      if (this.categoryIndex < this.filteredData.length - 1) {
        const nextFilteredData = this.filteredData.slice();
        const temp = nextFilteredData[this.categoryIndex + 1];
        nextFilteredData[this.categoryIndex + 1] = nextFilteredData[this.categoryIndex];
        nextFilteredData[this.categoryIndex] = temp;
        this.updateFilteredDataState({ orderChanged: true, categoryIndex: this.categoryIndex + 1 }, nextFilteredData, this.removedData, false);
      }
    }
  };

  private addCategories = (): void => {
    const oldFilteredData = this.filteredData;
    const oldRemovedData = this.removedData;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToAdd = this.categoryValuesText === emptyCategoryText ? [] : this.categoryValuesText.split(",");
    const categoryValueToAddMap: Record<string, boolean> = {};
    categoryValuesToAdd.forEach(categoryValueToAdd => {
      categoryValueToAddMap[categoryValueToAdd] = true;
    });
    const removedMap: Record<string, Row> = {};
    oldRemovedData.forEach(removedObject => {
      removedMap[removedObject[categoryProperty]] = removedObject;
    });
    const count = this.data.length;
    const filteredCount = oldFilteredData.length;
    const nextFilteredData: Row[] = [];
    for (let i = 0, fi = 0; i < count; i++) {
      if (fi < filteredCount) {
        if (this.data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
          if (categoryValueToAddMap[this.data[i][categoryProperty]] === true) {
            nextFilteredData.push(removedMap[this.data[i][categoryProperty]]);
            delete removedMap[this.data[i][categoryProperty]];
          }
        }
        else {
          nextFilteredData.push(oldFilteredData[fi]);
          fi++;
        }
      }
      else if (categoryValueToAddMap[this.data[i][categoryProperty]] === true) {
        nextFilteredData.push(removedMap[this.data[i][categoryProperty]]);
        delete removedMap[this.data[i][categoryProperty]];
      }
    }
    const nextRemovedData: Row[] = [];
    oldRemovedData.forEach(removedObject => {
      if (removedMap[removedObject[categoryProperty]] !== undefined) {
        nextRemovedData.push(removedMap[removedObject[categoryProperty]]);
      }
    });
    this.updateFilteredDataState({}, nextFilteredData, nextRemovedData);
  };

  private removeCategories = (): void => {
    const oldFilteredData = this.filteredData;
    const nextRemovedData = this.removedData;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = this.categoryValuesText === emptyCategoryText ? [] : this.categoryValuesText.split(",");
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
    this.updateFilteredDataState({}, nextFilteredData, nextRemovedData);
  };

  private startAddSequence = (): void => {
    const oldFilteredData = this.filteredData;
    const oldRemovedData = this.removedData;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToAdd = this.categoryValuesText === emptyCategoryText ? [] : this.categoryValuesText.split(",");
    const categoryValueToAddMap: Record<string, boolean> = {};
    categoryValuesToAdd.forEach(categoryValueToAdd => {
      categoryValueToAddMap[categoryValueToAdd] = true;
    });
    const removedIndexMap: Record<string, number> = {};
    oldRemovedData.forEach((removedObject, removedIndex) => {
      removedIndexMap[removedObject[categoryProperty]] = removedIndex;
    });
    const categoryObjectsToAdd: { removedIndex: number; dataIndex: number }[] = [];
    const count = this.data.length;
    const filteredCount = oldFilteredData.length;
    for (let i = 0, fi = 0; i < count; i++) {
      if (fi < filteredCount) {
        if (this.data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
          if (categoryValueToAddMap[this.data[i][categoryProperty]] === true) {
            categoryObjectsToAdd.push({
              removedIndex: removedIndexMap[this.data[i][categoryProperty]] - categoryObjectsToAdd.length,
              dataIndex: fi + categoryObjectsToAdd.length
            });
          }
        }
        else {
          fi++;
        }
      }
      else if (categoryValueToAddMap[this.data[i][categoryProperty]] === true) {
        categoryObjectsToAdd.push({
          removedIndex: removedIndexMap[this.data[i][categoryProperty]] - categoryObjectsToAdd.length,
          dataIndex: fi + categoryObjectsToAdd.length
        });
      }
    }
    if (categoryObjectsToAdd.length > 0) {
      this.sequencePlaying = true;
      let addCount = 0;
      this.sequenceId = setInterval(() => {
        oldFilteredData.splice(categoryObjectsToAdd[addCount].dataIndex, 0, oldRemovedData.splice(categoryObjectsToAdd[addCount].removedIndex, 1)[0]);
        this.updateFilteredDataState({}, oldFilteredData, oldRemovedData);
        if (addCount < categoryObjectsToAdd.length - 1) {
          addCount++;
        }
        else {
          this.stopSequence();
        }
      }, 2000);
    }
  };

  private startRemoveSequence = (): void => {
    const oldFilteredData = this.filteredData;
    const oldRemovedData = this.removedData;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = this.categoryValuesText === emptyCategoryText ? [] : this.categoryValuesText.split(",");
    const categoryValueToRemoveMap: Record<string, boolean> = {};
    categoryValuesToRemove.forEach(categoryValueToRemove => {
      categoryValueToRemoveMap[categoryValueToRemove] = true;
    });
    const removedIndexMap: Record<string, number> = {};
    oldRemovedData.forEach((removedObject, removedIndex) => {
      removedIndexMap[removedObject[categoryProperty]] = removedIndex;
    });
    const categoryObjectsToRemove: { removedIndex: number; dataIndex: number }[] = [];
    const count = this.data.length;
    const filteredCount = oldFilteredData.length;
    for (let i = 0, fi = 0, ri = 0; i < count && fi < filteredCount; i++) {
      if (this.data[i][categoryProperty] === oldFilteredData[fi][categoryProperty]) {
        if (categoryValueToRemoveMap[this.data[i][categoryProperty]] === true) {
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
      this.sequencePlaying = true;
      let removeCount = 0;
      this.sequenceId = setInterval(() => {
        oldRemovedData.splice(categoryObjectsToRemove[removeCount].removedIndex, 0, oldFilteredData.splice(categoryObjectsToRemove[removeCount].dataIndex, 1)[0]);
        this.updateFilteredDataState({}, oldFilteredData, oldRemovedData);
        if (removeCount < categoryObjectsToRemove.length - 1) {
          removeCount++;
        }
        else {
          this.stopSequence();
        }
      }, 2000);
    }
  };

  private stopSequence = (): void => {
    this.stopSequenceInternal();
    this.sequencePlaying = false;
  };

  private stopSequenceInternal(): void {
    if (this.sequenceId !== null) {
      clearInterval(this.sequenceId);
      this.sequenceId = null;
    }
  }

  private prevSeries = (): void => {
    if (this.categoryIndex !== -1 && this.seriesIndex > 0) {
      this.seriesIndex--;
      this.seriesValuesText = getSeriesValuesText(this.mochartDemoConfig, this.filteredData, this.categoryIndex, this.seriesIndex);
    }
  };

  private nextSeries = (): void => {
    const { seriesCount } = this.mochartDemoConfig;
    if (this.categoryIndex !== -1 && this.seriesIndex < seriesCount - 1) {
      this.seriesIndex++;
      this.seriesValuesText = getSeriesValuesText(this.mochartDemoConfig, this.filteredData, this.categoryIndex, this.seriesIndex);
    }
  };

  private applySeriesChanges = (): void => {
    const filteredDataObject = this.filteredData[this.categoryIndex];
    const { mochartConfig } = this.mochartDemoConfig;
    const { series: seriesConfigs } = mochartConfig;
    if (seriesConfigs.length > 0) {
      try {
        const dataObject = parseJson(this.seriesValuesText) as Record<string, unknown>;
        const seriesConfig = seriesConfigs[this.seriesIndex];
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
        this.updateFilteredDataState({}, this.filteredData, this.removedData, false);
      }
      catch {

      }
    }
  };

  private resetSeriesChanges = (): void => {
    const { mochartConfig } = this.mochartDemoConfig;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const { series: seriesConfigs } = mochartConfig;
    if (seriesConfigs.length > 0) {
      const filteredDataObject = this.filteredData[this.categoryIndex];
      const filteredCategoryValue = filteredDataObject[categoryProperty];
      const count = this.data.length;
      let dataObject: Row | null = null;
      for (let i = 0; i < count; i++) {
        if (this.data[i][categoryProperty] === filteredCategoryValue) {
          dataObject = this.data[i];
        }
      }
      const seriesConfig = seriesConfigs[this.seriesIndex];
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
      this.updateFilteredDataState({ seriesValuesText: getSeriesValuesText(this.mochartDemoConfig, this.filteredData, this.categoryIndex, this.seriesIndex) }, this.filteredData, this.removedData, false);
    }
  };

  private renderChartCountControls(): unknown {
    if (!this.showChartCountControls) {
      return nothing;
    }
    return html`<div class="demo-btn-group">
      ${buttonWithTooltip(
        { label: demoText.editableChart.secondChart.label, pressed: this.chartCount === 2, tooltipText: this.chartCount === 2 ? demoText.editableChart.secondChart.tooltipHide : demoText.editableChart.secondChart.tooltipShow, tooltipPlacement: 'right', onClick: this.onChartCountToggle, ariaLabel: demoText.editableChart.secondChart.aria },
        icon({ size: 'lg', fixedWidth: true, name: this.chartCount === 2 ? 'window-maximize' : 'window-restore' })
      )}
    </div>`;
  }

  private renderModeToggle(): unknown {
    return html`<div class="demo-btn-group">
      ${buttonWithTooltip(
        { label: this.selectionMode === 'category' ? demoText.editableChart.editMode.labelToSeries : demoText.editableChart.editMode.labelToCategories, tooltipText: this.selectionMode === 'category' ? demoText.editableChart.editMode.tooltipToSeries : demoText.editableChart.editMode.tooltipToCategories, tooltipPlacement: 'right', onClick: this.onModeToggle, ariaLabel: demoText.editableChart.editMode.aria },
        icon({ size: 'lg', fixedWidth: true, name: this.selectionMode === 'category' ? 'bullseye' : 'sliders' })
      )}
    </div>`;
  }

  // ------------------------------------------------------------------------
  // The phone fold. Which panel folds — and what each sends to the overflow
  // menu — mirrors the vanilla port's placeControls. Every foldable control is
  // a render method below, called from exactly one of the two places (the
  // strip or the panel), never both.
  // ------------------------------------------------------------------------
  private viewport = new PhoneViewportController(this);

  private get foldSlice(): boolean {
    return this.viewport.isPhone && this.mochartDemoConfig.pieMode;
  }

  private get foldCategory(): boolean {
    return this.viewport.isPhone && !this.mochartDemoConfig.pieMode && this.selectionMode === 'category';
  }

  private get foldSeries(): boolean {
    return this.viewport.isPhone && !this.mochartDemoConfig.pieMode && this.selectionMode !== 'category';
  }

  /**
   * The series readouts drop their 5px side margins while folded: the phone
   * tier's 6px field gap is separation enough, and the margins' 20px would
   * wrap the ▲ stepper onto a second row at 320px.
   */
  private get indexLabelStyle(): string {
    const margin = this.foldSeries ? '0px' : '5px';
    return `margin-left: ${margin}; margin-right: ${margin};`;
  }

  /**
   * The strip's trailing menus, at the far right of the controls row (past the
   * category/series input). Share is only offered on the chart flagged for it
   * (the first, when two are shown).
   *
   * The ⋯ renders only while its panel is folded, and it lives INSIDE this
   * span: the panel anchors to the whole span because the export trigger sits
   * to the ⋯'s right, so aligning to the ⋯ alone would stop the panel short of
   * the row's end and hang it off the left edge.
   */
  private renderControlsMenu(error: boolean, menuItems: (() => unknown) | null): unknown {
    return html`<span class="chart-controls-menu">
      ${menuItems === null ? nothing : html`<overflow-menu .text=${demoText.overflowMenu.chart}
        .placement=${controlsMenuPlacement} .getAnchor=${this.getMenuAnchor}
        .disabled=${error} .active=${this.isActive} .items=${menuItems}></overflow-menu>`}
      <export-share-menu .disabled=${error} .active=${this.isActive}
        .exportPng=${() => { const container = this.querySelector('.editable-chart-content'); if (container) { void exportPNG(container, getChartExportOptions()); } }}
        .exportSvg=${() => { const container = this.querySelector('.editable-chart-content'); if (container) { exportSVG(container, getChartExportOptions()); } }}
        .getShareState=${this.showShareButton ? () => ({ mode: 'single', config: this.mochartDemoConfig.config, data: this.data }) : undefined}></export-share-menu>
    </span>`;
  }

  private getMenuAnchor = (): HTMLElement | null => this.querySelector('.chart-controls-menu');

  private renderResetSliceButton(disabled: boolean): unknown {
    return buttonWithTooltip(
      { disabled, label: demoText.editableChart.resetSlice.label, tooltipText: demoText.editableChart.resetSlice.tooltip, tooltipPlacement: 'right', onClick: this.resetSliceChanges, ariaLabel: demoText.editableChart.resetSlice.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'arrow-rotate-left' })
    );
  }

  private renderSliceSequenceGroup(error: boolean): unknown {
    return html`<div class="demo-btn-group">
      ${buttonWithTooltip(
        { disabled: error || this.sequencePlaying || this.slices.length < 2, menuLabel: demoText.editableChart.playSliceSequence.menuLabel, tooltipText: demoText.editableChart.playSliceSequence.tooltip, tooltipPlacement: 'right', onClick: this.startSliceSequence, ariaLabel: demoText.editableChart.playSliceSequence.aria },
        icon({ size: 'lg', fixedWidth: true, name: 'play' })
      )}
      ${buttonWithTooltip(
        { disabled: error || !this.sequencePlaying, menuLabel: demoText.editableChart.stopSliceSequence.menuLabel, tooltipText: demoText.editableChart.stopSliceSequence.tooltip, tooltipPlacement: 'right', onClick: this.stopSequence, ariaLabel: demoText.editableChart.stopSliceSequence.aria },
        icon({ size: 'lg', fixedWidth: true, name: 'stop' })
      )}
    </div>`;
  }

  private renderResetCategoriesButton(error: boolean): unknown {
    return buttonWithTooltip(
      { disabled: error || this.sequencePlaying, label: demoText.editableChart.resetCategories.label, tooltipText: demoText.editableChart.resetCategories.tooltip, tooltipPlacement: 'right', onClick: this.resetCategories, ariaLabel: demoText.editableChart.resetCategories.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'arrow-rotate-left' })
    );
  }

  private renderReverseCategoriesButton(error: boolean): unknown {
    return buttonWithTooltip(
      { disabled: error || this.sequencePlaying, label: demoText.editableChart.reverseCategories.label, tooltipText: demoText.editableChart.reverseCategories.tooltip, tooltipPlacement: 'right', onClick: this.reverseCategories, ariaLabel: demoText.editableChart.reverseCategories.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'right-left' })
    );
  }

  private renderAddCategoriesButton(error: boolean, disableAdd: boolean): unknown {
    return buttonWithTooltip(
      { disabled: error || this.sequencePlaying || disableAdd, label: demoText.editableChart.addCategories.label, tooltipText: demoText.editableChart.addCategories.tooltip, tooltipPlacement: 'right', onClick: this.addCategories, ariaLabel: demoText.editableChart.addCategories.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'plus' })
    );
  }

  private renderRemoveCategoriesButton(error: boolean, disableRemove: boolean): unknown {
    return buttonWithTooltip(
      { disabled: error || this.sequencePlaying || disableRemove, label: demoText.editableChart.removeCategories.label, tooltipText: demoText.editableChart.removeCategories.tooltip, tooltipPlacement: 'right', onClick: this.removeCategories, ariaLabel: demoText.editableChart.removeCategories.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'minus' })
    );
  }

  private renderSequenceGroupButtons(error: boolean, disableAdd: boolean, disableRemove: boolean): unknown {
    return html`${buttonWithTooltip(
      { disabled: error || this.sequencePlaying || disableAdd, menuLabel: demoText.editableChart.playAddCategories.menuLabel, tooltipText: demoText.editableChart.playAddCategories.tooltip, tooltipPlacement: 'right', onClick: this.startAddSequence, ariaLabel: demoText.editableChart.playAddCategories.aria },
      html`${icon({ size: 'lg', name: 'play' })}<span style="padding-right: 2px;"></span>${icon({ size: 'lg', name: 'plus' })}`
    )}${buttonWithTooltip(
      { disabled: error || this.sequencePlaying || disableRemove, menuLabel: demoText.editableChart.playRemoveCategories.menuLabel, tooltipText: demoText.editableChart.playRemoveCategories.tooltip, tooltipPlacement: 'right', onClick: this.startRemoveSequence, ariaLabel: demoText.editableChart.playRemoveCategories.aria },
      html`${icon({ size: 'lg', name: 'play' })}<span style="padding-right: 2px;"></span>${icon({ size: 'lg', name: 'minus' })}`
    )}${buttonWithTooltip(
      { disabled: error || !this.sequencePlaying, menuLabel: demoText.editableChart.stopSequence.menuLabel, tooltipText: demoText.editableChart.stopSequence.tooltip, tooltipPlacement: 'right', onClick: this.stopSequence, ariaLabel: demoText.editableChart.stopSequence.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'stop' })
    )}`;
  }

  private renderSelectAllButton(error: boolean): unknown {
    return buttonWithTooltip(
      { disabled: error || this.sequencePlaying, label: demoText.editableChart.selectAllCategories.label, tooltipText: demoText.editableChart.selectAllCategories.tooltip, tooltipPlacement: 'right', onClick: this.selectAllCategories, ariaLabel: demoText.editableChart.selectAllCategories.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'check-double' })
    );
  }

  private renderResetSeriesButton(disabled: boolean): unknown {
    return buttonWithTooltip(
      { disabled, label: demoText.editableChart.resetSeries.label, tooltipText: demoText.editableChart.resetSeries.tooltip, tooltipPlacement: 'right', onClick: this.resetSeriesChanges, ariaLabel: demoText.editableChart.resetSeries.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'arrow-rotate-left' })
    );
  }

  private renderApplySeriesButton(disabled: boolean): unknown {
    return buttonWithTooltip(
      { disabled, label: demoText.editableChart.applySeries.label, tooltipText: demoText.editableChart.applySeries.tooltip, tooltipPlacement: 'right', onClick: this.applySeriesChanges, ariaLabel: demoText.editableChart.applySeries.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'check' })
    );
  }

  // The fold keeps Add and Remove — they act on what is typed in the input
  // beside them — plus the input; everything else goes to the menu, split into
  // the same sections the vanilla port uses (order edits, then the sequence
  // transport, then the shared controls).
  private renderCategoryControls(error: boolean, disableAdd: boolean, disableRemove: boolean): unknown {
    const folded = this.foldCategory;
    return html`<div class="chart-controls-container">
      <div class="chart-controls-buttons">
        <form>
          <div class="demo-field">
            <div class="demo-toolbar">
              ${folded ? nothing : html`${this.renderChartCountControls()}${this.renderModeToggle()}`}
              <div class="demo-btn-group">
                ${folded
                  ? html`${this.renderAddCategoriesButton(error, disableAdd)}${this.renderRemoveCategoriesButton(error, disableRemove)}`
                  : html`${this.renderResetCategoriesButton(error)}${this.renderReverseCategoriesButton(error)}${this.renderAddCategoriesButton(error, disableAdd)}${this.renderRemoveCategoriesButton(error, disableRemove)}${this.renderSequenceGroupButtons(error, disableAdd, disableRemove)}${this.renderSelectAllButton(error)}`}
              </div>
            </div>
          </div>
        </form>
      </div>
      <span class="chart-controls-input">
        <form>
          <input type="text" class="demo-input" ?disabled=${error || this.sequencePlaying} .value=${this.categoryValuesText}
                 @input=${(event: Event) => { this.categoryValuesText = (event.currentTarget as HTMLInputElement).value; }} />
        </form>
      </span>
      ${this.renderControlsMenu(error, folded ? () => html`<div class="demo-btn-group">
        ${this.renderResetCategoriesButton(error)}${this.renderReverseCategoriesButton(error)}${this.renderSelectAllButton(error)}
      </div>
      <div class="demo-menu-divider"></div>
      <div class="demo-btn-group">${this.renderSequenceGroupButtons(error, disableAdd, disableRemove)}</div>
      <div class="demo-menu-divider"></div>
      ${this.renderChartCountControls()}${this.renderModeToggle()}` : null)}
    </div>`;
  }

  private renderSeriesControls(error: boolean): unknown {
    const filteredCategoryValuesCount = this.dataProvider ? (this.dataProvider.getPropertyValues(this.mochartDemoConfig.mochartConfig.categoryAxis.property ?? '') ?? []).length : 0;
    const seriesControlsDisabled = this.sequencePlaying || this.categoryIndex === -1;
    const categoryOrderControlsDisabled = this.sequencePlaying || this.categoryIndex === -1;
    const isFirstCategory = this.categoryIndex === 0;
    const isLastCategory = this.categoryIndex === filteredCategoryValuesCount - 1;
    const hasPrevSeries = this.seriesIndex > 0;
    const hasNextSeries = this.seriesIndex < this.mochartDemoConfig.seriesCount - 1;
    // The fold keeps the steppers and their readouts — they are how a category
    // and a series get picked at all. Apply stays visible too, but moves DOWN,
    // onto the input row beside the JSON it applies: with it out of the
    // stepper row the panel holds two rows even at 320x568. Reset is the one
    // button with no partner anywhere, so it folds into the menu. The readout
    // prefixes shrink to their one-letter, aria-hidden stand-ins (the full
    // prefixes are sr-only clipped by the phone tier and keep carrying the
    // accessible name).
    const folded = this.foldSeries;
    return html`<div class="chart-controls-container">
      <div class="chart-controls-buttons">
        <form>
          ${folded ? nothing : html`<div class="demo-field">
            <div class="demo-toolbar">
              ${this.renderChartCountControls()}
              ${this.renderModeToggle()}
            </div>
          </div>`}
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                ${buttonWithTooltip(
                  { disabled: error || categoryOrderControlsDisabled || isFirstCategory, tooltipText: demoText.editableChart.decreaseCategoryOrder.tooltip, tooltipPlacement: 'right', onClick: this.decreaseCategoryOrder, ariaLabel: demoText.editableChart.decreaseCategoryOrder.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'arrow-left' })
                )}
              </div>
            </div>
          </div>
          <div class="demo-field">
            <span class="demo-label" style=${this.indexLabelStyle} title=${getCategoryIndexTitle(this.mochartDemoConfig, this.filteredData, this.categoryIndex)}><span class="demo-label-prefix">${demoText.editableChart.categoryIndexPrefix}</span><span class="demo-label-prefix-compact" aria-hidden="true">${demoText.editableChart.categoryIndexPrefixCompact}</span><span class="demo-index-value">${this.categoryIndex}</span></span>
          </div>
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                ${buttonWithTooltip(
                  { disabled: error || categoryOrderControlsDisabled || isLastCategory, tooltipText: demoText.editableChart.increaseCategoryOrder.tooltip, tooltipPlacement: 'right', onClick: this.increaseCategoryOrder, ariaLabel: demoText.editableChart.increaseCategoryOrder.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'arrow-right' })
                )}
              </div>
            </div>
          </div>
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                ${buttonWithTooltip(
                  { disabled: error || seriesControlsDisabled || !hasPrevSeries, tooltipText: demoText.editableChart.previousSeries.tooltip, tooltipPlacement: 'right', onClick: this.prevSeries, ariaLabel: demoText.editableChart.previousSeries.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'chevron-down' })
                )}
              </div>
            </div>
          </div>
          <div class="demo-field">
            <span class="demo-label" style=${this.indexLabelStyle} title=${getSeriesIndexTitle(this.mochartDemoConfig, this.seriesIndex)}><span class="demo-label-prefix">${demoText.editableChart.seriesIndexPrefix}</span><span class="demo-label-prefix-compact" aria-hidden="true">${demoText.editableChart.seriesIndexPrefixCompact}</span><span class="demo-index-value">${this.seriesIndex}</span></span>
          </div>
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                ${buttonWithTooltip(
                  { disabled: error || seriesControlsDisabled || !hasNextSeries, tooltipText: demoText.editableChart.nextSeries.tooltip, tooltipPlacement: 'right', onClick: this.nextSeries, ariaLabel: demoText.editableChart.nextSeries.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'chevron-up' })
                )}
              </div>
              ${folded ? nothing : html`<div class="demo-btn-group">
                ${this.renderResetSeriesButton(error || seriesControlsDisabled)}${this.renderApplySeriesButton(error || seriesControlsDisabled)}
              </div>`}
            </div>
          </div>
        </form>
      </div>
      <span class="chart-controls-input">
        <form>
          <input type="text" class="demo-input" ?disabled=${error || seriesControlsDisabled} .value=${this.seriesValuesText}
                 @input=${(event: Event) => { this.seriesValuesText = (event.currentTarget as HTMLInputElement).value; }} />
          ${folded ? this.renderApplySeriesButton(error || seriesControlsDisabled) : nothing}
        </form>
      </span>
      ${this.renderControlsMenu(error, folded ? () => html`<div class="demo-btn-group">${this.renderResetSeriesButton(error || seriesControlsDisabled)}</div>
      <div class="demo-menu-divider"></div>
      ${this.renderChartCountControls()}${this.renderModeToggle()}` : null)}
    </div>`;
  }

  // Pie-mode slice panel — replaces both panels when slices are the series:
  // click a slice (or step prev/next) to select it, edit its value, or play
  // the filter/restore sequence.
  private renderSliceControls(error: boolean): unknown {
    const sliceControlsDisabled = error || this.sequencePlaying || this.slices.length === 0;
    // The fold keeps the steppers, the readout, Apply and the input; Reset and
    // the play/stop pair go to the menu, with the 2nd-chart toggle as the tail.
    const folded = this.foldSlice;
    return html`<div class="chart-controls-container">
      <div class="chart-controls-buttons">
        <form>
          ${folded ? nothing : html`<div class="demo-field">
            <div class="demo-toolbar">
              ${this.renderChartCountControls()}
            </div>
          </div>`}
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                ${buttonWithTooltip(
                  { disabled: sliceControlsDisabled || this.sliceIndex === 0, tooltipText: demoText.editableChart.previousSlice.tooltip, tooltipPlacement: 'right', onClick: () => this.selectSlice(this.sliceIndex - 1), ariaLabel: demoText.editableChart.previousSlice.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'chevron-left' })
                )}
              </div>
            </div>
          </div>
          <div class="demo-field">
            <span class="demo-label" style="margin-left: 5px; margin-right: 5px;" title=${this.slices.length > 0 ? this.slices[this.sliceIndex].title : ''}>${this.slices.length > 0
              ? html`${demoText.editableChart.sliceIndexPrefix}<span class="demo-index-value">${this.sliceIndex}</span>`
              : demoText.editableChart.selectASliceText}</span>
          </div>
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                ${buttonWithTooltip(
                  { disabled: sliceControlsDisabled || this.sliceIndex >= this.slices.length - 1, tooltipText: demoText.editableChart.nextSlice.tooltip, tooltipPlacement: 'right', onClick: () => this.selectSlice(this.sliceIndex + 1), ariaLabel: demoText.editableChart.nextSlice.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'chevron-right' })
                )}
              </div>
              <div class="demo-btn-group">
                ${folded ? nothing : this.renderResetSliceButton(sliceControlsDisabled)}
                ${buttonWithTooltip(
                  { disabled: sliceControlsDisabled, label: demoText.editableChart.applySlice.label, tooltipText: demoText.editableChart.applySlice.tooltip, tooltipPlacement: 'right', onClick: this.applySliceChanges, ariaLabel: demoText.editableChart.applySlice.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'check' })
                )}
              </div>
              ${folded ? nothing : this.renderSliceSequenceGroup(error)}
            </div>
          </div>
        </form>
      </div>
      <span class="chart-controls-input">
        <form>
          <input type="text" class="demo-input" ?disabled=${sliceControlsDisabled} .value=${this.sliceValueText}
                 @input=${(event: Event) => { this.sliceValueText = (event.currentTarget as HTMLInputElement).value; }} />
        </form>
      </span>
      ${this.renderControlsMenu(error, folded ? () => html`<div class="demo-btn-group">${this.renderResetSliceButton(sliceControlsDisabled)}</div>
      <div class="demo-menu-divider"></div>
      ${this.renderSliceSequenceGroup(error)}
      ${this.showChartCountControls ? html`<div class="demo-menu-divider"></div>${this.renderChartCountControls()}` : nothing}` : null)}
    </div>`;
  }

  override render(): unknown {
    const chartDataError = !!(this.dataProvider && this.dataProvider.getError && this.dataProvider.getError());
    const configError = !this.mochartDemoConfig.valid;
    const error = chartDataError || configError;
    const filteredCategoryValues: readonly any[] = error || !this.dataProvider ? [] : this.dataProvider.getPropertyValues(this.mochartDemoConfig.mochartConfig.categoryAxis.property ?? '') ?? [];
    const selectedCategoryValues = (error || this.categoryValuesText === emptyCategoryText) ? [] : this.categoryValuesText.split(',');
    const filteredCategoryMap = filteredCategoryValues.reduce<Record<string, boolean>>((map, category) => { map[category] = true; return map; }, {});
    const disableRemove = this.orderChanged || !selectedCategoryValues.some(category => filteredCategoryMap[category]);
    const disableAdd = this.orderChanged || !selectedCategoryValues.some(category => !filteredCategoryMap[category]);
    // The chart controller picks animated vs static from the config.
    // Focus/filter is controlled by the parent chart-tab so the 1–2
    // charts stay in sync; the category index is translated into this
    // chart's filtered-data coordinates (filteredFocusedCategoryIndex).
    // Width is explicit; height tracks the container.
    const chartProps: ChartProps = {
      style: 'flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;',
      width: this.width,
      mochartConfig: this.mochartDemoConfig.mochartConfig,
      dataProvider: this.dataProvider,
      filteredSeriesIds: this.filteredSeriesIds,
      focusedCategoryIndex: this.filteredFocusedCategoryIndex,
      focusedValueAxisId: this.focusedValueAxisId ?? null,
      focusedSeriesId: this.focusedSeriesId ?? null,
      onFocus: this.onChartFocus,
      onSeriesFilter: this.onSeriesFilter,
      onChartClick: this.onChartClick,
      onSliceClick: this.onChartSliceClick
    };
    return html`<div class="editable-mochart-chart">
      <div class="editable-chart-container">
        <div class="editable-chart-content">
          ${chart(chartProps)}
        </div>
        <div class="editable-chart-controls">
          ${this.mochartDemoConfig.pieMode
            ? this.renderSliceControls(error)
            : this.selectionMode === 'category'
              ? this.renderCategoryControls(error, disableAdd, disableRemove)
              : this.renderSeriesControls(error)}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'editable-chart': EditableChart;
  }
}
