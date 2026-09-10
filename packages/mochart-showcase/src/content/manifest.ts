// The showcase's curated manifest: every capability of @mochart/core gets
// exactly one polished home, organized by feature. Reused entries pull their
// config/data/random (and blurb/notes) from @mochart/demo-data; the rest are
// authored in locals.ts or built from demo-common models.

import demoData from '@mochart/demo-data';
import type { DataObject, Demo, DemoConfig } from '@mochart/demo-data';
import { rotationConfigs, rotationData, tableSparklineMetrics } from '@mochart/demo-common';

import type { ShowcaseEntry, ShowcaseSection, SpecialKind } from './types';
import { randomFromCurated } from './randomFromCurated';
import { sparklinesThumb } from '../components/SparklinesThumb';
import {
  currentColorConfig, currentColorData, currentColorRandom,
  easingConfig, easingData, easingRandom,
  editorConfig, editorData, editorRandom,
  focusStylesConfig, focusStylesData, focusStylesRandom,
  legendConfig, legendData, legendRandom,
  makeGenericRandom,
  stackedLabelsData,
  timeSeriesConfig, timeSeriesData, timeSeriesRandom
} from './locals';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getDemo(id: string): Demo {
  const demo = demoData.demoObjectMap[id];
  if (demo === undefined) {
    throw new Error('showcase manifest references unknown demo-data id: ' + id);
  }
  return demo;
}

interface EntryPatch {
  title?: string;
  blurb?: string;
  notes?: string;
  special?: SpecialKind;
  config?: DemoConfig;
  data?: DataObject[];
  random?: ShowcaseEntry['random'];
  thumbnail?: ShowcaseEntry['thumbnail'];
}

/**
 * A reused demo's random spec. Chart-type generators own their specs; the
 * generic spec is re-derived from the entry's curated rows.
 */
function reusedRandom(demo: Demo, data: DataObject[]): ShowcaseEntry['random'] {
  const random = clone(demo.random);
  if (demo.generator !== undefined || !('category' in random)) {
    return random;
  }
  return randomFromCurated(demo.config, data, random);
}

/** An entry reusing a demo-data demo's config/data/random (and prose). */
function reuse(slug: string, patch: EntryPatch = {}): ShowcaseEntry {
  const demo = getDemo(slug);
  const special = patch.special;
  const data = patch.data ?? clone(demo.data);
  return {
    slug,
    title: patch.title ?? demo.title,
    blurb: patch.blurb ?? demo.description ?? '',
    notes: patch.notes ?? demo.notes,
    config: patch.config ?? clone(demo.config),
    data,
    random: patch.random ?? reusedRandom(demo, data),
    generator: demo.generator,
    special,
    thumbnail: patch.thumbnail,
    wall: special === undefined
  };
}

/** A special entry whose config/data are borrowed from a demo-data demo. */
function specialFrom(baseId: string, slug: string, patch: EntryPatch & { special: SpecialKind }): ShowcaseEntry {
  const entry = reuse(baseId, patch);
  return { ...entry, slug, wall: false };
}

interface LocalEntryInput {
  slug: string;
  title: string;
  blurb: string;
  notes?: string;
  config: DemoConfig;
  data: DataObject[];
  random?: ShowcaseEntry['random'];
  special?: SpecialKind;
  thumbnail?: ShowcaseEntry['thumbnail'];
  thumbnailElement?: ShowcaseEntry['thumbnailElement'];
}

function local(input: LocalEntryInput): ShowcaseEntry {
  return {
    slug: input.slug,
    title: input.title,
    blurb: input.blurb,
    notes: input.notes,
    config: clone(input.config),
    data: clone(input.data),
    random: input.random === undefined ? undefined : clone(input.random),
    special: input.special,
    thumbnail: input.thumbnail,
    thumbnailElement: input.thumbnailElement,
    wall: input.random !== undefined && input.special === undefined
  };
}

// --- Reused entries with showcase-side tweaks --------------------------------

function forEachValueAxis(config: DemoConfig, fn: (axis: Record<string, unknown>) => void): void {
  const axes = config.valueAxes;
  for (const axis of Array.isArray(axes) ? axes : [axes]) {
    if (axis !== null && typeof axis === 'object') {
      fn(axis as Record<string, unknown>);
    }
  }
}

/** Four value axes leave a card almost no plot: two ticks each is enough. */
function multipleAxesEntry(): ShowcaseEntry {
  return reuse('axis-multiple', {
    thumbnail(config) {
      forEachValueAxis(config, axis => {
        axis.tickCount = 2;
      });
    }
  });
}

/**
 * Two stacked bars and one line over every other row of the demo dataset, with
 * short threshold titles: five series over 26 categories buried the two
 * threshold lines the demo is about.
 */
function thresholdLineEntry(): ShowcaseEntry {
  const demo = getDemo('threshold-line');
  const entry = reuse('threshold-line', {
    blurb: 'Two value axes, each drawing its own threshold line and title across the plot.',
    notes: 'The left axis carries two stacked bars with a thresholds entry at 20; the right axis carries one unstacked line with a thresholds entry at -8, and because the bars and the line read different scales the two threshold lines sit at unrelated heights. Each threshold\'s title.text labels it, title.side puts one label on the low side and the other on the high side, and snapToValue flips a label that has no room left. The axes also differ in adjustForFiltering: hiding a stacked series from the legend rescales the left axis and its threshold line rides along, while the right axis keeps its domain. All four animation durations are stretched to 2000ms, so the rescaling is easy to follow.',
    data: clone(demo.data.filter((_, index) => index % 2 === 0))
  });
  forEachValueAxis(entry.config, axis => {
    for (const threshold of axis.thresholds as { value: number; title: { text: string } }[]) {
      // -5 on the right axis sits level with 20 on the left for the curated rows, reading as one double line
      if (threshold.value === -5) {
        threshold.value = -8;
      }
      threshold.title.text = `Threshold ${threshold.value}`;
    }
  });
  const kept = new Set(['value1', 'value2', 'value6']);
  entry.config.series = (entry.config.series as { property: string; title: string }[])
    .filter(series => kept.has(series.property))
    .map(series => series.property === 'value6' ? { ...series, title: 'Line' } : series);
  return entry;
}

/** Full ISO dates rotated 90 degrees take most of a card's height. */
function rotatedTicksEntry(): ShowcaseEntry {
  return reuse('ticks-rotated', {
    thumbnail(config) {
      const categoryAxis = config.categoryAxis as Record<string, unknown>;
      categoryAxis.tickLabel = { ...(categoryAxis.tickLabel as object), format: '%b %d' };
      // With no title row above the plot, the top value label's 45 degree overhang needs room.
      config.chart = { ...(config.chart as object), margin: { top: 14 } };
    }
  });
}

/** Eight categories instead of 27, so the labels on every segment stay legible. */
function stackedLabelsEntry(): ShowcaseEntry {
  const entry = reuse('label-property-stacked', {
    data: stackedLabelsData,
    // With no title row above the plot, the top labels need axis headroom.
    thumbnail(config) {
      config.valueAxes = { ...(config.valueAxes as object), softMax: 42 };
    }
  });
  const seriesDefaults = entry.config.seriesDefaults as { label: Record<string, unknown> };
  seriesDefaults.label = { ...seriesDefaults.label, format: '.0f' };
  // The top segment's outside labels sit above the plot; let them overflow it.
  entry.config.plot = { clipOverflow: { top: 16 } };
  return entry;
}

/**
 * A month demo whose random pool reaches two months past each end of its
 * year, so the "%b" tick labels get the year as well to stay distinct.
 */
function monthsEntry(slug: string, patch: EntryPatch = {}): ShowcaseEntry {
  const entry = reuse(slug, patch);
  const categoryAxis = entry.config.categoryAxis as Record<string, unknown>;
  categoryAxis.tickLabel = { ...(categoryAxis.tickLabel as object), format: '%b %y' };
  categoryAxis.valueFormat = '%B %Y';
  return entry;
}

/** Every third row of the 26-row demo dataset, with whole-number labels. */
function horizontalBarsEntry(): ShowcaseEntry {
  const demo = getDemo('label-property-pos-neg');
  const entry = reuse('label-property-pos-neg', {
    title: 'Horizontal Bars',
    data: clone(demo.data.filter((_, index) => index % 3 === 0))
  });
  const series = entry.config.series as { label: Record<string, unknown> };
  series.label = { ...series.label, format: '.0f' };
  return entry;
}

// --- Special demo assembly ---------------------------------------------------

function playerEntry(): ShowcaseEntry {
  const entry = specialFrom('stacked', 'player', {
    special: 'player',
    title: 'Staged Animation Player',
    blurb: 'Watch a staged transition frame by frame: axis expansion, value change, axis contraction, at full speed or in slow motion.',
    notes: 'Mochart plays every update as a staged sequence: axes expand first, then values (and category enter/exit) change, then axes contract. Only one kind of movement is on screen at a time, and stacked series move as one gapless unit. Step the seed to trigger a transition and use the speed control to stretch the animation durations so each stage is legible. The speed control scales the config\'s durations before the chart is built.'
  });
  entry.config = {
    ...entry.config,
    title: { text: 'Staged Animation Player' },
    animation: {
      enabled: true,
      initialDuration: 1000,
      expansionDuration: 1000,
      valueChangeDuration: 1000,
      contractionDuration: 1000,
      focusDuration: 500
    }
  };
  return entry;
}

function rotationEntry(): ShowcaseEntry {
  return local({
    slug: 'rotation',
    title: 'Layout Morph',
    blurb: 'One dataset, sixty axis layouts: inverted plots, flipped axes, collapsed and rotated tick labels, every change animated.',
    notes: 'The play button cycles through configurations that permute plot.inverted, categoryAxis.side/collapsed, tick label rotation and anchoring. Because the data never changes, everything you see moving is the chart re-laying itself out. The same staged animation that drives data updates also drives structural changes.',
    config: rotationConfigs[0] as DemoConfig,
    data: rotationData as DataObject[],
    special: 'rotation'
  });
}

function statesEntry(): ShowcaseEntry {
  return specialFrom('grouped', 'states', {
    special: 'states',
    title: 'Loading, Error & Empty States',
    blurb: 'The chart’s built-in loading, error, empty-data and invalid-config states, switchable live.',
    notes: 'Charts rarely live alone: data arrives late, requests fail, filters empty the set. The loading and error props switch the chart into its corresponding state, an empty dataset renders the no-data state, and every one of them is customizable through factory props (getLoadingComponent, getErrorComponent, getNoDataComponent, …) that return any DOM node.'
  });
}

function callbacksEntry(): ShowcaseEntry {
  return specialFrom('grouped', 'callbacks', {
    special: 'callbacks',
    title: 'Interaction Callbacks',
    blurb: 'Click, hover, focus and legend-filter events streamed into a live log as you interact with the chart.',
    notes: 'Every interaction the chart supports is also reported to the host: onChartClick with plot coordinates and the nearest category, onFocus as hover or legend interaction moves focus, onSeriesFilter as legend clicks filter series in and out, and onChartMouseEnter/Move/Leave for raw pointer tracking. The log below the chart prints each event as it fires.'
  });
}

function easingEntry(): ShowcaseEntry {
  return local({
    slug: 'easing',
    title: 'Easing',
    blurb: 'Sixteen easing curves for the same value change: pick one, step the seed, and compare the pacing.',
    notes: 'animation.easing paces each data animation phase and animation.focusEasing paces focus transitions. The value axis is pinned to 0 to 100, so every seed step is a pure value change with no axis phases, which is the cleanest stage for comparing easings. The picker writes both properties into the config so the config tab shows the current choice. Every easing stays between its start and its target: the bounce family settles onto the target rather than overshooting it.',
    config: easingConfig,
    data: easingData,
    random: easingRandom,
    special: 'easing'
  });
}

function sparklinesEntry(): ShowcaseEntry {
  const metric = tableSparklineMetrics[0];
  return local({
    slug: 'sparklines',
    title: 'Sparklines',
    blurb: 'Word-sized charts: the sparkline preset strips axes and chrome for inline text and small-multiple tables.',
    notes: 'createSparklineConfig turns a normal chart config into a sparkline preset: axes, legend, and margins collapse so the plot fills the whole (tiny) canvas. This page weaves live sparklines into a sentence and builds a small-multiples metrics table. Randomize to watch every one of them transition in place.',
    config: metric.config as DemoConfig,
    data: metric.generate(0),
    special: 'sparklines',
    thumbnailElement: sparklinesThumb
  });
}

// --- Sections ----------------------------------------------------------------

let sections: ShowcaseSection[] | null = null;

export function getSections(): ShowcaseSection[] {
  if (sections !== null) {
    return sections;
  }
  sections = [
    {
      id: 'series',
      title: 'Bars, lines & areas',
      tagline: 'The core series renderers, freely mixable in one chart: stacked, grouped, ranged, scattered, curved, capped, horizontal.',
      entries: [
        reuse('stacked'),
        reuse('grouped'),
        reuse('stacked-grouped'),
        reuse('range'),
        reuse('curved'),
        reuse('scatter'),
        reuse('bubble'),
        monthsEntry('picket', { title: 'Bar Caps' }),
        horizontalBarsEntry()
      ]
    },
    {
      id: 'chart-types',
      title: 'Chart types',
      tagline: 'Higher-level chart types built on the same primitives, each with a data helper that keeps its invariants.',
      entries: [
        reuse('histogram'),
        reuse('waterfall'),
        reuse('heatmap'),
        reuse('candlestick'),
        reuse('candlestick-hollow'),
        reuse('ohlc'),
        reuse('error-bars'),
        reuse('pie'),
        reuse('donut'),
        reuse('gauge'),
        sparklinesEntry()
      ]
    },
    {
      id: 'scales',
      title: 'Scales & axes',
      tagline: 'Ordinal, linear and date category scales; multiple value axes; thresholds; axis bounds; and tick-label management.',
      entries: [
        local({
          slug: 'time-series',
          title: 'Date & Time Axis',
          blurb: 'Readings logged at uneven times on a linear date scale: bursts bunch up and the gaps between them stay open, where an ordinal scale would space every reading evenly.',
          notes: 'categoryAxis.type "date" with scale "linear" places each row at its real time, so the four bursts of readings sit close together and the day-long gaps between them stay open. Change scale to "ordinal" in the config tab and every reading gets an equal slot, hiding the gaps. tickLabel.format and valueFormat take d3-time-format strings for the axis ticks and the tooltip\'s category line, and dateUTC pins parsing to UTC so the chart reads the same in every timezone. Randomizing picks quarter-hour slots across the same four days, so the sampling stays uneven.',
          config: timeSeriesConfig,
          data: timeSeriesData,
          random: timeSeriesRandom
        }),
        multipleAxesEntry(),
        thresholdLineEntry(),
        rotatedTicksEntry(),
        reuse('truncated-text'),
        // Bands should come and go: nine values in -6 to 6 cross each value-axis bound (-5, 5) on
        // about half the seeds, and a pool only a little wider than the 5 to 20 category bounds
        // keeps the side bands intermittent too.
        reuse('clipped', {
          random: makeGenericRandom({ categoryCount: 9, categoryNumber: { min: 3, max: 22, interval: 1 }, seriesMin: -6, seriesMax: 6 })
        })
      ]
    },
    {
      id: 'animation',
      title: 'Animation',
      tagline: 'The staged animation model that sets mochart apart: slowed down, stepped through, and paced by sixteen easings.',
      entries: [
        playerEntry(),
        rotationEntry(),
        easingEntry()
      ]
    },
    {
      id: 'interaction',
      title: 'Interaction',
      tagline: 'Tooltips, crosshair, legend filtering, focus states, and the callbacks that report all of it to your app.',
      entries: [
        callbacksEntry(),
        reuse('tooltip-controls'),
        reuse('axis-filtering'),
        local({
          slug: 'focus-styles',
          title: 'Focus Styles',
          blurb: 'Hover a series (or its legend entry) and watch the focused/defocused style states restyle the whole chart.',
          notes: 'Every styled element carries a style in three focus states: normal, focused, defocused. Here seriesDefaults.shapeStyle gives every series a thicker focused outline and fades defocused fills to 15%, so pointing at any series makes the others step back. "same" in a focused/defocused color means "inherit the normal state’s color", so states usually only need to override opacities and widths.',
          config: focusStylesConfig,
          data: focusStylesData,
          random: focusStylesRandom
        }),
        reuse('currency-pos-neg', { blurb: 'Currency formatting on the tick labels and tooltip values of two value axes at different scales.' })
      ]
    },
    {
      id: 'styling',
      title: 'Styling & theming',
      tagline: 'Gradients, patterns, data-driven color ramps, marker and label styling, and chrome that follows your page’s ink.',
      entries: [
        reuse('gradients'),
        monthsEntry('patterns'),
        reuse('color-property'),
        stackedLabelsEntry(),
        reuse('christmas'),
        local({
          slug: 'legend',
          title: 'Legend',
          blurb: 'A legend above the plot, right-aligned against the chart bounds and boxed, with filtered series struck through and a long title truncated.',
          notes: 'legend.position puts the legend above the plot and legend.align sets it right, with alignedToAxes false so it aligns to the chart bounds rather than the plot. backgroundStyle fills and outlines the padded box, item styles each entry and icon sizes the swatches. strikeThroughFiltered strikes a filtered series through instead of only greying it; click an entry to see it. truncation cuts a title that cannot fit its row, with the full text shown on hover; narrow the window until the EMEA entry has no room to see it.',
          config: legendConfig,
          data: legendData,
          random: legendRandom,
          // The card strips legends by default; this one is the legend.
          thumbnail(config) {
            config.legend = { ...(config.legend as object), visible: true };
          }
        }),
        local({
          slug: 'currentcolor',
          title: 'currentColor Chrome',
          blurb: 'Axes, ticks and title default to currentColor, and series can too. Toggle the theme and the chart follows.',
          notes: 'The chart’s structural chrome (axis lines, tick labels, title, legend text) defaults to currentColor, so it inherits whatever color the surrounding page sets, which is how the dark theme restyles every chart without a single config change. This demo goes further and paints a series with currentColor as well. Flip the theme toggle and watch both follow the page’s ink.',
          config: currentColorConfig,
          data: currentColorData,
          random: currentColorRandom
        })
      ]
    },
    {
      id: 'data',
      title: 'Data handling',
      tagline: 'Missing values, plain and stacked, and the loading / error / empty states real data pipelines need.',
      entries: [
        reuse('missing'),
        reuse('missing-stacked', { blurb: 'A bar stack with missing positive and negative values: segments stay coherent while the stack animates.' }),
        statesEntry()
      ]
    },
    {
      id: 'config',
      title: 'Config & validation',
      tagline: 'Configs are validated data: human-readable errors, and an editor that knows the whole vocabulary.',
      entries: [
        local({
          slug: 'editor',
          title: 'Config Editor Playground',
          blurb: 'Edit a config with completions, hover docs and live validation. Invalid configs explain themselves.',
          notes: 'The config tab on every showcase page is powered by @mochart/editor with mochart intelligence: completions for every section and property, hover documentation with defaults, and live diagnostics that combine JSON syntax errors with @mochart/movalid’s validation messages. Break something on purpose (change a renderer to "pie chart", or point a series at a missing axis) and the chart renders its config-error state with the same message the editor underlines.',
          config: editorConfig,
          data: editorData,
          random: editorRandom
        })
      ]
    }
  ];
  return sections;
}

let entryMap: Map<string, ShowcaseEntry> | null = null;

export function getEntry(slug: string): ShowcaseEntry | undefined {
  if (entryMap === null) {
    entryMap = new Map();
    for (const section of getSections()) {
      for (const entry of section.entries) {
        entryMap.set(entry.slug, entry);
      }
    }
  }
  return entryMap.get(slug);
}

/** Entries eligible for the wall: a random spec and a standard chart body. */
export function getWallEntries(): ShowcaseEntry[] {
  return getSections().flatMap(section => section.entries.filter(entry => entry.wall));
}

/** The wall's default selection: one visually distinct chart per family. */
export const defaultWallSlugs = ['stacked', 'curved', 'heatmap', 'waterfall', 'candlestick', 'donut', 'error-bars', 'gauge'];
