import { Component, Input, signal } from '@angular/core';
import type { OnChanges } from '@angular/core';

import { demoText, menuKeepOpenClassName } from '@mochart/demo-common';

import { Icon } from './icon';

/** `aria-controls` has to point at an id, and ids have to be unique. */
let disclosureIdCounter = 0;

/**
 * The phone fold's stand-in for the NotesMenu popover: a `.demo-menu-item` row
 * that expands the same title and body inline, inside the navigation row's
 * overflow panel. `.demo-menu-keep-open` so revealing the note does not also
 * dismiss the menu it lives in; the panel's own `overflow-y: auto` under its
 * `max-height` is what makes a long note readable on a screen that does not
 * scroll.
 */
@Component({
  selector: 'app-notes-menu-item',
  imports: [Icon],
  styles: [':host { display: contents; }'],
  template: `
    <div class="mochart-demo-notes-item {{ keepOpenClass }}">
      <button type="button" class="demo-menu-item"
              [attr.title]="text.trigger.tooltip"
              [attr.aria-expanded]="expanded()" [attr.aria-controls]="disclosureId"
              (click)="expanded.set(!expanded())">
        <app-icon [fixedWidth]="true" name="circle-info" /> <span>{{ text.trigger.aria }}</span>
        <app-icon [fixedWidth]="true" [name]="expanded() ? 'chevron-up' : 'chevron-down'" iconStyle="margin-left: auto;" />
      </button>
      <div class="demo-field" [id]="disclosureId" [hidden]="!expanded()">
        <span class="demo-menu-notes-title">{{ demoTitle }}</span>
        <span class="demo-menu-notes-body">{{ notes }}</span>
      </div>
    </div>
  `
})
export class NotesMenuItem implements OnChanges {
  readonly text = demoText.demoNotes;
  readonly keepOpenClass = menuKeepOpenClassName;

  @Input({ required: true }) demoTitle!: string;
  @Input() notes?: string;

  readonly expanded = signal(false);
  readonly disclosureId = 'demo-notes-disclosure-a' + ++disclosureIdCounter;

  // A different demo's notes start collapsed again (history navigation).
  ngOnChanges(): void {
    this.expanded.set(false);
  }
}
