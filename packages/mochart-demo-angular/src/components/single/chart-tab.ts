import { Component, ElementRef, Input, ViewChild, signal } from '@angular/core';
import type { AfterViewInit, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';

import { hasConfigStructureChange } from '@mochart/core';

import { buildMochartDemoConfig, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { EditableChart } from './editable-chart';
import { createElementSize } from '../misc/element-size';

import type { DemoConfig, DataObject, MochartDemoConfig, FocusData, FilteredSeriesIds } from '../../types';

const minChartWidthForSecondChart = 480;
const scrollWidthOffset = 20;
const defaultChartCount = 1;

@Component({
  selector: 'app-chart-tab',
  imports: [EditableChart],
  styles: [':host { display: contents; }'],
  template: `
    <div #container [id]="panelAttrs.id" [attr.role]="panelAttrs.role" [attr.aria-labelledby]="panelAttrs['aria-labelledby']"
         [class]="'mochart-demo-tab-container demo-layout-row chart' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
      <div class="editable-charts-sizer">
        <div class="editable-charts">
          @if (mochartDemoConfig() && width() > 0) {
            @for (i of chartIndexes; track i) {
              <app-editable-chart [chartCount]="chartCount()" [showChartCountControls]="allowedChartCount > 1 && i === 1" [showShareButton]="i === 1"
                                  [width]="chartWidth" [mochartDemoConfig]="mochartDemoConfig()!" [data]="data ?? []" [dataError]="dataError"
                                  [isActive]="active" [filteredSeriesIds]="filteredSeriesIds()" [focusedCategoryIndex]="focusedCategoryIndex()"
                                  [focusedValueAxisId]="focusedValueAxisId()" [focusedSeriesId]="focusedSeriesId()" [onChartCountToggle]="onChartCountToggle"
                                  [onFocus]="onFocus" [onSeriesFilter]="onSeriesFilter" />
            }
          }
        </div>
      </div>
    </div>
  `
})
export class ChartTab implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  readonly panelAttrs = getDemoTabPanelAttrs('chart');

  @Input() config: DemoConfig | null = null;
  @Input() data: DataObject[] | null = null;
  @Input() dataError: string | boolean | null = false;
  @Input() active = false;

  @ViewChild('container', { static: true }) containerElement!: ElementRef<HTMLDivElement>;

  // Measured width of the tab.
  private elementSize = createElementSize();
  width = this.elementSize.width;

  chartCount = signal(defaultChartCount);
  focusedValueAxisId = signal<string | null>(null);
  focusedSeriesId = signal<string | null>(null);
  focusedCategoryIndex = signal(-1);
  filteredSeriesIds = signal<FilteredSeriesIds>({});
  mochartDemoConfig = signal<MochartDemoConfig | null>(null);

  ngOnInit(): void {
    this.mochartDemoConfig.set(this.config ? buildMochartDemoConfig(this.config) : null);
  }

  ngAfterViewInit(): void {
    this.elementSize.observe(this.containerElement.nativeElement);
  }

  ngOnDestroy(): void {
    this.elementSize.disconnect();
  }

  private resetFocusAndFiltered(): void {
    this.focusedValueAxisId.set(null);
    this.focusedSeriesId.set(null);
    this.focusedCategoryIndex.set(-1);
    this.filteredSeriesIds.set({});
  }

  // Mirror the react lifecycle: a config change rebuilds the demo config and
  // resets focus/filter state when the structure changed (or on data errors);
  // a data change remaps the focused category index onto the new data.
  ngOnChanges(changes: SimpleChanges): void {
    const configChange = changes['config'];
    const dataChange = changes['data'];
    const dataErrorChange = changes['dataError'];
    if (!configChange && !dataChange && !dataErrorChange) {
      return;
    }
    if ([configChange, dataChange, dataErrorChange].some(change => change?.firstChange)) {
      return;
    }
    let configChanged = false;
    if (configChange) {
      const nextDemoConfig = this.config ? buildMochartDemoConfig(this.config) : null;
      const currentDemoConfig = this.mochartDemoConfig();
      if (nextDemoConfig && currentDemoConfig) {
        configChanged = hasConfigStructureChange(currentDemoConfig.mochartConfig, nextDemoConfig.mochartConfig);
      }
      this.mochartDemoConfig.set(nextDemoConfig);
    }
    if (this.dataError || configChanged) {
      this.resetFocusAndFiltered();
    }
    else if (dataChange) {
      const previousData = dataChange.previousValue as DataObject[] | null;
      const previousDataError = dataErrorChange ? dataErrorChange.previousValue : this.dataError;
      const { configValidation, mochartConfig } = this.mochartDemoConfig() ?? {};
      const valid = configValidation?.valid ?? false;
      if (!previousDataError && previousData && this.data && valid && mochartConfig) {
        if (this.focusedCategoryIndex() >= 0) {
          const property = mochartConfig.categoryAxis.property ?? '';
          const categoryValue = previousData[this.focusedCategoryIndex()][property];
          let newFocusedCategoryIndex = -1;
          const count = this.data.length;
          for (let i = 0; i < count; i++) {
            if (this.data[i][property] === categoryValue) {
              newFocusedCategoryIndex = i;
              break;
            }
          }
          this.focusedCategoryIndex.set(newFocusedCategoryIndex);
        }
      }
      else {
        this.resetFocusAndFiltered();
      }
    }
  }

  onFocus = (focusData: FocusData = {}): void => {
    const { valueAxisId, seriesId, categoryIndex } = focusData;
    if (valueAxisId !== undefined) {
      this.focusedValueAxisId.set(valueAxisId);
    }
    if (seriesId !== undefined) {
      this.focusedSeriesId.set(seriesId);
    }
    if (categoryIndex !== undefined) {
      this.focusedCategoryIndex.set(categoryIndex);
    }
  };

  // The chart owns filter toggling now and reports the whole map.
  onSeriesFilter = ({ filteredSeriesIds: nextFilteredSeriesIds }: { filteredSeriesIds: FilteredSeriesIds }): void => {
    this.filteredSeriesIds.set({ ...nextFilteredSeriesIds });
  };

  onChartCountToggle = (): void => {
    this.chartCount.set(this.chartCount() === 1 ? 2 : 1);
  };

  get allowedChartCount(): number {
    return Math.floor(this.width() / 2) > minChartWidthForSecondChart ? 2 : 1;
  }

  get adjustedChartCount(): number {
    return Math.min(this.chartCount(), this.allowedChartCount);
  }

  get chartWidth(): number {
    return Math.floor((this.width() - scrollWidthOffset) / this.adjustedChartCount);
  }

  get chartIndexes(): number[] {
    return Array.from({ length: this.adjustedChartCount }, (_, index) => index + 1);
  }
}
