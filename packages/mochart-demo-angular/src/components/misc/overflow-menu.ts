import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { createMenuController, isMenuDismissingClick } from '@mochart/demo-common';
import type { MenuController, MenuPlacement } from '@mochart/demo-common';

import { Icon } from './icon';

/**
 * The phone fold's container: a single `…` trigger whose panel holds the
 * controls that did not fit in the strip beside it.
 *
 * The vanilla port MOVES its retained DOM nodes into the panel (hosts, not
 * mirrors — see the header of vanilla's OverflowMenu.ts). Angular owns its
 * DOM, so the contract here is the same as the other framework ports': every
 * folded control is RENDERED in exactly one place — the strip above the phone
 * tier, this panel below it — from the same `<ng-template>`, driven by the
 * same state. Same outcome: no duplicate ids, no second accessible name, no
 * mirrored disabled/pressed state. A port that renders a control twice and
 * hides one with CSS has missed the design.
 *
 * Two angular-specific rules, both consequences of `createMenuController`
 * owning the DOM rather than a template binding:
 *
 *  1. **`bindTrigger: false`.** The controller binds the trigger's click to
 *     `toggle()` by default. This template declares its own `(click)` — the
 *     angular-idiomatic place for it — so the controller must not bind a
 *     second one, or the two fire per press and cancel out. Angular is the
 *     first real consumer of that option.
 *  2. **The trigger and panel carry STATIC `class` attributes.** The
 *     controller writes `.open` / `.active` and the `aria-*` and inline
 *     position styles straight onto those elements; a `[class]` or `[style]`
 *     binding on the same element would be re-applied on the next change
 *     detection pass and wipe them. `[disabled]` is safe — the controller
 *     never touches it.
 *
 * Activating any button or link inside the panel closes it, except inside a
 * `.demo-menu-keep-open` subtree (a stepper beside a number input, say, where
 * closing after every press would make the control unusable).
 */
@Component({
  selector: 'app-overflow-menu',
  imports: [Icon],
  styles: [':host { display: contents; }'],
  template: `
    <div class="demo-btn-group demo-overflow-menu">
      <button #trigger type="button" class="demo-btn demo-btn-secondary"
              [disabled]="disabled" [attr.title]="text.tooltip" [attr.aria-label]="text.aria"
              (click)="controller?.toggle()">
        <app-icon size="lg" [fixedWidth]="true" name="ellipsis" />
      </button>
      <div #panel class="demo-menu demo-menu-overflow" (click)="onPanelClick($event)">
        <ng-content />
      </div>
    </div>
  `
})
export class OverflowMenu implements OnInit, OnChanges, OnDestroy {
  /** Trigger copy — one of `demoText.overflowMenu.*`, so each trigger names what it holds. */
  @Input({ required: true }) text!: { tooltip: string; aria: string };
  @Input() placement?: MenuPlacement;
  /** Anchor the panel to a whole row when the trigger is not the row's end. */
  @Input() getAnchor?: () => HTMLElement | null | undefined;
  @Input() disabled = false;
  /**
   * The hosting pane's active state. A deactivated pane is only marked inert
   * and shifted offscreen, and an open panel is `position: fixed` — it would
   * keep painting over whichever pane replaced this one. False closes it.
   */
  @Input() active = true;

  @ViewChild('trigger', { static: true }) triggerElement!: ElementRef<HTMLButtonElement>;
  @ViewChild('panel', { static: true }) panelElement!: ElementRef<HTMLDivElement>;

  controller?: MenuController;

  ngOnInit(): void {
    const trigger = this.triggerElement.nativeElement;
    const getAnchor = this.getAnchor;
    this.controller = createMenuController({
      trigger,
      panel: this.panelElement.nativeElement,
      placement: this.placement,
      // The controller's `getAnchor` returns a definite element; the input may
      // hand back null while the anchor row is still being created.
      getAnchor: getAnchor === undefined ? undefined : () => getAnchor() ?? trigger,
      bindTrigger: false
    });
  }

  // A disabled trigger fires no click, so the menu cannot be opened — but one
  // already open when its trigger is disabled would be stranded.
  ngOnChanges(): void {
    if (this.disabled || !this.active) {
      this.controller?.close();
    }
  }

  ngOnDestroy(): void {
    this.controller?.destroy();
  }

  onPanelClick(event: MouseEvent): void {
    if (isMenuDismissingClick(event.target)) {
      this.controller?.close();
    }
  }
}
