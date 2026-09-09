import { Component, Input, signal } from '@angular/core';
import type { OnChanges, SimpleChanges } from '@angular/core';

import { Chart } from '@mochart/angular';
import type { MochartConfig } from '@mochart/core';

import { demoText, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { ButtonWithTooltip } from '../misc/button-with-tooltip';
import { Icon } from '../misc/icon';

import type { ChartDataProviderLike } from '../../types';

@Component({
  selector: 'app-transition-chart-tab',
  imports: [Chart, ButtonWithTooltip, Icon],
  styles: [':host { display: contents; }'],
  template: `
    <div [id]="panelAttrs.id" [attr.role]="panelAttrs.role" [attr.aria-labelledby]="panelAttrs['aria-labelledby']"
         [class]="'mochart-demo-tab-container demo-layout-col chart' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
      <div class="transition-chart-sizer">
        <mochart-chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
                       [mochartConfig]="mochartConfig" [dataProvider]="dataProviders[dataProviderIndex()]" />
      </div>
      <div class="transition-controls">
        <form>
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                <app-button-with-tooltip id="transition-back" [label]="text.back.label" [tooltipText]="text.back.tooltip" tooltipPlacement="top-start"
                                         [onClick]="onStepBack" [aria-label]="text.back.aria">
                  <app-icon size="lg" [fixedWidth]="true" name="backward-step" />
                </app-button-with-tooltip>
                <app-button-with-tooltip id="transition-forward" [label]="text.next.label" [tooltipText]="text.next.tooltip" tooltipPlacement="top-start"
                                         [onClick]="onStepForward" [aria-label]="text.next.aria">
                  <app-icon size="lg" [fixedWidth]="true" name="forward-step" />
                </app-button-with-tooltip>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  `
})
export class TransitionChartTab implements OnChanges {
  readonly panelAttrs = getDemoTabPanelAttrs('chart');

  readonly text = demoText.transitionChartTab;

  @Input() active = false;
  @Input({ required: true }) mochartConfig!: MochartConfig;
  @Input({ required: true }) dataProviders!: ChartDataProviderLike[];

  dataProviderIndex = signal(0);

  ngOnChanges(changes: SimpleChanges): void {
    const mochartConfigChange = changes['mochartConfig'];
    const dataProvidersChange = changes['dataProviders'];
    if ((mochartConfigChange && !mochartConfigChange.firstChange) || (dataProvidersChange && !dataProvidersChange.firstChange)) {
      this.dataProviderIndex.set(0);
    }
  }

  onStepBack = (): void => {
    if (this.dataProviders.length > 1) {
      if (this.dataProviderIndex() === 0) {
        this.dataProviderIndex.set(this.dataProviders.length - 1);
      }
      else {
        this.dataProviderIndex.update(index => index - 1);
      }
    }
  };

  onStepForward = (): void => {
    if (this.dataProviders.length > 1) {
      if (this.dataProviderIndex() === this.dataProviders.length - 1) {
        this.dataProviderIndex.set(0);
      }
      else {
        this.dataProviderIndex.update(index => index + 1);
      }
    }
  };
}
