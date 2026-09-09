import { html } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import { createMenuController, isMenuDismissingClick } from '@mochart/demo-common';
import type { MenuController, MenuPlacement } from '@mochart/demo-common';

import { LightElement } from './LightElement';
import { icon } from './templates';

/**
 * The phone fold's container: a single `…` trigger whose panel holds the
 * controls that did not fit in the strip beside it.
 *
 * The vanilla port MOVES its retained DOM nodes into the panel (hosts, not
 * mirrors — see the header of vanilla's OverflowMenu.ts). Lit owns its DOM, so
 * the contract here is the same as the other framework ports': every folded
 * control is RENDERED in exactly one place — the strip above the phone tier,
 * this panel below it — from the same template function, driven by the same
 * state. Same outcome: no duplicate ids, no second accessible name, no
 * mirrored disabled/pressed state. A port that renders a control twice and
 * hides one with CSS has missed the design.
 *
 * Three Lit-specific rules, all consequences of `createMenuController` owning
 * the DOM rather than a template binding:
 *
 *  1. **`bindTrigger: false`.** The controller binds the trigger's click to
 *     `toggle()` by default. This template declares its own `@click` — the
 *     lit-idiomatic place for it — so the controller must not bind a second
 *     one, or the two fire per press and cancel out.
 *  2. **The trigger and panel carry STATIC `class` attributes**, and no
 *     `aria-expanded` or `style` binding. The controller writes `.open` /
 *     `.active` / the `aria-*` / the inline position styles straight onto
 *     those elements; an interpolated `class=${...}` would clobber them on the
 *     next render where its expression changed. `?disabled` is safe — the
 *     controller never touches it.
 *  3. **The controller is built in `firstUpdated`,** not `connectedCallback`:
 *     `@query` is a lazy `querySelector` over this element's light-DOM output,
 *     so the trigger and panel do not exist until the first render has
 *     committed.
 *
 * Items arrive as a thunk property rather than a slot — this element renders
 * into the light DOM, where `<slot>` does nothing, and a thunk is already the
 * package's idiom for passing markup (see `error-tab`'s `.content`).
 *
 * Activating any button or link inside the panel closes it, except inside a
 * `.demo-menu-keep-open` subtree (a stepper beside a number input, say, where
 * closing after every press would make the control unusable).
 */
@customElement('overflow-menu')
export class OverflowMenu extends LightElement {
  /** Trigger copy — one of `demoText.overflowMenu.*`, so each trigger names what it holds. */
  @property({ attribute: false }) text!: { tooltip: string; aria: string };
  @property({ attribute: false }) placement?: MenuPlacement;
  /** Anchor the panel to a whole row when the trigger is not the row's end. */
  @property({ attribute: false }) getAnchor?: () => HTMLElement | null | undefined;
  @property({ attribute: false }) disabled = false;
  /**
   * The hosting pane's active state. A deactivated pane is only marked inert
   * and shifted offscreen, and an open panel is `position: fixed` — it would
   * keep painting over whichever pane replaced this one. False closes it.
   */
  @property({ attribute: false }) active = true;
  /** The folded controls, as a thunk so the host can re-render them. */
  @property({ attribute: false }) items: (() => unknown) | null = null;

  @query('.demo-overflow-menu > button') private triggerElement?: HTMLButtonElement;
  @query('.demo-menu-overflow') private panelElement?: HTMLElement;

  private controller: MenuController | null = null;

  override firstUpdated(): void {
    const trigger = this.triggerElement;
    const panel = this.panelElement;
    if (trigger === undefined || panel === undefined) {
      return;
    }
    const getAnchor = this.getAnchor;
    this.controller = createMenuController({
      trigger,
      panel,
      placement: this.placement,
      // The controller's `getAnchor` returns a definite element; the property
      // may hand back null while the anchor row is still being created.
      getAnchor: getAnchor === undefined ? undefined : () => getAnchor() ?? trigger,
      bindTrigger: false
    });
  }

  // A disabled trigger fires no click, so the menu cannot be opened — but one
  // already open when its trigger is disabled would be stranded.
  override willUpdate(changed: PropertyValues<this>): void {
    if ((changed.has('disabled') || changed.has('active')) && (this.disabled || !this.active)) {
      this.controller?.close();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.controller?.destroy();
    this.controller = null;
  }

  private onPanelClick = (event: MouseEvent): void => {
    if (isMenuDismissingClick(event.target)) {
      this.controller?.close();
    }
  };

  override render(): TemplateResult {
    return html`<div class="demo-btn-group demo-overflow-menu">
      <button type="button" class="demo-btn demo-btn-secondary" ?disabled=${this.disabled}
              title=${this.text.tooltip} aria-label=${this.text.aria}
              @click=${() => this.controller?.toggle()}>${icon({ size: 'lg', fixedWidth: true, name: 'ellipsis' })}</button>
      <div class="demo-menu demo-menu-overflow" @click=${this.onPanelClick}>${this.items?.()}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'overflow-menu': OverflowMenu;
  }
}
