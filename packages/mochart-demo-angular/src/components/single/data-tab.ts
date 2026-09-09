import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Input, ViewChild, signal } from '@angular/core';
import type { OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { applyDataEdit, buildMochartDemoConfig, collectUsedDataProperties, controlsMenuPlacement, demoText, formatDataView, getCategoryProperty, getDemoTabPanelAttrs, getJsonError, parseFullData } from '@mochart/demo-common';
import type { ParsedFullData } from '@mochart/demo-common';

import { JsonEditorContent } from '../misc/json-editor-content';
import { ButtonWithTooltip } from '../misc/button-with-tooltip';
import { Icon } from '../misc/icon';
import { OverflowMenu } from '../misc/overflow-menu';
import { phoneViewport } from '../misc/phone-viewport';

import type { DemoConfig, DataObject } from '../../types';

@Component({
  selector: 'app-data-tab',
  imports: [JsonEditorContent, ButtonWithTooltip, Icon, NgTemplateOutlet, OverflowMenu],
  styles: [':host { display: contents; }'],
  template: `
    <ng-template #resetButton>
      <app-button-with-tooltip id="data-reset" [label]="text.reset.label" [tooltipText]="text.reset.tooltip" tooltipPlacement="top-start"
                               [onClick]="resetData" [aria-label]="text.reset.aria">
        <app-icon size="lg" [fixedWidth]="true" name="arrow-rotate-left" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #unusedButton>
      <app-button-with-tooltip id="data-unused" [label]="text.unused.label" [pressed]="showUnused()"
                               [tooltipText]="text.unused.tooltip" tooltipPlacement="top-start"
                               [onClick]="toggleShowUnused" [aria-label]="text.unused.aria">
        <app-icon size="lg" [fixedWidth]="true" [name]="showUnused() ? 'eye' : 'eye-slash'" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #applyButton>
      <app-button-with-tooltip id="data-apply" [label]="text.apply.label" [disabled]="jsonError !== null"
                               [tooltipText]="text.apply.tooltip" tooltipPlacement="top-start"
                               [onClick]="applyData" [aria-label]="text.apply.aria">
        <app-icon size="lg" [fixedWidth]="true" name="check" />
      </app-button-with-tooltip>
    </ng-template>

    <!-- Same fold as the config footer — Apply and the \`role="alert"\` error
         stay inline, the rest goes to the \`⋯\`; the reasons live on ConfigTab. -->
    <div [id]="panelAttrs.id" [attr.role]="panelAttrs.role" [attr.aria-labelledby]="panelAttrs['aria-labelledby']"
         [class]="'mochart-demo-tab-container demo-layout-col data' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
      <div class="mochart-demo-tab-content">
        <app-json-editor-content [value]="dataText()" [ariaLabel]="text.editorAria" [onChange]="onTextChange" />
      </div>
      <div class="mochart-demo-tab-footer" #footer>
        <div class="demo-toolbar">
          @if (phone()) {
            <ng-container [ngTemplateOutlet]="applyButton" />
            <app-overflow-menu [text]="overflowText" [placement]="editorPlacement" [getAnchor]="getFooterAnchor" [active]="active">
              <div class="demo-btn-group">
                <ng-container [ngTemplateOutlet]="resetButton" />
                <ng-container [ngTemplateOutlet]="unusedButton" />
              </div>
            </app-overflow-menu>
          } @else {
            <ng-container [ngTemplateOutlet]="resetButton" />
            <ng-container [ngTemplateOutlet]="unusedButton" />
            <ng-container [ngTemplateOutlet]="applyButton" />
          }
          @if (footerError) {
            <span class="mochart-demo-footer-error" role="alert">{{ footerError }}</span>
          }
        </div>
      </div>
    </div>
  `
})
export class DataTab implements OnInit, OnChanges {
  readonly panelAttrs = getDemoTabPanelAttrs('data');

  @Input() active = false;

  // The phone fold (see the comment above the pane in the template).
  @ViewChild('footer', { static: true }) footerElement!: ElementRef<HTMLDivElement>;
  readonly phone = phoneViewport();
  readonly overflowText = demoText.overflowMenu.editor;
  readonly editorPlacement = controlsMenuPlacement;
  readonly getFooterAnchor = (): HTMLElement => this.footerElement.nativeElement;
  @Input({ required: true }) config!: DemoConfig;
  @Input({ required: true }) data!: DataObject[];
  @Input({ required: true }) onDataChange!: (data: DataObject[]) => void;
  @Input({ required: true }) onDataError!: (errorMessage: string) => void;
  @Input({ required: true }) onDataReset!: () => void;

  readonly text = demoText.dataTab;

  dataText = signal('');
  errorMessage = signal<string | null>(null);
  // Data properties the chart config does not read are hidden by default; the
  // Unused button toggles them. fullData is the complete dataset backing the
  // textarea, viewUsedProperties the used-set its current content was rendered
  // with (null when every property is shown).
  showUnused = signal(false);
  private fullData: DataObject[] = [];
  private usedProperties: Set<string> | null = null;
  private viewUsedProperties: Set<string> | null = null;

  ngOnInit(): void {
    this.usedProperties = collectUsedDataProperties(buildMochartDemoConfig(this.config).mochartConfig);
    this.renderView(this.data);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const configChange = changes['config'];
    if (configChange && !configChange.firstChange) {
      this.usedProperties = collectUsedDataProperties(buildMochartDemoConfig(this.config).mochartConfig);
      // Re-filter for the changed config, keeping any (valid) unapplied edits.
      // The data branch below re-renders instead when data changed too.
      if (!changes['data'] && !this.showUnused()) {
        const parsed = this.parseCurrentFullData();
        if (!('error' in parsed)) {
          this.renderView(parsed.full);
        }
      }
    }
    const dataChange = changes['data'];
    if (dataChange && !dataChange.firstChange) {
      this.renderView(this.data);
    }
  }

  private renderView(fullRows: DataObject[]): void {
    this.fullData = fullRows;
    this.viewUsedProperties = this.showUnused() ? null : this.usedProperties;
    this.dataText.set(formatDataView(fullRows, this.viewUsedProperties));
  }

  private parseCurrentFullData(): ParsedFullData {
    return parseFullData(this.dataText(), this.fullData, this.viewUsedProperties, getCategoryProperty(this.config));
  }

  onTextChange = (nextDataText: string): void => {
    this.dataText.set(nextDataText);
    this.errorMessage.set(null);
  };

  resetData = (): void => {
    this.renderView(this.data);
    this.errorMessage.set(null);
    this.onDataReset();
  };

  toggleShowUnused = (): void => {
    const parsed = this.parseCurrentFullData();
    if ('error' in parsed) {
      this.errorMessage.set(parsed.error === 'json' ? demoText.errors.invalidJson : demoText.errors.invalidDataArray);
      return;
    }
    this.showUnused.set(!this.showUnused());
    this.errorMessage.set(null);
    this.renderView(parsed.full);
  };

  applyData = (): void => {
    const result = applyDataEdit(this.dataText(), this.fullData, this.viewUsedProperties, this.config);
    if (result.ok) {
      this.errorMessage.set(null);
      this.fullData = result.data;
      this.onDataChange(result.data);
    }
    else {
      this.errorMessage.set(result.errorMessage);
      this.onDataError(result.callbackError);
    }
  };

  get jsonError(): string | null {
    return getJsonError(this.dataText());
  }

  get footerError(): string | null {
    return this.jsonError ?? this.errorMessage();
  }
}
