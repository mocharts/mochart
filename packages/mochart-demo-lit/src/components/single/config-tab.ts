import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { buildMochartDemoConfig, controlsMenuPlacement, copyDemoConfig, demoConfigFromText, demoText, formatMochartDemoConfig, getDemoTabPanelAttrs, getJsonError, getJsonErrorMessage, isConfigSectionActive, parseConfigFromText, parseJson, slowAnimationConfig, toggleConfigFromText, toggleConfigProperty, toggleConfigSection } from '@mochart/demo-common';

import type { DemoConfigView } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { PhoneViewportController } from '../misc/PhoneViewportController';
import { buttonWithTooltip, docsLinks, icon } from '../misc/templates';
import '../misc/json-editor-content';
import '../misc/overflow-menu';

import type { DemoConfig, MochartDemoConfig } from '../../types';

const panelAttrs = getDemoTabPanelAttrs('config');

@customElement('config-tab')
export class ConfigTab extends LightElement {
  @property({ attribute: false }) active = false;
  @property({ attribute: false }) config!: DemoConfig;
  @property({ attribute: false }) onConfigChange!: (config: DemoConfig) => void;
  @property({ attribute: false }) onConfigReset!: () => void;

  @state() private showDefaults = false;
  @state() private mochartDemoConfig!: MochartDemoConfig;
  @state() private demoConfig!: DemoConfigView;
  @state() private configText = '';
  @state() private errorMessage: string | null = null;

  private viewport = new PhoneViewportController(this);

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('config')) {
      this.mochartDemoConfig = buildMochartDemoConfig(this.config);
      this.demoConfig = copyDemoConfig(this.mochartDemoConfig);
      this.configText = formatMochartDemoConfig(this.demoConfig, this.hasUpdated ? this.showDefaults : false);
    }
  }

  // demoConfig tracks the text, so the Invert/Slow states and reference links follow unapplied edits.
  private onTextChange = (nextConfigText: string): void => {
    this.configText = nextConfigText;
    this.demoConfig = demoConfigFromText(nextConfigText, this.demoConfig);
    this.errorMessage = null;
  };

  private resetConfig = (): void => {
    this.onConfigReset();
  };

  private updateShowDefaults(nextShowDefaults: boolean): void {
    try {
      const newConfig = parseJson(this.configText) as DemoConfig;
      const newMochartDemoConfig = buildMochartDemoConfig(newConfig);
      const { configValidation } = newMochartDemoConfig;
      const { valid } = configValidation;
      if (valid) {
        this.showDefaults = nextShowDefaults;
        this.configText = formatMochartDemoConfig(newMochartDemoConfig, nextShowDefaults);
        this.errorMessage = null;
      }
      else {
        const { errors, warnings } = configValidation;
        if (errors.length > 0) {
          console.warn('errors: ', errors);
        }
        if (warnings.length > 0) {
          console.warn('warnings: ', warnings);
        }
        this.errorMessage = demoText.errors.invalidChartConfig;
      }
    }
    catch (error) {
      console.warn('Invalid Chart Config JSON: ' + this.configText);
      this.errorMessage = getJsonErrorMessage(error);
    }
  }

  private toggleConfigDefaults = (): void => {
    this.updateShowDefaults(!this.showDefaults);
  };

  // Toggle against the current text (the Defaults toggle's pattern), so
  // unapplied textarea edits survive the toggle instead of being overwritten.
  private applyConfigToggle(transform: (current: DemoConfigView) => DemoConfigView): void {
    const result = toggleConfigFromText(this.configText, this.showDefaults, transform);
    if (result.error !== null) {
      this.errorMessage = result.error;
    }
    else {
      this.demoConfig = result.demoConfig;
      this.configText = result.text;
      this.errorMessage = null;
    }
  }

  private toggleConfigInverted = (): void => {
    this.applyConfigToggle(current => toggleConfigProperty(current, 'plot', 'inverted', true));
  };

  private toggleConfigAnimationSlow = (): void => {
    this.applyConfigToggle(current => toggleConfigSection(this.mochartDemoConfig, current, 'animation', slowAnimationConfig));
  };

  private applyConfig = (): void => {
    const { config, error } = parseConfigFromText(this.configText);
    this.errorMessage = error;
    if (config !== null) {
      this.onConfigChange(config);
    }
  };

  private formatConfig = (): void => {
    this.querySelector('json-editor-content')?.format();
  };

  // Live JSON validity — disables Apply and shows an inline hint while the
  // editor holds unparseable text.
  private get jsonError(): string | null {
    return getJsonError(this.configText);
  }

  override render(): unknown {
    const inverted = this.demoConfig.configWithDefaults.plot.inverted;
    const invertedIcon = inverted ? 'chart-bar' : 'chart-column';
    const slow = isConfigSectionActive(this.demoConfig, 'animation', slowAnimationConfig);
    const slowIcon = slow ? 'hourglass' : 'hourglass-end';
    const jsonError = this.jsonError;
    const footerError = jsonError ?? this.errorMessage;
    // The phone fold. Apply stays beside the editor it applies, and the
    // `role="alert"` error span stays inline — a message that has to be read
    // cannot live behind a tap. Everything else, including the reference
    // links, goes to the `⋯` menu.
    const folded = this.viewport.isPhone;
    const resetButton = buttonWithTooltip(
      { id: 'config-reset', label: demoText.configTab.reset.label, tooltipText: demoText.configTab.reset.tooltip, tooltipPlacement: 'top-start', onClick: this.resetConfig, ariaLabel: demoText.configTab.reset.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'arrow-rotate-left' })
    );
    const defaultsButton = buttonWithTooltip(
      { id: 'config-defaults', label: demoText.configTab.defaults.label, pressed: this.showDefaults, tooltipText: demoText.configTab.defaults.tooltip, tooltipPlacement: 'top-start', onClick: this.toggleConfigDefaults, ariaLabel: demoText.configTab.defaults.aria },
      icon({ size: 'lg', fixedWidth: true, name: this.showDefaults ? 'eye' : 'eye-slash' })
    );
    const invertedButton = buttonWithTooltip(
      { id: 'config-inverted', label: demoText.configTab.invert.label, pressed: !!inverted, tooltipText: demoText.configTab.invert.tooltip, tooltipPlacement: 'top-start', onClick: this.toggleConfigInverted, ariaLabel: demoText.configTab.invert.aria },
      icon({ size: 'lg', fixedWidth: true, name: invertedIcon })
    );
    const slowButton = buttonWithTooltip(
      { id: 'config-animate-slow', label: demoText.configTab.slow.label, pressed: slow, tooltipText: demoText.configTab.slow.tooltip, tooltipPlacement: 'top-start', onClick: this.toggleConfigAnimationSlow, ariaLabel: demoText.configTab.slow.aria },
      icon({ size: 'lg', fixedWidth: true, name: slowIcon })
    );
    const formatButton = buttonWithTooltip(
      { id: 'config-format', label: demoText.configTab.format.label, disabled: jsonError !== null, tooltipText: demoText.configTab.format.tooltip, tooltipPlacement: 'top-start', onClick: this.formatConfig, ariaLabel: demoText.configTab.format.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'indent' })
    );
    const applyButton = buttonWithTooltip(
      { id: 'config-apply', label: demoText.configTab.apply.label, disabled: jsonError !== null, tooltipText: demoText.configTab.apply.tooltip, tooltipPlacement: 'top-start', onClick: this.applyConfig, ariaLabel: demoText.configTab.apply.aria },
      icon({ size: 'lg', fixedWidth: true, name: 'check' })
    );
    const links = docsLinks(this.demoConfig.configWithoutDefaults);
    return html`<div id=${panelAttrs.id} role=${panelAttrs.role} aria-labelledby=${panelAttrs['aria-labelledby']}
        class=${'mochart-demo-tab-container demo-layout-col config' + (this.active ? ' active' : '')} ?inert=${!this.active}>
      <div class="mochart-demo-tab-content">
        <json-editor-content .value=${this.configText} .ariaLabelText=${demoText.configTab.editorAria}
          .formatOnSet=${true} .mochartSupport=${true} .onChange=${this.onTextChange}></json-editor-content>
      </div>
      <div class="mochart-demo-tab-footer">
        <div class="demo-toolbar">
          ${folded
            ? html`${applyButton}
              <!-- \`.editor\`, not \`.chart\`: what folds here edits the JSON,
                   and "more chart controls" would tell a screen-reader user
                   the wrong thing. Anchored to the full-width footer — the
                   trigger sits mid-row, left of an error span that comes and
                   goes. -->
              <overflow-menu .text=${demoText.overflowMenu.editor} .placement=${controlsMenuPlacement}
                .getAnchor=${this.getFooterAnchor} .active=${this.active}
                .items=${() => html`<div class="demo-btn-group">${resetButton}${defaultsButton}${invertedButton}${slowButton}${formatButton}</div>
                  ${links === nothing ? nothing : html`<div class="demo-menu-divider"></div>${links}`}`}></overflow-menu>`
            : html`${resetButton}${defaultsButton}${invertedButton}${slowButton}${formatButton}${applyButton}`}
          ${footerError ? html`<span class="mochart-demo-footer-error" role="alert">${footerError}</span>` : nothing}
        </div>
        ${folded ? nothing : links}
      </div>
    </div>`;
  }

  private getFooterAnchor = (): HTMLElement | null => this.querySelector('.mochart-demo-tab-footer');
}

declare global {
  interface HTMLElementTagNameMap {
    'config-tab': ConfigTab;
  }
}
