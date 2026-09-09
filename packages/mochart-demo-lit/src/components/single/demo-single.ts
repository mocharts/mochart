import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { consumeSingleShareState, demoText, getConfigDataError } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { demoTabs } from '../misc/demo-tabs';
import '../misc/error-tab';
import '../misc/top-bar';

import './chart-tab';
import './config-tab';
import './data-tab';

import type { DemoData, DemoConfig, DataObject } from '../../types';

type DataError = string | boolean | null;

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

@customElement('demo-single')
export class DemoSingle extends LightElement {
  @property({ attribute: false }) demoData!: DemoData;
  @property({ attribute: false }) initialDemoId!: string;
  @property({ attribute: false }) siteRootUrl: string | undefined = undefined;
  @property({ attribute: false }) onModeChanged!: (nextDemoMode: SwitchableDemoMode) => void;
  @property({ attribute: false }) onBackToDemos!: () => void;

  @state() private activeKey = eventKeyChart;
  @state() private demoId = '';
  // Config/data edits made on the Config/Data tabs stay "pending" until the
  // Chart tab is shown again (so the chart animates one combined change).
  // pendingConfig/pendingData are reactive so the Chart tab badge updates.
  @state() private pendingConfig: DemoConfig | null = null;
  @state() private pendingData: DataObject[] | null = null;
  private pendingDataError: DataError = false;
  @state() private config: DemoConfig | null = null;
  @state() private data: DataObject[] | null = null;
  @state() private viewingConfig: DemoConfig | null = null;
  @state() private viewingData: DataObject[] | null = null;
  @state() private viewingDataError: DataError = false;
  // editor-reported error, or the viewing config/data pair failing validation;
  // recomputed wherever the viewing values change, so a render always follows
  private chartDataError: DataError = false;


  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('initialDemoId')) {
      return;
    }
    const initialDemoId = this.initialDemoId;
    if (!this.hasUpdated) {
      // A share link carries edited config/data in the URL hash; it overrides
      // the demo's own config/data for the initial mount only.
      const sharedState = consumeSingleShareState();
      this.activeKey = eventKeyChart;
      this.demoId = initialDemoId;
      this.config = sharedState?.config ?? this.demoData.demoObjectMap[initialDemoId].config;
      this.data = sharedState?.data ?? this.demoData.demoObjectMap[initialDemoId].data;
      this.viewingConfig = this.config;
      this.viewingData = this.data;
      this.viewingDataError = false;
      this.chartDataError = getConfigDataError(this.viewingConfig, this.viewingData);
      return;
    }
    // When the routed demo changes (history navigation between two demos),
    // reload its config/data and promote them straight to the visible chart.
    this.activeKey = eventKeyChart;
    this.demoId = initialDemoId;
    this.config = this.demoData.demoObjectMap[initialDemoId].config;
    this.data = this.demoData.demoObjectMap[initialDemoId].data;
    this.pendingConfig = this.config;
    this.pendingData = this.data;
    this.chartShown();
  }

  private chartShown(): void {
    if (this.pendingConfig !== null || this.pendingData !== null || this.pendingDataError !== null) {
      if (this.pendingConfig !== null) {
        this.viewingConfig = this.pendingConfig;
        this.pendingConfig = null;
      }
      if (this.pendingData !== null) {
        this.viewingData = this.pendingData;
        this.pendingData = null;
      }
      if (this.pendingDataError !== null) {
        this.viewingDataError = this.pendingDataError;
        this.pendingDataError = null;
      }
      this.chartDataError = this.viewingDataError || getConfigDataError(this.viewingConfig!, this.viewingData!);
    }
  }

  private handleSelect(nextActiveKey: number): void {
    const previousActiveKey = this.activeKey;
    this.activeKey = nextActiveKey;
    if (nextActiveKey === eventKeyChart && previousActiveKey !== eventKeyChart) {
      this.chartShown();
    }
  }

  private onConfigChange = (nextPendingConfig: DemoConfig): void => {
    this.pendingConfig = nextPendingConfig;
  };

  private onConfigReset = (): void => {
    const resetConfig = { ...this.demoData.demoObjectMap[this.demoId].config };
    this.pendingConfig = resetConfig;
    this.config = resetConfig;
  };

  private onDataChange = (nextPendingData: DataObject[]): void => {
    this.pendingData = nextPendingData;
    this.pendingDataError = false;
  };

  private onDataError = (errorMessage: string): void => {
    this.pendingDataError = errorMessage;
  };

  private onDataReset = (): void => {
    // give it a new array reference so children know to update
    this.pendingData = this.demoData.demoObjectMap[this.demoId].data.slice();
    this.pendingDataError = false;
  };

  // Applied config/data edits are held until the Chart tab is shown; badge the
  // Chart tab so it's visible that something is waiting there.
  private get hasPendingChanges(): boolean {
    return this.activeKey !== eventKeyChart && (this.pendingConfig !== null || this.pendingData !== null);
  }

  override render(): unknown {
    return html`<div class="mochart-demo-container">
      <top-bar .siteRootUrl=${this.siteRootUrl} .onBackToDemos=${this.onBackToDemos}
               .notes=${this.demoData.demoObjectMap[this.initialDemoId]}
               .modes=${{ demoMode: 'single' as const, onModeChanged: this.onModeChanged }}
               .tabs=${() => demoTabs({
                 activeKey: this.activeKey,
                 onSelect: (key: number) => this.handleSelect(key),
                 tabs: [
                   { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart, pending: this.hasPendingChanges },
                   { name: 'config', key: eventKeyConfig, label: demoText.tabs.config },
                   { name: 'data', key: eventKeyData, label: demoText.tabs.data }
                 ]
               })}></top-bar>
      <div class="mochart-demo-content-pane">
        <div class="mochart-demo-content">
          <error-tab .active=${this.activeKey === eventKeyChart} .content=${() =>
            html`<chart-tab .active=${this.activeKey === eventKeyChart} .config=${this.viewingConfig} .data=${this.viewingData} .dataError=${this.chartDataError}></chart-tab>`}></error-tab>
          <error-tab .active=${this.activeKey === eventKeyConfig} .content=${() =>
            html`<config-tab .active=${this.activeKey === eventKeyConfig} .config=${this.config!} .onConfigChange=${this.onConfigChange} .onConfigReset=${this.onConfigReset}></config-tab>`}></error-tab>
          <error-tab .active=${this.activeKey === eventKeyData} .content=${() =>
            html`<data-tab .active=${this.activeKey === eventKeyData} .config=${this.viewingConfig!} .data=${this.data!}
                .onDataChange=${this.onDataChange} .onDataError=${this.onDataError} .onDataReset=${this.onDataReset}></data-tab>`}></error-tab>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-single': DemoSingle;
  }
}
