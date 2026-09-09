import { readFile } from 'node:fs/promises';

import { byAria, charts, chartClass, demoText, expect, openDemo, openExportShareMenu, test } from './helpers';
import { mochartCssClasses } from '@mochart/core';

// Multi mode's export stitches the whole grid into ONE file — a different code
// path from the single-chart export demo-basic covers, in both formats (svg
// stitches serialized documents side by side, png composites onto one canvas).

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'multi');
  await expect(charts(page)).toHaveCount(4);
  // Every tile has to be drawn before the stitch reads it, not just mounted.
  await expect(page.locator(chartClass(mochartCssClasses.series))).not.toHaveCount(0);
});

for (const format of ['svg', 'png'] as const) {
  const button = format === 'svg' ? demoText.exportButtons.svg : demoText.exportButtons.png;
  test('the grid downloads as one stitched ' + format + ' file', async ({ page }) => {
    await openExportShareMenu(page);
    const downloadPromise = page.waitForEvent('download');
    await byAria(page, button.aria).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp('\\.' + format + '$'));
    if (format === 'svg') {
      // One outer document wrapping one nested svg per tile: all four grid
      // charts really did land in the single file, not just the focused one.
      const text = await readFile(await download.path(), 'utf8');
      expect(text.split('<svg').length - 1).toBe(5);
    }
  });
}
