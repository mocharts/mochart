import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import type { PropertyValues } from 'lit';

import { chart } from '@mochart/lit';
import { exportChartsPNG, exportChartsSVG } from '@mochart/export';

import { getChartExportOptions, buildMochartDemoConfig, consumeShareState, getDataProvidersForDataCount, getPieSlices, getPieStepCycle, getPieStepFilteredIds, applyReportedSeriesFilter } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { ElementSizeController } from '../misc/ElementSizeController';
import './charts-controls';

import type { Demo, DataObject, FilteredSeriesIds, ChartDataProviderLike, MochartDemoConfig } from '../../types';

const scrollWidthOffset = 20;

const defaultChartRows = 2;
const defaultChartCols = 2;

@customElement('charts-tab')
export class ChartsTab extends LightElement {
  @property({ attribute: false }) demoObject!: Demo;
  @property({ attribute: false }) active = false;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  @state() private playing = false;
  @state() private chartRows = defaultChartRows;
  @state() private chartCols = defaultChartCols;
  private rate = 2000;
  @state() private mochartDemoConfig!: MochartDemoConfig;
  @state() private data: DataObject[] = [];
  private dataCount = 0;
  private currentDataCount = 0;
  // Pie mode steps a filtering pattern instead of data prefixes: chart i at
  // step s filters the last (s + i) mod cycle slices, so the grid shows
  // different-sized views of the same pie and stepping animates all charts.
  private sliceIds: string[] = [];
  @state() private dataProviders: ChartDataProviderLike[] = [];
  @state() private focusedCategoryIndices: number[] = [];
  private focusedCategoryIndex = -1;
  @state() private focusedValueAxisId: string | null = null;
  @state() private focusedSeriesId: string | null = null;
  @state() private filteredSeriesIds: FilteredSeriesIds = {};

  // Measured size of the charts grid.
  private size = new ElementSizeController(this);

  private initFocusAndFiltered(): void {
    this.focusedCategoryIndex = -1;
    this.focusedValueAxisId = null;
    this.focusedSeriesId = null;
    this.filteredSeriesIds = {};
  }

  private stepCycle(): number {
    return this.mochartDemoConfig.pieMode ? getPieStepCycle(this.sliceIds) : this.dataCount;
  }

  private resetStep(): number {
    return this.mochartDemoConfig.pieMode ? 0 : this.dataCount;
  }

  // A shared `step` seeks the playback position; otherwise start on the full
  // set (pie mode starts at step 0 — the grid's staggered initial view).
  private initForDemoObject(step?: number): void {
    this.mochartDemoConfig = buildMochartDemoConfig(this.demoObject.config);
    this.initFocusAndFiltered();
    this.playing = false;
    this.data = this.demoObject.data;
    this.dataCount = this.data.length;
    this.sliceIds = this.mochartDemoConfig.pieMode ? getPieSlices(this.mochartDemoConfig.mochartConfig).map(slice => slice.id) : [];
    const cycle = this.stepCycle();
    this.currentDataCount = step !== undefined && cycle > 0
      ? ((Math.round(step) % cycle) + cycle) % cycle
      : this.resetStep();
    this.dataProviders = getDataProvidersForDataCount(this.data, this.chartRows * this.chartCols, this.currentDataCount);
    this.focusedCategoryIndices = this.dataProviders.map(() => -1);
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      // A share link restores the grid size, playback step and interval.
      const shared = consumeShareState('multi');
      const sharedMulti = shared && shared.mode === 'multi' ? shared : null;
      let step: number | undefined;
      if (sharedMulti) {
        this.chartRows = sharedMulti.rows;
        this.chartCols = sharedMulti.cols;
        this.rate = sharedMulti.interval;
        step = sharedMulti.step;
      }
      this.initForDemoObject(step);
      return;
    }
    if (changed.has('demoObject')) {
      this.initForDemoObject();
    }
    if (changed.has('active')) {
      this.onStopClick();
    }
  }

  // The whole grid exports as one tiled image; share captures the grid size,
  // playback step and interval so the link restores the same view.
  private getChartContainers(): Element[] {
    return Array.from(this.querySelectorAll('.multi-mochart-chart'));
  }

  private onExportPng = (): void => {
    const containers = this.getChartContainers();
    if (containers.length > 0) {
      void exportChartsPNG(containers, { cols: this.chartCols, ...getChartExportOptions() });
    }
  };

  private onExportSvg = (): void => {
    const containers = this.getChartContainers();
    if (containers.length > 0) {
      exportChartsSVG(containers, { cols: this.chartCols, ...getChartExportOptions() });
    }
  };

  private getShareState = (): ShareState => ({
    mode: 'multi', rows: this.chartRows, cols: this.chartCols, step: this.currentDataCount, interval: this.rate
  });

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private onRateChange = (nextRate: number): void => {
    this.rate = nextRate;
  };

  private onRowsChange = (nextChartRows: number): void => {
    this.chartRows = nextChartRows;
    this.currentDataCount = this.resetStep();
    this.dataProviders = getDataProvidersForDataCount(this.data, this.chartRows * this.chartCols, this.currentDataCount);
    this.focusedCategoryIndices = this.getFocusedCategoryIndices(this.dataProviders);
  };

  private onColsChange = (nextChartCols: number): void => {
    this.chartCols = nextChartCols;
    this.currentDataCount = this.resetStep();
    this.dataProviders = getDataProvidersForDataCount(this.data, this.chartRows * this.chartCols, this.currentDataCount);
    this.focusedCategoryIndices = this.getFocusedCategoryIndices(this.dataProviders);
  };

  private onStepBackwardClick = (): void => {
    const cycle = this.stepCycle();
    this.currentDataCount = this.mochartDemoConfig.pieMode
      ? (this.currentDataCount - 1 + cycle) % cycle
      : cycle + (this.currentDataCount - 1) % cycle;
    this.dataProviders = getDataProvidersForDataCount(this.data, this.chartRows * this.chartCols, this.currentDataCount);
    this.focusedCategoryIndices = this.getFocusedCategoryIndices(this.dataProviders);
  };

  private onStepForwardClick = (): void => {
    this.currentDataCount = (this.currentDataCount + 1) % this.stepCycle();
    this.dataProviders = getDataProvidersForDataCount(this.data, this.chartRows * this.chartCols, this.currentDataCount);
    this.focusedCategoryIndices = this.getFocusedCategoryIndices(this.dataProviders);
  };

  private getFocusedCategoryIndices(nextDataProviders: ChartDataProviderLike[]): number[] {
    const { mochartConfig } = this.mochartDemoConfig;
    if (this.focusedCategoryIndex >= 0) {
      const categoryValue = this.data[this.focusedCategoryIndex][mochartConfig.categoryAxis.property ?? ''];
      return this.getFocusedCategoryIndicesForValue(nextDataProviders, mochartConfig.categoryAxis.property ?? '', categoryValue);
    }
    else {
      return nextDataProviders.map(() => -1);
    }
  }

  private getFocusedCategoryIndicesForValue(nextDataProviders: ChartDataProviderLike[], categoryProperty: string, categoryValue: unknown): number[] {
    let count: number, i: number;
    return nextDataProviders.map(dataProvider => {
      let chartCategoryIndex = -1;
      const categoryValues = dataProvider.getPropertyValues(categoryProperty) ?? [];
      count = categoryValues.length;
      for (i = 0; i < count; i++) {
        if (categoryValues[i] === categoryValue) {
          chartCategoryIndex = i;
          break;
        }
      }
      return chartCategoryIndex;
    });
  }

  private onPlayBackwardClick = (): void => {
    this.playing = true;
    this.intervalId = setInterval(this.onStepBackwardClick, this.rate);
  };

  private onPlayForwardClick = (): void => {
    this.playing = true;
    this.intervalId = setInterval(this.onStepForwardClick, this.rate);
  };

  private onStopClick = (): void => {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    this.intervalId = null;
    this.playing = false;
  };

  private onChartFocus(chartIndex: number, focusData: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }): void {
    const { focusedValueAxisId: valueAxisId, focusedSeriesId: seriesId } = focusData;
    let categoryIndex = focusData.focusedCategoryIndex;
    const { mochartConfig } = this.mochartDemoConfig;
    let nextFocusedCategoryIndices = this.focusedCategoryIndices;
    if (categoryIndex !== undefined && categoryIndex >= 0) {
      const categoryValue = (this.dataProviders[chartIndex].getPropertyValues(mochartConfig.categoryAxis.property ?? '') ?? [])[categoryIndex];
      const count = this.data.length;
      for (let i = 0; i < count; i++) {
        if (this.data[i][mochartConfig.categoryAxis.property ?? ''] === categoryValue) {
          categoryIndex = i;
          break;
        }
      }
      if (categoryIndex !== this.focusedCategoryIndex) {
        nextFocusedCategoryIndices = this.getFocusedCategoryIndicesForValue(this.dataProviders, mochartConfig.categoryAxis.property ?? '', categoryValue);
      }
    }
    else if (this.focusedCategoryIndex >= 0) {
      nextFocusedCategoryIndices = this.dataProviders.map(() => -1);
    }
    if (categoryIndex !== undefined) {
      this.focusedCategoryIndex = categoryIndex;
    }
    if (valueAxisId !== undefined) {
      this.focusedValueAxisId = valueAxisId;
    }
    if (seriesId !== undefined) {
      this.focusedSeriesId = seriesId;
    }
    this.focusedCategoryIndices = nextFocusedCategoryIndices;
  }

  // The chart owns filter toggling now and reports the whole map.
  // Pie mode unions the stepper's per-chart filtering with the user's
  // legend filtering, so the legend stays interactive while stepping.
  private chartFilteredSeriesIds(i: number): FilteredSeriesIds {
    return this.mochartDemoConfig.pieMode
      ? { ...this.filteredSeriesIds, ...getPieStepFilteredIds(this.sliceIds, i, this.currentDataCount) }
      : this.filteredSeriesIds;
  }

  // The chart reports the whole union it was shown; keep only the user delta.
  private onSeriesFilter = (chartIndex: number, { filteredSeriesIds: reported }: { filteredSeriesIds: FilteredSeriesIds }): void => {
    this.filteredSeriesIds = applyReportedSeriesFilter(this.filteredSeriesIds, this.chartFilteredSeriesIds(chartIndex), reported);
  };

  override render(): unknown {
    const chartWidth = Math.floor((this.size.width - scrollWidthOffset) / this.chartCols);
    const chartHeight = Math.floor(this.size.height / this.chartRows);
    return html`<div class=${'mochart-demo-tab-container demo-layout-col chart' + (this.active ? ' active' : '')} ?inert=${!this.active}>
      <div ${ref(this.size.attach)} class="multi-charts-sizer">
        ${this.size.width > 0
          ? html`<div class="multi-charts">
              ${this.dataProviders.map((dataProvider, i) => html`<div class="multi-mochart-chart">
                ${chart({
                  mochartConfig: this.mochartDemoConfig.mochartConfig,
                  dataProvider,
                  width: chartWidth,
                  height: chartHeight,
                  filteredSeriesIds: this.chartFilteredSeriesIds(i),
                  focusedCategoryIndex: this.focusedCategoryIndices[i] ?? -1,
                  focusedValueAxisId: this.focusedValueAxisId ?? null,
                  focusedSeriesId: this.focusedSeriesId ?? null,
                  onSeriesFilter: (filterData: { filteredSeriesIds: FilteredSeriesIds }) => this.onSeriesFilter(i, filterData),
                  onFocus: (focusData: any) => this.onChartFocus(i, focusData)
                })}
              </div>`)}
            </div>`
          : null}
      </div>
      <charts-controls .playing=${this.playing} .initialRows=${this.chartRows} .initialCols=${this.chartCols} .initialRate=${this.rate}
          .onRowsChange=${this.onRowsChange} .onColsChange=${this.onColsChange}
          .onStepBackwardClick=${this.onStepBackwardClick} .onStepForwardClick=${this.onStepForwardClick}
          .onPlayBackwardClick=${this.onPlayBackwardClick} .onPlayForwardClick=${this.onPlayForwardClick}
          .onStopClick=${this.onStopClick} .onRateChange=${this.onRateChange}
          .exportPng=${this.onExportPng} .exportSvg=${this.onExportSvg} .getShareState=${this.getShareState}></charts-controls>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'charts-tab': ChartsTab;
  }
}
