/**
 * Guards the cost of text truncation: every getComputedTextLength call forces layout, so the number
 * of calls each truncating host makes across an animated update sequence is pinned here. The counts
 * were recorded before the truncation state machine moved into TruncationTracker and must not grow.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installFakeFrameClock, runFrames, mountContainer } from './helpers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';
import type { MochartInputConfig } from '../../src';
import { mochartCssClasses } from '../../src/utils/ChartDom';
import { installTextMetrics } from '../golden/textMetrics';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, '../../../mochart-demo-data/src/config/truncated-text-config.json');
const dataPath = path.resolve(here, '../../../mochart-demo-data/src/data/long-category-string-values-data.json');

const WIDTH = 800;
const HEIGHT = 600;

type Host = 'tickLabels' | 'title' | 'axisTitle' | 'legendItem' | 'other';
type Counts = Record<Host, number>;

const HOST_SELECTORS: [Host, string][] = [
  ['tickLabels', '.' + mochartCssClasses['axisTickLabels']],
  ['title', '.' + mochartCssClasses['title']],
  ['axisTitle', '.' + mochartCssClasses['axisTitle']],
  ['legendItem', '.' + mochartCssClasses['legend']]
];

let counts: Counts;

function resetCounts(): void {
  counts = { tickLabels: 0, title: 0, axisTitle: 0, legendItem: 0, other: 0 };
}

function hostOf(element: Element): Host {
  for (const [host, selector] of HOST_SELECTORS) {
    if (element.closest(selector) !== null) {
      return host;
    }
  }
  return 'other';
}

let mochart: typeof import('../../src');

beforeAll(async () => {
  installTextMetrics();
  const svgProto = globalThis.SVGElement.prototype as any;
  const measure = svgProto.getComputedTextLength as (this: SVGElement) => number;
  svgProto.getComputedTextLength = function (this: SVGElement): number {
    counts[hostOf(this)]++;
    return measure.call(this);
  };
  installFakeFrameClock();
  mochart = await import('../../src');
});

function loadJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildConfig(): EnhancedMochartConfig {
  const migrated = mochart.migrateConfig(loadJson(configPath)) as Record<string, any>;
  migrated.animation = { ...(migrated.animation || {}), enabled: true };
  return mochart.enhanceConfig(migrated as MochartInputConfig) as EnhancedMochartConfig;
}

function scaleValues(mochartConfig: EnhancedMochartConfig, rows: Record<string, any>[], factor: number): Record<string, any>[] {
  const properties = mochartConfig.series.map(seriesConfig => seriesConfig.property).filter(Boolean) as string[];
  return rows.map(row => {
    const next = { ...row };
    for (const property of properties) {
      if (typeof next[property] === 'number') {
        next[property] = Math.round(next[property] * factor);
      }
    }
    return next;
  });
}

describe('truncation measurement cost', () => {
  it('makes a fixed number of getComputedTextLength calls per host across an animated update sequence', () => {
    const mochartConfig = buildConfig();
    const rows: Record<string, any>[] = loadJson(dataPath);
    const container = mountContainer();
    const provider = (data: Record<string, any>[]) => new mochart.ArrayOfObjectsDataProvider(data);

    resetCounts();
    const chart = mochart.createChart(container, { mochartConfig, dataProvider: provider(rows), width: WIDTH, height: HEIGHT });
    runFrames();
    const initial = { ...counts };

    // value axis expands, then contracts: tick label slots change every animation frame
    resetCounts();
    chart.update({ dataProvider: provider(scaleValues(mochartConfig, rows, 12)) });
    runFrames();
    chart.update({ dataProvider: provider(scaleValues(mochartConfig, rows, 0.3)) });
    runFrames();
    const valuesAnimated = { ...counts };

    // resize: every host's available width changes at once
    resetCounts();
    chart.update({ width: WIDTH / 2 });
    runFrames();
    chart.update({ width: WIDTH });
    runFrames();
    const resized = { ...counts };

    // category churn: tick count changes, so the tick label truncation data is rebuilt
    resetCounts();
    chart.update({ dataProvider: provider(rows.slice(0, rows.length - 2)) });
    runFrames();
    chart.update({ dataProvider: provider(rows) });
    runFrames();
    const categoriesChurned = { ...counts };

    chart.destroy();

    expect({ initial, valuesAnimated, resized, categoriesChurned }).toEqual({
      // the mount includes one bounded follow-up measure once the tick labels have truncated
      initial: { tickLabels: 1285, title: 251, axisTitle: 138, legendItem: 500, other: 0 },
      valuesAnimated: { tickLabels: 6594, title: 1104, axisTitle: 580, legendItem: 2208, other: 0 },
      resized: { tickLabels: 136, title: 14, axisTitle: 22, legendItem: 26, other: 0 },
      categoriesChurned: { tickLabels: 4281, title: 576, axisTitle: 302, legendItem: 1152, other: 0 }
    });
  });

  // Regression: a legend item or title that already fit was reset on every update, so each focus frame re-measured it
  it('stops measuring settled legend items and the title across focus updates', () => {
    const mochartConfig = mochart.enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      title: { text: 'Sales' },
      legend: { visible: true },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ id: 'sales', property: 'sales' }, { id: 'costs', property: 'costs' }]
    } as MochartInputConfig) as EnhancedMochartConfig;
    const rows = [{ month: 'Jan', sales: 10, costs: 5 }, { month: 'Feb', sales: 20, costs: 8 }];
    const container = mountContainer();
    const chart = mochart.createChart(container, { mochartConfig, dataProvider: new mochart.ArrayOfObjectsDataProvider(rows), width: WIDTH, height: HEIGHT });
    runFrames();
    // a real prop change flushes the tail of the mount-time measurement passes
    chart.update({ focusedSeriesId: 'sales' });
    runFrames();

    resetCounts();
    for (let i = 0; i < 10; i++) {
      chart.update({ focusedSeriesId: i % 2 === 0 ? 'costs' : 'sales' });
      runFrames();
    }
    chart.destroy();
    expect(counts.legendItem).toBe(0);
    expect(counts.title).toBe(0);
  });
});
