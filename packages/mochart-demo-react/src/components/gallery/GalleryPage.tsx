import { useState } from 'react';

import Icon from '../misc/Icon';

import { demoText, getGallerySections } from '@mochart/demo-common';
import type { GalleryItem, GallerySection, ShowcaseMode } from '@mochart/demo-common';

import { SiteRootButton, ThemeToggleButton } from '../misc/ModeSwitcher';

import type { DemoData } from '../../types';

interface GalleryPageProps {
  demoData: DemoData;
  siteRootUrl?: string;
  onOpenDemo: (demoId: string) => void;
  onOpenPage: (mode: ShowcaseMode) => void;
}

const pageIcons: Record<ShowcaseMode, string> = {
  transition: 'right-left',
  rotation: 'repeat',
  sparkline: 'chart-line'
};

// A demo's `notes` hang off the card behind a toggle. The toggle and the notes
// prose are siblings of the open-demo button rather than children of it, since
// a <button> may not contain interactive content, so the card chrome lives on
// the .demo-list-entry wrapper (see demo.css).
function GalleryListItem({ item, onOpenDemo, onOpenPage }: { item: GalleryItem } & Pick<GalleryPageProps, 'onOpenDemo' | 'onOpenPage'>) {
  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <div className="demo-list-entry">
      <div className="demo-list-row">
        <button type="button" className="demo-list-item"
          onClick={() => {
            if (item.kind === 'demo') {
              onOpenDemo(item.id);
            }
            else {
              onOpenPage(item.mode);
            }
          }}>
          {item.kind === 'page' ? <Icon fixedWidth name={pageIcons[item.mode]} /> : null}
          <span className="mochart-demo-item-title">{item.title}</span>
          {item.description !== undefined ? <span className="mochart-demo-item-description">{item.description}</span> : null}
        </button>
        {item.notes !== undefined ? (
          <button type="button" className={'demo-btn demo-btn-secondary mochart-demo-notes-toggle' + (notesOpen ? ' active' : '')}
            aria-expanded={notesOpen} aria-label={demoText.demoNotes.galleryToggle.aria}
            title={notesOpen ? demoText.demoNotes.galleryToggle.tooltipHide : demoText.demoNotes.galleryToggle.tooltipShow}
            onClick={() => setNotesOpen(prev => !prev)}>
            <Icon fixedWidth name="circle-info" />
          </button>
        ) : null}
      </div>
      {item.notes !== undefined && notesOpen ? <div className="mochart-demo-notes">{item.notes}</div> : null}
    </div>
  );
}

function GallerySectionView({ section, onOpenDemo, onOpenPage }: { section: GallerySection } & Pick<GalleryPageProps, 'onOpenDemo' | 'onOpenPage'>) {
  const header = (
    <>
      <span className="mochart-demo-gallery-section-title">{section.title}</span>
      {section.hint !== undefined ? <span className="mochart-demo-gallery-section-hint">{section.hint}</span> : null}
    </>
  );
  const list = (
    <div className="demo-list">
      {section.items.map(item => (
        <GalleryListItem key={item.kind === 'demo' ? 'demo-' + item.id : 'page-' + item.mode}
          item={item} onOpenDemo={onOpenDemo} onOpenPage={onOpenPage} />
      ))}
    </div>
  );
  if (!section.collapsed) {
    return (
      <section className="mochart-demo-gallery-section">
        <div className="mochart-demo-gallery-section-header">{header}</div>
        {list}
      </section>
    );
  }
  // Collapsed sections use native details/summary: no state to manage and
  // keyboard/screen-reader behavior comes for free.
  return (
    <details className="mochart-demo-gallery-section">
      <summary className="mochart-demo-gallery-section-header">
        <Icon fixedWidth name="flask" />
        {header}
      </summary>
      {list}
    </details>
  );
}

export default function GalleryPage({ demoData, siteRootUrl, onOpenDemo, onOpenPage }: GalleryPageProps) {
  return (
    <div className="mochart-demo-container">
      <div className="mochart-demo-gallery-header">
        <SiteRootButton siteRootUrl={siteRootUrl} />
        <ThemeToggleButton />
      </div>
      <div className="mochart-demo-content-pane">
        <div className="mochart-demo-gallery">
          {getGallerySections(demoData).map(section => (
            <GallerySectionView key={section.key} section={section} onOpenDemo={onOpenDemo} onOpenPage={onOpenPage} />
          ))}
        </div>
      </div>
    </div>
  );
}
