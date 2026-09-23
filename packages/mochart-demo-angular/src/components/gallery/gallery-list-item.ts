import { Component, Input, signal } from '@angular/core';

import { demoText } from '@mochart/demo-common';

import { Icon } from '../misc/icon';

import type { GalleryItem, ShowcaseMode } from '../../types';

const pageIcons: Record<ShowcaseMode, string> = {
  transition: 'right-left',
  rotation: 'repeat',
  sparkline: 'chart-line'
};

/**
 * One gallery card. A demo's `notes` hang off the card behind a toggle; the
 * toggle and the notes prose are siblings of the open-demo button rather than
 * children of it, since a <button> may not contain interactive content, so the
 * card chrome lives on the .demo-list-entry wrapper (see demo.css).
 */
@Component({
  selector: 'app-gallery-list-item',
  imports: [Icon],
  styles: [':host { display: contents; }'],
  template: `
    <div class="demo-list-entry">
      <div class="demo-list-row">
        <button type="button" class="demo-list-item" (click)="onOpen(item)">
          @if (item.kind === 'page') {
            <app-icon [name]="pageIcons[item.mode]" [fixedWidth]="true" />
          }
          <span class="mochart-demo-item-title">{{ item.title }}</span>
          @if (item.description !== undefined) {
            <span class="mochart-demo-item-description">{{ item.description }}</span>
          }
        </button>
        @if (item.notes !== undefined) {
          <button type="button"
                  [class]="'demo-btn demo-btn-secondary mochart-demo-notes-toggle' + (notesOpen() ? ' active' : '')"
                  [attr.aria-expanded]="notesOpen()" [attr.aria-label]="text.aria"
                  [attr.title]="notesOpen() ? text.tooltipHide : text.tooltipShow"
                  (click)="notesOpen.set(!notesOpen())">
            <app-icon name="circle-info" [fixedWidth]="true" />
          </button>
        }
      </div>
      @if (item.notes !== undefined && notesOpen()) {
        <div class="mochart-demo-notes">{{ item.notes }}</div>
      }
    </div>
  `
})
export class GalleryListItem {
  readonly text = demoText.demoNotes.galleryToggle;
  readonly pageIcons = pageIcons;

  @Input({ required: true }) item!: GalleryItem;
  @Input({ required: true }) onOpen!: (item: GalleryItem) => void;

  readonly notesOpen = signal(false);
}
