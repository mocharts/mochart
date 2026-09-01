import { mochartCssClasses } from '@mochart/core';
import { test, expect, chartClass, openDemo } from './helpers';

// The same three checks against every framework gallery: the binding mounts a
// chart, updates it, and wires its interaction, without throwing or logging an
// error. Everything deeper (editor, share links, export, keyboard, phone
// layout) lives in the vanilla and basic suites; this suite exists to catch a
// binding that builds fine and breaks at runtime.

const titleTextSelector = chartClass(mochartCssClasses.titleText);
const seriesSelector = chartClass(mochartCssClasses.series);
const seriesBarSelector = chartClass(mochartCssClasses.seriesBar);
const plotBackgroundSelector = chartClass(mochartCssClasses.plotBackground);
const tooltipSelector = chartClass(mochartCssClasses.tooltip);
const tooltipSeriesLines = `${tooltipSelector} ${chartClass(mochartCssClasses.tooltipSeriesLine)}`;
const legendItemSelector = chartClass(mochartCssClasses.legendItem);

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'stacked');
  await expect(page.locator(seriesBarSelector).first()).toBeAttached();
});

test('renders the demo with its title and more than one series', async ({ page }) => {
  await expect(page.locator(titleTextSelector)).not.toHaveText('');
  expect(await page.locator(seriesSelector).count()).toBeGreaterThan(1);
});

test('clicking the plot opens a tooltip with one line per series', async ({ page }) => {
  const box = await page.locator(plotBackgroundSelector).boundingBox();
  if (!box) {
    throw new Error('plot background has no bounding box');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator(tooltipSelector)).toBeVisible();
  const seriesCount = await page.locator(seriesSelector).count();
  await expect(page.locator(tooltipSeriesLines)).toHaveCount(seriesCount);
});

test('clicking a legend item filters the series out and back in', async ({ page }) => {
  const series = page.locator(seriesSelector);
  const initialCount = await series.count();
  expect(initialCount).toBeGreaterThan(1);

  const firstLegendItem = page.locator(legendItemSelector).first();
  await firstLegendItem.click();
  await expect(series).toHaveCount(initialCount - 1);

  await firstLegendItem.click();
  await expect(series).toHaveCount(initialCount);
});
