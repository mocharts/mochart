import { demoText, formatData, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { LightElement } from '../misc/LightElement';
import '../misc/json-editor-content';

const panelAttrs = getDemoTabPanelAttrs('data');

@customElement('random-data-tab')
export class RandomDataTab extends LightElement {
  @property({ attribute: false }) active = false;
  @property({ attribute: false }) data: unknown = null;

  @state() private dataText = '';

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('data')) {
      this.dataText = formatData(this.data);
    }
  }

  override render(): unknown {
    return html`<div id=${panelAttrs.id} role=${panelAttrs.role} aria-labelledby=${panelAttrs['aria-labelledby']}
        class=${'mochart-demo-tab-container demo-layout-col data' + (this.active ? ' active' : '')} ?inert=${!this.active}>
      <div class="mochart-demo-tab-content">
        <json-editor-content .value=${this.dataText} .ariaLabelText=${demoText.randomDataTab.editorAria} .readOnly=${true}></json-editor-content>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'random-data-tab': RandomDataTab;
  }
}
