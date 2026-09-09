import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Input, ViewChild, signal } from '@angular/core';
import type { OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { buildMochartDemoConfig, controlsMenuPlacement, copyDemoConfig, demoConfigFromText, demoText, formatMochartDemoConfig, getDemoTabPanelAttrs, getJsonError, getJsonErrorMessage, getReferenceSectionIds, isConfigSectionActive, parseConfigFromText, parseJson, slowAnimationConfig, toggleConfigFromText, toggleConfigProperty, toggleConfigSection } from '@mochart/demo-common';

import type { DemoConfigView } from '@mochart/demo-common';

import { JsonEditorContent } from '../misc/json-editor-content';
import { ButtonWithTooltip } from '../misc/button-with-tooltip';
import { DocsLinks } from '../misc/docs-links';
import { Icon } from '../misc/icon';
import { OverflowMenu } from '../misc/overflow-menu';
import { phoneViewport } from '../misc/phone-viewport';

import type { DemoConfig, MochartDemoConfig } from '../../types';

@Component({
  selector: 'app-config-tab',
  imports: [JsonEditorContent, ButtonWithTooltip, DocsLinks, Icon, NgTemplateOutlet, OverflowMenu],
  styles: [':host { display: contents; }'],
  template: `
    <ng-template #resetButton>
      <app-button-with-tooltip id="config-reset" [label]="text.reset.label" [tooltipText]="text.reset.tooltip" tooltipPlacement="top-start"
                               [onClick]="resetConfig" [aria-label]="text.reset.aria">
        <app-icon size="lg" [fixedWidth]="true" name="arrow-rotate-left" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #defaultsButton>
      <app-button-with-tooltip id="config-defaults" [label]="text.defaults.label" [pressed]="showDefaults()"
                               [tooltipText]="text.defaults.tooltip" tooltipPlacement="top-start"
                               [onClick]="toggleConfigDefaults" [aria-label]="text.defaults.aria">
        <app-icon size="lg" [fixedWidth]="true" [name]="showDefaults() ? 'eye' : 'eye-slash'" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #invertedButton>
      <app-button-with-tooltip id="config-inverted" [label]="text.invert.label" [pressed]="!!inverted"
                               [tooltipText]="text.invert.tooltip" tooltipPlacement="top-start"
                               [onClick]="toggleConfigInverted" [aria-label]="text.invert.aria">
        <app-icon size="lg" [fixedWidth]="true" [name]="invertedIcon" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #slowButton>
      <app-button-with-tooltip id="config-animate-slow" [label]="text.slow.label" [pressed]="slow"
                               [tooltipText]="text.slow.tooltip" tooltipPlacement="top-start"
                               [onClick]="toggleConfigAnimationSlow" [aria-label]="text.slow.aria">
        <app-icon size="lg" [fixedWidth]="true" [name]="slowIcon" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #formatButton>
      <app-button-with-tooltip id="config-format" [label]="text.format.label" [disabled]="jsonError !== null"
                               [tooltipText]="text.format.tooltip" tooltipPlacement="top-start"
                               [onClick]="formatConfig" [aria-label]="text.format.aria">
        <app-icon size="lg" [fixedWidth]="true" name="indent" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #applyButton>
      <app-button-with-tooltip id="config-apply" [label]="text.apply.label" [disabled]="jsonError !== null"
                               [tooltipText]="text.apply.tooltip" tooltipPlacement="top-start"
                               [onClick]="applyConfig" [aria-label]="text.apply.aria">
        <app-icon size="lg" [fixedWidth]="true" name="check" />
      </app-button-with-tooltip>
    </ng-template>
    <ng-template #docsLinks>
      <app-docs-links [config]="demoConfig()?.configWithoutDefaults" />
    </ng-template>

    <!-- The phone fold. Apply stays beside the editor it applies, and the
         \`role="alert"\` error span stays inline — a message that has to be read
         cannot live behind a tap. Everything else, including the reference
         links, goes to the \`⋯\` menu. -->
    <div [id]="panelAttrs.id" [attr.role]="panelAttrs.role" [attr.aria-labelledby]="panelAttrs['aria-labelledby']"
         [class]="'mochart-demo-tab-container demo-layout-col config' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
      <div class="mochart-demo-tab-content">
        <app-json-editor-content #editor [value]="configText()" [ariaLabel]="text.editorAria" [formatOnSet]="true"
                                 [mochartSupport]="true" [onChange]="onTextChange" />
      </div>
      <div class="mochart-demo-tab-footer" #footer>
        <div class="demo-toolbar">
          @if (phone()) {
            <ng-container [ngTemplateOutlet]="applyButton" />
            <!-- \`.editor\`, not \`.chart\`: what folds here edits the JSON, and
                 "more chart controls" would tell a screen-reader user the
                 wrong thing. Anchored to the full-width footer — the trigger
                 sits mid-row, left of an error span that comes and goes. -->
            <app-overflow-menu [text]="overflowText" [placement]="editorPlacement" [getAnchor]="getFooterAnchor" [active]="active">
              <div class="demo-btn-group">
                <ng-container [ngTemplateOutlet]="resetButton" />
                <ng-container [ngTemplateOutlet]="defaultsButton" />
                <ng-container [ngTemplateOutlet]="invertedButton" />
                <ng-container [ngTemplateOutlet]="slowButton" />
                <ng-container [ngTemplateOutlet]="formatButton" />
              </div>
              @if (hasDocsLinks) {
                <div class="demo-menu-divider"></div>
                <ng-container [ngTemplateOutlet]="docsLinks" />
              }
            </app-overflow-menu>
          } @else {
            <ng-container [ngTemplateOutlet]="resetButton" />
            <ng-container [ngTemplateOutlet]="defaultsButton" />
            <ng-container [ngTemplateOutlet]="invertedButton" />
            <ng-container [ngTemplateOutlet]="slowButton" />
            <ng-container [ngTemplateOutlet]="formatButton" />
            <ng-container [ngTemplateOutlet]="applyButton" />
          }
          @if (footerError) {
            <span class="mochart-demo-footer-error" role="alert">{{ footerError }}</span>
          }
        </div>
        @if (!phone()) {
          <ng-container [ngTemplateOutlet]="docsLinks" />
        }
      </div>
    </div>
  `
})
export class ConfigTab implements OnInit, OnChanges {
  readonly panelAttrs = getDemoTabPanelAttrs('config');

  @Input() active = false;
  @Input({ required: true }) config!: DemoConfig;
  @Input({ required: true }) onConfigChange!: (config: DemoConfig) => void;
  @Input({ required: true }) onConfigReset!: () => void;

  // The phone fold (see the comment above the pane in the template).
  @ViewChild('footer', { static: true }) footerElement!: ElementRef<HTMLDivElement>;
  @ViewChild('editor', { static: true }) editorComponent!: JsonEditorContent;
  readonly phone = phoneViewport();
  readonly overflowText = demoText.overflowMenu.editor;
  readonly editorPlacement = controlsMenuPlacement;
  readonly getFooterAnchor = (): HTMLElement => this.footerElement.nativeElement;

  get hasDocsLinks(): boolean {
    return getReferenceSectionIds(this.demoConfig()?.configWithoutDefaults).length > 0;
  }

  readonly text = demoText.configTab;

  showDefaults = signal(false);
  errorMessage = signal<string | null>(null);
  mochartDemoConfig = signal<MochartDemoConfig | null>(null);
  demoConfig = signal<DemoConfigView | null>(null);
  configText = signal('');

  ngOnInit(): void {
    this.mochartDemoConfig.set(buildMochartDemoConfig(this.config));
    this.demoConfig.set(copyDemoConfig(this.mochartDemoConfig()!));
    this.configText.set(formatMochartDemoConfig(this.demoConfig()!, false));
  }

  ngOnChanges(changes: SimpleChanges): void {
    const configChange = changes['config'];
    if (configChange && !configChange.firstChange) {
      this.mochartDemoConfig.set(buildMochartDemoConfig(this.config));
      this.demoConfig.set(copyDemoConfig(this.mochartDemoConfig()!));
      this.configText.set(formatMochartDemoConfig(this.demoConfig()!, this.showDefaults()));
    }
  }

  // demoConfig tracks the text, so the Invert/Slow states and reference links follow unapplied edits.
  onTextChange = (nextConfigText: string): void => {
    this.configText.set(nextConfigText);
    this.demoConfig.set(demoConfigFromText(nextConfigText, this.demoConfig()!));
    this.errorMessage.set(null);
  };

  resetConfig = (): void => {
    this.onConfigReset();
  };

  private updateShowDefaults(nextShowDefaults: boolean): void {
    try {
      const newConfig = parseJson(this.configText()) as DemoConfig;
      const newMochartDemoConfig = buildMochartDemoConfig(newConfig);
      const { configValidation } = newMochartDemoConfig;
      const { valid } = configValidation;
      if (valid) {
        this.showDefaults.set(nextShowDefaults);
        this.configText.set(formatMochartDemoConfig(newMochartDemoConfig, nextShowDefaults));
        this.errorMessage.set(null);
      }
      else {
        const { errors, warnings } = configValidation;
        if (errors.length > 0) {
          console.warn('errors: ', errors);
        }
        if (warnings.length > 0) {
          console.warn('warnings: ', warnings);
        }
        this.errorMessage.set(demoText.errors.invalidChartConfig);
      }
    }
    catch (error) {
      console.warn('Invalid Chart Config JSON: ' + this.configText());
      this.errorMessage.set(getJsonErrorMessage(error));
    }
  }

  toggleConfigDefaults = (): void => {
    this.updateShowDefaults(!this.showDefaults());
  };

  // Toggle against the current text (the Defaults toggle's pattern), so
  // unapplied textarea edits survive the toggle instead of being overwritten.
  private applyConfigToggle(transform: (current: DemoConfigView) => DemoConfigView): void {
    const result = toggleConfigFromText(this.configText(), this.showDefaults(), transform);
    if (result.error !== null) {
      this.errorMessage.set(result.error);
    }
    else {
      this.demoConfig.set(result.demoConfig);
      this.configText.set(result.text);
      this.errorMessage.set(null);
    }
  }

  toggleConfigInverted = (): void => {
    this.applyConfigToggle(current => toggleConfigProperty(current, 'plot', 'inverted', true));
  };

  toggleConfigAnimationSlow = (): void => {
    this.applyConfigToggle(current => toggleConfigSection(this.mochartDemoConfig()!, current, 'animation', slowAnimationConfig));
  };

  formatConfig = (): void => {
    this.editorComponent.format();
  };

  applyConfig = (): void => {
    const { config, error } = parseConfigFromText(this.configText());
    this.errorMessage.set(error);
    if (config !== null) {
      this.onConfigChange(config);
    }
  };

  get inverted(): boolean {
    return !!this.demoConfig()?.configWithDefaults['plot']?.inverted;
  }

  get invertedIcon(): string {
    return this.inverted ? 'chart-bar' : 'chart-column';
  }

  get slow(): boolean {
    const demoConfig = this.demoConfig();
    return demoConfig !== null && isConfigSectionActive(demoConfig, 'animation', slowAnimationConfig);
  }

  get slowIcon(): string {
    return this.slow ? 'hourglass' : 'hourglass-end';
  }

  // Live JSON validity — disables Apply and shows an inline hint while the
  // editor holds unparseable text.
  get jsonError(): string | null {
    return getJsonError(this.configText());
  }

  get footerError(): string | null {
    return this.jsonError ?? this.errorMessage();
  }
}
