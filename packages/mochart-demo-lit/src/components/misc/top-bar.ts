import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { demoText, navMenuPlacement } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { LightElement } from './LightElement';
import { PhoneViewportController } from './PhoneViewportController';
import { backToDemosButton, modeSwitcher, siteRootButton } from './mode-switcher';

import './notes-menu';
import './notes-menu-item';
import './overflow-menu';
import './theme-toggle-button';

/**
 * The bar across the top of every demo view: the site-root link, the back link
 * to the gallery, the view's tab strip, the "about this demo" popover, the
 * Single/Multi/Random mode switcher and the theme toggle. It was hand-written
 * six times (and in two shapes) before this — the same consolidation the
 * vanilla port made in its TopBar.ts, whose header documents the design.
 *
 * The phone fold: below the phone breakpoint a bar that can fold keeps exactly
 * one thing directly tappable — the tab strip — and renders everything else
 * inside a single `…` menu at the far end. Each control renders in exactly ONE
 * of the two branches, so nothing is duplicated (see overflow-menu.ts). A bar
 * folds only when it has tabs, notes or a mode switcher: rotation and
 * sparkline have none of the three, their bar is just the back link and the
 * theme toggle (which fits at every width), and folding them would produce a
 * row whose only content is a `…` holding two rows.
 *
 * The tab strip arrives as a thunk rather than projected content: this element
 * renders into the light DOM, where `<slot>` does nothing, and a thunk is the
 * package's existing idiom for passing markup (see `error-tab`'s `.content`).
 */
@customElement('top-bar')
export class TopBar extends LightElement {
  /** Undefined in a standalone build, where there is no docs site to go back to. */
  @property({ attribute: false }) siteRootUrl?: string;
  @property({ attribute: false }) onBackToDemos: () => void = () => { /* no-op */ };
  /** The view's `<li class="demo-tab-item">` rows, if it has a tab strip. */
  @property({ attribute: false }) tabs: (() => unknown) | null = null;
  /** The demo the ⓘ popover describes. The standalone pages describe none. */
  @property({ attribute: false }) notes?: { title: string; notes?: string };
  /** Omitted by the pages that are not one of the three switchable modes. */
  @property({ attribute: false }) modes?: { demoMode: SwitchableDemoMode; onModeChanged: (next: SwitchableDemoMode) => void };

  private viewport = new PhoneViewportController(this);

  private get hasNotes(): boolean {
    return this.notes !== undefined && this.notes.notes !== undefined;
  }

  private get folded(): boolean {
    return this.viewport.isPhone
      && (this.tabs !== null || this.notes !== undefined || this.modes !== undefined);
  }

  private renderMenuItems = (): unknown => {
    const { notes, modes } = this;
    // In the order a thumb should meet them: what this demo is, then where
    // else to see it, then how it looks, then the two ways out. The about row
    // has no trailing divider when the Mode section follows — the section
    // label draws its own rule above itself whenever it is not the panel's
    // first child.
    return html`${this.hasNotes
      ? html`<notes-menu-item .demoTitle=${notes!.title} .notes=${notes!.notes}></notes-menu-item>`
      : nothing}${this.hasNotes && modes === undefined ? html`<div class="demo-menu-divider"></div>` : nothing}${modes !== undefined
      ? html`<div class="demo-menu-section-label">${demoText.modeSwitcher.menuSectionLabel}</div>${modeSwitcher({ demoMode: modes.demoMode, isPhone: true, onModeChanged: modes.onModeChanged })}<div class="demo-menu-divider"></div>`
      : nothing}<theme-toggle-button></theme-toggle-button>
      <div class="demo-menu-divider"></div>
      ${backToDemosButton(this.onBackToDemos)}${siteRootButton(this.siteRootUrl)}`;
  };

  override render(): unknown {
    const { folded } = this;
    // `demo-has-overflow` gates the stylesheet's `flex-wrap: nowrap` chain,
    // which is only safe while the row's surplus has somewhere to go — the
    // class and the trigger that justifies it render together or not at all.
    return html`<div class=${'mochart-demo-tabs-container' + (folded ? ' demo-has-overflow' : '')}>
      <div class="mochart-demo-nav-group">
        ${folded ? nothing : html`${siteRootButton(this.siteRootUrl)}${backToDemosButton(this.onBackToDemos)}`}
        ${this.tabs !== null ? this.tabs() : nothing}
        ${!folded && this.hasNotes
          ? html`<notes-menu .demoTitle=${this.notes!.title} .notes=${this.notes!.notes}></notes-menu>`
          : nothing}
      </div>
      ${folded
        ? html`<overflow-menu .text=${demoText.overflowMenu.nav} .placement=${navMenuPlacement} .items=${this.renderMenuItems}></overflow-menu>`
        : this.modes !== undefined
          // The trailing slot is the one place the two historical shapes
          // differ: with a mode switcher it is a second nav group holding the
          // switcher and the toggle; without one the toggle is a direct child
          // of the row (an intermediate group of one would add its own gap and
          // move it).
          ? html`<div class="mochart-demo-nav-group">
              ${modeSwitcher({ demoMode: this.modes.demoMode, isPhone: this.viewport.isPhone, onModeChanged: this.modes.onModeChanged })}
              <theme-toggle-button></theme-toggle-button>
            </div>`
          : html`<theme-toggle-button></theme-toggle-button>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'top-bar': TopBar;
  }
}
