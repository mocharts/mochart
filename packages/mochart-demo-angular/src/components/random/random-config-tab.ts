import { Component, Input, signal } from '@angular/core';
import type { OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { JsonEditorContent } from '../misc/json-editor-content';
import { ButtonWithTooltip } from '../misc/button-with-tooltip';
import { Icon } from '../misc/icon';

import { demoText, formatRandomConfig, getDemoTabPanelAttrs, getJsonError, getJsonErrorMessage, parseJson, validateRandomConfig } from '@mochart/demo-common';

import type { RandomConfigWithValid } from '../../types';

@Component({
  selector: 'app-random-config-tab',
  imports: [JsonEditorContent, ButtonWithTooltip, Icon],
  styles: [':host { display: contents; }'],
  template: `
    <div [id]="panelAttrs.id" [attr.role]="panelAttrs.role" [attr.aria-labelledby]="panelAttrs['aria-labelledby']"
         [class]="'mochart-demo-tab-container demo-layout-col config' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
      <div class="mochart-demo-tab-content">
        <app-json-editor-content [value]="configText()" [ariaLabel]="text.editorAria" [formatOnSet]="true" [onChange]="onTextChange" />
      </div>
      <div class="mochart-demo-tab-footer">
        <div class="demo-toolbar">
          <app-button-with-tooltip id="config-reset" [label]="text.reset.label" [tooltipText]="text.reset.tooltip" tooltipPlacement="top-start"
                                   [onClick]="onReset" [aria-label]="text.reset.aria">
            <app-icon size="lg" [fixedWidth]="true" name="arrow-rotate-left" />
          </app-button-with-tooltip>
          <app-button-with-tooltip id="config-apply" [label]="text.apply.label" [disabled]="jsonError !== null"
                                   [tooltipText]="text.apply.tooltip" tooltipPlacement="top-start"
                                   [onClick]="onUpdateClick" [aria-label]="text.apply.aria">
            <app-icon size="lg" [fixedWidth]="true" name="check" />
          </app-button-with-tooltip>
          @if (footerError) {
            <span class="mochart-demo-footer-error" role="alert">{{ footerError }}</span>
          }
        </div>
      </div>
    </div>
  `
})
export class RandomConfigTab implements OnInit, OnChanges {
  readonly panelAttrs = getDemoTabPanelAttrs('config');

  @Input() active = false;
  @Input({ required: true }) randomConfig!: RandomConfigWithValid;
  /** The current demo's generator id, for schema dispatch. */
  @Input() generator?: string;
  @Input({ required: true }) onUpdate!: (config: RandomConfigWithValid) => void;
  @Input({ required: true }) onReset!: () => void;

  readonly text = demoText.randomConfigTab;

  configText = signal('');
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.configText.set(formatRandomConfig(this.randomConfig));
  }

  ngOnChanges(changes: SimpleChanges): void {
    const randomConfigChange = changes['randomConfig'];
    if (randomConfigChange && !randomConfigChange.firstChange) {
      this.configText.set(formatRandomConfig(this.randomConfig));
    }
  }

  onTextChange = (nextConfigText: string): void => {
    this.configText.set(nextConfigText);
    this.errorMessage.set(null);
  };

  onUpdateClick = (): void => {
    try {
      const newConfig = parseJson(this.configText()) as RandomConfigWithValid;
      newConfig.valid = validateRandomConfig(newConfig, this.generator);
      this.errorMessage.set(newConfig.valid ? null : demoText.errors.invalidRandomConfigValues);
      this.onUpdate(newConfig);
    }
    catch (error) {
      console.warn('Invalid Random Config JSON: ' + this.configText());
      this.errorMessage.set(getJsonErrorMessage(error));
    }
  };

  get jsonError(): string | null {
    return getJsonError(this.configText());
  }

  get footerError(): string | null {
    return this.jsonError ?? this.errorMessage();
  }
}
