import type { DataObject, DemoConfig, DemoRandomConfig } from '@mochart/demo-data';

/** A card's own thumbnail, for an entry whose page is more than one chart. */
export interface ThumbnailHandle {
  el: HTMLElement;
  destroy(): void;
}

/** Demos with bespoke behavior beyond the standard demo page. */
export type SpecialKind = 'player' | 'rotation' | 'states' | 'callbacks' | 'sparklines' | 'easing';

export interface ShowcaseEntry {
  slug: string;
  title: string;
  /** One-sentence gallery blurb. */
  blurb: string;
  /** The longer explanation shown in the About tab. */
  notes?: string;
  config: DemoConfig;
  data: DataObject[];
  /** Present → the seed stepper / play controls are offered. */
  random?: DemoRandomConfig;
  /** Chart-type random-mode generator id (demo-common chartTypeGenerators). */
  generator?: string;
  special?: SpecialKind;
  /** Tweaks the gallery thumbnail's config clone after the generic stripping. */
  thumbnail?: (config: DemoConfig) => void;
  /** Builds the card's thumbnail in place of the entry's chart (still mounted lazily). */
  thumbnailElement?: () => ThumbnailHandle;
  /** Eligible for the wall (derived: has a random spec and no special body). */
  wall: boolean;
}

export interface ShowcaseSection {
  id: string;
  title: string;
  tagline: string;
  entries: ShowcaseEntry[];
}
