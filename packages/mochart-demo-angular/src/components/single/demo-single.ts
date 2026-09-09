import { Component, Input, computed, signal } from '@angular/core';
import type { OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { consumeSingleShareState, demoText, getConfigDataError } from '@mochart/demo-common';

import { ChartTab } from './chart-tab';
import { ConfigTab } from './config-tab';
import { DataTab } from './data-tab';
import { DemoTabs } from '../misc/demo-tabs';
import { ErrorTab } from '../misc/error-tab';
import { TopBar } from '../misc/top-bar';

import type { DemoTab } from '@mochart/demo-common';

import type { DemoData, DemoConfig, DataObject, SwitchableDemoMode } from '../../types';

type DataError = string | boolean | null;

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

@Component({
  selector: 'app-demo-single',
  imports: [ChartTab, ConfigTab, DataTab, DemoTabs, ErrorTab, TopBar],
  styles: [':host { display: contents; }'],
  template: `
    <div class="mochart-demo-container">
      <app-top-bar [siteRootUrl]="siteRootUrl" [onBackToDemos]="onBackToDemos" [hasTabs]="true"
                   [notes]="demoData.demoObjectMap[initialDemoId]"
                   [modes]="{ demoMode: 'single', onModeChanged }">
        <app-demo-tabs [tabs]="tabItems" [activeKey]="activeKey()" [onSelect]="handleSelect" />
      </app-top-bar>
      <div class="mochart-demo-content-pane">
        <div class="mochart-demo-content">
          <app-error-tab [active]="activeKey() === eventKeyChart">
            <ng-template>
              <app-chart-tab [active]="activeKey() === eventKeyChart" [config]="viewingConfig()" [data]="viewingData()" [dataError]="chartDataError()" />
            </ng-template>
          </app-error-tab>
          <app-error-tab [active]="activeKey() === eventKeyConfig">
            <ng-template>
              <app-config-tab [active]="activeKey() === eventKeyConfig" [config]="config()!" [onConfigChange]="onConfigChange" [onConfigReset]="onConfigReset" />
            </ng-template>
          </app-error-tab>
          <app-error-tab [active]="activeKey() === eventKeyData">
            <ng-template>
              <app-data-tab [active]="activeKey() === eventKeyData" [config]="viewingConfig()!" [data]="data()!"
                            [onDataChange]="onDataChange" [onDataError]="onDataError" [onDataReset]="onDataReset" />
            </ng-template>
          </app-error-tab>
        </div>
      </div>
    </div>
  `
})
export class DemoSingle implements OnInit, OnChanges {
  @Input({ required: true }) demoData!: DemoData;
  @Input({ required: true }) initialDemoId!: string;
  @Input() siteRootUrl?: string;
  @Input({ required: true }) onModeChanged!: (nextDemoMode: SwitchableDemoMode) => void;
  @Input({ required: true }) onBackToDemos!: () => void;

  readonly text = demoText.tabs;

  readonly eventKeyChart = eventKeyChart;
  readonly eventKeyConfig = eventKeyConfig;
  readonly eventKeyData = eventKeyData;

  activeKey = signal(eventKeyChart);

  // Config/data edits made on the Config/Data tabs stay "pending" until the
  // Chart tab is shown again (so the chart animates one combined change).
  demoId = signal('');
  pendingConfig = signal<DemoConfig | null>(null);
  pendingData = signal<DataObject[] | null>(null);
  pendingDataError = signal<DataError>(false);
  config = signal<DemoConfig | null>(null);
  data = signal<DataObject[] | null>(null);
  dataError = signal<DataError>(false);
  viewingConfig = signal<DemoConfig | null>(null);
  viewingData = signal<DataObject[] | null>(null);
  viewingDataError = signal<DataError>(false);
  // editor-reported error, or the viewing config/data pair failing validation
  chartDataError = computed<DataError>(() => {
    const viewingConfig = this.viewingConfig();
    const viewingData = this.viewingData();
    return this.viewingDataError() ||
      (viewingConfig !== null && viewingData !== null ? getConfigDataError(viewingConfig, viewingData) : false);
  });

  ngOnInit(): void {
    const { initialDemoId } = this;
    this.demoId.set(initialDemoId);
    // A share link carries edited config/data in the URL hash; it overrides
    // the demo's own config/data for the initial mount only.
    const sharedState = consumeSingleShareState();
    const config = sharedState?.config ?? this.demoData.demoObjectMap[initialDemoId].config;
    const data = sharedState?.data ?? this.demoData.demoObjectMap[initialDemoId].data;
    this.config.set(config);
    this.data.set(data);
    this.viewingConfig.set(config);
    this.viewingData.set(data);
  }

  private chartShown(): void {
    if (this.pendingConfig() !== null || this.pendingData() !== null || this.pendingDataError() !== null) {
      if (this.pendingConfig() !== null) {
        this.viewingConfig.set(this.pendingConfig());
        this.pendingConfig.set(null);
      }
      if (this.pendingData() !== null) {
        this.viewingData.set(this.pendingData());
        this.pendingData.set(null);
      }
      if (this.pendingDataError() !== null) {
        this.viewingDataError.set(this.pendingDataError());
        this.pendingDataError.set(null);
      }
    }
  }

  get tabItems(): DemoTab[] {
    return [
      { name: 'chart', key: eventKeyChart, label: this.text.chart, pending: this.hasPendingChanges },
      { name: 'config', key: eventKeyConfig, label: this.text.config },
      { name: 'data', key: eventKeyData, label: this.text.data }
    ];
  }

  handleSelect = (nextActiveKey: number): void => {
    const previousActiveKey = this.activeKey();
    this.activeKey.set(nextActiveKey);
    if (nextActiveKey === eventKeyChart && previousActiveKey !== eventKeyChart) {
      this.chartShown();
    }
  };

  // When the routed demo changes (history navigation between two demos),
  // reload its config/data and promote them straight to the visible chart.
  ngOnChanges(changes: SimpleChanges): void {
    const initialDemoIdChange = changes['initialDemoId'];
    if (!initialDemoIdChange || initialDemoIdChange.firstChange) {
      return;
    }
    const { initialDemoId } = this;
    this.activeKey.set(eventKeyChart);
    this.demoId.set(initialDemoId);
    this.config.set(this.demoData.demoObjectMap[initialDemoId].config);
    this.data.set(this.demoData.demoObjectMap[initialDemoId].data);
    this.dataError.set(null);
    this.pendingConfig.set(this.config());
    this.pendingData.set(this.data());
    this.chartShown();
  }

  onConfigChange = (nextPendingConfig: DemoConfig): void => {
    this.pendingConfig.set(nextPendingConfig);
  };

  onConfigReset = (): void => {
    const resetConfig = { ...this.demoData.demoObjectMap[this.demoId()].config };
    this.pendingConfig.set(resetConfig);
    this.config.set(resetConfig);
  };

  onDataChange = (nextPendingData: DataObject[]): void => {
    this.pendingData.set(nextPendingData);
    this.pendingDataError.set(false);
  };

  onDataError = (errorMessage: string): void => {
    this.pendingDataError.set(errorMessage);
  };

  onDataReset = (): void => {
    // give it a new array reference so children know to update
    this.pendingData.set(this.demoData.demoObjectMap[this.demoId()].data.slice());
    this.pendingDataError.set(false);
  };

  // Applied config/data edits are held until the Chart tab is shown; badge the
  // Chart tab so it's visible that something is waiting there.
  get hasPendingChanges(): boolean {
    return this.activeKey() !== eventKeyChart && (this.pendingConfig() !== null || this.pendingData() !== null);
  }
}
