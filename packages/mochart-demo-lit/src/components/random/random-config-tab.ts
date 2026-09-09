import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { LightElement } from '../misc/LightElement';
import { buttonWithTooltip, icon } from '../misc/templates';
import '../misc/json-editor-content';

import { demoText, formatRandomConfig, getDemoTabPanelAttrs, getJsonError, getJsonErrorMessage, parseJson, validateRandomConfig } from '@mochart/demo-common';

import type { RandomConfigWithValid } from '../../types';

const panelAttrs = getDemoTabPanelAttrs('config');

@customElement('random-config-tab')
export class RandomConfigTab extends LightElement {
  @property({ attribute: false }) active = false;
  @property({ attribute: false }) randomConfig!: RandomConfigWithValid;
  /** The current demo's generator id, for schema dispatch. */
  @property({ attribute: false }) generator?: string;
  @property({ attribute: false }) onUpdate!: (config: RandomConfigWithValid) => void;
  @property({ attribute: false }) onReset!: () => void;

  @state() private configText = '';
  @state() private errorMessage: string | null = null;

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('randomConfig')) {
      this.configText = formatRandomConfig(this.randomConfig);
    }
  }

  private onTextChange = (nextConfigText: string): void => {
    this.configText = nextConfigText;
    this.errorMessage = null;
  };

  private onUpdateClick = (): void => {
    try {
      const newConfig = parseJson(this.configText) as RandomConfigWithValid;
      newConfig.valid = validateRandomConfig(newConfig, this.generator);
      this.errorMessage = newConfig.valid ? null : demoText.errors.invalidRandomConfigValues;
      this.onUpdate(newConfig);
    }
    catch (error) {
      console.warn('Invalid Random Config JSON: ' + this.configText);
      this.errorMessage = getJsonErrorMessage(error);
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
        <json-editor-content .value=${this.configText} .ariaLabelText=${demoText.randomConfigTab.editorAria}
          .formatOnSet=${true} .onChange=${this.onTextChange}></json-editor-content>
      </div>
      <div class="mochart-demo-tab-footer">
        <div class="demo-toolbar">
          ${buttonWithTooltip(
            { id: 'config-reset', label: demoText.randomConfigTab.reset.label, tooltipText: demoText.randomConfigTab.reset.tooltip, tooltipPlacement: 'top-start', onClick: () => this.onReset(), ariaLabel: demoText.randomConfigTab.reset.aria },
            icon({ size: 'lg', fixedWidth: true, name: 'arrow-rotate-left' })
          )}
          ${buttonWithTooltip(
            { id: 'config-apply', label: demoText.randomConfigTab.apply.label, disabled: jsonError !== null, tooltipText: demoText.randomConfigTab.apply.tooltip, tooltipPlacement: 'top-start', onClick: this.onUpdateClick, ariaLabel: demoText.randomConfigTab.apply.aria },
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
    'random-config-tab': RandomConfigTab;
  }
}
