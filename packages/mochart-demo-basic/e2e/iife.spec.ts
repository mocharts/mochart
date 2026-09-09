import { createRequire } from 'node:module';
import { mochartCssClasses } from '@mochart/core';
import { test, expect, smokeTag, chartClass } from './helpers';

const require = createRequire(import.meta.url);

/** A published artifact, resolved through its real export subpath. */
function artifactPath(subpath: string): string {
  try {
    return require.resolve(subpath);
  } catch {
    throw new Error(subpath + ' did not resolve — build the library packages first (root npm ci or build:libs)');
  }
}

// Executes the built bundle nothing else runs: injected as a classic script,
// it must define the `mochart` global and render without any bundler help.
test('the iife bundle renders a chart through the mochart global', { tag: smokeTag }, async ({ page }) => {
  await page.goto('about:blank');
  await page.addStyleTag({ path: artifactPath('@mochart/core/mochart.css') });
  await page.addScriptTag({ path: artifactPath('@mochart/core/mochart.iife.js') });
  await page.evaluate(() => {
    const mochart = (window as { mochart?: typeof import('@mochart/core') }).mochart;
    if (!mochart) {
      throw new Error('iife script did not define the mochart global');
    }
    const container = document.createElement('div');
    container.id = 'iife-chart';
    document.body.appendChild(container);
    mochart.createDefaultChart(container, {
      width: 640,
      height: 360,
      config: {
        categoryAxis: { property: 'category', type: 'string', scale: 'ordinal' },
        seriesDefaults: { renderer: 'bar' },
        series: [
          { property: 'alpha', title: 'Alpha' },
          { property: 'beta', title: 'Beta' }
        ]
      },
      data: [
        { category: 'A', alpha: 3, beta: 1 },
        { category: 'B', alpha: 5, beta: 2 },
        { category: 'C', alpha: 2, beta: 4 }
      ]
    });
  });
  await expect(page.locator('#iife-chart ' + chartClass(mochartCssClasses.chart))).toBeVisible();
  await expect(page.locator('#iife-chart ' + chartClass(mochartCssClasses.series))).toHaveCount(2);
});
