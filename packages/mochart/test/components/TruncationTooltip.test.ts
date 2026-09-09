/**
 * The native tooltip on truncated text: while a group's truncation.tooltipEnabled is on, a text element
 * whose drawn string was truncated carries an svg <title> holding the full string, so a resting pointer shows
 * it. Text that fits carries none, and each group's switch acts on its own text only.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakeFrameClock, runFrames, mountContainer, trackHandle } from './helpers';
import { installTextMetrics, getRenderedText } from '../golden/textMetrics';
import { getCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';
import type { MochartInputConfig } from '../../src';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, '../../../mochart-demo-data/src/config/truncated-text-config.json');
const dataPath = path.resolve(here, '../../../mochart-demo-data/src/data/long-category-string-values-data.json');

let mochart: typeof import('../../src');

beforeAll(async () => {
  installTextMetrics();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function loadJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// 320px wide: the demo's title, legend items and axis titles all overflow that in the synthetic golden font
function mountChart(editConfig: (config: EnhancedMochartConfig) => void = () => undefined, width = 320) {
  const config = mochart.migrateConfig(loadJson(configPath)) as MochartInputConfig;
  const mochartConfig = mochart.enhanceConfig(config) as EnhancedMochartConfig;
  editConfig(mochartConfig);
  const rows: Record<string, any>[] = loadJson(dataPath);
  const container = mountContainer();
  const chart = trackHandle(mochart.createChart(container, {
    mochartConfig, dataProvider: new mochart.ArrayOfObjectsDataProvider(rows), width, height: 600
  }));
  // truncation is only checked after an update; the animation frames supply them
  runFrames();
  return { container, chart, mochartConfig, rows };
}

const TITLE_TEXT = getCssSelector('titleText');
const LEGEND_TEXTS = getCssSelector('legendItemText') + ' text';
const CATEGORY_TICK_TEXTS = getDescendantCssSelector('categoryAxis', 'axisTickLabel') + ' text';
const VALUE_TICK_TEXTS = getDescendantCssSelector('valueAxis', 'axisTickLabel') + ' text';
const CATEGORY_TITLE_TEXT = getDescendantCssSelector('categoryAxis', 'axisTitle') + ' text';
const VALUE_TITLE_TEXT = getDescendantCssSelector('valueAxis', 'axisTitle') + ' text';

function tooltipOf(text: Element): string | null {
  const title = [...text.children].find(child => child.tagName === 'title');
  return title === undefined ? null : title.textContent;
}

function texts(container: Element, selector: string): Element[] {
  return [...container.querySelectorAll(selector)];
}

function isHidden(text: Element): boolean {
  return (text.getAttribute('style') ?? '').includes('hidden');
}

/** a truncated text carries its full string; text that fits, and an overlap-suppressed hidden label, carry none */
function expectTooltipIffTruncated(text: Element, fullText: string): boolean {
  const truncated = getRenderedText(text) !== fullText;
  expect(tooltipOf(text), fullText).toBe(truncated && !isHidden(text) ? fullText : null);
  return truncated;
}

describe('the native tooltip on truncated text', () => {
  it('gives every truncated text a <title> holding its full string, and text that fits none', () => {
    const { container, mochartConfig, rows } = mountChart();

    expect(expectTooltipIffTruncated(container.querySelector(TITLE_TEXT)!, mochartConfig.title.text!)).toBe(true);
    expect(expectTooltipIffTruncated(container.querySelector(CATEGORY_TITLE_TEXT)!, mochartConfig.categoryAxis.title.text!)).toBe(true);
    expect(expectTooltipIffTruncated(container.querySelector(VALUE_TITLE_TEXT)!, mochartConfig.valueAxes[0].title.text!)).toBe(true);

    const tickTexts = texts(container, CATEGORY_TICK_TEXTS);
    expect(tickTexts.length).toBe(rows.length);
    const truncatedTicks = tickTexts.filter((text, i) => expectTooltipIffTruncated(text, String(rows[i].categoryDisplay)));
    expect(truncatedTicks.length).toBeGreaterThan(0);
    // the fixture must include an overlap-suppressed label that is also truncated, or the hidden case above is vacuous
    const hiddenTruncatedTicks = truncatedTicks.filter(isHidden);
    expect(hiddenTruncatedTicks.length).toBeGreaterThan(0);
    expect(hiddenTruncatedTicks.every(text => tooltipOf(text) === null)).toBe(true);

    const legendTexts = texts(container, LEGEND_TEXTS);
    expect(legendTexts.length).toBe(mochartConfig.series.length);
    const truncatedItems = legendTexts.filter((text, i) => expectTooltipIffTruncated(text, mochartConfig.series[i].title!));
    expect(truncatedItems.length).toBeGreaterThan(0);
    expect(truncatedItems.length).toBeLessThan(legendTexts.length);

    // value tick labels never truncate
    const valueTickTexts = texts(container, VALUE_TICK_TEXTS);
    expect(valueTickTexts.length).toBeGreaterThan(0);
    expect(valueTickTexts.every(text => tooltipOf(text) === null)).toBe(true);

    // no text anywhere carries a <title> equal to what it already draws, and a hidden text carries none
    for (const text of texts(container, 'text')) {
      const tooltip = tooltipOf(text);
      if (tooltip !== null) {
        expect(tooltip).not.toBe(getRenderedText(text));
        expect(isHidden(text)).toBe(false);
      }
    }
  });

  it('drops the <title> once the text fits', () => {
    const { container, chart, mochartConfig } = mountChart();
    expect(texts(container, 'text > title').length).toBeGreaterThan(0);

    // taller as well: the value axis title runs along the chart height
    chart.update({ width: 6000, height: 3000 });
    runFrames();

    expect(getRenderedText(container.querySelector(TITLE_TEXT)!)).toBe(mochartConfig.title.text);
    expect(texts(container, 'text > title').length).toBe(0);
  });

  it('lets each group switch off its own tooltips without touching the others', () => {
    const { container } = mountChart(config => {
      config.legend.truncation.tooltipEnabled = false;
    });
    expect(texts(container, LEGEND_TEXTS + ' > title').length).toBe(0);
    expect(tooltipOf(container.querySelector(TITLE_TEXT)!)).not.toBeNull();
    expect(tooltipOf(container.querySelector(CATEGORY_TITLE_TEXT)!)).not.toBeNull();
    expect(tooltipOf(container.querySelector(VALUE_TITLE_TEXT)!)).not.toBeNull();
    expect(texts(container, CATEGORY_TICK_TEXTS + ' > title').length).toBeGreaterThan(0);

    const { container: offContainer, mochartConfig } = mountChart(config => {
      config.title.truncation.tooltipEnabled = false;
      config.legend.truncation.tooltipEnabled = false;
      config.categoryAxis.tickLabel.truncation.tooltipEnabled = false;
      config.categoryAxis.title.truncation.tooltipEnabled = false;
      for (const valueAxisConfig of config.valueAxes) {
        valueAxisConfig.title.truncation.tooltipEnabled = false;
      }
    });
    expect(texts(offContainer, 'text > title').length).toBe(0);
    // the text is still truncated; only the tooltip is gone
    expect(getRenderedText(offContainer.querySelector(TITLE_TEXT)!)).not.toBe(mochartConfig.title.text);
  });

  it('shows the tooltip regardless of the accessibility switch, since it is a pointer affordance', () => {
    const { container, mochartConfig } = mountChart(config => {
      config.accessibility.enabled = false;
    });
    expect(tooltipOf(container.querySelector(TITLE_TEXT)!)).toBe(mochartConfig.title.text);
    expect(container.querySelectorAll('[aria-hidden], [aria-label], [role]').length).toBe(0);
  });
});
