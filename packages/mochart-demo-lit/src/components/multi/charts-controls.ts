import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { demoText } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { buttonWithTooltip, icon } from '../misc/templates';
import '../misc/export-share-menu';

const defaultChartRows = 2;
const defaultChartCols = 2;
const defaultRate = 2000;

@customElement('charts-controls')
export class ChartsControls extends LightElement {
  @property({ attribute: false }) playing = false;
  // Seed values from the (possibly share-restored) grid size and interval.
  @property({ attribute: false }) initialRows = defaultChartRows;
  @property({ attribute: false }) initialCols = defaultChartCols;
  @property({ attribute: false }) initialRate = defaultRate;
  @property({ attribute: false }) onRowsChange!: (rows: number) => void;
  @property({ attribute: false }) onColsChange!: (cols: number) => void;
  @property({ attribute: false }) onStepBackwardClick!: () => void;
  @property({ attribute: false }) onStepForwardClick!: () => void;
  @property({ attribute: false }) onPlayBackwardClick!: () => void;
  @property({ attribute: false }) onPlayForwardClick!: () => void;
  @property({ attribute: false }) onStopClick!: () => void;
  @property({ attribute: false }) onRateChange!: (rate: number) => void;
  @property({ attribute: false }) exportPng!: () => void;
  @property({ attribute: false }) exportSvg!: () => void;
  @property({ attribute: false }) getShareState!: () => ShareState;

  @state() private rateText = '' + defaultRate;
  @state() private rowsText = '' + defaultChartRows;
  @state() private colsText = '' + defaultChartCols;

  override willUpdate(_changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      this.rowsText = '' + this.initialRows;
      this.colsText = '' + this.initialCols;
      this.rateText = '' + this.initialRate;
    }
  }

  // Input values arrive as strings and are coerced to numbers in place, so the
  // working variable is intentionally loose (matching the original demo).
  private rowsChanged = (event: Event): void => {
    let rows: any = (event.currentTarget as HTMLInputElement).value;
    if (!isNaN(parseFloat(rows)) && isFinite(rows)) {
      rows = +rows;
      if (rows >= 1 && rows <= 4) {
        this.onRowsChange(rows);
      }
    }
    this.rowsText = rows;
  };

  private colsChanged = (event: Event): void => {
    let cols: any = (event.currentTarget as HTMLInputElement).value;
    if (!isNaN(parseFloat(cols)) && isFinite(cols)) {
      cols = +cols;
      if (cols >= 1 && cols <= 4) {
        this.onColsChange(cols);
      }
    }
    this.colsText = cols;
  };

  private rateChanged = (event: Event): void => {
    let rate: any = (event.currentTarget as HTMLInputElement).value;
    if (!isNaN(parseFloat(rate)) && isFinite(rate)) {
      rate = +rate;
      if (rate >= 5 && rate <= 60000) {
        this.onRateChange(rate);
      }
    }
    this.rateText = rate;
  };

  override render(): unknown {
    return html`<div class="multi-controls">
      <form>
        <div class="demo-field">
          <label class="demo-label" for="grid-rows">${demoText.multiChartsTab.gridLabel}</label>
          <input id="grid-rows" ?disabled=${this.playing} type="number" min="1" max="4" class="demo-input" .value=${'' + this.rowsText} aria-label=${demoText.multiChartsTab.gridRowsAria} @input=${this.rowsChanged} />
          <span class="demo-label">&times;</span>
          <input id="grid-cols" ?disabled=${this.playing} type="number" min="1" max="4" class="demo-input" .value=${'' + this.colsText} aria-label=${demoText.multiChartsTab.gridColsAria} @input=${this.colsChanged} />
        </div>
        <div class="demo-field">
          <div class="demo-toolbar">
            <div class="demo-btn-group">
              ${buttonWithTooltip(
                { id: 'step-back', disabled: this.playing, tooltipText: demoText.multiChartsTab.stepBackward.tooltip, tooltipPlacement: 'top-start', onClick: this.onStepBackwardClick, ariaLabel: demoText.multiChartsTab.stepBackward.aria },
                icon({ size: 'lg', fixedWidth: true, name: 'backward-step' })
              )}
              ${buttonWithTooltip(
                { id: 'step-forward', disabled: this.playing, tooltipText: demoText.multiChartsTab.stepForward.tooltip, tooltipPlacement: 'top-start', onClick: this.onStepForwardClick, ariaLabel: demoText.multiChartsTab.stepForward.aria },
                icon({ size: 'lg', fixedWidth: true, name: 'forward-step' })
              )}
              ${buttonWithTooltip(
                { id: 'play-backward', disabled: this.playing, tooltipText: demoText.multiChartsTab.playBackward.tooltip, tooltipPlacement: 'top-start', onClick: this.onPlayBackwardClick, ariaLabel: demoText.multiChartsTab.playBackward.aria },
                icon({ size: 'lg', fixedWidth: true, name: 'play', flip: 'horizontal' })
              )}
              ${buttonWithTooltip(
                { id: 'play-forward', disabled: this.playing, tooltipText: demoText.multiChartsTab.playForward.tooltip, tooltipPlacement: 'top-start', onClick: this.onPlayForwardClick, ariaLabel: demoText.multiChartsTab.playForward.aria },
                icon({ size: 'lg', fixedWidth: true, name: 'play' })
              )}
              ${buttonWithTooltip(
                { id: 'stop', disabled: !this.playing, tooltipText: demoText.multiChartsTab.stop.tooltip, tooltipPlacement: 'top-start', onClick: this.onStopClick, ariaLabel: demoText.multiChartsTab.stop.aria },
                icon({ size: 'lg', fixedWidth: true, name: 'stop' })
              )}
            </div>
          </div>
        </div>
        <div class="demo-field">
          <label class="demo-label" for="multi-rate">${demoText.multiChartsTab.intervalLabel}</label>
          <input id="multi-rate" ?disabled=${this.playing} type="number" min="5" max="60000" step="100" class="demo-input" .value=${'' + this.rateText} aria-label=${demoText.multiChartsTab.intervalAria} @input=${this.rateChanged} />
        </div>
        <div class="demo-field">
          <div class="demo-toolbar">
            <export-share-menu .exportPng=${this.exportPng} .exportSvg=${this.exportSvg} .getShareState=${this.getShareState}></export-share-menu>
          </div>
        </div>
      </form>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'charts-controls': ChartsControls;
  }
}
