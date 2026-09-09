import { html, nothing } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { demoText, menuKeepOpenClassName } from '@mochart/demo-common';

import { LightElement } from './LightElement';
import { icon } from './templates';

/** `aria-controls` has to point at an id, and ids have to be unique. */
let disclosureIdCounter = 0;

/**
 * The phone fold's stand-in for the NotesMenu popover: a `.demo-menu-item` row
 * that expands the same title and body inline, inside the navigation row's
 * overflow panel. A popover cannot come along into the fold — its panel would
 * be a descendant of an element the menu hides with `display: none` — so
 * TopBar renders this instead below the breakpoint.
 *
 * `.demo-menu-keep-open` so revealing the note does not also dismiss the menu
 * it lives in; the panel's own `overflow-y: auto` under its `max-height` is
 * what makes a long note readable on a screen that does not scroll.
 */
@customElement('notes-menu-item')
export class NotesMenuItem extends LightElement {
  @property({ attribute: false }) demoTitle = '';
  @property({ attribute: false }) notes?: string;

  @state() private expanded = false;

  private readonly disclosureId = 'demo-notes-disclosure-l' + ++disclosureIdCounter;

  // A different demo's notes start collapsed again (history navigation).
  override willUpdate(changed: PropertyValues<this>): void {
    if (this.hasUpdated && (changed.has('demoTitle') || changed.has('notes'))) {
      this.expanded = false;
    }
  }

  override render(): unknown {
    if (this.notes === undefined) {
      return nothing;
    }
    return html`<div class="mochart-demo-notes-item ${menuKeepOpenClassName}">
      <button type="button" class="demo-menu-item"
              title=${demoText.demoNotes.trigger.tooltip}
              aria-expanded=${String(this.expanded)} aria-controls=${this.disclosureId}
              @click=${() => { this.expanded = !this.expanded; }}>${icon({ fixedWidth: true, name: 'circle-info' })} <span>${demoText.demoNotes.trigger.aria}</span>${icon({ fixedWidth: true, name: this.expanded ? 'chevron-up' : 'chevron-down', style: 'margin-left: auto;' })}</button>
      <div class="demo-field" id=${this.disclosureId} ?hidden=${!this.expanded}>
        <span class="demo-menu-notes-title">${this.demoTitle}</span>
        <span class="demo-menu-notes-body">${this.notes}</span>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notes-menu-item': NotesMenuItem;
  }
}
