import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import type { OnChanges, OnDestroy, OnInit } from '@angular/core';

import { createMenuController, demoText, notesMenuPlacement } from '@mochart/demo-common';
import type { MenuController } from '@mochart/demo-common';

import { Icon } from './icon';

/**
 * The "about this demo" button in each mode's navigation row: an info icon
 * that opens the demo's `notes` (the detail kept out of its one-sentence
 * gallery description) in a popover panel. This is the desktop shape; below
 * the phone breakpoint the navigation row folds into an overflow menu, where a
 * popover cannot come along — its panel would be a descendant of an element
 * the menu hides with `display: none` — so TopBar renders NotesMenuItem (a
 * disclosure row inside the panel) instead of this.
 *
 * Open/close, positioning, dismissal, focus return and the disclosure ARIA all
 * come from demo-common's `createMenuController`. Note what that means for the
 * template: the trigger and panel carry STATIC classes and no `aria-expanded`,
 * because the controller writes those itself — a binding on the same element
 * would be re-applied by change detection and wipe them. It also means the
 * `ChangeDetectorRef.detectChanges()` dance this component used to need is
 * gone: open/close never goes through Angular at all.
 *
 * Whether there are notes to show is the caller's business (TopBar guards with
 * `@if`), so the elements here are unconditional and the controller can be
 * built once, in `ngOnInit`.
 */
@Component({
  selector: 'app-notes-menu',
  imports: [Icon],
  styles: [':host { display: contents; }'],
  template: `
    <div class="demo-btn-group mochart-demo-notes-menu">
      <button type="button" #trigger class="demo-btn demo-btn-secondary mochart-demo-notes-trigger"
              [attr.title]="text.trigger.tooltip" [attr.aria-label]="text.trigger.aria"
              (click)="controller?.toggle()">
        <app-icon size="lg" [fixedWidth]="true" name="circle-info" />
      </button>
      <div #panel class="demo-menu demo-menu-notes">
        <span class="demo-menu-notes-title">{{ demoTitle }}</span>
        <span class="demo-menu-notes-body">{{ notes }}</span>
      </div>
    </div>
  `
})
export class NotesMenu implements OnInit, OnChanges, OnDestroy {
  readonly text = demoText.demoNotes;

  /** Demo title, shown as the panel heading (not `title`, which is native). */
  @Input({ required: true }) demoTitle!: string;
  /** The demo's notes. The caller renders nothing when there are none. */
  @Input() notes?: string;

  @ViewChild('trigger', { static: true }) triggerElement!: ElementRef<HTMLButtonElement>;
  @ViewChild('panel', { static: true }) panelElement!: ElementRef<HTMLDivElement>;

  controller?: MenuController;

  ngOnInit(): void {
    this.controller = createMenuController({
      trigger: this.triggerElement.nativeElement,
      panel: this.panelElement.nativeElement,
      placement: notesMenuPlacement,
      bindTrigger: false
    });
  }

  // Close whenever the demo changes under us (history navigation between demos).
  ngOnChanges(): void {
    this.controller?.close();
  }

  ngOnDestroy(): void {
    this.controller?.destroy();
  }
}
