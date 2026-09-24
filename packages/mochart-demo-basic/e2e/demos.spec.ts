import { mochartCssClasses } from '@mochart/core';
import demosJson from '@mochart/demo-data/demos.json' with { type: 'json' };
import type { DemoEntry } from './helpers';
import { test, expect, openDemo, smokeTag, chartClass } from './helpers';

const manifest = demosJson as { demos: DemoEntry[]; testDemos: DemoEntry[] };

// Cross-engine render smoke: this demo's labels are wide enough to truncate, so
// it exercises the SVG text-measurement path where engines diverge most.
const smokeDemoId = 'truncated-text';

// Test demos are ordinary valid configs (feature coverage), so they get the
// same assertions as the gallery demos.
const sections: { label: string; demos: DemoEntry[] }[] = [
  { label: 'demo', demos: manifest.demos },
  { label: 'test demo', demos: manifest.testDemos }
];

test.describe('demo gallery', () => {
  for (const { label, demos } of sections) {
    for (const demo of demos) {
      test('renders ' + label + ' "' + demo.title + '" (' + demo.id + ')', {
        tag: demo.id === smokeDemoId ? [smokeTag] : []
      }, async ({ page }) => {
        await openDemo(page, demo.id);
        await expect(page.locator('#errors')).toBeHidden();
        await expect(page.locator('#chart-host ' + chartClass(mochartCssClasses.series)).first()).toBeAttached();
      });
    }
  }
});

test('follows back and forward navigation through the demo hash', async ({ page }) => {
  const [first, second] = manifest.demos;
  await openDemo(page, first!.id);
  await page.locator('#demo-list button[data-id="' + second!.id + '"]').click();
  await expect(page.locator('#demo-title')).toHaveText(second!.title);
  await page.goBack();
  await expect(page.locator('#demo-title')).toHaveText(first!.title);
  await page.goForward();
  await expect(page.locator('#demo-title')).toHaveText(second!.title);
});
