import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { applyDataEdit, buildMochartDemoConfig, collectUsedDataProperties, controlsMenuPlacement, demoText, formatDataView, getCategoryProperty, getDemoTabPanelAttrs, getJsonError, parseFullData } from '@mochart/demo-common';
import type { ParsedFullData } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { PhoneViewportController } from '../misc/PhoneViewportController';
import { buttonWithTooltip, icon } from '../misc/templates';
import '../misc/json-editor-content';
import '../misc/overflow-menu';

import type { DemoConfig, DataObject } from '../../types';

const panelAttrs = getDemoTabPanelAttrs('data');

@customElement('data-tab')
export class DataTab extends LightElement {
  @property({ attribute: false }) active = false;
  @property({ attribute: false }) config!: DemoConfig;
  @property({ attribute: false }) data!: DataObject[];
  @property({ attribute: false }) onDataChange!: (data: DataObject[]) => void;
  @property({ attribute: false }) onDataError!: (errorMessage: string) => void;
  @property({ attribute: false }) onDataReset!: () => void;

  @state() private dataText = '';
  @state() private errorMessage: string | null = null;

  private viewport = new PhoneViewportController(this);
  // Data properties the chart config does not read are hidden by default; the
  // Unused button toggles them. fullData is the complete dataset backing the
  // textarea, viewUsedProperties the used-set its current content was rendered
  // with (null when every property is shown).
  @state() private showUnused = false;
  private fullData: DataObject[] = [];
  private usedProperties: Set<string> | null = null;
  private viewUsedProperties: Set<string> | null = null;

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('config')) {
      this.usedProperties = collectUsedDataProperties(buildMochartDemoConfig(this.config).mochartConfig);
      // Re-filter for the changed config, keeping any (valid) unapplied edits.
      // The data branch below renders the initial view instead.
      if (!changed.has('data') && !this.showUnused) {
        const parsed = this.parseCurrentFullData();
        if (!('error' in parsed)) {
          this.renderView(parsed.full);
        }
      }
    }
    if (changed.has('data')) {
      this.renderView(this.data);
    }
  }

  private renderView(fullRows: DataObject[]): void {
    this.fullData = fullRows;
    this.viewUsedProperties = this.showUnused ? null : this.usedProperties;
    this.dataText = formatDataView(fullRows, this.viewUsedProperties);
  }

  private parseCurrentFullData(): ParsedFullData {
    return parseFullData(this.dataText, this.fullData, this.viewUsedProperties, getCategoryProperty(this.config));
  }

  private onTextChange = (nextDataText: string): void => {
    this.dataText = nextDataText;
    this.errorMessage = null;
  };

  private resetData = (): void => {
    this.renderView(this.data);
    this.errorMessage = null;
    this.onDataReset();
  };

  private toggleShowUnused = (): void => {
    const parsed = this.parseCurrentFullData();
    if ('error' in parsed) {
      this.errorMessage = parsed.error === 'json' ? demoText.errors.invalidJson : demoText.errors.invalidDataArray;
      return;
    }
    this.showUnused = !this.showUnused;
    this.errorMessage = null;
    this.renderView(parsed.full);
  };

  private applyData = (): void => {
    const result = applyDataEdit(this.dataText, this.fullData, this.viewUsedProperties, this.config);
    if (result.ok) {
      this.errorMessage = null;
      this.fullData = result.data;
      this.onDataChange(result.data);
    }
    else {
      this.errorMessage = result.errorMessage;
      this.onDataError(result.callbackError);
    }
  };

  override render(): unknown {
    const jsonError = getJsonError(this.dataText);
    const footerError = jsonError ?? this.errorMessage;
    // Same fold as the config footer — Apply and the `role="alert"` error stay
    // inline, the rest goes to the `⋯`; the reasons live on config-tab.
    const folded = this.viewport.isPhone;
    const resetButton = buttonWithTooltip(
      { id: 'data-reset', label: demoText.dataTab.reset.label, tooltipText: demoText.dataTab.reset.tooltip, tooltipPlacement: 'top-start', onClick: this.resetData, ariaLabel: demoText.dataTab.reset.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'arrow-rotate-left' })
    );
    const unusedButton = buttonWithTooltip(
      { id: 'data-unused', label: demoText.dataTab.unused.label, pressed: this.showUnused, tooltipText: demoText.dataTab.unused.tooltip, tooltipPlacement: 'top-start', onClick: this.toggleShowUnused, ariaLabel: demoText.dataTab.unused.aria },
      icon({ size: 'lg', fixedWidth: true, name: this.showUnused ? 'eye' : 'eye-slash' })
    );
    const applyButton = buttonWithTooltip(
      { id: 'data-apply', label: demoText.dataTab.apply.label, disabled: jsonError !== null, tooltipText: demoText.dataTab.apply.tooltip, tooltipPlacement: 'top-start', onClick: this.applyData, ariaLabel: demoText.dataTab.apply.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'check' })
    );
    return html`<div id=${panelAttrs.id} role=${panelAttrs.role} aria-labelledby=${panelAttrs['aria-labelledby']}
        class=${'mochart-demo-tab-container demo-layout-col data' + (this.active ? ' active' : '')} ?inert=${!this.active}>
      <div class="mochart-demo-tab-content">
        <json-editor-content .value=${this.dataText} .ariaLabelText=${demoText.dataTab.editorAria} .onChange=${this.onTextChange}></json-editor-content>
      </div>
      <div class="mochart-demo-tab-footer">
        <div class="demo-toolbar">
          ${folded
            ? html`${applyButton}
              <overflow-menu .text=${demoText.overflowMenu.editor} .placement=${controlsMenuPlacement}
                .getAnchor=${this.getFooterAnchor} .active=${this.active}
                .items=${() => html`<div class="demo-btn-group">${resetButton}${unusedButton}</div>`}></overflow-menu>`
            : html`${resetButton}${unusedButton}${applyButton}`}
          ${footerError ? html`<span class="mochart-demo-footer-error" role="alert">${footerError}</span>` : nothing}
        </div>
      </div>
    </div>`;
  }

  private getFooterAnchor = (): HTMLElement | null => this.querySelector('.mochart-demo-tab-footer');
}

declare global {
  interface HTMLElementTagNameMap {
    'data-tab': DataTab;
  }
}
