import type { EnhancedMochartConfig } from '../../src/types/enhanced';
/**
 * Golden DOM snapshots of the full rendering pipeline: every demo config from
 * packages/mochart-demo-data/src renders through createChart() in jsdom on a fake clock, and the
 * normalized DOM is compared against ./__snapshots__. The goldens were captured from the
 * mochart-vdom implementation and act as the equivalence oracle for the retained-mode renderer.
 *
 * The suites are defined here and registered by the golden-*.test.ts files: vitest parallelizes per
 * file, and the animated per-demo runs are the whole suite's wall-clock floor, so the demos are
 * spread over several shard files (see shardDemos).
 */
import { describe, it, beforeAll, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MochartInputConfig, DataProvider } from '../../src';
import { getCssSelector, getIdCssSelector, mochartVersionAttribute } from '../../src/utils/ChartDom';
import { installTextMetrics } from './textMetrics';
import { FRAME_MS, installFakeFrameClock, runFrames, advanceFrames, mountContainer } from '../components/helpers';

/** Settle like runFrames, and fail on a chart that still schedules work at the frame cap. */
function settle(): void {
  runFrames();
  expect(vi.getTimerCount(), 'chart never settled').toBe(0);
}

export interface Demo { id: string; config: string; data: string; random?: string; generator?: string; goldenCategoryShift?: number }
/** Rows are decoded from arbitrary demo JSON, so values are intentionally loose. */
type Row = Record<string, any>;

const here = path.dirname(fileURLToPath(import.meta.url));
const demosDir = path.resolve(here, '../../../mochart-demo-data/src');

const WIDTH = 800;
const HEIGHT = 600;
const MAX_FRAMES = 500;

// ---------------------------------------------------------------------------
// demo assets, indexed by basename (configs live in nested folders too)
// ---------------------------------------------------------------------------

function indexJsonFilesByBasename(dir: string, map: Record<string, string> = {}): Record<string, string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      indexJsonFilesByBasename(full, map);
    }
    else if (entry.name.endsWith('.json')) {
      map[entry.name] = full;
    }
  }
  return map;
}

const demosJson = JSON.parse(fs.readFileSync(path.join(demosDir, 'demos.json'), 'utf8'));
const configPaths = indexJsonFilesByBasename(path.join(demosDir, 'config'));
const dataPaths = indexJsonFilesByBasename(path.join(demosDir, 'data'));
const randomPaths = indexJsonFilesByBasename(path.join(demosDir, 'random'));
const allDemos: Demo[] = [...demosJson.demos, ...demosJson.testDemos];

/** Every `count`th demo starting at `index`, so the shard files split the demos evenly. */
export function shardDemos(index: number, count: number): Demo[] {
  return allDemos.filter((_, i) => i % count === index);
}

function loadJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ---------------------------------------------------------------------------
// library loading — fake timers must be installed before the import
// ---------------------------------------------------------------------------

let mochart: typeof import('../../src');
let generateDemoDataProvider: typeof import('../../../mochart-demo-common/src/chartTypeGenerators').generateDemoDataProvider;

/** Registers the per-file environment every golden suite needs; call once at the top of each test file. */
export function setupGoldenEnvironment(): void {
  // headroom for saturated coverage runs, which starve these past the 30s default
  vi.setConfig({ testTimeout: 120_000 });
  beforeAll(async () => {
    // jsdom has no font or layout engine; install the deterministic synthetic
    // font so the goldens capture real measured text (truncation, tick pruning,
    // layout fitting) instead of the library's default-bounds fallbacks.
    installTextMetrics();
    installFakeFrameClock();
    mochart = await import('../../src');
    // imports @mochart/core, so it must also load after the fake timers
    ({ generateDemoDataProvider } = await import('../../../mochart-demo-common/src/chartTypeGenerators'));
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const UNIQUE_ID_PREFIXES = [
  '__mochart__chart__', 'tooltip__clippath__', 'title__clippath__', 'legend__clippath__',
  'categoryaxistitle__clippath__', 'categoryaxisticklabel__clippath__', 'seriesaxistitle__clippath__',
  'series__clippath__', 'clipindicator__pattern__', 'linear__gradient__', 'radial__gradient__',
  'series__pattern__', 'seriescolor__gradient__'
];
const uniqueIdPattern = new RegExp('(' + UNIQUE_ID_PREFIXES.join('|') + ')(\\d+)', 'g');

/**
 * Normalize markup for stable snapshots: per-instance id counters, version stamps, and comment
 * nodes (vdom empty-child placeholders vs retained-renderer anchors — neither affects rendering).
 */
function normalizeHtml(html: string) {
  return html
    .replace(uniqueIdPattern, '$1N')
    .replace(new RegExp(' ' + mochartVersionAttribute + '="[^"]*"', 'g'), '')
    .replace(/<!--[^>]*-->/g, '')
    .replace(/></g, '>\n<');
}

function snapshotFile(demoId: string, stage: string) {
  return path.join(here, '__snapshots__', `${demoId}--${stage}.html`);
}

async function expectSnapshot(container: HTMLElement, demoId: string, stage: string) {
  await expect(normalizeHtml(container.innerHTML)).toMatchFileSnapshot(snapshotFile(demoId, stage));
}

function buildMochartConfig(
  configBasename: string,
  { animate = true, mutate }: { animate?: boolean; mutate?: (raw: Record<string, any>) => void } = {}
): EnhancedMochartConfig {
  const raw = loadJson(configPaths[configBasename]);
  const migrated = mochart.migrateConfig(raw) as Record<string, any>;
  migrated.animation = { ...(migrated.animation || {}), enabled: animate };
  mutate?.(migrated);
  return mochart.enhanceConfig(migrated as MochartInputConfig) as EnhancedMochartConfig;
}

function getCategoryProperty(mochartConfig: EnhancedMochartConfig): string | undefined {
  return mochartConfig.categoryAxis ? mochartConfig.categoryAxis.property : undefined;
}

function getSeriesProperties(mochartConfig: EnhancedMochartConfig): string[] {
  return (mochartConfig.series || [])
    .map((seriesConfig) => seriesConfig.property)
    .filter((property): property is string => Boolean(property));
}

function makeProvider(rows: Row[]): DataProvider {
  return new mochart.ArrayOfObjectsDataProvider(rows);
}

/**
 * The app's random-mode data for a generator demo at `randomId`: every step re-runs the core chart
 * helper, so it stays a valid chart of its type — the per-property transforms below would corrupt
 * these demos' structural range/color properties.
 */
function generatorProvider(demo: Demo, mochartConfig: EnhancedMochartConfig, randomId: number): DataProvider {
  return generateDemoDataProvider(demo.generator, mochartConfig, loadJson(randomPaths[demo.random!]), randomId);
}

/** Deterministic stand-in for the demo app's "randomize values" button. */
function transformValues(mochartConfig: EnhancedMochartConfig, rows: Row[]): Row[] {
  const seriesProperties = getSeriesProperties(mochartConfig);
  return rows.map((row, rowIndex) => {
    const next = { ...row };
    for (const property of seriesProperties) {
      if (typeof next[property] === 'number') {
        next[property] = Math.round(next[property] * 0.6 + 7 + rowIndex);
      }
    }
    return next;
  });
}

/** Window slide for demos declaring goldenCategoryShift: days on date axes, value units on numeric. */
function shiftCategories(mochartConfig: EnhancedMochartConfig, rows: Row[], shift: number): Row[] {
  const categoryProperty = getCategoryProperty(mochartConfig);
  if (!categoryProperty) {
    return rows;
  }
  return rows.map((row) => {
    const value = row[categoryProperty];
    const next = { ...row };
    if (typeof value === 'number') {
      next[categoryProperty] = value + shift;
    }
    else if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
      next[categoryProperty] = new Date(Date.parse(value) + shift * 24 * 3600 * 1000).toISOString();
    }
    return next;
  });
}

/** The next category value or key after the given ones: numbers count up, ISO dates step a day, anything else becomes NEW1. */
function nextValueFor(values: unknown[]): unknown {
  const last = values[values.length - 1];
  if (typeof last === 'number') {
    return Math.max(...values.filter((v): v is number => typeof v === 'number')) + 1;
  }
  if (typeof last === 'string' && !Number.isNaN(Date.parse(last)) && last.includes('-')) {
    const maxTime = Math.max(...values.map((v) => Date.parse(v as string)));
    return new Date(maxTime + 24 * 3600 * 1000).toISOString();
  }
  return 'NEW1';
}

/** Deterministic version of the demo app's "add category" button. */
function addCategoryRow(mochartConfig: EnhancedMochartConfig, rows: Row[]): Row[] {
  const categoryProperty = getCategoryProperty(mochartConfig);
  if (!categoryProperty || rows.length === 0) {
    return rows;
  }
  // a keyed axis gets a fresh key with the copied (repeated) value, since repeated values are what keys are for
  const keyProperty = mochartConfig.categoryAxis!.keyProperty;
  const freshProperty = keyProperty !== null ? keyProperty : categoryProperty;
  const row = { ...rows[rows.length - 1], [freshProperty]: nextValueFor(rows.map((r) => r[freshProperty])) };
  const seriesProperties = getSeriesProperties(mochartConfig);
  seriesProperties.forEach((property, i) => {
    if (typeof row[property] === 'number') {
      row[property] = 20 + i * 11;
    }
  });
  return [...rows, row];
}

function removeCategoryRow(rows: Row[]): Row[] {
  if (rows.length <= 2) {
    return rows;
  }
  const index = Math.floor(rows.length / 2);
  return rows.filter((_, i) => i !== index);
}

function createContainer() {
  const container = mountContainer();
  return container;
}

// ---------------------------------------------------------------------------
// the suites
// ---------------------------------------------------------------------------

/** The per-demo suites for `demos`: animated, static, and (opt-in) category-window slide goldens. */
export function describeDemoGoldens(demos: Demo[]): void {
  describe.each(demos)('demo: $id', (demo) => {
    it('renders and animates deterministically', async () => {
      const mochartConfig = buildMochartConfig(demo.config);
      const originalRows = loadJson(dataPaths[demo.data]);
      const container = createContainer();

      const chart = mochart.createChart(container, {
        mochartConfig,
        dataProvider: makeProvider(originalRows),
        width: WIDTH,
        height: HEIGHT
      });

      settle();
      await expectSnapshot(container, demo.id, 'initial');

      if (demo.generator) {
        // generator demos: step the app's random mode; successive steps change
        // values and churn categories (dropped columns/steps, day counts)
        chart.update({ dataProvider: generatorProvider(demo, mochartConfig, 1) });
        settle();
        await expectSnapshot(container, demo.id, 'random-1');

        // the 1 → 2 transition is app-reachable, so snapshot it mid-tween too
        chart.update({ dataProvider: generatorProvider(demo, mochartConfig, 2) });
        advanceFrames(3);
        await expectSnapshot(container, demo.id, 'random-2-mid-tween');
        settle();
        await expectSnapshot(container, demo.id, 'random-2');

        chart.update({ dataProvider: generatorProvider(demo, mochartConfig, 3) });
        settle();
        await expectSnapshot(container, demo.id, 'random-3');
      }
      else {
        // deterministic value change: snapshot mid-tween and settled
        const changedRows = transformValues(mochartConfig, originalRows);
        chart.update({ dataProvider: makeProvider(changedRows) });
        advanceFrames(3);
        await expectSnapshot(container, demo.id, 'values-mid-tween');
        settle();
        await expectSnapshot(container, demo.id, 'values-settled');

        // category addition, run to completion
        const addedRows = addCategoryRow(mochartConfig, changedRows);
        chart.update({ dataProvider: makeProvider(addedRows) });
        settle();
        await expectSnapshot(container, demo.id, 'category-added');

        // category removal, run to completion
        const removedRows = removeCategoryRow(addedRows);
        chart.update({ dataProvider: makeProvider(removedRows) });
        settle();
        await expectSnapshot(container, demo.id, 'category-removed');
      }

      chart.destroy();
      expect(vi.getTimerCount(), 'timers left after destroy').toBe(0);
      expect(container.innerHTML).toBe('');
    });

    it('renders statically with animation disabled', async () => {
      const mochartConfig = buildMochartConfig(demo.config, { animate: false });
      const originalRows = loadJson(dataPaths[demo.data]);
      const container = createContainer();

      const chart = mochart.createChart(container, {
        mochartConfig,
        dataProvider: makeProvider(originalRows),
        width: WIDTH,
        height: HEIGHT
      });
      settle();
      await expectSnapshot(container, demo.id, 'static');

      chart.update({
        dataProvider: demo.generator
          ? generatorProvider(demo, mochartConfig, 1)
          : makeProvider(transformValues(mochartConfig, originalRows))
      });
      settle();
      await expectSnapshot(container, demo.id, 'static-updated');

      chart.destroy();
      expect(vi.getTimerCount(), 'timers left after destroy').toBe(0);
      expect(container.innerHTML).toBe('');
    });

    // opt-in via goldenCategoryShift: a window slide big enough to classify as a
    // translation, so the mid-tween frame captures the domain mid-slide
    if (demo.goldenCategoryShift !== undefined) {
      it('slides the category window deterministically', async () => {
        const mochartConfig = buildMochartConfig(demo.config);
        const originalRows = loadJson(dataPaths[demo.data]);
        const container = createContainer();

        const chart = mochart.createChart(container, {
          mochartConfig,
          dataProvider: makeProvider(originalRows),
          width: WIDTH,
          height: HEIGHT
        });
        settle();

        const shiftedRows = shiftCategories(mochartConfig, originalRows, demo.goldenCategoryShift!);
        chart.update({ dataProvider: makeProvider(shiftedRows) });
        advanceFrames(3);
        await expectSnapshot(container, demo.id, 'slide-mid-tween');
        settle();
        await expectSnapshot(container, demo.id, 'slide-settled');

        chart.destroy();
        expect(vi.getTimerCount(), 'timers left after destroy').toBe(0);
        expect(container.innerHTML).toBe('');
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Series filtering via legend click — the per-demo suites never filter. A wrong tween resting value
// (the axis base) strands the shrink partway, and a fixed-frame snapshot can miss it, so the oracle
// is the LAST frame the filtered series is still in the DOM: correct code shows a vanishing sliver,
// a wrong base a stranded shape. Radial demos cover the pie-mode base-0 default; grouped is the xy control;
// candlestick's legend series carries followSeries followers (wick, volume) that must filter with it.
// ---------------------------------------------------------------------------

const FILTERING_DEMO_IDS = ['pie', 'donut', 'gauge', 'grouped', 'candlestick'];
const filteringDemos = allDemos.filter((demo) => FILTERING_DEMO_IDS.includes(demo.id));

function clickFirstLegendItem(container: HTMLElement) {
  const legendItem = container.querySelector(getCssSelector('legendItem'));
  expect(legendItem).not.toBeNull();
  legendItem!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

export function describeFilteringGoldens(): void {
  describe.each(filteringDemos)('filtering: $id', (demo) => {
    it('animates a legend-click filtering out and back in', async () => {
      const mochartConfig = buildMochartConfig(demo.config);
      const rows = loadJson(dataPaths[demo.data]);
      const container = createContainer();

      const chart = mochart.createChart(container, {
        mochartConfig,
        dataProvider: makeProvider(rows),
        width: WIDTH,
        height: HEIGHT
      });
      settle();

      clickFirstLegendItem(container);
      advanceFrames(3);
      await expectSnapshot(container, demo.id, 'filter-early-tween');

      // step to the removal of the filtered series' elements (the first legend series plus its
      // followSeries followers), keeping the DOM of the last frame any of them was still present
      const leaderId = mochartConfig.series.find((seriesConfig) => seriesConfig.showInLegend)!.id;
      const filteredSelectors = mochartConfig.series
        .filter((seriesConfig) => seriesConfig.id === leaderId || seriesConfig.followSeries === leaderId)
        .map((seriesConfig) => getIdCssSelector('series', seriesConfig.id));
      const anyFilteredPresent = () => filteredSelectors.some((selector) => container.querySelector(selector) !== null);
      for (const selector of filteredSelectors) {
        expect(container.querySelector(selector)).not.toBeNull();
      }
      let lastPresentHtml = container.innerHTML;
      for (let frame = 0; frame < MAX_FRAMES && vi.getTimerCount() > 0; frame++) {
        vi.advanceTimersByTime(FRAME_MS);
        if (!anyFilteredPresent()) {
          break;
        }
        lastPresentHtml = container.innerHTML;
      }
      expect(anyFilteredPresent()).toBe(false);
      await expect(normalizeHtml(lastPresentHtml)).toMatchFileSnapshot(snapshotFile(demo.id, 'filter-last-frame'));
      settle();
      await expectSnapshot(container, demo.id, 'filter-settled');

      // unfilter: the series animates back in from the same resting value
      clickFirstLegendItem(container);
      settle();
      await expectSnapshot(container, demo.id, 'filter-restored');

      chart.destroy();
      expect(vi.getTimerCount(), 'timers left after destroy').toBe(0);
      expect(container.innerHTML).toBe('');
    });
  });
}

// ---------------------------------------------------------------------------
// Config updates on a live chart — exercises Chart.derive's incremental vs full-rebuild branches
// and ChartController's animate-toggle source swap, which the data-only per-demo suites never reach.
// ---------------------------------------------------------------------------

export function describeConfigUpdateGoldens(): void {
  describe('config updates on a mounted chart', () => {
    const demo = allDemos.find((aDemo) => aDemo.id === 'grouped')!;

    function mountGrouped(mochartConfig: EnhancedMochartConfig, rows: Row[]) {
      const container = createContainer();
      const chart = mochart.createChart(container, {
        mochartConfig,
        dataProvider: makeProvider(rows),
        width: WIDTH,
        height: HEIGHT
      });
      settle();
      return { container, chart };
    }

    it('applies a non-structural config change incrementally (title, series title, renderer)', async () => {
      const mochartConfig = buildMochartConfig(demo.config);
      const rows = loadJson(dataPaths[demo.data]);
      const { container, chart } = mountGrouped(mochartConfig, rows);

      const changedConfig = buildMochartConfig(demo.config, {
        mutate: (raw) => {
          raw.title.text = 'Updated Title';
          raw.series[1].title = 'Renamed Series';
          raw.seriesDefaults.renderer = 'line';
        }
      });
      // renderer/title changes must take the incremental derive path, not a rebuild
      expect(mochart.hasConfigStructureChange(mochartConfig, changedConfig)).toBe(false);

      chart.update({ mochartConfig: changedConfig });
      advanceFrames(3);
      await expectSnapshot(container, demo.id, 'config-nonstructural-mid-tween');
      settle();
      await expectSnapshot(container, demo.id, 'config-nonstructural-settled');

      chart.destroy();
      expect(vi.getTimerCount(), 'timers left after destroy').toBe(0);
      expect(container.innerHTML).toBe('');
    });

    it('rebuilds on a structural config change (series removed, then restored)', async () => {
      const mochartConfig = buildMochartConfig(demo.config);
      const rows = loadJson(dataPaths[demo.data]);
      const { container, chart } = mountGrouped(mochartConfig, rows);
      const initialHtml = normalizeHtml(container.innerHTML);

      const removedConfig = buildMochartConfig(demo.config, {
        mutate: (raw) => {
          raw.series.pop();
        }
      });
      expect(mochart.hasConfigStructureChange(mochartConfig, removedConfig)).toBe(true);

      chart.update({ mochartConfig: removedConfig });
      settle();
      await expectSnapshot(container, demo.id, 'config-series-removed');

      // restoring the original config rebuilds back to the exact initial DOM
      const restoredConfig = buildMochartConfig(demo.config);
      expect(mochart.hasConfigStructureChange(removedConfig, restoredConfig)).toBe(true);

      chart.update({ mochartConfig: restoredConfig });
      settle();
      expect(normalizeHtml(container.innerHTML)).toBe(initialHtml);

      chart.destroy();
      expect(vi.getTimerCount(), 'timers left after destroy').toBe(0);
      expect(container.innerHTML).toBe('');
    });

    it('swaps the data source when animate is toggled at runtime', async () => {
      const animatedConfig = buildMochartConfig(demo.config);
      const staticConfig = buildMochartConfig(demo.config, { animate: false });
      const rows = loadJson(dataPaths[demo.data]);
      const { container, chart } = mountGrouped(animatedConfig, rows);

      // animate off + new data: the static source applies synchronously, no tween
      const changedRows = transformValues(staticConfig, rows);
      chart.update({ mochartConfig: staticConfig, dataProvider: makeProvider(changedRows) });
      const appliedHtml = normalizeHtml(container.innerHTML);
      settle();
      expect(normalizeHtml(container.innerHTML)).toBe(appliedHtml);
      await expectSnapshot(container, demo.id, 'config-animate-off');

      // animate back on with unchanged data settles to the same DOM, style attributes included — an emptied style removes its attribute, so neither path leaves style="" behind
      chart.update({ mochartConfig: animatedConfig });
      settle();
      expect(normalizeHtml(container.innerHTML)).toBe(appliedHtml);

      // and the next data change tweens again
      const tweenedRows = transformValues(animatedConfig, changedRows);
      chart.update({ dataProvider: makeProvider(tweenedRows) });
      advanceFrames(3);
      await expectSnapshot(container, demo.id, 'config-animate-on-mid-tween');
      settle();
      await expectSnapshot(container, demo.id, 'config-animate-on-settled');

      chart.destroy();
      expect(vi.getTimerCount(), 'timers left after destroy').toBe(0);
      expect(container.innerHTML).toBe('');
    });
  });
}

// ---------------------------------------------------------------------------
// Rotated category tick labels — the perpendicular truncation path, where the tick-label budget and
// the clip rect are sized from a fraction of a layout box rather than from the tick spacing. Every
// demo golden has parallel labels, so nothing else covers it.
// ---------------------------------------------------------------------------

const rotatedTickLabelVariants = [
  { stage: 'rotated', inverted: false },
  { stage: 'rotated-inverted', inverted: true }
];

export function describeRotatedTickLabelGoldens(): void {
  describe('rotated category tick labels', () => {
    // long category values, a title, a legend and truncation already on: only the rotation is missing
    const demo = allDemos.find((aDemo) => aDemo.id === 'truncated-text')!;

    it.each(rotatedTickLabelVariants)('truncates and clips $stage labels', async ({ stage, inverted }) => {
      const mochartConfig = buildMochartConfig(demo.config, {
        animate: false,
        mutate: (raw) => {
          raw.categoryAxis.tickLabel.rotation = 45;
          raw.plot.inverted = inverted;
        }
      });
      const rows = loadJson(dataPaths[demo.data]);
      const container = createContainer();

      const chart = mochart.createChart(container, {
        mochartConfig,
        dataProvider: makeProvider(rows),
        width: WIDTH,
        height: HEIGHT
      });

      // before any frame runs: the first sync renders untruncated, so the clip rect is the only
      // thing bounding the labels here
      await expectSnapshot(container, demo.id, stage + '-mount');
      settle();
      await expectSnapshot(container, demo.id, stage + '-settled');

      chart.destroy();
      expect(vi.getTimerCount(), 'timers left after destroy').toBe(0);
      expect(container.innerHTML).toBe('');
    });
  });
}
