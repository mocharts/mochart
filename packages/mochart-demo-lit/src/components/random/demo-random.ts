import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { buildMochartDemoConfig, demoText } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { demoTabs } from '../misc/demo-tabs';
import '../misc/top-bar';
import './random-content';

import type { DemoData, MochartDemoConfig, RandomConfigWithValid } from '../../types';

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

@customElement('demo-random')
export class DemoRandom extends LightElement {
  @property({ attribute: false }) demoData!: DemoData;
  @property({ attribute: false }) initialDemoId!: string;
  @property({ attribute: false }) siteRootUrl: string | undefined = undefined;
  @property({ attribute: false }) onModeChanged!: (nextDemoMode: SwitchableDemoMode) => void;
  @property({ attribute: false }) onBackToDemos!: () => void;
  @property({ attribute: false }) randomId = 0;
  @property({ attribute: false }) incrementRandomId!: () => void;
  @property({ attribute: false }) decrementRandomId!: () => void;

  @state() private activeKey = eventKeyChart;
  @state() private mochartDemoConfig: MochartDemoConfig | null = null;
  @state() private randomConfig: RandomConfigWithValid | null = null;
  @state() private generator: string | undefined = undefined;


  private buildStateForDemo(demoId: string): { mochartDemoConfig: MochartDemoConfig; randomConfig: RandomConfigWithValid; generator?: string } {
    const demo = this.demoData.demoObjectMap[demoId];
    return {
      mochartDemoConfig: buildMochartDemoConfig(demo.config),
      randomConfig: Object.assign({}, demo.random, { valid: true }),
      generator: demo.generator
    };
  }

  // The demo's derived config state rebuilds only when the routed demo
  // changes; a randomId-only change flows through to random-content untouched.
  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('initialDemoId')) {
      return;
    }
    const nextState = this.buildStateForDemo(this.initialDemoId);
    this.activeKey = eventKeyChart;
    this.mochartDemoConfig = nextState.mochartDemoConfig;
    this.randomConfig = nextState.randomConfig;
    this.generator = nextState.generator;
  }

  private handleSelect(nextActiveKey: number): void {
    this.activeKey = nextActiveKey;
  }

  override render(): unknown {
    return html`<div class="mochart-demo-container multi">
      <top-bar .siteRootUrl=${this.siteRootUrl} .onBackToDemos=${this.onBackToDemos}
               .notes=${this.demoData.demoObjectMap[this.initialDemoId]}
               .modes=${{ demoMode: 'random' as const, onModeChanged: this.onModeChanged }}
               .tabs=${() => demoTabs({
                 activeKey: this.activeKey,
                 onSelect: (key: number) => this.handleSelect(key),
                 tabs: [
                   { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
                   { name: 'config', key: eventKeyConfig, label: demoText.tabs.randomConfig },
                   { name: 'data', key: eventKeyData, label: demoText.tabs.data }
                 ]
               })}></top-bar>
      <div class="mochart-demo-content-pane">
        <random-content
            .mochartDemoConfig=${this.mochartDemoConfig!} .initialRandomConfig=${this.randomConfig!} .generator=${this.generator}
            .activeKey=${this.activeKey} .eventKeys=${{ eventKeyChart, eventKeyConfig, eventKeyData }}
            .randomId=${this.randomId} .incrementRandomId=${this.incrementRandomId} .decrementRandomId=${this.decrementRandomId}></random-content>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-random': DemoRandom;
  }
}
