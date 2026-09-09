// The sparkline showcase page model: a paragraph with sparklines woven
// between the demoText.sparklinePage.intro segments, then a small-multiples
// metrics table. Each metric owns a preset config (createSparklineConfig)
// and a seeded per-step data generator, so the frameworks only mount charts
// and re-generate on the Randomize button.

import seedrandom from 'seedrandom';

import { createSparklineConfig } from '@mochart/core';

import type { DataObject, DemoConfig } from './types';

type Rng = () => number;

export interface SparklineMetric {
  id: string;
  /** Row label shown in the metrics table (table metrics only). */
  label: string;
  /** Chart size in pixels — inline metrics are word-sized, table cells larger. */
  width: number;
  height: number;
  config: DemoConfig;
  /** The dataset for a randomize step (step 0 is the initial page load). */
  generate(step: number): DataObject[];
  /** The "Latest" cell text for a generated dataset (table metrics only). */
  latestText(rows: DataObject[]): string;
}

const POINT_COUNT = 30;

// The waterfall demo's CVD-safe direction triple, reused as accents.
const BLUE = '#2a78d6';
const AQUA = '#1baf7a';
const RED = '#e34948';

function rng(metricId: string, step: number): Rng {
  return seedrandom('sparkline:' + metricId + ':' + step);
}

function walk(random: Rng, start: number, stepSize: number, drift: number): number[] {
  let value = start;
  return Array.from({ length: POINT_COUNT }, () => {
    value = Math.max(0, value + (random() - drift) * stepSize);
    return Math.round(value * 10) / 10;
  });
}

function lineConfig(renderer: 'line' | 'area', color: string): DemoConfig {
  return createSparklineConfig({
    version: '1.0.0',
    categoryAxis: { property: 'i', type: 'number', scale: 'linear' },
    // The preset hides value axes through valueAxisDefaults, which only
    // merges into *declared* axes — so declare the (otherwise defaulted) one.
    valueAxes: [{}],
    series: [
      { property: 'value', renderer, shapeStyle: { normal: { strokeColor: color, fillColor: color } } }
    ]
  }) as DemoConfig;
}

function walkMetric(
  id: string,
  label: string,
  size: { width: number; height: number },
  renderer: 'line' | 'area',
  color: string,
  start: number,
  stepSize: number,
  drift: number,
  latestText: (latest: number) => string
): SparklineMetric {
  return {
    id,
    label,
    ...size,
    config: lineConfig(renderer, color),
    generate: step => walk(rng(id, step), start, stepSize, drift).map((value, i) => ({ i, value })),
    latestText: rows => latestText(rows[rows.length - 1]['value'] as number)
  };
}

const INLINE_SIZE = { width: 120, height: 26 };
const TABLE_SIZE = { width: 150, height: 32 };

// Win/loss reuses the waterfall trick: one property (and color) per
// direction, each row filling exactly one of them.
const winLossMetric: SparklineMetric = {
  id: 'win-loss',
  label: 'Daily win/loss',
  ...TABLE_SIZE,
  config: createSparklineConfig({
    version: '1.0.0',
    categoryAxis: { property: 'i', type: 'string', scale: 'ordinal' },
    valueAxes: [{ base: 0, min: -1, max: 1 }],
    series: [
      { property: 'up', renderer: 'bar', missingValueMode: 'connect', shapeStyle: { normal: { fillColor: AQUA } } },
      { property: 'down', renderer: 'bar', missingValueMode: 'connect', shapeStyle: { normal: { fillColor: RED } } }
    ]
  }) as DemoConfig,
  generate(step) {
    const random = rng(this.id, step);
    return Array.from({ length: POINT_COUNT }, (_, i) => {
      const win = random() > 0.45;
      return win ? { i: String(i), up: 1 } : { i: String(i), down: -1 };
    });
  },
  latestText(rows) {
    const wins = rows.filter(row => row['up'] !== undefined).length;
    return wins + 'W / ' + (rows.length - wins) + 'L';
  }
};

/** The word-sized charts woven into the intro paragraph, in segment order. */
export const inlineSparklineMetrics: SparklineMetric[] = [
  walkMetric('revenue-inline', 'Revenue', INLINE_SIZE, 'line', BLUE, 120, 14, 0.42, latest => '$' + latest + 'k'),
  walkMetric('error-rate-inline', 'Error rate', INLINE_SIZE, 'line', RED, 1.4, 0.5, 0.5, latest => latest + '%')
];

/** The metrics-table rows. */
export const tableSparklineMetrics: SparklineMetric[] = [
  walkMetric('revenue', 'Revenue ($k)', TABLE_SIZE, 'area', BLUE, 120, 14, 0.42, latest => String(latest)),
  walkMetric('sessions', 'Sessions (k)', TABLE_SIZE, 'area', AQUA, 46, 7, 0.46, latest => String(latest)),
  walkMetric('latency', 'P95 latency (ms)', TABLE_SIZE, 'line', RED, 220, 30, 0.48, latest => String(latest)),
  winLossMetric
];
