import { demoText, getGallerySections } from '@mochart/demo-common';
import type { GalleryItem, GallerySection, ShowcaseMode } from '@mochart/demo-common';

import { el, icon } from '../misc/dom';
import { siteRootButton, themeToggle } from '../misc/ModeSwitcher';

import type { DemoData } from '../../types';

export interface GalleryPageProps {
  demoData: DemoData;
  siteRootUrl?: string;
  onOpenDemo: (demoId: string) => void;
  onOpenPage: (mode: ShowcaseMode) => void;
}

export interface GalleryPageHandle {
  el: HTMLElement;
  destroy(): void;
}

const pageIcons: Record<ShowcaseMode, string> = {
  transition: 'right-left',
  rotation: 'repeat',
  sparkline: 'chart-line'
};

export function galleryPage(props: GalleryPageProps): GalleryPageHandle {
  const { demoData, onOpenDemo, onOpenPage } = props;

  // A demo's `notes` hang off the card behind a toggle. The toggle and the
  // notes prose are siblings of the open-demo button rather than children of
  // it, since a <button> may not contain interactive content — so the card
  // chrome lives on the .demo-list-entry wrapper (see demo.css).
  function galleryItem(item: GalleryItem): HTMLElement {
    const button = el('button', {
      className: 'demo-list-item',
      attrs: { type: 'button' }
    }, [
      item.kind === 'page' ? icon(pageIcons[item.mode], { fixedWidth: true }) : null,
      el('span', { className: 'mochart-demo-item-title', text: item.title }),
      item.description !== undefined
        ? el('span', { className: 'mochart-demo-item-description', text: item.description })
        : null
    ]);
    button.addEventListener('click', () => {
      if (item.kind === 'demo') {
        onOpenDemo(item.id);
      }
      else {
        onOpenPage(item.mode);
      }
    });

    const row = el('div', { className: 'demo-list-row' }, [button]);
    const entry = el('div', { className: 'demo-list-entry' }, [row]);

    if (item.notes !== undefined) {
      const notes = el('div', { className: 'mochart-demo-notes', text: item.notes });
      notes.hidden = true;
      const toggle = el('button', {
        className: 'demo-btn demo-btn-secondary mochart-demo-notes-toggle',
        attrs: {
          type: 'button',
          'aria-expanded': 'false',
          title: demoText.demoNotes.galleryToggle.tooltipShow,
          'aria-label': demoText.demoNotes.galleryToggle.aria
        }
      }, [icon('circle-info', { fixedWidth: true })]);
      let open = false;
      toggle.addEventListener('click', () => {
        open = !open;
        notes.hidden = !open;
        toggle.classList.toggle('active', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.title = open ? demoText.demoNotes.galleryToggle.tooltipHide : demoText.demoNotes.galleryToggle.tooltipShow;
      });
      row.append(toggle);
      entry.append(notes);
    }

    return entry;
  }

  function sectionEl(section: GallerySection): HTMLElement {
    const list = el('div', { className: 'demo-list' }, section.items.map(galleryItem));
    const header: (Node | string | null)[] = [
      el('span', { className: 'mochart-demo-gallery-section-title', text: section.title }),
      section.hint !== undefined
        ? el('span', { className: 'mochart-demo-gallery-section-hint', text: section.hint })
        : null
    ];
    if (!section.collapsed) {
      return el('section', { className: 'mochart-demo-gallery-section' }, [
        el('div', { className: 'mochart-demo-gallery-section-header' }, header),
        list
      ]);
    }
    // Collapsed sections use native details/summary: no state to manage and
    // keyboard/screen-reader behavior comes for free.
    const details = el('details', { className: 'mochart-demo-gallery-section' }, [
      el('summary', { className: 'mochart-demo-gallery-section-header' }, [
        icon('flask', { fixedWidth: true }),
        ...header
      ]),
      list
    ]);
    return details;
  }

  const siteRoot = siteRootButton(props.siteRootUrl);
  const toggle = themeToggle();
  const container = el('div', { className: 'mochart-demo-container' }, [
    el('div', { className: 'mochart-demo-gallery-header' }, [siteRoot, toggle.el]),
    el('div', { className: 'mochart-demo-content-pane' }, [
      el('div', { className: 'mochart-demo-gallery' },
        getGallerySections(demoData).map(sectionEl))
    ])
  ]);

  return {
    el: container,
    destroy() {
      toggle.destroy();
    }
  };
}
