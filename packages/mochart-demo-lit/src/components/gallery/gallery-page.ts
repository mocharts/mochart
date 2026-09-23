import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { demoText, getGallerySections } from '@mochart/demo-common';
import type { GalleryItem, GallerySection, ShowcaseMode } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { icon } from '../misc/templates';
import { siteRootButton } from '../misc/mode-switcher';
import '../misc/theme-toggle-button';

import type { DemoData } from '../../types';

const pageIcons: Record<ShowcaseMode, string> = {
  transition: 'right-left',
  rotation: 'repeat',
  sparkline: 'chart-line'
};

@customElement('gallery-page')
export class GalleryPage extends LightElement {
  @property({ attribute: false }) demoData!: DemoData;
  @property({ attribute: false }) siteRootUrl: string | undefined = undefined;
  @property({ attribute: false }) onOpenDemo!: (demoId: string) => void;
  @property({ attribute: false }) onOpenPage!: (mode: ShowcaseMode) => void;

  /** Ids of the demos whose notes are expanded. */
  @state() private openNotes = new Set<string>();

  private onItemClick(item: GalleryItem): void {
    if (item.kind === 'demo') {
      this.onOpenDemo(item.id);
    }
    else {
      this.onOpenPage(item.mode);
    }
  }

  // A new Set each time: Lit compares @state by identity, so mutating in place
  // would not schedule an update.
  private toggleNotes(id: string): void {
    const next = new Set(this.openNotes);
    if (!next.delete(id)) {
      next.add(id);
    }
    this.openNotes = next;
  }

  // A demo's `notes` hang off the card behind a toggle. The toggle and the
  // notes prose are siblings of the open-demo button rather than children of
  // it, since a <button> may not contain interactive content, so the card
  // chrome lives on the .demo-list-entry wrapper (see demo.css).
  private renderItem(item: GalleryItem): unknown {
    const id = item.kind === 'demo' ? item.id : item.mode;
    const notesOpen = this.openNotes.has(id);
    return html`<div class="demo-list-entry">
      <div class="demo-list-row">
        <button type="button" class="demo-list-item"
            @click=${() => this.onItemClick(item)}>${item.kind === 'page' ? icon({ name: pageIcons[item.mode], fixedWidth: true }) : nothing}<span class="mochart-demo-item-title">${item.title}</span>${item.description !== undefined
              ? html`<span class="mochart-demo-item-description">${item.description}</span>`
              : nothing}</button>
        ${item.notes !== undefined ? html`<button type="button"
            class=${'demo-btn demo-btn-secondary mochart-demo-notes-toggle' + (notesOpen ? ' active' : '')}
            aria-expanded=${notesOpen} aria-label=${demoText.demoNotes.galleryToggle.aria}
            title=${notesOpen ? demoText.demoNotes.galleryToggle.tooltipHide : demoText.demoNotes.galleryToggle.tooltipShow}
            @click=${() => this.toggleNotes(id)}>${icon({ name: 'circle-info', fixedWidth: true })}</button>` : nothing}
      </div>
      ${item.notes !== undefined && notesOpen
        ? html`<div class="mochart-demo-notes">${item.notes}</div>`
        : nothing}
    </div>`;
  }

  private renderSection(section: GallerySection): unknown {
    const list = html`<div class="demo-list">${section.items.map(item => this.renderItem(item))}</div>`;
    const header = html`<span class="mochart-demo-gallery-section-title">${section.title}</span>${section.hint !== undefined
      ? html`<span class="mochart-demo-gallery-section-hint">${section.hint}</span>`
      : nothing}`;
    if (!section.collapsed) {
      return html`<section class="mochart-demo-gallery-section">
        <div class="mochart-demo-gallery-section-header">${header}</div>
        ${list}
      </section>`;
    }
    // Collapsed sections use native details/summary: no state to manage and
    // keyboard/screen-reader behavior comes for free.
    return html`<details class="mochart-demo-gallery-section">
      <summary class="mochart-demo-gallery-section-header">${icon({ name: 'flask', fixedWidth: true })}${header}</summary>
      ${list}
    </details>`;
  }

  override render(): unknown {
    return html`<div class="mochart-demo-container">
      <div class="mochart-demo-gallery-header">
        ${siteRootButton(this.siteRootUrl)}
        <theme-toggle-button></theme-toggle-button>
      </div>
      <div class="mochart-demo-content-pane">
        <div class="mochart-demo-gallery">
          ${getGallerySections(this.demoData).map(section => this.renderSection(section))}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gallery-page': GalleryPage;
  }
}
