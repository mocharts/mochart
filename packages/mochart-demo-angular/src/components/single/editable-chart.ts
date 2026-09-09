import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Input, ViewChild, signal } from '@angular/core';
import type { OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';

import { hasConfigStructureChange, NONE, ArrayOfObjectsDataProvider } from '@mochart/core';
import type { DataProvider } from '@mochart/core';
import { exportPNG, exportSVG } from '@mochart/export';

import { Chart } from '@mochart/angular';

import { applyPieSliceValue, controlsMenuPlacement, createErrorDataProvider, getChartExportOptions, getCategoryIndexTitle, getPieSequenceSteps, getPieSlices, getSeriesIndexTitle, getSeriesValuesText, demoText, parseJson } from '@mochart/demo-common';

import type { PieSliceInfo } from '@mochart/demo-common';

import { ButtonWithTooltip } from '../misc/button-with-tooltip';
import { ExportShareMenu } from '../misc/export-share-menu';
import { Icon } from '../misc/icon';
import { OverflowMenu } from '../misc/overflow-menu';
import { phoneViewport } from '../misc/phone-viewport';

import type { MochartDemoConfig, FilteredSeriesIds, FocusData } from '../../types';

// Mutable working rows are keyed by config-driven property names, so their
// value type is intentionally loose.
type Row = Record<string, any>;

type EditableDataProvider = DataProvider;

interface FocusPayload {
  valueAxisId?: string | null;
  seriesId?: string | null;
  categoryIndex?: number;
}

const emptyCategoryText = demoText.editableChart.emptyCategoryText;
const selectACategoryText = demoText.editableChart.selectACategoryText;

@Component({
  selector: 'app-editable-chart',
  imports: [Chart, ButtonWithTooltip, ExportShareMenu, Icon, NgTemplateOutlet, OverflowMenu],
  styles: [':host { display: contents; }'],
  template: `
    <!-- The phone fold's foldable controls, each defined ONCE and rendered
         through an outlet in exactly one place — the strip above the phone
         tier, the overflow panel below it. Angular's answer to the react
         port's JSX consts and the svelte port's snippets; it also retires the
         triple duplication these three branches used to carry. -->
    <ng-template #chartCountControl>
      @if (showChartCountControls) {
        <div class="demo-btn-group">
          <app-button-with-tooltip [label]="text.secondChart.label" [pressed]="chartCount === 2"
                                   [tooltipText]="chartCount === 2 ? text.secondChart.tooltipHide : text.secondChart.tooltipShow" tooltipPlacement="right"
                                   [onClick]="onChartCountToggle" [aria-label]="text.secondChart.aria">
            <app-icon size="lg" [fixedWidth]="true" [name]="chartCount === 2 ? 'window-maximize' : 'window-restore'" />
          </app-button-with-tooltip>
        </div>
      }
    </ng-template>
    <ng-template #modeControl>
      <div class="demo-btn-group">
        <app-button-with-tooltip [label]="selectionMode() === 'category' ? text.editMode.labelToSeries : text.editMode.labelToCategories"
                                 [tooltipText]="selectionMode() === 'category'
                                   ? text.editMode.tooltipToSeries
                                   : text.editMode.tooltipToCategories" tooltipPlacement="right"
                                 [onClick]="onModeToggle" [aria-label]="text.editMode.aria">
          <app-icon size="lg" [fixedWidth]="true" [name]="selectionMode() === 'category' ? 'bullseye' : 'sliders'" />
        </app-button-with-tooltip>
      </div>
    </ng-template>
    <ng-template #resetSliceButton>
      <app-button-with-tooltip [disabled]="sliceControlsDisabled" [label]="text.resetSlice.label" [tooltipText]="text.resetSlice.tooltip" tooltipPlacement="right"
                               [onClick]="resetSliceChanges" [aria-label]="text.resetSlice.aria">
        <app-icon size="lg" [fixedWidth]="true" name="arrow-rotate-left" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #sliceSequenceGroup>
      <div class="demo-btn-group">
        <app-button-with-tooltip [disabled]="error || sequencePlaying() || slices().length < 2"
                                 [menuLabel]="text.playSliceSequence.menuLabel" [tooltipText]="text.playSliceSequence.tooltip" tooltipPlacement="right"
                                 [onClick]="startSliceSequence" [aria-label]="text.playSliceSequence.aria">
          <app-icon size="lg" [fixedWidth]="true" name="play" />
        </app-button-with-tooltip>
        <app-button-with-tooltip [disabled]="error || !sequencePlaying()"
                                 [menuLabel]="text.stopSliceSequence.menuLabel" [tooltipText]="text.stopSliceSequence.tooltip" tooltipPlacement="right"
                                 [onClick]="stopSequence" [aria-label]="text.stopSliceSequence.aria">
          <app-icon size="lg" [fixedWidth]="true" name="stop" />
        </app-button-with-tooltip>
      </div>
    </ng-template>
    <ng-template #resetCategoriesButton>
      <app-button-with-tooltip [disabled]="error || sequencePlaying()" [label]="text.resetCategories.label" [tooltipText]="text.resetCategories.tooltip" tooltipPlacement="right"
                               [onClick]="resetCategories" [aria-label]="text.resetCategories.aria">
        <app-icon size="lg" [fixedWidth]="true" name="arrow-rotate-left" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #reverseCategoriesButton>
      <app-button-with-tooltip [disabled]="error || sequencePlaying()" [label]="text.reverseCategories.label" [tooltipText]="text.reverseCategories.tooltip" tooltipPlacement="right"
                               [onClick]="reverseCategories" [aria-label]="text.reverseCategories.aria">
        <app-icon size="lg" [fixedWidth]="true" name="right-left" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #addCategoriesButton>
      <app-button-with-tooltip [disabled]="error || sequencePlaying() || disableAdd" [label]="text.addCategories.label" [tooltipText]="text.addCategories.tooltip" tooltipPlacement="right"
                               [onClick]="addCategories" [aria-label]="text.addCategories.aria">
        <app-icon size="lg" [fixedWidth]="true" name="plus" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #removeCategoriesButton>
      <app-button-with-tooltip [disabled]="error || sequencePlaying() || disableRemove" [label]="text.removeCategories.label" [tooltipText]="text.removeCategories.tooltip" tooltipPlacement="right"
                               [onClick]="removeCategories" [aria-label]="text.removeCategories.aria">
        <app-icon size="lg" [fixedWidth]="true" name="minus" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #playAddButton>
      <app-button-with-tooltip [disabled]="error || sequencePlaying() || disableAdd"
                               [menuLabel]="text.playAddCategories.menuLabel" [tooltipText]="text.playAddCategories.tooltip" tooltipPlacement="right"
                               [onClick]="startAddSequence" [aria-label]="text.playAddCategories.aria">
        <app-icon size="lg" name="play" /><span style="padding-right: 2px;"></span><app-icon size="lg" name="plus" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #playRemoveButton>
      <app-button-with-tooltip [disabled]="error || sequencePlaying() || disableRemove"
                               [menuLabel]="text.playRemoveCategories.menuLabel" [tooltipText]="text.playRemoveCategories.tooltip" tooltipPlacement="right"
                               [onClick]="startRemoveSequence" [aria-label]="text.playRemoveCategories.aria">
        <app-icon size="lg" name="play" /><span style="padding-right: 2px;"></span><app-icon size="lg" name="minus" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #stopCategoriesButton>
      <app-button-with-tooltip [disabled]="error || !sequencePlaying()"
                               [menuLabel]="text.stopSequence.menuLabel" [tooltipText]="text.stopSequence.tooltip" tooltipPlacement="right"
                               [onClick]="stopSequence" [aria-label]="text.stopSequence.aria">
        <app-icon size="lg" [fixedWidth]="true" name="stop" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #selectAllButton>
      <app-button-with-tooltip [disabled]="error || sequencePlaying()" [label]="text.selectAllCategories.label" [tooltipText]="text.selectAllCategories.tooltip" tooltipPlacement="right"
                               [onClick]="selectAllCategories" [aria-label]="text.selectAllCategories.aria">
        <app-icon size="lg" [fixedWidth]="true" name="check-double" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #resetSeriesButton>
      <app-button-with-tooltip [disabled]="error || seriesControlsDisabled" [label]="text.resetSeries.label" [tooltipText]="text.resetSeries.tooltip" tooltipPlacement="right"
                               [onClick]="resetSeriesChanges" [aria-label]="text.resetSeries.aria">
        <app-icon size="lg" [fixedWidth]="true" name="arrow-rotate-left" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #applySeriesButton>
      <app-button-with-tooltip [disabled]="error || seriesControlsDisabled" [label]="text.applySeries.label" [tooltipText]="text.applySeries.tooltip" tooltipPlacement="right"
                               [onClick]="applySeriesChanges" [aria-label]="text.applySeries.aria">
        <app-icon size="lg" [fixedWidth]="true" name="check" />
      </app-button-with-tooltip>
    </ng-template>

    <div class="editable-mochart-chart">
      <div class="editable-chart-container">
        <div class="editable-chart-content" #chartContent>
          <!-- ManagedChart (behind mochart-angular's Chart) picks animated vs
               static from the config and owns focus/filter state internally.
               Width is explicit; height tracks the container. -->
          <mochart-chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
                         [width]="width" [mochartConfig]="mochartDemoConfig.mochartConfig" [dataProvider]="dataProvider()"
                         [filteredSeriesIds]="filteredSeriesIds" [focusedCategoryIndex]="filteredFocusedCategoryIndex()"
                         [focusedValueAxisId]="focusedValueAxisId ?? null" [focusedSeriesId]="focusedSeriesId ?? null"
                         (focusChange)="onChartFocus($event)" (seriesFilter)="onSeriesFilter($event)" (chartClick)="onChartClick($event)"
                         (sliceClick)="onChartSliceClick($event)" />
        </div>
        <div class="editable-chart-controls">
          <!-- Pie-mode slice panel — replaces both panels when slices are the
               series: click a slice (or step prev/next) to select it, edit its
               value, or play the filter/restore sequence. -->
          @if (mochartDemoConfig.pieMode) {
            <!-- The fold keeps the steppers, the readout, Apply and the input;
                 Reset and the play/stop pair go to the menu, with the
                 2nd-chart toggle as the tail. -->
            <div class="chart-controls-container">
              <div class="chart-controls-buttons">
                <form>
                  @if (!foldSlice()) {
                    <!-- Kept on desktop even when empty — the empty field's
                         gap is part of the unfolded layout. -->
                    <div class="demo-field">
                      <div class="demo-toolbar">
                        <ng-container [ngTemplateOutlet]="chartCountControl" />
                      </div>
                    </div>
                  }
                  <div class="demo-field">
                    <div class="demo-toolbar">
                      <div class="demo-btn-group">
                        <app-button-with-tooltip [disabled]="sliceControlsDisabled || sliceIndex() === 0" [tooltipText]="text.previousSlice.tooltip" tooltipPlacement="right"
                                                 [onClick]="prevSlice" [aria-label]="text.previousSlice.aria">
                          <app-icon size="lg" [fixedWidth]="true" name="chevron-left" />
                        </app-button-with-tooltip>
                      </div>
                    </div>
                  </div>
                  <div class="demo-field">
                    <span class="demo-label" style="margin-left: 5px; margin-right: 5px;" [title]="sliceLabelTitle">{{ sliceLabelText }}@if (slices().length > 0) {<span class="demo-index-value">{{ sliceIndex() }}</span>}</span>
                  </div>
                  <div class="demo-field">
                    <div class="demo-toolbar">
                      <div class="demo-btn-group">
                        <app-button-with-tooltip [disabled]="sliceControlsDisabled || sliceIndex() >= slices().length - 1" [tooltipText]="text.nextSlice.tooltip" tooltipPlacement="right"
                                                 [onClick]="nextSlice" [aria-label]="text.nextSlice.aria">
                          <app-icon size="lg" [fixedWidth]="true" name="chevron-right" />
                        </app-button-with-tooltip>
                      </div>
                      <div class="demo-btn-group">
                        @if (!foldSlice()) {
                          <ng-container [ngTemplateOutlet]="resetSliceButton" />
                        }
                        <app-button-with-tooltip [disabled]="sliceControlsDisabled" [label]="text.applySlice.label" [tooltipText]="text.applySlice.tooltip" tooltipPlacement="right"
                                                 [onClick]="applySliceChanges" [aria-label]="text.applySlice.aria">
                          <app-icon size="lg" [fixedWidth]="true" name="check" />
                        </app-button-with-tooltip>
                      </div>
                      @if (!foldSlice()) {
                        <ng-container [ngTemplateOutlet]="sliceSequenceGroup" />
                      }
                    </div>
                  </div>
                </form>
              </div>
              <span class="chart-controls-input">
                <form>
                  <input type="text" class="demo-input" [disabled]="sliceControlsDisabled"
                         [value]="sliceValueText()" (input)="onSliceValueInput($event)" />
                </form>
              </span>
              <span class="chart-controls-menu" #menuSpan>
                @if (foldSlice()) {
                  <app-overflow-menu [text]="overflowText" [placement]="chartPlacement" [getAnchor]="getMenuAnchor"
                                     [disabled]="error" [active]="isActive">
                    <div class="demo-btn-group"><ng-container [ngTemplateOutlet]="resetSliceButton" /></div>
                    <div class="demo-menu-divider"></div>
                    <ng-container [ngTemplateOutlet]="sliceSequenceGroup" />
                    @if (showChartCountControls) {
                      <div class="demo-menu-divider"></div>
                      <ng-container [ngTemplateOutlet]="chartCountControl" />
                    }
                  </app-overflow-menu>
                }
                <app-export-share-menu [disabled]="error" [active]="isActive"
                                       [exportPng]="onExportPng" [exportSvg]="onExportSvg"
                                       [getShareState]="showShareButton ? getShareState : undefined" />
              </span>
            </div>
          } @else if (selectionMode() === 'category') {
            <!-- The fold keeps Add and Remove — they act on what is typed in
                 the input beside them — plus the input; everything else goes
                 to the menu, split into the same sections the vanilla port
                 uses (order edits, then the sequence transport, then the
                 shared controls). -->
            <div class="chart-controls-container">
              <div class="chart-controls-buttons">
                <form>
                  <div class="demo-field">
                    <div class="demo-toolbar">
                      @if (!foldCategory()) {
                        <ng-container [ngTemplateOutlet]="chartCountControl" />
                        <ng-container [ngTemplateOutlet]="modeControl" />
                      }
                      <div class="demo-btn-group">
                        @if (foldCategory()) {
                          <ng-container [ngTemplateOutlet]="addCategoriesButton" />
                          <ng-container [ngTemplateOutlet]="removeCategoriesButton" />
                        } @else {
                          <ng-container [ngTemplateOutlet]="resetCategoriesButton" />
                          <ng-container [ngTemplateOutlet]="reverseCategoriesButton" />
                          <ng-container [ngTemplateOutlet]="addCategoriesButton" />
                          <ng-container [ngTemplateOutlet]="removeCategoriesButton" />
                          <ng-container [ngTemplateOutlet]="playAddButton" />
                          <ng-container [ngTemplateOutlet]="playRemoveButton" />
                          <ng-container [ngTemplateOutlet]="stopCategoriesButton" />
                          <ng-container [ngTemplateOutlet]="selectAllButton" />
                        }
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              <span class="chart-controls-input">
                <form>
                  <input type="text" class="demo-input" [disabled]="error || sequencePlaying()"
                         [value]="categoryValuesText()" (input)="onCategoryValuesInput($event)" />
                </form>
              </span>
              <span class="chart-controls-menu" #menuSpan>
                @if (foldCategory()) {
                  <app-overflow-menu [text]="overflowText" [placement]="chartPlacement" [getAnchor]="getMenuAnchor"
                                     [disabled]="error" [active]="isActive">
                    <div class="demo-btn-group">
                      <ng-container [ngTemplateOutlet]="resetCategoriesButton" />
                      <ng-container [ngTemplateOutlet]="reverseCategoriesButton" />
                      <ng-container [ngTemplateOutlet]="selectAllButton" />
                    </div>
                    <div class="demo-menu-divider"></div>
                    <div class="demo-btn-group">
                      <ng-container [ngTemplateOutlet]="playAddButton" />
                      <ng-container [ngTemplateOutlet]="playRemoveButton" />
                      <ng-container [ngTemplateOutlet]="stopCategoriesButton" />
                    </div>
                    <div class="demo-menu-divider"></div>
                    <ng-container [ngTemplateOutlet]="chartCountControl" />
                    <ng-container [ngTemplateOutlet]="modeControl" />
                  </app-overflow-menu>
                }
                <app-export-share-menu [disabled]="error" [active]="isActive"
                                       [exportPng]="onExportPng" [exportSvg]="onExportSvg"
                                       [getShareState]="showShareButton ? getShareState : undefined" />
              </span>
            </div>
          } @else {
            <!-- The fold keeps the steppers and their readouts — they are how
                 a category and a series get picked at all. Apply stays visible
                 too, but moves DOWN, onto the input row beside the JSON it
                 applies: with it out of the stepper row the panel holds two
                 rows even at 320x568. Reset is the one button with no partner
                 anywhere, so it folds into the menu. The readout prefixes
                 shrink to their one-letter, aria-hidden stand-ins (the full
                 prefixes are sr-only clipped by the phone tier and keep
                 carrying the accessible name), and the labels drop their 5px
                 side margins — the phone tier's 6px field gap is separation
                 enough, and the margins' 20px would wrap the ▲ stepper onto a
                 second row at 320px. -->
            <div class="chart-controls-container">
              <div class="chart-controls-buttons">
                <form>
                  @if (!foldSeries()) {
                    <div class="demo-field">
                      <div class="demo-toolbar">
                        <ng-container [ngTemplateOutlet]="chartCountControl" />
                        <ng-container [ngTemplateOutlet]="modeControl" />
                      </div>
                    </div>
                  }
                  <div class="demo-field">
                    <div class="demo-toolbar">
                      <div class="demo-btn-group">
                        <app-button-with-tooltip [disabled]="error || categoryOrderControlsDisabled || isFirstCategory" [tooltipText]="text.decreaseCategoryOrder.tooltip" tooltipPlacement="right"
                                                 [onClick]="decreaseCategoryOrder" [aria-label]="text.decreaseCategoryOrder.aria">
                          <app-icon size="lg" [fixedWidth]="true" name="arrow-left" />
                        </app-button-with-tooltip>
                      </div>
                    </div>
                  </div>
                  <div class="demo-field">
                    <span class="demo-label" [style.margin-left]="indexLabelMargin()" [style.margin-right]="indexLabelMargin()" [title]="categoryIndexTitle"><span class="demo-label-prefix">{{ text.categoryIndexPrefix }}</span><span class="demo-label-prefix-compact" aria-hidden="true">{{ text.categoryIndexPrefixCompact }}</span><span class="demo-index-value">{{ categoryIndex() }}</span></span>
                  </div>
                  <div class="demo-field">
                    <div class="demo-toolbar">
                      <div class="demo-btn-group">
                        <app-button-with-tooltip [disabled]="error || categoryOrderControlsDisabled || isLastCategory" [tooltipText]="text.increaseCategoryOrder.tooltip" tooltipPlacement="right"
                                                 [onClick]="increaseCategoryOrder" [aria-label]="text.increaseCategoryOrder.aria">
                          <app-icon size="lg" [fixedWidth]="true" name="arrow-right" />
                        </app-button-with-tooltip>
                      </div>
                    </div>
                  </div>
                  <div class="demo-field">
                    <div class="demo-toolbar">
                      <div class="demo-btn-group">
                        <app-button-with-tooltip [disabled]="error || seriesControlsDisabled || !hasPrevSeries" [tooltipText]="text.previousSeries.tooltip" tooltipPlacement="right"
                                                 [onClick]="prevSeries" [aria-label]="text.previousSeries.aria">
                          <app-icon size="lg" [fixedWidth]="true" name="chevron-down" />
                        </app-button-with-tooltip>
                      </div>
                    </div>
                  </div>
                  <div class="demo-field">
                    <span class="demo-label" [style.margin-left]="indexLabelMargin()" [style.margin-right]="indexLabelMargin()" [title]="seriesIndexTitle"><span class="demo-label-prefix">{{ text.seriesIndexPrefix }}</span><span class="demo-label-prefix-compact" aria-hidden="true">{{ text.seriesIndexPrefixCompact }}</span><span class="demo-index-value">{{ seriesIndex() }}</span></span>
                  </div>
                  <div class="demo-field">
                    <div class="demo-toolbar">
                      <div class="demo-btn-group">
                        <app-button-with-tooltip [disabled]="error || seriesControlsDisabled || !hasNextSeries" [tooltipText]="text.nextSeries.tooltip" tooltipPlacement="right"
                                                 [onClick]="nextSeries" [aria-label]="text.nextSeries.aria">
                          <app-icon size="lg" [fixedWidth]="true" name="chevron-up" />
                        </app-button-with-tooltip>
                      </div>
                      @if (!foldSeries()) {
                        <div class="demo-btn-group">
                          <ng-container [ngTemplateOutlet]="resetSeriesButton" />
                          <ng-container [ngTemplateOutlet]="applySeriesButton" />
                        </div>
                      }
                    </div>
                  </div>
                </form>
              </div>
              <span class="chart-controls-input">
                <form>
                  <input type="text" class="demo-input" [disabled]="error || seriesControlsDisabled"
                         [value]="seriesValuesText()" (input)="onSeriesValuesInput($event)" />
                  @if (foldSeries()) {
                    <ng-container [ngTemplateOutlet]="applySeriesButton" />
                  }
                </form>
              </span>
              <span class="chart-controls-menu" #menuSpan>
                @if (foldSeries()) {
                  <app-overflow-menu [text]="overflowText" [placement]="chartPlacement" [getAnchor]="getMenuAnchor"
                                     [disabled]="error" [active]="isActive">
                    <div class="demo-btn-group"><ng-container [ngTemplateOutlet]="resetSeriesButton" /></div>
                    <div class="demo-menu-divider"></div>
                    <ng-container [ngTemplateOutlet]="chartCountControl" />
                    <ng-container [ngTemplateOutlet]="modeControl" />
                  </app-overflow-menu>
                }
                <app-export-share-menu [disabled]="error" [active]="isActive"
                                       [exportPng]="onExportPng" [exportSvg]="onExportSvg"
                                       [getShareState]="showShareButton ? getShareState : undefined" />
              </span>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class EditableChart implements OnInit, OnChanges, OnDestroy {
  readonly text = demoText.editableChart;

  @Input({ required: true }) width!: number;
  @Input({ required: true }) mochartDemoConfig!: MochartDemoConfig;
  @Input({ required: true }) data!: Row[];

  getShareState = (): { mode: 'single'; config: Record<string, unknown>; data: Row[] } => ({ mode: 'single', config: this.mochartDemoConfig.config, data: this.data });
  @Input() dataError: string | boolean | null = false;
  @Input({ required: true }) isActive!: boolean;
  @Input({ required: true }) chartCount!: number;
  @Input({ required: true }) showChartCountControls!: boolean;
  /** Set on the chart instance that should render the share button. */
  @Input() showShareButton = false;
  @Input({ required: true }) filteredSeriesIds!: FilteredSeriesIds;
  @Input({ required: true }) focusedCategoryIndex!: number;
  @Input() focusedValueAxisId: string | null = null;
  @Input() focusedSeriesId: string | null = null;
  @Input({ required: true }) onFocus!: (focusData: FocusData) => void;
  @Input({ required: true }) onSeriesFilter!: (filterData: { filteredSeriesIds: FilteredSeriesIds }) => void;
  @Input({ required: true }) onChartCountToggle!: () => void;

  @ViewChild('chartContent', { static: true }) chartContentElement!: ElementRef<HTMLDivElement>;

  // ------------------------------------------------------------------------
  // The phone fold. Which panel folds — and what each sends to the overflow
  // menu — mirrors the vanilla port's placeControls.
  // ------------------------------------------------------------------------
  readonly overflowText = demoText.overflowMenu.chart;
  readonly chartPlacement = controlsMenuPlacement;

  private readonly phone = phoneViewport();

  /**
   * Only one of the three branches renders, so this query resolves to that
   * branch's `.chart-controls-menu`. The ⋯ anchors to the whole span because
   * the export trigger sits to its right — aligning to the ⋯ alone would stop
   * the panel short of the row's end and hang it off the left edge.
   */
  @ViewChild('menuSpan') menuSpanElement?: ElementRef<HTMLElement>;

  readonly getMenuAnchor = (): HTMLElement | null => this.menuSpanElement?.nativeElement ?? null;

  foldSlice(): boolean {
    return this.phone() && this.mochartDemoConfig.pieMode;
  }

  foldCategory(): boolean {
    return this.phone() && !this.mochartDemoConfig.pieMode && this.selectionMode() === 'category';
  }

  foldSeries(): boolean {
    return this.phone() && !this.mochartDemoConfig.pieMode && this.selectionMode() !== 'category';
  }

  /**
   * The series readouts drop their 5px side margins while folded: the phone
   * tier's 6px field gap is separation enough, and the margins' 20px would
   * wrap the ▲ stepper onto a second row at 320px.
   */
  indexLabelMargin(): string {
    return this.foldSeries() ? '0px' : '5px';
  }

  // Working copies of the demo data; mutated in place by the category/series
  // editing controls (same pattern as the react demo's instance fields).
  private filteredData: Row[] = [];
  private removedData: Row[] = [];
  private sequenceId: ReturnType<typeof setInterval> | null = null;

  dataProvider = signal<EditableDataProvider | null>(null);
  categoryIndex = signal(-1);
  categoryValuesText = signal('');
  seriesIndex = signal(0);
  seriesValuesText = signal('');
  selectionMode = signal('category');
  sequencePlaying = signal(false);
  // pie-mode slice editing: slices are the series, so the category machinery has
  // nothing to operate on and a single slice panel replaces both panels
  slices = signal<PieSliceInfo[]>([]);
  sliceIndex = signal(0);
  sliceValueText = signal('');
  filteredFocusedCategoryIndex = signal(-1);
  orderChanged = signal(false);

  getChartContent = (): Element | null => this.chartContentElement?.nativeElement ?? null;

  onExportPng = (): void => {
    const container = this.getChartContent();
    if (container) {
      void exportPNG(container, getChartExportOptions());
    }
  };

  onExportSvg = (): void => {
    const container = this.getChartContent();
    if (container) {
      exportSVG(container, getChartExportOptions());
    }
  };

  private getFilteredFocusedCategoryIndex(nextFilteredData: Row[]): number {
    let nextFilteredFocusedCategoryIndex = -1;
    if (this.focusedCategoryIndex >= 0) {
      const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
      // a stale index (combined config+data update) must degrade to no focus, not throw
      const categoryValue = this.data[this.focusedCategoryIndex]?.[categoryProperty];
      const count = nextFilteredData.length;
      for (let i = 0; i < count; i++) {
        if (nextFilteredData[i][categoryProperty] === categoryValue) {
          nextFilteredFocusedCategoryIndex = i;
          break;
        }
      }
    }
    return nextFilteredFocusedCategoryIndex;
  }

  private updateFilteredDataState(
    nextState: { orderChanged?: boolean; categoryIndex?: number; seriesIndex?: number; categoryValuesText?: string; seriesValuesText?: string },
    nextFilteredData: Row[],
    nextRemovedData: Row[],
    resetCategoryIndex = true
  ): void {
    this.filteredData = nextFilteredData;
    this.removedData = nextRemovedData;
    if (resetCategoryIndex === true) {
      this.categoryIndex.set(-1);
      this.seriesValuesText.set(selectACategoryText);
    }
    this.filteredFocusedCategoryIndex.set(this.dataError ? -1 : this.getFilteredFocusedCategoryIndex(nextFilteredData));
    if (!this.dataError && this.mochartDemoConfig.mochartConfig.validation.valid) {
      this.dataProvider.set(new ArrayOfObjectsDataProvider(nextFilteredData));
    }
    else if (this.dataError) {
      this.dataProvider.set(createErrorDataProvider(this.dataError));
    }
    else {
      this.dataProvider.set(null);
    }
    if (nextState.orderChanged !== undefined) {
      this.orderChanged.set(nextState.orderChanged);
    }
    if (nextState.categoryIndex !== undefined) {
      this.categoryIndex.set(nextState.categoryIndex);
    }
    if (nextState.seriesIndex !== undefined) {
      this.seriesIndex.set(nextState.seriesIndex);
    }
    if (nextState.categoryValuesText !== undefined) {
      this.categoryValuesText.set(nextState.categoryValuesText);
    }
    if (nextState.seriesValuesText !== undefined) {
      this.seriesValuesText.set(nextState.seriesValuesText);
    }
  }

  private initData(): void {
    const nextFilteredData: Row[] = [];
    if (this.data && !this.dataError) {
      const count = this.data.length;
      for (let i = 0; i < count; i++) {
        nextFilteredData.push(Object.assign({}, this.data[i]));
      }
    }
    this.slices.set(this.mochartDemoConfig.pieMode ? getPieSlices(this.mochartDemoConfig.mochartConfig) : []);
    if (this.sliceIndex() >= this.slices().length) {
      this.sliceIndex.set(0);
    }
    this.sliceValueText.set(this.getSliceValueText(nextFilteredData));
    this.updateFilteredDataState({ orderChanged: false, seriesIndex: 0, categoryValuesText: emptyCategoryText }, nextFilteredData, []);
  }

  ngOnInit(): void {
    this.initData();
  }

  // Mirror the vue watch on [data, dataError, mochartDemoConfig,
  // focusedCategoryIndex, isActive].
  ngOnChanges(changes: SimpleChanges): void {
    if (Object.values(changes).some(change => change.firstChange)) {
      return;
    }
    const configChange = changes['mochartDemoConfig'];
    if (changes['data'] || changes['dataError'] ||
        (configChange &&
         hasConfigStructureChange((configChange.previousValue as MochartDemoConfig).mochartConfig, this.mochartDemoConfig.mochartConfig))) {
      this.initData();
    }
    else if (changes['focusedCategoryIndex']) {
      this.filteredFocusedCategoryIndex.set(this.getFilteredFocusedCategoryIndex(this.filteredData));
    }
    if (changes['isActive'] && this.isActive === false) {
      this.stopSequence();
    }
  }

  // mochart's ManagedChart reports focus with the new payload shape; adapt it
  // to the { valueAxisId, seriesId, categoryIndex } shape this demo tracks.
  onChartFocus({ focusedValueAxisId: valueAxisId, focusedSeriesId: seriesId, focusedCategoryIndex: chartCategoryIndex }: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }): void {
    this.onLocalFocus({ valueAxisId, seriesId, categoryIndex: chartCategoryIndex });
  }

  private onLocalFocus({ valueAxisId, seriesId, categoryIndex: nextCategoryIndex }: FocusPayload): void {
    if (nextCategoryIndex !== undefined) {
      const nextFilteredFocusedCategoryIndex = nextCategoryIndex;
      let newFocusedCategoryIndex = -1;
      if (nextFilteredFocusedCategoryIndex >= 0) {
        const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
        const categoryValue = this.filteredData[nextFilteredFocusedCategoryIndex][categoryProperty];
        const count = this.data.length;
        for (let i = 0; i < count; i++) {
          if (this.data[i][categoryProperty] === categoryValue) {
            newFocusedCategoryIndex = i;
            break;
          }
        }
      }
      this.filteredFocusedCategoryIndex.set(nextFilteredFocusedCategoryIndex);
      this.onFocus({ valueAxisId, seriesId, categoryIndex: newFocusedCategoryIndex });
    }
    else {
      this.onFocus({ valueAxisId, seriesId, categoryIndex: nextCategoryIndex });
    }
  }

  onChartClick({ categoryIndex: clickedCategoryIndex }: { categoryIndex: number }): void {
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const clickedCategoryValue = '' + this.filteredData[clickedCategoryIndex][categoryProperty];
    if (this.selectionMode() === 'series') {
      this.categoryIndex.set(clickedCategoryIndex);
      this.seriesValuesText.set(getSeriesValuesText(this.mochartDemoConfig, this.filteredData, clickedCategoryIndex, this.seriesIndex()));
    }
    else if (this.selectionMode() === 'category') {
      const dataCategoryValues: any[] = [];
      const count = this.filteredData.length;
      for (let i = 0; i < count; i++) {
        dataCategoryValues.push(this.filteredData[i][categoryProperty]);
      }
      let parsedCategoryValues = this.categoryValuesText() === emptyCategoryText ? [] : this.categoryValuesText().split(',');
      parsedCategoryValues = parsedCategoryValues.filter((parsedCategoryValue) => dataCategoryValues.indexOf(parsedCategoryValue) !== -1 || dataCategoryValues.indexOf(+parsedCategoryValue) !== -1);
      const clickedIndex = parsedCategoryValues.indexOf(clickedCategoryValue);
      if (clickedIndex === -1) {
        parsedCategoryValues = parsedCategoryValues.concat(clickedCategoryValue);
      }
      else {
        parsedCategoryValues.splice(clickedIndex, 1);
      }
      this.categoryValuesText.set(parsedCategoryValues.length === 0 ? emptyCategoryText : parsedCategoryValues.join(','));
    }
  }

  onCategoryValuesInput(event: Event): void {
    this.categoryValuesText.set((event.currentTarget as HTMLInputElement).value);
  }

  onSeriesValuesInput(event: Event): void {
    this.seriesValuesText.set((event.currentTarget as HTMLInputElement).value);
  }

  onSliceValueInput(event: Event): void {
    this.sliceValueText.set((event.currentTarget as HTMLInputElement).value);
  }

  onModeToggle = (): void => {
    this.selectionMode.set(this.selectionMode() === 'category' ? 'series' : 'category');
  };

  selectAllCategories = (): void => {
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const allCategoryValues: any[] = [];
    const count = this.data.length;
    for (let i = 0; i < count; i++) {
      allCategoryValues.push(this.data[i][categoryProperty]);
    }
    this.categoryValuesText.set(allCategoryValues.join(','));
  };

  resetCategories = (): void => {
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryToObjectMap: Record<string, Row> = {};
    this.removedData.forEach(removedObject => {
      categoryToObjectMap[removedObject[categoryProperty]] = removedObject;
    });
    this.filteredData.forEach(oldObject => {
      categoryToObjectMap[oldObject[categoryProperty]] = oldObject;
    });
    const nextFilteredData = this.data.map(o => categoryToObjectMap[o[categoryProperty]]);
    this.updateFilteredDataState({ orderChanged: false }, nextFilteredData, []);
  };

  reverseCategories = (): void => {
    if (this.filteredData && this.filteredData.length > 1) {
      const nextFilteredData = this.filteredData.slice().reverse();
      this.updateFilteredDataState({ orderChanged: true }, nextFilteredData, this.removedData);
    }
  };

  decreaseCategoryOrder = (): void => {
    if (this.filteredData && this.filteredData.length > 1) {
      if (this.categoryIndex() > 0) {
        const nextFilteredData = this.filteredData.slice();
        const temp = nextFilteredData[this.categoryIndex() - 1];
        nextFilteredData[this.categoryIndex() - 1] = nextFilteredData[this.categoryIndex()];
        nextFilteredData[this.categoryIndex()] = temp;
        this.updateFilteredDataState({ orderChanged: true, categoryIndex: this.categoryIndex() - 1 }, nextFilteredData, this.removedData, false);
      }
    }
  };

  increaseCategoryOrder = (): void => {
    if (this.filteredData && this.filteredData.length > 1) {
      if (this.categoryIndex() < this.filteredData.length - 1) {
        const nextFilteredData = this.filteredData.slice();
        const temp = nextFilteredData[this.categoryIndex() + 1];
        nextFilteredData[this.categoryIndex() + 1] = nextFilteredData[this.categoryIndex()];
        nextFilteredData[this.categoryIndex()] = temp;
        this.updateFilteredDataState({ orderChanged: true, categoryIndex: this.categoryIndex() + 1 }, nextFilteredData, this.removedData, false);
      }
    }
  };

  addCategories = (): void => {
    const oldFilteredData = this.filteredData;
    const oldRemovedData = this.removedData;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToAdd = this.categoryValuesText() === emptyCategoryText ? [] : this.categoryValuesText().split(',');
    const categoryValueToAddMap: Record<string, boolean> = {};
    categoryValuesToAdd.forEach(categoryValueToAdd => {
      categoryValueToAddMap[categoryValueToAdd] = true;
    });
    const removedMap: Record<string, Row> = {};
    oldRemovedData.forEach(removedObject => {
      removedMap[removedObject[categoryProperty]] = removedObject;
    });
    const count = this.data.length;
    const filteredCount = oldFilteredData.length;
    const nextFilteredData: Row[] = [];
    for (let i = 0, fi = 0; i < count; i++) {
      if (fi < filteredCount) {
        if (this.data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
          if (categoryValueToAddMap[this.data[i][categoryProperty]] === true) {
            nextFilteredData.push(removedMap[this.data[i][categoryProperty]]);
            delete removedMap[this.data[i][categoryProperty]];
          }
        }
        else {
          nextFilteredData.push(oldFilteredData[fi]);
          fi++;
        }
      }
      else if (categoryValueToAddMap[this.data[i][categoryProperty]] === true) {
        nextFilteredData.push(removedMap[this.data[i][categoryProperty]]);
        delete removedMap[this.data[i][categoryProperty]];
      }
    }
    const nextRemovedData: Row[] = [];
    oldRemovedData.forEach(removedObject => {
      if (removedMap[removedObject[categoryProperty]] !== undefined) {
        nextRemovedData.push(removedMap[removedObject[categoryProperty]]);
      }
    });
    this.updateFilteredDataState({}, nextFilteredData, nextRemovedData);
  };

  removeCategories = (): void => {
    const oldFilteredData = this.filteredData;
    const nextRemovedData = this.removedData;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = this.categoryValuesText() === emptyCategoryText ? [] : this.categoryValuesText().split(',');
    const categoryValueToRemoveMap: Record<string, boolean> = {};
    categoryValuesToRemove.forEach(categoryValueToRemove => {
      categoryValueToRemoveMap[categoryValueToRemove] = true;
    });
    const count = oldFilteredData.length;
    const nextFilteredData: Row[] = [];
    for (let i = 0; i < count; i++) {
      if (categoryValueToRemoveMap[oldFilteredData[i][categoryProperty]] !== true) {
        nextFilteredData.push(oldFilteredData[i]);
      }
      else {
        nextRemovedData.push(oldFilteredData[i]);
      }
    }
    this.updateFilteredDataState({}, nextFilteredData, nextRemovedData);
  };

  startAddSequence = (): void => {
    const oldFilteredData = this.filteredData;
    const oldRemovedData = this.removedData;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToAdd = this.categoryValuesText() === emptyCategoryText ? [] : this.categoryValuesText().split(',');
    const categoryValueToAddMap: Record<string, boolean> = {};
    categoryValuesToAdd.forEach(categoryValueToAdd => {
      categoryValueToAddMap[categoryValueToAdd] = true;
    });
    const removedIndexMap: Record<string, number> = {};
    oldRemovedData.forEach((removedObject, removedIndex) => {
      removedIndexMap[removedObject[categoryProperty]] = removedIndex;
    });
    const categoryObjectsToAdd: { removedIndex: number; dataIndex: number }[] = [];
    const count = this.data.length;
    const filteredCount = oldFilteredData.length;
    for (let i = 0, fi = 0; i < count; i++) {
      if (fi < filteredCount) {
        if (this.data[i][categoryProperty] !== oldFilteredData[fi][categoryProperty]) {
          if (categoryValueToAddMap[this.data[i][categoryProperty]] === true) {
            categoryObjectsToAdd.push({
              removedIndex: removedIndexMap[this.data[i][categoryProperty]] - categoryObjectsToAdd.length,
              dataIndex: fi + categoryObjectsToAdd.length
            });
          }
        }
        else {
          fi++;
        }
      }
      else if (categoryValueToAddMap[this.data[i][categoryProperty]] === true) {
        categoryObjectsToAdd.push({
          removedIndex: removedIndexMap[this.data[i][categoryProperty]] - categoryObjectsToAdd.length,
          dataIndex: fi + categoryObjectsToAdd.length
        });
      }
    }
    if (categoryObjectsToAdd.length > 0) {
      this.sequencePlaying.set(true);
      let addCount = 0;
      this.sequenceId = setInterval(() => {
        oldFilteredData.splice(categoryObjectsToAdd[addCount].dataIndex, 0, oldRemovedData.splice(categoryObjectsToAdd[addCount].removedIndex, 1)[0]);
        this.updateFilteredDataState({}, oldFilteredData, oldRemovedData);
        if (addCount < categoryObjectsToAdd.length - 1) {
          addCount++;
        }
        else {
          this.stopSequence();
        }
      }, 2000);
    }
  };

  startRemoveSequence = (): void => {
    const oldFilteredData = this.filteredData;
    const oldRemovedData = this.removedData;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const categoryValuesToRemove = this.categoryValuesText() === emptyCategoryText ? [] : this.categoryValuesText().split(',');
    const categoryValueToRemoveMap: Record<string, boolean> = {};
    categoryValuesToRemove.forEach(categoryValueToRemove => {
      categoryValueToRemoveMap[categoryValueToRemove] = true;
    });
    const removedIndexMap: Record<string, number> = {};
    oldRemovedData.forEach((removedObject, removedIndex) => {
      removedIndexMap[removedObject[categoryProperty]] = removedIndex;
    });
    const categoryObjectsToRemove: { removedIndex: number; dataIndex: number }[] = [];
    const count = this.data.length;
    const filteredCount = oldFilteredData.length;
    for (let i = 0, fi = 0, ri = 0; i < count && fi < filteredCount; i++) {
      if (this.data[i][categoryProperty] === oldFilteredData[fi][categoryProperty]) {
        if (categoryValueToRemoveMap[this.data[i][categoryProperty]] === true) {
          categoryObjectsToRemove.push({
            removedIndex: ri,
            dataIndex: fi - categoryObjectsToRemove.length
          });
          ri++;
        }
        fi++;
      }
      else {
        ri++;
      }
    }
    if (categoryObjectsToRemove.length > 0) {
      this.sequencePlaying.set(true);
      let removeCount = 0;
      this.sequenceId = setInterval(() => {
        oldRemovedData.splice(categoryObjectsToRemove[removeCount].removedIndex, 0, oldFilteredData.splice(categoryObjectsToRemove[removeCount].dataIndex, 1)[0]);
        this.updateFilteredDataState({}, oldFilteredData, oldRemovedData);
        if (removeCount < categoryObjectsToRemove.length - 1) {
          removeCount++;
        }
        else {
          this.stopSequence();
        }
      }, 2000);
    }
  };

  stopSequence = (): void => {
    this.stopSequenceInternal();
    this.sequencePlaying.set(false);
  };

  private stopSequenceInternal(): void {
    if (this.sequenceId !== null) {
      clearInterval(this.sequenceId);
      this.sequenceId = null;
    }
  }

  private getSliceValueText(rows: Row[]): string {
    const slices = this.slices();
    if (slices.length === 0 || rows.length === 0) {
      return '';
    }
    const value = rows[0][slices[this.sliceIndex()].property];
    return value === undefined || value === null ? '' : String(value);
  }

  private selectSlice(nextSliceIndex: number): void {
    if (nextSliceIndex >= 0 && nextSliceIndex < this.slices().length) {
      this.sliceIndex.set(nextSliceIndex);
      this.sliceValueText.set(this.getSliceValueText(this.filteredData));
    }
  }

  prevSlice = (): void => {
    this.selectSlice(this.sliceIndex() - 1);
  };

  nextSlice = (): void => {
    this.selectSlice(this.sliceIndex() + 1);
  };

  onChartSliceClick = ({ seriesId }: { seriesId: string }): void => {
    this.selectSlice(this.slices().findIndex(slice => slice.id === seriesId));
  };

  applySliceChanges = (): void => {
    const value = parseFloat(this.sliceValueText());
    if (!isNaN(value) && isFinite(value) && this.filteredData.length > 0 && this.slices().length > 0) {
      applyPieSliceValue(this.filteredData[0], this.slices()[this.sliceIndex()].property, value);
      this.updateFilteredDataState({}, this.filteredData, this.removedData, false);
    }
  };

  resetSliceChanges = (): void => {
    if (this.filteredData.length > 0 && this.data.length > 0 && this.slices().length > 0) {
      const property = this.slices()[this.sliceIndex()].property;
      applyPieSliceValue(this.filteredData[0], property, this.data[0][property] as number);
      this.sliceValueText.set(this.getSliceValueText(this.filteredData));
      this.updateFilteredDataState({}, this.filteredData, this.removedData, false);
    }
  };

  // The pie analog of the category add/remove sequences: filter the slices one
  // at a time (via the shared legend filter, so the remaining slices re-sweep
  // and center totals count along), then restore them.
  startSliceSequence = (): void => {
    const steps = getPieSequenceSteps(this.slices().map(slice => slice.id));
    if (steps.length > 0) {
      this.sequencePlaying.set(true);
      let stepCount = 0;
      this.sequenceId = setInterval(() => {
        this.onSeriesFilter({ filteredSeriesIds: steps[stepCount] });
        if (stepCount < steps.length - 1) {
          stepCount++;
        }
        else {
          this.stopSequence();
        }
      }, 2000);
    }
  };

  prevSeries = (): void => {
    if (this.categoryIndex() !== -1 && this.seriesIndex() > 0) {
      this.seriesIndex.update(seriesIndex => seriesIndex - 1);
      this.seriesValuesText.set(getSeriesValuesText(this.mochartDemoConfig, this.filteredData, this.categoryIndex(), this.seriesIndex()));
    }
  };

  nextSeries = (): void => {
    const { seriesCount } = this.mochartDemoConfig;
    if (this.categoryIndex() !== -1 && this.seriesIndex() < seriesCount - 1) {
      this.seriesIndex.update(seriesIndex => seriesIndex + 1);
      this.seriesValuesText.set(getSeriesValuesText(this.mochartDemoConfig, this.filteredData, this.categoryIndex(), this.seriesIndex()));
    }
  };

  applySeriesChanges = (): void => {
    const filteredDataObject = this.filteredData[this.categoryIndex()];
    const { mochartConfig } = this.mochartDemoConfig;
    const { series: seriesConfigs } = mochartConfig;
    if (seriesConfigs.length > 0) {
      try {
        const dataObject = parseJson(this.seriesValuesText()) as Record<string, unknown>;
        const seriesConfig = seriesConfigs[this.seriesIndex()];
        const { property, rangeProperty, markerProperty, labelProperty, colorProperty, tooltipProperty, errorLowProperty, errorHighProperty } = seriesConfig;
        filteredDataObject[property!] = dataObject['p'];
        if (rangeProperty !== NONE) {
          filteredDataObject[rangeProperty] = dataObject['r'];
        }
        if (markerProperty !== NONE) {
          filteredDataObject[markerProperty] = dataObject['m'];
        }
        if (labelProperty !== NONE) {
          filteredDataObject[labelProperty] = dataObject['l'];
        }
        if (colorProperty !== NONE) {
          filteredDataObject[colorProperty] = dataObject['c'];
        }
        if (tooltipProperty !== NONE) {
          filteredDataObject[tooltipProperty] = dataObject['t'];
        }
        if (errorLowProperty !== NONE) {
          filteredDataObject[errorLowProperty] = dataObject['el'];
        }
        if (errorHighProperty !== NONE) {
          filteredDataObject[errorHighProperty] = dataObject['eh'];
        }
        this.updateFilteredDataState({}, this.filteredData, this.removedData, false);
      }
      catch {

      }
    }
  };

  resetSeriesChanges = (): void => {
    const { mochartConfig } = this.mochartDemoConfig;
    const categoryProperty = this.mochartDemoConfig.categoryProperty ?? '';
    const { series: seriesConfigs } = mochartConfig;
    if (seriesConfigs.length > 0) {
      const filteredDataObject = this.filteredData[this.categoryIndex()];
      const filteredCategoryValue = filteredDataObject[categoryProperty];
      const count = this.data.length;
      let dataObject: Row | null = null;
      for (let i = 0; i < count; i++) {
        if (this.data[i][categoryProperty] === filteredCategoryValue) {
          dataObject = this.data[i];
        }
      }
      const seriesConfig = seriesConfigs[this.seriesIndex()];
      const { property, rangeProperty, markerProperty, labelProperty, colorProperty, tooltipProperty, errorLowProperty, errorHighProperty } = seriesConfig;
      filteredDataObject[property!] = dataObject![property!];
      if (rangeProperty !== NONE) {
        filteredDataObject[rangeProperty] = dataObject![rangeProperty];
      }
      if (markerProperty !== NONE) {
        filteredDataObject[markerProperty] = dataObject![markerProperty];
      }
      if (labelProperty !== NONE) {
        filteredDataObject[labelProperty] = dataObject![labelProperty];
      }
      if (colorProperty !== NONE) {
        filteredDataObject[colorProperty] = dataObject![colorProperty];
      }
      if (tooltipProperty !== NONE) {
        filteredDataObject[tooltipProperty] = dataObject![tooltipProperty];
      }
      if (errorLowProperty !== NONE) {
        filteredDataObject[errorLowProperty] = dataObject![errorLowProperty];
      }
      if (errorHighProperty !== NONE) {
        filteredDataObject[errorHighProperty] = dataObject![errorHighProperty];
      }
      this.updateFilteredDataState({ seriesValuesText: getSeriesValuesText(this.mochartDemoConfig, this.filteredData, this.categoryIndex(), this.seriesIndex()) }, this.filteredData, this.removedData, false);
    }
  };

  ngOnDestroy(): void {
    this.stopSequenceInternal();
  }

  get chartDataError(): boolean {
    const dataProvider = this.dataProvider();
    return !!(dataProvider && dataProvider.getError && dataProvider.getError());
  }

  get configError(): boolean {
    return !this.mochartDemoConfig.valid;
  }

  get error(): boolean {
    return this.chartDataError || this.configError;
  }

  get filteredCategoryValues(): readonly any[] {
    const dataProvider = this.dataProvider();
    return this.error || !dataProvider ? [] : dataProvider.getPropertyValues(this.mochartDemoConfig.mochartConfig.categoryAxis.property ?? '') ?? [];
  }

  get selectedCategoryValues(): string[] {
    return (this.error || this.categoryValuesText() === emptyCategoryText) ? [] : this.categoryValuesText().split(',');
  }

  get filteredCategoryMap(): Record<string, boolean> {
    return this.filteredCategoryValues.reduce<Record<string, boolean>>((map, category) => { map[category] = true; return map; }, {});
  }

  get disableRemove(): boolean {
    return this.orderChanged() || !this.selectedCategoryValues.some(category => this.filteredCategoryMap[category]);
  }

  get disableAdd(): boolean {
    return this.orderChanged() || !this.selectedCategoryValues.some(category => !this.filteredCategoryMap[category]);
  }

  get seriesControlsDisabled(): boolean {
    return this.sequencePlaying() || this.categoryIndex() === -1;
  }

  get categoryOrderControlsDisabled(): boolean {
    return this.sequencePlaying() || this.categoryIndex() === -1;
  }

  get isFirstCategory(): boolean {
    return this.categoryIndex() === 0;
  }

  get isLastCategory(): boolean {
    return this.categoryIndex() === this.filteredCategoryValues.length - 1;
  }

  get hasPrevSeries(): boolean {
    return this.seriesIndex() > 0;
  }

  get hasNextSeries(): boolean {
    return this.seriesIndex() < this.mochartDemoConfig.seriesCount - 1;
  }

  get sliceControlsDisabled(): boolean {
    return this.error || this.sequencePlaying() || this.slices().length === 0;
  }

  // The label shows only the index, in a fixed-width span, so the controls to
  // its right don't jump as slices are stepped; the slice name is the native
  // tooltip instead.
  get sliceLabelText(): string {
    return this.slices().length > 0 ? this.text.sliceIndexPrefix : this.text.selectASliceText;
  }

  get sliceLabelTitle(): string {
    const slices = this.slices();
    return slices.length > 0 ? slices[this.sliceIndex()].title : '';
  }

  // Same idea for the category/series index labels: the fixed-width index reads as
  // the position, the native tooltip names what is selected.
  get categoryIndexTitle(): string {
    return getCategoryIndexTitle(this.mochartDemoConfig, this.filteredData, this.categoryIndex());
  }

  get seriesIndexTitle(): string {
    return getSeriesIndexTitle(this.mochartDemoConfig, this.seriesIndex());
  }
}
