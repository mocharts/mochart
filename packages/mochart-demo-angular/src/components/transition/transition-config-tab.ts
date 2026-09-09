import { Component, Input, signal } from '@angular/core';
import type { OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { applyTransitionConfigEdit, demoText, formatTransitionConfig, getDemoTabPanelAttrs, getJsonError } from '@mochart/demo-common';

import { JsonEditorContent } from '../misc/json-editor-content';
import { ButtonWithTooltip } from '../misc/button-with-tooltip';
import { Icon } from '../misc/icon';

import type { TransitionConfig } from '../../types';

@Component({
  selector: 'app-transition-config-tab',
  imports: [JsonEditorContent, ButtonWithTooltip, Icon],
  styles: [':host { display: contents; }'],
  template: `
    <div [id]="panelAttrs.id" [attr.role]="panelAttrs.role" [attr.aria-labelledby]="panelAttrs['aria-labelledby']"
         [class]="'mochart-demo-tab-container demo-layout-col config' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
      <div class="mochart-demo-tab-content">
        <app-json-editor-content [value]="configText()" [ariaLabel]="text.editorAria" [onChange]="onTextChange" />
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
export class TransitionConfigTab implements OnInit, OnChanges {
  readonly panelAttrs = getDemoTabPanelAttrs('config');

  @Input() active = false;
  @Input({ required: true }) transitionConfig!: TransitionConfig;
  @Input({ required: true }) onUpdate!: (config: TransitionConfig) => void;
  @Input({ required: true }) onReset!: () => void;

  readonly text = demoText.transitionConfigTab;

  configText = signal('');
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.configText.set(formatTransitionConfig(this.transitionConfig));
  }

  ngOnChanges(changes: SimpleChanges): void {
    const transitionConfigChange = changes['transitionConfig'];
    if (transitionConfigChange && !transitionConfigChange.firstChange) {
      this.configText.set(formatTransitionConfig(this.transitionConfig));
    }
  }

  onTextChange = (nextConfigText: string): void => {
    this.configText.set(nextConfigText);
    this.errorMessage.set(null);
  };

  onUpdateClick = (): void => {
    const result = applyTransitionConfigEdit(this.configText());
    if (result.ok) {
      this.errorMessage.set(null);
      this.onUpdate(result.config);
    }
    else {
      this.errorMessage.set(result.errorMessage);
    }
  };

  get jsonError(): string | null {
    return getJsonError(this.configText());
  }

  get footerError(): string | null {
    return this.jsonError ?? this.errorMessage();
  }
}
