import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { defaultTransitionConfig, demoText, getTransitionDataProviders, getTransitionMochartConfig } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { demoTabs } from '../misc/demo-tabs';
import '../misc/top-bar';
import './transition-chart-tab';
import './transition-config-tab';

import type { TransitionConfig } from '../../types';

const eventKeyChart = 1;
const eventKeyConfig = 2;

@customElement('demo-transition')
export class DemoTransition extends LightElement {
  @property({ attribute: false }) siteRootUrl: string | undefined = undefined;
  @property({ attribute: false }) onBackToDemos!: () => void;

  @state() private activeKey = eventKeyChart;
  @state() private transitionConfig: TransitionConfig = defaultTransitionConfig;
  @state() private mochartConfig = getTransitionMochartConfig(defaultTransitionConfig);
  @state() private dataProviders = getTransitionDataProviders(defaultTransitionConfig);

  private handleSelect(nextActiveKey: number): void {
    this.activeKey = nextActiveKey;
  }

  private onUpdateConfig = (nextTransitionConfig: TransitionConfig): void => {
    this.transitionConfig = nextTransitionConfig;
    this.mochartConfig = getTransitionMochartConfig(nextTransitionConfig);
    this.dataProviders = getTransitionDataProviders(nextTransitionConfig);
  };

  private onResetConfig = (): void => {
    this.transitionConfig = defaultTransitionConfig;
    this.mochartConfig = getTransitionMochartConfig(defaultTransitionConfig);
    this.dataProviders = getTransitionDataProviders(defaultTransitionConfig);
  };

  override render(): unknown {
    return html`<div class="mochart-demo-container multi">
      <top-bar .siteRootUrl=${this.siteRootUrl} .onBackToDemos=${this.onBackToDemos}
               .tabs=${() => demoTabs({
                 activeKey: this.activeKey,
                 onSelect: (key: number) => this.handleSelect(key),
                 tabs: [
                   { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
                   { name: 'config', key: eventKeyConfig, label: demoText.tabs.transitionConfig }
                 ]
               })}></top-bar>
      <div class="mochart-demo-content-pane">
        <div class="mochart-demo-content">
          <transition-chart-tab .mochartConfig=${this.mochartConfig} .dataProviders=${this.dataProviders} .active=${this.activeKey === eventKeyChart}></transition-chart-tab>
          <transition-config-tab .transitionConfig=${this.transitionConfig} .onUpdate=${this.onUpdateConfig} .onReset=${this.onResetConfig}
              .active=${this.activeKey === eventKeyConfig}></transition-config-tab>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-transition': DemoTransition;
  }
}
