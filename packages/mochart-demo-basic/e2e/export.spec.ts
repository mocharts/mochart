import { mochartCssClasses } from '@mochart/core';
import { test, expect, openDemo, smokeTag, chartClass } from './helpers';

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'stacked');
  await expect(page.locator('#chart-host ' + chartClass(mochartCssClasses.series)).first()).toBeAttached();
});

test('the SVG button downloads the chart as an svg file', { tag: smokeTag }, async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-svg').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
});

test('the PNG button downloads the chart as a png file', { tag: smokeTag }, async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
