import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Input, ViewChild, signal } from '@angular/core';
import type { OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';

import { Chart } from '@mochart/angular';
import type { MochartConfig } from '@mochart/core';
import { exportPNG, exportSVG } from '@mochart/export';

import { controlsMenuPlacement, demoText, getChartExportOptions, getDemoTabPanelAttrs, menuKeepOpenClassName } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import { ButtonWithTooltip } from '../misc/button-with-tooltip';
import { ExportShareMenu } from '../misc/export-share-menu';
import { Icon } from '../misc/icon';
import { OverflowMenu } from '../misc/overflow-menu';
import { phoneViewport } from '../misc/phone-viewport';

import type { DemoDataProvider, RandomConfigWithValid } from '../../types';

const defaultRate = 2000;

@Component({
  selector: 'app-random-chart-tab',
  imports: [Chart, ButtonWithTooltip, ExportShareMenu, Icon, NgTemplateOutlet, OverflowMenu],
  styles: [':host { display: contents; }'],
  template: `
    <ng-template #playButton>
      <app-button-with-tooltip id="play" [disabled]="playing()" [menuLabel]="text.play.menuLabel"
                               [tooltipText]="text.play.tooltip" tooltipPlacement="top-start"
                               [onClick]="onPlayClick" [aria-label]="text.play.aria">
        <app-icon size="lg" [fixedWidth]="true" name="play" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #stopButton>
      <app-button-with-tooltip id="stop" [disabled]="!playing()" [menuLabel]="text.stop.menuLabel"
                               [tooltipText]="text.stop.tooltip" tooltipPlacement="top-start"
                               [onClick]="onStopClick" [aria-label]="text.stop.aria">
        <app-icon size="lg" [fixedWidth]="true" name="stop" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #reuseButton>
      <app-button-with-tooltip id="reuse" [disabled]="playing()" [label]="text.reuse.label" [pressed]="applyReuse"
                               [tooltipText]="text.reuse.tooltip" tooltipPlacement="top-start"
                               [onClick]="toggleApplyReuse" [aria-label]="text.reuse.aria">
        <app-icon size="lg" [fixedWidth]="true" name="recycle" />
      </app-button-with-tooltip>
    </ng-template>
    <!-- \`.demo-menu-keep-open\` so a press inside the field — the number
         input's own spinners in particular — cannot dismiss the panel it is
         hosted in. The class paints nothing, so it is unconditional. -->
    <ng-template #rateField>
      <div class="demo-field {{ keepOpenClass }}">
        <label class="demo-label" for="random-rate">{{ text.intervalLabel }}</label>
        <input id="random-rate" [disabled]="playing()" type="number" min="5" max="60000" step="100" class="demo-input" [value]="rateText()"
               [attr.aria-label]="text.intervalAria" (input)="rateChanged($event)" />
      </div>
    </ng-template>

    <!-- The phone fold keeps the dice pair (Back / Randomize) inline —
         stepping by hand is the mode's primary interaction — and demotes the
         automation transport (Play / Stop) with the Reuse toggle and the
         interval field. -->
    <div [id]="panelAttrs.id" [attr.role]="panelAttrs.role" [attr.aria-labelledby]="panelAttrs['aria-labelledby']"
         [class]="'mochart-demo-tab-container demo-layout-col chart' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
      <div class="random-chart-sizer" #chartSizer>
        <mochart-chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
                       [mochartConfig]="mochartConfig" [dataProvider]="dataProvider" />
      </div>
      <div class="random-controls" #controls>
        <form>
          <div class="demo-field">
            <div class="demo-toolbar">
              <div class="demo-btn-group">
                <app-button-with-tooltip id="randomize-back" [disabled]="playing()" [label]="text.back.label"
                                         [tooltipText]="text.back.tooltip" tooltipPlacement="top-start"
                                         [onClick]="onRandomizeBack" [aria-label]="text.back.aria">
                  <app-icon size="lg" [fixedWidth]="true" name="dice" flip="horizontal" />
                </app-button-with-tooltip>
                <app-button-with-tooltip id="randomize-next" [disabled]="playing()" [label]="text.randomize.label"
                                         [tooltipText]="text.randomize.tooltip" tooltipPlacement="top-start"
                                         [onClick]="onRandomizeNext" [aria-label]="text.randomize.aria">
                  <app-icon size="lg" [fixedWidth]="true" name="dice" />
                </app-button-with-tooltip>
                @if (!phone()) {
                  <ng-container [ngTemplateOutlet]="playButton" />
                  <ng-container [ngTemplateOutlet]="stopButton" />
                }
              </div>
              @if (!phone()) {
                <ng-container [ngTemplateOutlet]="rateField" />
              }
            </div>
            <div class="demo-toolbar">
              @if (phone()) {
                <!-- Anchored to the whole strip: \`align: 'end'\` pins the
                     panel's right edge to the anchor's, and the export trigger
                     sits to the ⋯'s right. -->
                <div class="demo-btn-group">
                  <app-overflow-menu [text]="overflowText" [placement]="randomPlacement" [getAnchor]="getControlsAnchor" [active]="active">
                    <div class="demo-btn-group">
                      <ng-container [ngTemplateOutlet]="playButton" />
                      <ng-container [ngTemplateOutlet]="stopButton" />
                    </div>
                    <div class="demo-menu-divider"></div>
                    <div class="demo-btn-group"><ng-container [ngTemplateOutlet]="reuseButton" /></div>
                    <div class="demo-menu-divider"></div>
                    <ng-container [ngTemplateOutlet]="rateField" />
                  </app-overflow-menu>
                  <app-export-share-menu [active]="active" [exportPng]="onExportPng" [exportSvg]="onExportSvg" [getShareState]="getShareState" />
                </div>
              } @else {
                <div class="demo-btn-group"><ng-container [ngTemplateOutlet]="reuseButton" /></div>
                <app-export-share-menu [active]="active" [exportPng]="onExportPng" [exportSvg]="onExportSvg" [getShareState]="getShareState" />
              }
            </div>
          </div>
        </form>
      </div>
    </div>
  `
})
export class RandomChartTab implements OnInit, OnChanges, OnDestroy {
  readonly panelAttrs = getDemoTabPanelAttrs('chart');

  readonly text = demoText.randomChartTab;
  readonly keepOpenClass = menuKeepOpenClassName;

  @Input() active = false;
  @Input({ required: true }) mochartConfig!: MochartConfig;
  @Input({ required: true }) dataProvider!: DemoDataProvider | null;
  @Input({ required: true }) randomConfig!: RandomConfigWithValid;
  @Input() initialRate?: number;
  @Input({ required: true }) onRandomizeBack!: () => void;
  @Input({ required: true }) onRandomizeNext!: () => void;
  @Input({ required: true }) applyReuse!: boolean;
  @Input({ required: true }) toggleApplyReuse!: () => void;

  @ViewChild('chartSizer', { static: true }) chartSizerElement!: ElementRef<HTMLDivElement>;
  @ViewChild('controls', { static: true }) controlsElement!: ElementRef<HTMLDivElement>;

  // The phone fold (see the comment above the strip in the template).
  readonly phone = phoneViewport();
  readonly overflowText = demoText.overflowMenu.random;
  readonly randomPlacement = controlsMenuPlacement;
  readonly getControlsAnchor = (): HTMLElement => this.controlsElement.nativeElement;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  playing = signal(false);
  rate = signal(defaultRate);
  rateText = signal('' + defaultRate);

  getChartSizer = (): Element | null => this.chartSizerElement?.nativeElement ?? null;

  onExportPng = (): void => {
    const container = this.getChartSizer();
    if (container) {
      void exportPNG(container, getChartExportOptions());
    }
  };

  onExportSvg = (): void => {
    const container = this.getChartSizer();
    if (container) {
      exportSVG(container, getChartExportOptions());
    }
  };

  // Share captures the generator config, the reuse toggle and the interval; the
  // step comes from the /random/:demoId/:randomId path already in the URL.
  getShareState = (): ShareState => ({
    mode: 'random', randomConfig: this.randomConfig, applyReuse: this.applyReuse, interval: this.rate()
  });

  ngOnInit(): void {
    // A share link restores the interval; otherwise keep the default.
    if (this.initialRate !== undefined) {
      this.rate.set(this.initialRate);
      this.rateText.set('' + this.initialRate);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const activeChange = changes['active'];
    if (activeChange && !activeChange.firstChange) {
      this.onStopClick();
    }
  }

  onPlayClick = (): void => {
    this.playing.set(true);
    this.intervalId = setInterval(this.onRandomizeNext, this.rate());
  };

  onStopClick = (): void => {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    this.intervalId = null;
    this.playing.set(false);
  };

  rateChanged(event: Event): void {
    let nextRateText: any = (event.currentTarget as HTMLInputElement).value;
    if (!isNaN(parseFloat(nextRateText)) && isFinite(nextRateText)) {
      nextRateText = +nextRateText;
      if (nextRateText >= 5 && nextRateText <= 60000) {
        this.rate.set(nextRateText);
      }
    }
    this.rateText.set('' + nextRateText);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
