import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import type { PropertyValues } from 'lit';

import { hasConfigStructureChange } from '@mochart/core';

import { buildMochartDemoConfig, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { ElementSizeController } from '../misc/ElementSizeController';
import './editable-chart';

import type { DemoConfig, DataObject, MochartDemoConfig, FocusData, FilteredSeriesIds } from '../../types';

const minChartWidthForSecondChart = 480;
const scrollWidthOffset = 20;
const defaultChartCount = 1;

const panelAttrs = getDemoTabPanelAttrs('chart');

@customElement('chart-tab')
export class ChartTab extends LightElement {
  @property({ attribute: false }) config: DemoConfig | null = null;
  @property({ attribute: false }) data: DataObject[] | null = null;
  @property({ attribute: false }) dataError: string | boolean | null = false;
  @property({ attribute: false }) active = false;

  // Measured width of the tab.
  private size = new ElementSizeController(this);

  @state() private chartCount = defaultChartCount;
  @state() private focusedValueAxisId: string | null = null;
  @state() private focusedSeriesId: string | null = null;
  @state() private focusedCategoryIndex = -1;
  @state() private filteredSeriesIds: FilteredSeriesIds = {};
  @state() private mochartDemoConfig: MochartDemoConfig | null = null;

  private resetFocusAndFiltered(): void {
    this.focusedValueAxisId = null;
    this.focusedSeriesId = null;
    this.focusedCategoryIndex = -1;
    this.filteredSeriesIds = {};
  }

  // Mirror the react lifecycle: a config change rebuilds the demo config and
  // resets focus/filter state when the structure changed (or on data errors);
  // a data change remaps the focused category index onto the new data.
  override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      this.mochartDemoConfig = this.config ? buildMochartDemoConfig(this.config) : null;
      return;
    }
    if (!changed.has('config') && !changed.has('data') && !changed.has('dataError')) {
      return;
    }
    const previousConfig = changed.has('config') ? (changed.get('config') as DemoConfig | null) : this.config;
    const previousData = changed.has('data') ? (changed.get('data') as DataObject[] | null) : this.data;
    const previousDataError = changed.has('dataError') ? (changed.get('dataError') as string | boolean | null) : this.dataError;
    let configChanged = false;
    if (this.config !== previousConfig) {
      const nextDemoConfig = this.config ? buildMochartDemoConfig(this.config) : null;
      if (nextDemoConfig && this.mochartDemoConfig) {
        configChanged = hasConfigStructureChange(this.mochartDemoConfig.mochartConfig, nextDemoConfig.mochartConfig);
      }
      this.mochartDemoConfig = nextDemoConfig;
    }
    if (this.dataError || configChanged) {
      this.resetFocusAndFiltered();
    }
    else if (this.data !== previousData) {
      const { configValidation, mochartConfig } = this.mochartDemoConfig ?? {};
      const valid = configValidation?.valid ?? false;
      if (!previousDataError && previousData && this.data && valid && mochartConfig) {
        if (this.focusedCategoryIndex >= 0) {
          const property = mochartConfig.categoryAxis.property ?? '';
          const categoryValue = previousData[this.focusedCategoryIndex][property];
          let newFocusedCategoryIndex = -1;
          const count = this.data.length;
          for (let i = 0; i < count; i++) {
            if (this.data[i][property] === categoryValue) {
              newFocusedCategoryIndex = i;
              break;
            }
          }
          this.focusedCategoryIndex = newFocusedCategoryIndex;
        }
      }
      else {
        this.resetFocusAndFiltered();
      }
    }
  }

  private onFocus = (focusData: FocusData = {}): void => {
    const { valueAxisId, seriesId, categoryIndex } = focusData;
    if (valueAxisId !== undefined) {
      this.focusedValueAxisId = valueAxisId;
    }
    if (seriesId !== undefined) {
      this.focusedSeriesId = seriesId;
    }
    if (categoryIndex !== undefined) {
      this.focusedCategoryIndex = categoryIndex;
    }
  };

  // The chart owns filter toggling now and reports the whole map.
  private onSeriesFilter = ({ filteredSeriesIds: nextFilteredSeriesIds }: { filteredSeriesIds: FilteredSeriesIds }): void => {
    this.filteredSeriesIds = { ...nextFilteredSeriesIds };
  };

  private onChartCountToggle = (): void => {
    this.chartCount = this.chartCount === 1 ? 2 : 1;
  };

  override render(): unknown {
    const width = this.size.width;
    const allowedChartCount = Math.floor(width / 2) > minChartWidthForSecondChart ? 2 : 1;
    const adjustedChartCount = Math.min(this.chartCount, allowedChartCount);
    const chartWidth = Math.floor((width - scrollWidthOffset) / adjustedChartCount);
    const chartIndices = Array.from({ length: adjustedChartCount }, (_unused, index) => index + 1);
    return html`<div ${ref(this.size.attach)} id=${panelAttrs.id} role=${panelAttrs.role} aria-labelledby=${panelAttrs['aria-labelledby']}
        class=${'mochart-demo-tab-container demo-layout-row chart' + (this.active ? ' active' : '')} ?inert=${!this.active}>
      <div class="editable-charts-sizer">
        <div class="editable-charts">
          ${this.mochartDemoConfig && width > 0
            ? chartIndices.map(i => html`<editable-chart
                .chartCount=${this.chartCount} .showChartCountControls=${allowedChartCount > 1 && i === 1} .showShareButton=${i === 1}
                .width=${chartWidth} .mochartDemoConfig=${this.mochartDemoConfig!} .data=${this.data ?? []} .dataError=${this.dataError}
                .isActive=${this.active} .filteredSeriesIds=${this.filteredSeriesIds} .focusedCategoryIndex=${this.focusedCategoryIndex}
                .focusedValueAxisId=${this.focusedValueAxisId} .focusedSeriesId=${this.focusedSeriesId} .onChartCountToggle=${this.onChartCountToggle}
                .onFocus=${this.onFocus} .onSeriesFilter=${this.onSeriesFilter}></editable-chart>`)
            : null}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chart-tab': ChartTab;
  }
}
