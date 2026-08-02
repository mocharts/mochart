import type { DataRow, DemoConfig, DemoRandomConfig } from '@mochart/demo-data';

/** Demos with bespoke behavior beyond the standard demo page. */
export type SpecialKind = 'player' | 'rotation' | 'states' | 'callbacks' | 'sparklines';

export interface ShowcaseEntry {
  slug: string;
  title: string;
  /** One-sentence gallery blurb. */
  blurb: string;
  /** The longer explanation shown in the About tab. */
  notes?: string;
  config: DemoConfig;
  data: DataRow[];
  /** Present → the seed stepper / play controls are offered. */
  random?: DemoRandomConfig;
  /** Chart-type random-mode generator id (demo-common chartTypeGenerators). */
  generator?: string;
  special?: SpecialKind;
  /** Eligible for the wall (derived: has a random spec and no special body). */
  wall: boolean;
}

export interface ShowcaseSection {
  id: string;
  title: string;
  tagline: string;
  entries: ShowcaseEntry[];
}
