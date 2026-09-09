import { html, nothing } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import { createMenuController, demoText, notesMenuPlacement } from '@mochart/demo-common';
import type { MenuController } from '@mochart/demo-common';

import { LightElement } from './LightElement';
import { icon } from './templates';

/**
 * The "about this demo" button in each mode's navigation row: an info icon
 * that opens the demo's `notes` (the detail kept out of its one-sentence
 * gallery description) in a popover panel. This is the desktop shape; below
 * the phone breakpoint the navigation row folds into an overflow menu, where a
 * popover cannot come along — its panel would be a descendant of an element
 * the menu hides with `display: none` — so TopBar renders `<notes-menu-item>`
 * (a disclosure row inside the panel) instead.
 *
 * Open/close, positioning, dismissal, focus return and the disclosure ARIA all
 * come from demo-common's `createMenuController`. Note what that means for the
 * template: the trigger and panel carry STATIC classes and no `aria-expanded`
 * or `style` binding, because the controller writes those itself and an
 * interpolated attribute would clobber them on the next render. The controller
 * is built in `firstUpdated` because `@query` cannot see the elements until
 * the first render has committed.
 *
 * Whether there are notes to show is the caller's business (TopBar guards),
 * but this keeps its own `nothing` guard for the same reason it always had
 * one — a demo without notes must render no trigger.
 */
@customElement('notes-menu')
export class NotesMenu extends LightElement {
  /** Demo title, shown as the panel heading (not `title`, which is native). */
  @property({ attribute: false }) demoTitle = '';
  /** The demo's notes; nothing renders when there are none. */
  @property({ attribute: false }) notes: string | undefined = undefined;

  @query('.mochart-demo-notes-trigger') private triggerElement?: HTMLButtonElement;
  @query('.demo-menu-notes') private panelElement?: HTMLElement;

  private controller: MenuController | null = null;

  override firstUpdated(): void {
    this.syncController();
  }

  // Close whenever the demo changes under us (history navigation between
  // demos). The controller is rebuilt when the notes appear or disappear,
  // since that takes the whole trigger/panel pair in and out of the DOM.
  override updated(changed: PropertyValues<this>): void {
    if (changed.has('notes')) {
      this.syncController();
    }
    else if (changed.has('demoTitle')) {
      this.controller?.close();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.controller?.destroy();
    this.controller = null;
  }

  private syncController(): void {
    this.controller?.destroy();
    this.controller = null;
    const trigger = this.triggerElement;
    const panel = this.panelElement;
    if (trigger === undefined || panel === undefined) {
      return;
    }
    this.controller = createMenuController({
      trigger,
      panel,
      placement: notesMenuPlacement,
      bindTrigger: false
    });
  }

  override render(): unknown {
    if (this.notes === undefined) {
      return nothing;
    }
    return html`<div class="demo-btn-group mochart-demo-notes-menu">
      <button type="button" class="demo-btn demo-btn-secondary mochart-demo-notes-trigger"
              title=${demoText.demoNotes.trigger.tooltip} aria-label=${demoText.demoNotes.trigger.aria}
              @click=${() => this.controller?.toggle()}>${icon({ size: 'lg', fixedWidth: true, name: 'circle-info' })}</button>
      <div class="demo-menu demo-menu-notes">
        <span class="demo-menu-notes-title">${this.demoTitle}</span>
        <span class="demo-menu-notes-body">${this.notes}</span>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notes-menu': NotesMenu;
  }
}
