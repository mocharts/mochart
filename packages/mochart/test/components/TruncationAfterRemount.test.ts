/**
 * An axis title, axis tick labels or a legend item created by an update (a front move, a renamed series,
 * the plot replacing an empty one) must truncate even when no later render gives it new props: updating
 * to a config reaches the same text as building it directly.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installFakeFrameClock, runFrames, mountContainer } from './helpers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MochartInputConfig } from '../../src';
import { getCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';
import type { MochartCssClassKey } from '../../src/utils/ChartDom';
import { installTextMetrics } from '../golden/textMetrics';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, '../../../mochart-demo-data/src/config/truncated-text-config.json');
const dataPath = path.resolve(here, '../../../mochart-demo-data/src/data/long-category-string-values-data.json');

const TRUNCATION_TEXT = '...';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installTextMetrics();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function loadJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function baseConfig(): Record<string, any> {
  const config = mochart.migrateConfig(loadJson(configPath)) as Record<string, any>;
  config.valueAxes = [config.valueAxes];
  config.animation = { ...config.animation, enabled: false };
  config.legend.truncation = { enabled: true, text: TRUNCATION_TEXT, maxFraction: 0.15 };
  return config;
}

function selector(...classKeys: MochartCssClassKey[]): string {
  return getDescendantCssSelector(...classKeys) + ' text';
}

// the drawn text only, without the tooltip's <title> child
function drawnTexts(container: Element, textSelector: string): string[] {
  return [...container.querySelectorAll(textSelector)].map(text =>
    [...text.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(''));
}

function render<T>(configs: Record<string, any>[], read: (container: Element) => T): T {
  const container = mountContainer();
  const enhance = (config: Record<string, any>) => mochart.enhanceConfig(structuredClone(config) as MochartInputConfig);
  const chart = mochart.createChart(container, { mochartConfig: enhance(configs[0]),
    dataProvider: new mochart.ArrayOfObjectsDataProvider(loadJson(dataPath)), width: 800, height: 600 });
  runFrames();
  for (const config of configs.slice(1)) {
    chart.update({ mochartConfig: enhance(config) });
    runFrames();
  }
  const result = read(container);
  chart.destroy();
  container.remove();
  return result;
}

describe('truncation of parts created by an update', () => {
  it('truncates a value axis title moved to the front', () => {
    const base = baseConfig();
    const moved = baseConfig();
    moved.valueAxes[0].title.front = true;
    const read = (container: Element) => drawnTexts(container, selector('axisTitle'));
    const built = render([moved], read);
    expect(built.filter(text => text.startsWith('A Value') && text.endsWith(TRUNCATION_TEXT))).toHaveLength(1);
    expect(render([base, moved], read)).toEqual(built);
  });

  it('truncates category axis tick labels moved to the front and back', () => {
    const base = baseConfig();
    const moved = baseConfig();
    moved.categoryAxis.tickLabel.front = true;
    const read = (container: Element) => drawnTexts(container, selector('categoryAxis', 'axisTickLabel'));
    const built = render([base], read);
    expect(built.some(text => text.endsWith(TRUNCATION_TEXT))).toBe(true);
    expect(render([base, moved, base], read)).toEqual(built);
  });

  it('truncates the legend item of a renamed series', () => {
    const base = baseConfig();
    const renamed = baseConfig();
    renamed.series[0].id = 'renamed';
    const read = (container: Element) => drawnTexts(container, selector('legendItemText'));
    const built = render([renamed], read);
    expect(built.every(text => text.endsWith(TRUNCATION_TEXT))).toBe(true);
    expect(render([base, renamed], read)).toEqual(built);
  });

  // animated, the first render draws the axes in an empty plot, and the plot that replaces it creates them again
  it('truncates the value axis title of an animated build with hidden value axis tick labels', () => {
    const config = baseConfig();
    config.animation = { ...config.animation, enabled: true };
    config.valueAxes[0].tickLabel = { ...config.valueAxes[0].tickLabel, visible: false };
    const titles = render([config], container => drawnTexts(container, selector('axisTitle')));
    expect(titles.filter(text => text.startsWith('A Value') && text.endsWith(TRUNCATION_TEXT))).toHaveLength(1);
  });

  // the layout reads the drawn label sizes, so it must see the labels truncated
  it('lays out rotated category axis tick labels moved to the front for their truncated size', () => {
    const base = baseConfig();
    base.categoryAxis.tickLabel.rotation = -45;
    const moved = structuredClone(base);
    moved.categoryAxis.tickLabel.front = true;
    const read = (container: Element) => ({
      labels: drawnTexts(container, selector('categoryAxis', 'axisTickLabel')),
      axisPositions: [...container.querySelectorAll(getCssSelector('categoryAxis') + ' > g')].map(group => group.getAttribute('transform'))
    });
    const built = render([moved], read);
    expect(built.labels.some(text => text.endsWith(TRUNCATION_TEXT))).toBe(true);
    expect(built.axisPositions.length).toBeGreaterThan(0);
    expect(render([base, moved], read)).toEqual(built);
  });
});
