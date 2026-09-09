// The demo gallery page model. The gallery is the landing route of every
// framework demo: a list of curated demos, the standalone showcase pages
// (transition/rotation), and the feature-coverage test demos in a collapsed
// section. Each framework renders these sections; the structure lives here so
// the ports stay mechanical.

import { demoText } from './demoText';

import type { DemoData, DemoMode } from './types';

/** The modes a demo can be viewed in from within the tabbed demo view. */
export const switchableDemoModes = ['single', 'multi', 'random'] as const;

export type SwitchableDemoMode = (typeof switchableDemoModes)[number];

/** Font Awesome solid icon per mode, for the switcher's segments. */
export const demoModeIcons: Record<SwitchableDemoMode, string> = {
  single: 'pen-to-square',
  multi: 'window-restore',
  random: 'shuffle'
};

/** A gallery entry opening a demo (in single mode). */
export interface GalleryDemoItem {
  kind: 'demo';
  id: string;
  title: string;
  description?: string;
  /** The longer explanation, behind the card's details toggle. */
  notes?: string;
}

/** The demo modes rendered as standalone showcase pages. */
export type ShowcaseMode = Extract<DemoMode, 'transition' | 'rotation' | 'sparkline'>;

/** A gallery entry opening a standalone showcase page. */
export interface GalleryPageItem {
  kind: 'page';
  mode: ShowcaseMode;
  title: string;
  description: string;
  /** Showcase pages carry no notes; declared so items are uniform to render. */
  notes?: undefined;
}

export type GalleryItem = GalleryDemoItem | GalleryPageItem;

export interface GallerySection {
  key: 'demos' | 'showcases' | 'test';
  title: string;
  /** Extra caption shown with the section header (test section only). */
  hint?: string;
  /** Whether the section starts collapsed. */
  collapsed: boolean;
  items: GalleryItem[];
}

function toDemoItem(demoData: DemoData, demoId: string): GalleryDemoItem {
  const { title, description, notes } = demoData.demoObjectMap[demoId];
  return { kind: 'demo', id: demoId, title, description, notes };
}

export function getGallerySections(demoData: DemoData): GallerySection[] {
  const { sections, testSectionHint, showcases } = demoText.gallery;
  return [
    {
      key: 'demos',
      title: sections.demos,
      collapsed: false,
      items: demoData.demoIds.map(demoId => toDemoItem(demoData, demoId))
    },
    {
      key: 'test',
      title: sections.test,
      hint: testSectionHint,
      collapsed: true,
      items: demoData.testDemoIds.map(demoId => toDemoItem(demoData, demoId))
    },
    {
      key: 'showcases',
      title: sections.showcases,
      collapsed: false,
      items: [
        { kind: 'page', mode: 'transition', ...showcases.transition },
        { kind: 'page', mode: 'rotation', ...showcases.rotation },
        { kind: 'page', mode: 'sparkline', ...showcases.sparkline }
      ]
    }
  ];
}
