import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { demoText, initTheme } from '@mochart/demo-common';

import { LightElement } from './LightElement';
import { icon } from './templates';

// One controller for the whole app; every view's toggle button shares it.
const theme = initTheme();

/**
 * Icon-only light/dark toggle; shares the docs site's theme choice.
 *
 * The `.btn-menu-label` span is text for the phone fold only: folded into the
 * navigation row's overflow menu this would be the one row with nothing to
 * read, and the class is `display: none` everywhere except inside a
 * `.demo-menu`, so it costs the bars neither a box nor one of the button's
 * gaps.
 */
@customElement('theme-toggle-button')
export class ThemeToggleButton extends LightElement {
  @state() private dark = theme.isDark();

  private unsubscribe: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = theme.onChange(dark => {
      this.dark = dark;
    });
    this.dark = theme.isDark();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  override render(): TemplateResult {
    return html`<button type="button" class="demo-btn demo-btn-secondary mochart-demo-theme-toggle"
        title=${this.dark ? demoText.themeToggle.tooltipToLight : demoText.themeToggle.tooltipToDark}
        aria-label=${demoText.themeToggle.aria}
        @click=${() => theme.toggle()}>${icon({ name: this.dark ? 'sun' : 'moon', size: 'lg', fixedWidth: true })}<span class="btn-menu-label">${this.dark ? demoText.themeToggle.menuLabelToLight : demoText.themeToggle.menuLabelToDark}</span></button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'theme-toggle-button': ThemeToggleButton;
  }
}
