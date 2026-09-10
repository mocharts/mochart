// The gallery landing page: feature-organized sections of cards, each with a
// live mini-chart thumbnail. Cards are real links (deep-linkable, middle-
// clickable); navigation is intercepted for the client-side router.

import type { ThemeController } from '../app/theme';

import { getSections } from '../content/manifest';
import { hrefFor, navigate } from '../app/router';
import { button, el } from '../ui/dom';
import { svgIcon } from '../ui/icons';
import { thumb } from './Thumb';
import type { ThumbHandle } from './Thumb';

export interface GalleryPageProps {
  theme: ThemeController;
}

export interface GalleryPageHandle {
  el: HTMLElement;
  destroy(): void;
}

export function galleryPage(props: GalleryPageProps): GalleryPageHandle {
  const { theme } = props;
  const thumbs: ThumbHandle[] = [];

  const themeButton = button({
    icon: theme.isDark() ? 'sun' : 'moon',
    ariaLabel: 'Toggle color theme', title: 'Toggle color theme', variant: 'sc-btn-quiet',
    onClick: () => theme.toggle()
  });
  const unsubscribeTheme = theme.onChange(dark => themeButton.setIcon(dark ? 'sun' : 'moon'));

  const wallLink = el('a', {
    className: 'sc-btn sc-btn-quiet sc-wall-link',
    attrs: { href: hrefFor('/wall'), title: 'Open the chart wall' }
  }, [svgIcon('grid'), el('span', { className: 'sc-btn-label', text: 'Wall' })]);
  wallLink.addEventListener('click', event => {
    event.preventDefault();
    navigate('/wall');
  });

  const header = el('header', { className: 'sc-hero' }, [
    el('div', { className: 'sc-hero-row' }, [
      el('h1', { className: 'sc-hero-title', text: 'Mochart Showcase' }),
      el('div', { className: 'sc-appbar-actions' }, [wallLink, themeButton.el])
    ]),
    el('p', {
      className: 'sc-hero-tagline',
      text: 'Every capability of the mochart charting library, one polished demo at a time. Open any card to edit its config and data live, randomize it deterministically, and share exactly what you made.'
    })
  ]);

  const sectionsEl = el('main', { className: 'sc-sections' });
  for (const section of getSections()) {
    const grid = el('div', { className: 'sc-card-grid' });
    for (const entry of section.entries) {
      const cardThumb = thumb(entry);
      thumbs.push(cardThumb);
      const card = el('a', {
        className: 'sc-card',
        attrs: { href: hrefFor('/d/' + entry.slug) }
      }, [
        cardThumb.el,
        el('div', { className: 'sc-card-text' }, [
          el('h3', { className: 'sc-card-title', text: entry.title }),
          el('p', { className: 'sc-card-blurb', text: entry.blurb })
        ])
      ]);
      card.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        navigate('/d/' + entry.slug);
      });
      grid.append(card);
    }
    sectionsEl.append(el('section', { className: 'sc-section', id: 'section-' + section.id }, [
      el('h2', { className: 'sc-section-title', text: section.title }),
      el('p', { className: 'sc-section-tagline', text: section.tagline }),
      grid
    ]));
  }

  const container = el('div', { className: 'sc-gallery' }, [header, sectionsEl]);

  return {
    el: container,
    destroy() {
      unsubscribeTheme();
      for (const cardThumb of thumbs) {
        cardThumb.destroy();
      }
    }
  };
}
