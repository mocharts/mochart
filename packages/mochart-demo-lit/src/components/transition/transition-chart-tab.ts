import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { chart } from '@mochart/lit';
import type { MochartConfig } from '@mochart/core';

import { demoText, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { buttonWithTooltip, icon } from '../misc/templates';

import type { ChartDataProviderLike } from '../../types';

const panelAttrs = getDemoTabPanelAttrs('chart');

@customElement('transition-chart-tab')
export class TransitionChartTab extends LightElement {
  @property({ attribute: false }) active = false;
  @property({ attribute: false }) mochartConfig!: MochartConfig;
  @property({ attribute: false }) dataProviders: ChartDataProviderLike[] = [];

  @state() private dataProviderIndex = 0;

  override willUpdate(changed: PropertyValues<this>): void {
    if (this.hasUpdated && (changed.has('mochartConfig') || changed.has('dataProviders'))) {
      this.dataProviderIndex = 0;
    }
  }

  private onStepBack = (): void => {
    if (this.dataProviders.length > 1) {
      if (this.dataProviderIndex === 0) {
        this.dataProviderIndex = this.dataProviders.length - 1;
      }
      else {
        this.dataProviderIndex--;
      }
    }
  };

  private onStepForward = (): void => {
    if (this.dataProviders.length > 1) {
      if (this.dataProviderIndex === this.dataProviders.length - 1) {
        this.dataProviderIndex = 0;
      }
      else {
        this.dataProviderIndex++;
      }
    }
  };

  override render(): unknown {
    return html`<div id=${panelAttrs.id} role=${panelAttrs.role} aria-labelledby=${panelAttrs['aria-labelledby']}
        class=${'mochart-demo-tab-container demo-layout-col chart' + (this.active ? ' active' : '')} ?inert=${!this.active}>
      <div class="transition-chart-sizer">
        ${chart({
          style: 'flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;',
          mochartConfig: this.mochartConfig,
          dataProvider: this.dataProviders[this.dataProviderIndex]
        })}
      </div>
      <div class="transition-controls">
        <form>
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                ${buttonWithTooltip(
                  { id: 'transition-back', label: demoText.transitionChartTab.back.label, tooltipText: demoText.transitionChartTab.back.tooltip, tooltipPlacement: 'top-start', onClick: this.onStepBack, ariaLabel: demoText.transitionChartTab.back.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'backward-step' })
                )}
                ${buttonWithTooltip(
                  { id: 'transition-forward', label: demoText.transitionChartTab.next.label, tooltipText: demoText.transitionChartTab.next.tooltip, tooltipPlacement: 'top-start', onClick: this.onStepForward, ariaLabel: demoText.transitionChartTab.next.aria },
                  icon({ size: 'lg', fixedWidth: true, name: 'forward-step' })
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'transition-chart-tab': TransitionChartTab;
  }
}
