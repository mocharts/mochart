import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { demoText } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { staticDemoTabs } from '../misc/demo-tabs';
import '../misc/error-tab';
import '../misc/top-bar';

import './charts-tab';

import type { DemoData } from '../../types';

@customElement('demo-multi')
export class DemoMulti extends LightElement {
  @property({ attribute: false }) demoData!: DemoData;
  @property({ attribute: false }) initialDemoId!: string;
  @property({ attribute: false }) siteRootUrl: string | undefined = undefined;
  @property({ attribute: false }) onModeChanged!: (nextDemoMode: SwitchableDemoMode) => void;
  @property({ attribute: false }) onBackToDemos!: () => void;

  @state() private demoId = '';


  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('initialDemoId')) {
      this.demoId = this.initialDemoId;
    }
  }

  override render(): unknown {
    return html`<div class="mochart-demo-container multi">
      <top-bar .siteRootUrl=${this.siteRootUrl} .onBackToDemos=${this.onBackToDemos}
               .notes=${this.demoData.demoObjectMap[this.initialDemoId]}
               .modes=${{ demoMode: 'multi' as const, onModeChanged: this.onModeChanged }}
               .tabs=${() => staticDemoTabs(demoText.tabs.chart)}></top-bar>
      <div class="mochart-demo-content-pane">
        <div class="mochart-demo-content">
          <error-tab .active=${true} .content=${() =>
            html`<charts-tab .active=${true} .demoObject=${this.demoData.demoObjectMap[this.demoId]}></charts-tab>`}></error-tab>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-multi': DemoMulti;
  }
}
