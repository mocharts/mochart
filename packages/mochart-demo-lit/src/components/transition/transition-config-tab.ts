import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { applyTransitionConfigEdit, demoText, formatTransitionConfig, getDemoTabPanelAttrs, getJsonError } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { buttonWithTooltip, icon } from '../misc/templates';
import '../misc/json-editor-content';

import type { TransitionConfig } from '../../types';

const panelAttrs = getDemoTabPanelAttrs('config');

@customElement('transition-config-tab')
export class TransitionConfigTab extends LightElement {
  @property({ attribute: false }) active = false;
  @property({ attribute: false }) transitionConfig!: TransitionConfig;
  @property({ attribute: false }) onUpdate!: (config: TransitionConfig) => void;
  @property({ attribute: false }) onReset!: () => void;

  @state() private configText = '';
  @state() private errorMessage: string | null = null;

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('transitionConfig')) {
      this.configText = formatTransitionConfig(this.transitionConfig);
    }
  }

  private onTextChange = (nextConfigText: string): void => {
    this.configText = nextConfigText;
    this.errorMessage = null;
  };

  private onUpdateClick = (): void => {
    const result = applyTransitionConfigEdit(this.configText);
    if (result.ok) {
      this.errorMessage = null;
      this.onUpdate(result.config);
    }
    else {
      this.errorMessage = result.errorMessage;
    }
  };

  private get jsonError(): string | null {
    return getJsonError(this.configText);
  }

  override render(): unknown {
    const jsonError = this.jsonError;
    const footerError = jsonError ?? this.errorMessage;
    return html`<div id=${panelAttrs.id} role=${panelAttrs.role} aria-labelledby=${panelAttrs['aria-labelledby']}
        class=${'mochart-demo-tab-container demo-layout-col config' + (this.active ? ' active' : '')} ?inert=${!this.active}>
      <div class="mochart-demo-tab-content">
        <json-editor-content .value=${this.configText} .ariaLabelText=${demoText.transitionConfigTab.editorAria} .onChange=${this.onTextChange}></json-editor-content>
      </div>
      <div class="mochart-demo-tab-footer">
        <div class="demo-toolbar">
          ${buttonWithTooltip(
            { id: 'config-reset', label: demoText.transitionConfigTab.reset.label, tooltipText: demoText.transitionConfigTab.reset.tooltip, tooltipPlacement: 'top-start', onClick: () => this.onReset(), ariaLabel: demoText.transitionConfigTab.reset.aria },
            icon({ size: 'lg', fixedWidth: true, name: 'arrow-rotate-left' })
          )}
          ${buttonWithTooltip(
            { id: 'config-apply', label: demoText.transitionConfigTab.apply.label, disabled: jsonError !== null, tooltipText: demoText.transitionConfigTab.apply.tooltip, tooltipPlacement: 'top-start', onClick: this.onUpdateClick, ariaLabel: demoText.transitionConfigTab.apply.aria },
            icon({ size: 'lg', fixedWidth: true, name: 'check' })
          )}
          ${footerError ? html`<span class="mochart-demo-footer-error" role="alert">${footerError}</span>` : nothing}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'transition-config-tab': TransitionConfigTab;
  }
}
